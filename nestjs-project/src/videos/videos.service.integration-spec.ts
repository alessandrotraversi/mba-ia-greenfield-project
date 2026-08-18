import Bull from 'bull';
import type { Queue } from 'bull';
import { DataSource, Repository } from 'typeorm';
import { Client } from 'minio';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelsService } from '../channels/channels.service';
import { User } from '../users/entities/user.entity';
import {
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { Video, VideoStatus } from './entities/video.entity';
import { VideosService } from './videos.service';
import { VIDEO_PROCESSING_QUEUE, PROCESS_VIDEO_JOB } from './videos.constants';

const ALL_ENTITIES = [User, Channel, Video];

describe('VideosService (integration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;
  let videoRepository: Repository<Video>;
  let videosService: VideosService;
  let channelsService: ChannelsService;
  let videoProcessingQueue: Queue;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
    videoRepository = dataSource.getRepository(Video);

    channelsService = new ChannelsService(dataSource);

    const minioClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'minio',
      port: 9000,
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    });

    const bucket = process.env.MINIO_BUCKET ?? 'streamtube-videos';
    const bucketExists = await minioClient.bucketExists(bucket);
    if (!bucketExists) {
      await minioClient.makeBucket(bucket);
    }

    videoProcessingQueue = new Bull(VIDEO_PROCESSING_QUEUE, {
      redis: {
        host: process.env.REDIS_HOST ?? 'redis',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    });

    videosService = new VideosService(
      videoRepository,
      minioClient as unknown as Client,
      {
        endpoint: process.env.MINIO_ENDPOINT ?? 'minio',
        accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
        bucket: process.env.MINIO_BUCKET ?? 'streamtube-videos',
      },
      channelsService,
      videoProcessingQueue,
    );
  });

  afterAll(async () => {
    await videoProcessingQueue.close();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    await videoProcessingQueue.empty();
  });

  let counter = 0;
  async function createChannel(): Promise<Channel> {
    const user = await userRepository.save(
      userRepository.create({
        email: `upload_session_user_${++counter}@example.com`,
        password: 'hashed',
      }),
    );
    return channelRepository.save(
      channelRepository.create({
        name: `Channel ${counter}`,
        nickname: `upload_channel_${counter}`,
        user_id: user.id,
      }),
    );
  }

  it('should persist a draft Video row with the correct storageKey and return a presigned upload URL', async () => {
    const channel = await createChannel();

    const result = await videosService.createUploadSession(channel.user_id, {
      fileName: 'my-video.mp4',
      contentType: 'video/mp4',
      fileSizeBytes: 1024 * 1024,
    });

    expect(result.videoId).toBeDefined();
    expect(result.storageKey).toBe(
      `channels/${channel.id}/videos/${result.videoId}.mp4`,
    );
    expect(result.uploadUrl).toContain('http');
    expect(result.expiresAt).toBeInstanceOf(Date);

    const persisted = await videoRepository.findOneBy({ id: result.videoId });
    expect(persisted).not.toBeNull();
    expect(persisted?.status).toBe('draft');
    expect(persisted?.storage_key).toBe(result.storageKey);
    expect(persisted?.channel_id).toBe(channel.id);
  });

  it('markProcessing transitions a draft video to processing and enqueues the process-video job', async () => {
    const channel = await createChannel();
    const draft = await videoRepository.save(
      videoRepository.create({
        channel_id: channel.id,
        storage_key: `channels/${channel.id}/videos/placeholder.mp4`,
        status: VideoStatus.DRAFT,
      }),
    );

    await videosService.markProcessing(draft.id);

    const persisted = await videoRepository.findOneBy({ id: draft.id });
    expect(persisted?.status).toBe(VideoStatus.PROCESSING);

    const jobs = await videoProcessingQueue.getJobs([
      'waiting',
      'active',
      'completed',
      'failed',
    ]);
    const job = jobs.find(
      (j) => (j.data as { videoId: string }).videoId === draft.id,
    );
    expect(job).toBeDefined();
    expect(job?.name).toBe(PROCESS_VIDEO_JOB);
  });

  it('markProcessing ignores a videoId with no matching draft video without throwing', async () => {
    await expect(
      videosService.markProcessing('00000000-0000-0000-0000-000000000000'),
    ).resolves.toBeUndefined();

    const waitingJobs = await videoProcessingQueue.getJobs(['waiting']);
    expect(waitingJobs).toHaveLength(0);
  });
});
