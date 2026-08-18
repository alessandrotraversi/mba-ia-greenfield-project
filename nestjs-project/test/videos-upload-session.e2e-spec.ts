import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { Channel } from '../src/channels/entities/channel.entity';
import { Video } from '../src/videos/entities/video.entity';
import { cleanAllTables } from '../src/test/create-test-data-source';

const TEN_GB = 10 * 1024 ** 3;

describe('POST /videos/upload-session (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let channelRepository: Repository<Channel>;
  let videoRepository: Repository<Video>;
  let throttlerStorage: ThrottlerStorageService;

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
    channelRepository = dataSource.getRepository(Channel);
    videoRepository = dataSource.getRepository(Video);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
  });

  async function captureConfirmationToken(
    email: string,
    password = 'password123',
  ): Promise<string> {
    const authService = app.get(AuthService);
    const mailServiceInstance = (authService as any).mailService;
    let capturedToken = '';
    jest
      .spyOn(mailServiceInstance, 'sendConfirmationEmail')
      .mockImplementationOnce(async (_e: string, _n: string, t: string) => {
        capturedToken = t;
      });
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password });
    return capturedToken;
  }

  async function registerConfirmAndLogin(
    email: string,
    password = 'password123',
  ): Promise<string> {
    const token = await captureConfirmationToken(email, password);
    await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return res.body.access_token;
  }

  it('create-upload-session-success: returns 201 with videoId/uploadUrl/expiresAt/storageKey and persists a draft Video row', async () => {
    const accessToken = await registerConfirmAndLogin(
      'upload-success@example.com',
    );

    const res = await request(app.getHttpServer())
      .post('/videos/upload-session')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fileName: 'my-video.mp4',
        contentType: 'video/mp4',
        fileSizeBytes: 1024 * 1024,
      })
      .expect(201);

    expect(res.body.videoId).toBeDefined();
    expect(res.body.uploadUrl).toBeDefined();
    expect(res.body.expiresAt).toBeDefined();
    expect(res.body.storageKey).toBeDefined();

    const channel = await channelRepository.findOneBy({});
    expect(res.body.storageKey).toBe(
      `channels/${channel?.id}/videos/${res.body.videoId}.mp4`,
    );

    const video = await videoRepository.findOneBy({ id: res.body.videoId });
    expect(video).not.toBeNull();
    expect(video?.status).toBe('draft');
  });

  it('file-too-large-rejected: returns 400 with FILE_TOO_LARGE and creates no Video row', async () => {
    const accessToken = await registerConfirmAndLogin(
      'file-too-large@example.com',
    );

    const res = await request(app.getHttpServer())
      .post('/videos/upload-session')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fileName: 'huge-video.mp4',
        contentType: 'video/mp4',
        fileSizeBytes: TEN_GB + 1,
      })
      .expect(400);

    expect(res.body.error).toBe('FILE_TOO_LARGE');

    const videoCount = await videoRepository.count();
    expect(videoCount).toBe(0);
  });

  it('unsupported-content-type-rejected: returns 400 with UNSUPPORTED_CONTENT_TYPE', async () => {
    const accessToken = await registerConfirmAndLogin(
      'unsupported-content-type@example.com',
    );

    const res = await request(app.getHttpServer())
      .post('/videos/upload-session')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fileName: 'document.pdf',
        contentType: 'application/pdf',
        fileSizeBytes: 1024,
      })
      .expect(400);

    expect(res.body.error).toBe('UNSUPPORTED_CONTENT_TYPE');
  });

  it('unauthenticated-request-rejected: returns 401 without an Authorization header', async () => {
    await request(app.getHttpServer())
      .post('/videos/upload-session')
      .send({
        fileName: 'my-video.mp4',
        contentType: 'video/mp4',
        fileSizeBytes: 1024,
      })
      .expect(401);
  });
});
