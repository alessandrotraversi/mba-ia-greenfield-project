import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import type { Client } from 'minio';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { User } from '../src/users/entities/user.entity';
import { Channel } from '../src/channels/entities/channel.entity';
import { Video, VideoStatus } from '../src/videos/entities/video.entity';
import { MINIO_CLIENT } from '../src/storage/storage.module';
import storageConfig from '../src/config/storage.config';
import type { ConfigType } from '@nestjs/config';
import { cleanAllTables } from '../src/test/create-test-data-source';

const FIXTURE_CONTENT = Buffer.alloc(4096, 'a');

describe('GET /videos/:id/stream (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;
  let videoRepository: Repository<Video>;
  let minioClient: Client;
  let bucket: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new DomainExceptionFilter(),
      new ValidationExceptionFilter(),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
    videoRepository = dataSource.getRepository(Video);
    minioClient = moduleFixture.get<Client>(MINIO_CLIENT);
    bucket = moduleFixture.get<ConfigType<typeof storageConfig>>(
      storageConfig.KEY,
    ).bucket;
  });

  afterAll(async () => {
    await app.close();
  });

  let counter = 0;
  let readyVideoId: string;
  let processingVideoId: string;

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    counter += 1;

    const user = await userRepository.save(
      userRepository.create({
        email: `stream_user_${counter}@example.com`,
        password: 'hashed',
      }),
    );
    const channel = await channelRepository.save(
      channelRepository.create({
        name: `Stream Channel ${counter}`,
        nickname: `stream_channel_${counter}`,
        user_id: user.id,
      }),
    );

    readyVideoId = randomUUID();
    const readyStorageKey = `channels/${channel.id}/videos/${readyVideoId}.mp4`;
    await minioClient.putObject(bucket, readyStorageKey, FIXTURE_CONTENT);
    await videoRepository.save(
      videoRepository.create({
        id: readyVideoId,
        channel_id: channel.id,
        storage_key: readyStorageKey,
        status: VideoStatus.READY,
        file_size_bytes: String(FIXTURE_CONTENT.length),
      }),
    );

    processingVideoId = randomUUID();
    await videoRepository.save(
      videoRepository.create({
        id: processingVideoId,
        channel_id: channel.id,
        storage_key: `channels/${channel.id}/videos/${processingVideoId}.mp4`,
        status: VideoStatus.PROCESSING,
      }),
    );
  });

  it('full-content-stream-success: returns 200 with the full video byte stream', async () => {
    const res = await request(app.getHttpServer())
      .get(`/videos/${readyVideoId}/stream`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/^video\//);
    expect(res.body).toBeInstanceOf(Buffer);
    expect((res.body as Buffer).length).toBe(FIXTURE_CONTENT.length);
  });

  it('partial-content-range-request: returns 206 with the requested byte range', async () => {
    const res = await request(app.getHttpServer())
      .get(`/videos/${readyVideoId}/stream`)
      .set('Range', 'bytes=0-1023')
      .expect(206);

    expect(res.headers['content-range']).toBe(
      `bytes 0-1023/${FIXTURE_CONTENT.length}`,
    );
    expect((res.body as Buffer).length).toBe(1024);
  });

  it('video-not-found: returns 404 with VIDEO_NOT_FOUND', async () => {
    const res = await request(app.getHttpServer())
      .get(`/videos/${randomUUID()}/stream`)
      .expect(404);

    expect((res.body as { error: string }).error).toBe('VIDEO_NOT_FOUND');
  });

  it('video-not-ready: returns 409 with VIDEO_NOT_READY', async () => {
    const res = await request(app.getHttpServer())
      .get(`/videos/${processingVideoId}/stream`)
      .expect(409);

    expect((res.body as { error: string }).error).toBe('VIDEO_NOT_READY');
  });

  it('anonymous-access-allowed: succeeds without an Authorization header', async () => {
    await request(app.getHttpServer())
      .get(`/videos/${readyVideoId}/stream`)
      .expect(200);
  });
});
