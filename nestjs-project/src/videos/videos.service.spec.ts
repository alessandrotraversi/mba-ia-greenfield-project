import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import storageConfig from '../config/storage.config';
import { MINIO_CLIENT } from '../storage/storage.module';
import { Video, VideoStatus } from './entities/video.entity';
import {
  FileTooLargeException,
  UnsupportedContentTypeException,
  VideoNotFoundException,
  VideoNotReadyException,
} from './exceptions/video.exception';
import { VideosService } from './videos.service';
import { VIDEO_PROCESSING_QUEUE } from './videos.constants';

const TEN_GB = 10 * 1024 ** 3;

describe('VideosService — createUploadSession', () => {
  let videosService: VideosService;
  let videoRepository: jest.Mocked<Repository<Video>>;
  let minioClient: { presignedPutObject: jest.Mock };
  let channelsService: jest.Mocked<ChannelsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        VideosService,
        {
          provide: getRepositoryToken(Video),
          useValue: {
            create: jest.fn((data) => data),
            save: jest.fn().mockResolvedValue({}),
            findOneBy: jest.fn(),
          },
        },
        {
          provide: MINIO_CLIENT,
          useValue: {
            presignedPutObject: jest.fn(),
          },
        },
        {
          provide: storageConfig.KEY,
          useValue: { bucket: 'streamtube-videos' },
        },
        {
          provide: ChannelsService,
          useValue: {
            findByUserId: jest.fn(),
          },
        },
        {
          provide: getQueueToken(VIDEO_PROCESSING_QUEUE),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    videosService = module.get(VideosService);
    videoRepository = module.get(getRepositoryToken(Video));
    minioClient = module.get(MINIO_CLIENT);
    channelsService = module.get(ChannelsService);
  });

  it('should throw FileTooLargeException and never touch the repository or MinIO when fileSizeBytes exceeds 10GB', async () => {
    await expect(
      videosService.createUploadSession('user-1', {
        fileName: 'movie.mp4',
        contentType: 'video/mp4',
        fileSizeBytes: TEN_GB + 1,
      }),
    ).rejects.toThrow(FileTooLargeException);

    expect(channelsService.findByUserId).not.toHaveBeenCalled();
    expect(videoRepository.save).not.toHaveBeenCalled();
    expect(minioClient.presignedPutObject).not.toHaveBeenCalled();
  });

  it('should throw UnsupportedContentTypeException and never touch the repository or MinIO for a non-video contentType', async () => {
    await expect(
      videosService.createUploadSession('user-1', {
        fileName: 'document.pdf',
        contentType: 'application/pdf',
        fileSizeBytes: 1024,
      }),
    ).rejects.toThrow(UnsupportedContentTypeException);

    expect(channelsService.findByUserId).not.toHaveBeenCalled();
    expect(videoRepository.save).not.toHaveBeenCalled();
    expect(minioClient.presignedPutObject).not.toHaveBeenCalled();
  });

  describe('getStreamableVideo', () => {
    it('throws VideoNotFoundException when no video exists with the given id', async () => {
      videoRepository.findOneBy.mockResolvedValueOnce(null);

      await expect(
        videosService.getStreamableVideo('missing-id'),
      ).rejects.toThrow(VideoNotFoundException);
    });

    it('throws VideoNotReadyException when the video status is not ready', async () => {
      videoRepository.findOneBy.mockResolvedValueOnce({
        id: 'video-1',
        status: VideoStatus.PROCESSING,
      } as Video);

      await expect(videosService.getStreamableVideo('video-1')).rejects.toThrow(
        VideoNotReadyException,
      );
    });

    it('returns the video when it exists and is ready', async () => {
      const readyVideo = { id: 'video-1', status: VideoStatus.READY } as Video;
      videoRepository.findOneBy.mockResolvedValueOnce(readyVideo);

      await expect(videosService.getStreamableVideo('video-1')).resolves.toBe(
        readyVideo,
      );
    });
  });
});
