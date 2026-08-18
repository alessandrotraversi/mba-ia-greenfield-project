import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import execa from 'execa';
import type { Job } from 'bull';
import { DataSource, Repository } from 'typeorm';
import { Client } from 'minio';
import { Channel } from '../channels/entities/channel.entity';
import { User } from '../users/entities/user.entity';
import {
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { Video, VideoStatus } from './entities/video.entity';
import { VideoProcessorService } from './video-processor.service';

const ALL_ENTITIES = [User, Channel, Video];

describe('VideoProcessorService (integration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;
  let videoRepository: Repository<Video>;
  let minioClient: Client;
  let bucket: string;
  let processor: VideoProcessorService;
  let fixtureDir: string;
  let validFixturePath: string;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
    videoRepository = dataSource.getRepository(Video);

    minioClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'minio',
      port: 9000,
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    });
    bucket = process.env.MINIO_BUCKET ?? 'streamtube-videos';
    const bucketExists = await minioClient.bucketExists(bucket);
    if (!bucketExists) {
      await minioClient.makeBucket(bucket);
    }

    processor = new VideoProcessorService(videoRepository, minioClient, {
      endpoint: process.env.MINIO_ENDPOINT ?? 'minio',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
      bucket,
    });

    fixtureDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'video-processor-fixtures-'),
    );
    validFixturePath = path.join(fixtureDir, 'valid.mp4');
    await execa('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=2:size=320x240:rate=10',
      '-pix_fmt',
      'yuv420p',
      validFixturePath,
    ]);
  });

  afterAll(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  let counter = 0;
  async function createChannel(): Promise<Channel> {
    const user = await userRepository.save(
      userRepository.create({
        email: `video_processor_user_${++counter}@example.com`,
        password: 'hashed',
      }),
    );
    return channelRepository.save(
      channelRepository.create({
        name: `Channel ${counter}`,
        nickname: `video_processor_channel_${counter}`,
        user_id: user.id,
      }),
    );
  }

  it('processes a valid uploaded video: extracts duration, generates thumbnail, transitions to ready', async () => {
    const channel = await createChannel();
    const videoId = randomUUID();
    const storageKey = `channels/${channel.id}/videos/${videoId}.mp4`;
    const expectedThumbnailKey = `channels/${channel.id}/thumbnails/${videoId}.jpg`;

    await minioClient.fPutObject(bucket, storageKey, validFixturePath);
    await videoRepository.save(
      videoRepository.create({
        id: videoId,
        channel_id: channel.id,
        storage_key: storageKey,
        status: VideoStatus.PROCESSING,
      }),
    );

    await processor.handleProcessVideo({
      data: { videoId },
    } as Job<{ videoId: string }>);

    const persisted = await videoRepository.findOneBy({ id: videoId });
    expect(persisted?.status).toBe(VideoStatus.READY);
    expect(persisted?.duration_seconds).toBeGreaterThanOrEqual(1);
    expect(persisted?.duration_seconds).toBeLessThanOrEqual(3);
    expect(persisted?.thumbnail_key).toBe(expectedThumbnailKey);
    expect(persisted?.file_size_bytes).not.toBeNull();
    expect(Number(persisted?.file_size_bytes)).toBeGreaterThan(0);

    const thumbnailStat = await minioClient.statObject(
      bucket,
      expectedThumbnailKey,
    );
    expect(thumbnailStat.size).toBeGreaterThan(0);
  });

  it('processing a corrupt file sets status to error, increments processingAttempts, and records lastError from stderr', async () => {
    const channel = await createChannel();
    const videoId = randomUUID();
    const storageKey = `channels/${channel.id}/videos/${videoId}.mp4`;

    await minioClient.putObject(
      bucket,
      storageKey,
      Buffer.from('this is not a real video file'),
    );
    await videoRepository.save(
      videoRepository.create({
        id: videoId,
        channel_id: channel.id,
        storage_key: storageKey,
        status: VideoStatus.PROCESSING,
      }),
    );

    await processor.handleProcessVideo({
      data: { videoId },
    } as Job<{ videoId: string }>);

    const persisted = await videoRepository.findOneBy({ id: videoId });
    expect(persisted?.status).toBe(VideoStatus.ERROR);
    expect(persisted?.processing_attempts).toBe(1);
    expect(persisted?.last_error).toEqual(expect.any(String));
    expect(persisted?.last_error?.length).toBeGreaterThan(0);
  });
});
