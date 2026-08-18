import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { ConfigType } from '@nestjs/config';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import type { Client } from 'minio';
import { ChannelsService } from '../channels/channels.service';
import { MINIO_CLIENT } from '../storage/storage.module';
import storageConfig from '../config/storage.config';
import { Video, VideoStatus } from './entities/video.entity';
import { CreateUploadSessionDto } from './dto/create-upload-session.dto';
import {
  FileTooLargeException,
  UnsupportedContentTypeException,
  VideoNotFoundException,
  VideoNotReadyException,
  RangeNotSatisfiableException,
} from './exceptions/video.exception';
import { VIDEO_PROCESSING_QUEUE, PROCESS_VIDEO_JOB } from './videos.constants';

const MAX_FILE_SIZE_BYTES = 10 * 1024 ** 3;
const PRESIGNED_URL_EXPIRY_SECONDS = 2 * 60 * 60;
const VIDEO_CONTENT_TYPE = 'video/mp4';

export interface UploadSession {
  videoId: string;
  uploadUrl: string;
  expiresAt: Date;
  storageKey: string;
}

export interface VideoStreamResult {
  statusCode: 200 | 206;
  headers: Record<string, string>;
  body: Readable;
}

interface ByteRange {
  start: number;
  end: number;
}

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @Inject(MINIO_CLIENT)
    private readonly minioClient: Client,
    @Inject(storageConfig.KEY)
    private readonly storage: ConfigType<typeof storageConfig>,
    private readonly channelsService: ChannelsService,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly videoProcessingQueue: Queue,
  ) {}

  async createUploadSession(
    userId: string,
    dto: CreateUploadSessionDto,
  ): Promise<UploadSession> {
    if (dto.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new FileTooLargeException();
    }
    if (!dto.contentType.startsWith('video/')) {
      throw new UnsupportedContentTypeException();
    }

    const channel = await this.channelsService.findByUserId(userId);
    if (!channel) {
      throw new Error('No channel found for the authenticated user');
    }

    const videoId = randomUUID();
    const storageKey = `channels/${channel.id}/videos/${videoId}.mp4`;

    await this.videoRepository.save(
      this.videoRepository.create({
        id: videoId,
        channel_id: channel.id,
        storage_key: storageKey,
        status: VideoStatus.DRAFT,
      }),
    );

    const uploadUrl = await this.minioClient.presignedPutObject(
      this.storage.bucket,
      storageKey,
      PRESIGNED_URL_EXPIRY_SECONDS,
    );
    const expiresAt = new Date(
      Date.now() + PRESIGNED_URL_EXPIRY_SECONDS * 1000,
    );

    return { videoId, uploadUrl, expiresAt, storageKey };
  }

  async markProcessing(videoId: string): Promise<void> {
    const video = await this.videoRepository.findOneBy({
      id: videoId,
      status: VideoStatus.DRAFT,
    });
    if (!video) {
      return;
    }

    video.status = VideoStatus.PROCESSING;
    await this.videoRepository.save(video);

    await this.videoProcessingQueue.add(PROCESS_VIDEO_JOB, { videoId });
  }

  async getStreamableVideo(id: string): Promise<Video> {
    const video = await this.videoRepository.findOneBy({ id });
    if (!video) {
      throw new VideoNotFoundException();
    }
    if (video.status !== VideoStatus.READY) {
      throw new VideoNotReadyException();
    }
    return video;
  }

  async streamVideo(
    id: string,
    rangeHeader?: string,
  ): Promise<VideoStreamResult> {
    const video = await this.getStreamableVideo(id);
    const totalSize = Number(video.file_size_bytes);

    if (!rangeHeader) {
      const body = await this.minioClient.getObject(
        this.storage.bucket,
        video.storage_key,
      );
      return {
        statusCode: 200,
        headers: {
          'Content-Type': VIDEO_CONTENT_TYPE,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
        },
        body,
      };
    }

    const range = this.parseRange(rangeHeader, totalSize);
    if (!range) {
      throw new RangeNotSatisfiableException();
    }

    const { start, end } = range;
    const length = end - start + 1;
    const body = await this.minioClient.getPartialObject(
      this.storage.bucket,
      video.storage_key,
      start,
      length,
    );
    return {
      statusCode: 206,
      headers: {
        'Content-Type': VIDEO_CONTENT_TYPE,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': String(length),
        'Accept-Ranges': 'bytes',
      },
      body,
    };
  }

  private parseRange(rangeHeader: string, totalSize: number): ByteRange | null {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match) {
      return null;
    }
    const [, startStr, endStr] = match;
    if (startStr === '' && endStr === '') {
      return null;
    }

    let start: number;
    let end: number;
    if (startStr === '') {
      const suffixLength = parseInt(endStr, 10);
      start = Math.max(totalSize - suffixLength, 0);
      end = totalSize - 1;
    } else {
      start = parseInt(startStr, 10);
      end = endStr === '' ? totalSize - 1 : parseInt(endStr, 10);
    }

    if (start > end || start < 0 || end >= totalSize) {
      return null;
    }
    return { start, end };
  }
}
