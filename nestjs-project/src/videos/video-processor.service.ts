import { randomUUID } from 'node:crypto';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Process, Processor } from '@nestjs/bull';
import type { ConfigType } from '@nestjs/config';
import type { Job } from 'bull';
import { Repository } from 'typeorm';
import type { Client } from 'minio';
import execa from 'execa';
import type { ExecaError } from 'execa';
import { MINIO_CLIENT } from '../storage/storage.module';
import storageConfig from '../config/storage.config';
import { Video, VideoStatus } from './entities/video.entity';
import { VIDEO_PROCESSING_QUEUE, PROCESS_VIDEO_JOB } from './videos.constants';

const THUMBNAIL_SEEK_SECONDS = '1';

interface FfprobeFormatOutput {
  format: { duration: string };
}

@Processor(VIDEO_PROCESSING_QUEUE)
export class VideoProcessorService {
  private readonly logger = new Logger(VideoProcessorService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @Inject(MINIO_CLIENT)
    private readonly minioClient: Client,
    @Inject(storageConfig.KEY)
    private readonly storage: ConfigType<typeof storageConfig>,
  ) {}

  @Process(PROCESS_VIDEO_JOB)
  async handleProcessVideo(job: Job<{ videoId: string }>): Promise<void> {
    const { videoId } = job.data;
    const video = await this.videoRepository.findOneBy({ id: videoId });
    if (!video) {
      return;
    }

    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `video-processing-${randomUUID()}-`),
    );
    const videoTmpPath = path.join(tmpDir, `${videoId}.mp4`);
    const thumbnailTmpPath = path.join(tmpDir, `${videoId}.jpg`);
    const thumbnailKey = `channels/${video.channel_id}/thumbnails/${videoId}.jpg`;

    try {
      const downloadStream = await this.minioClient.getObject(
        this.storage.bucket,
        video.storage_key,
      );
      await pipeline(downloadStream, fsSync.createWriteStream(videoTmpPath));

      const { stdout } = await execa('ffprobe', [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        videoTmpPath,
      ]);
      const { format } = JSON.parse(stdout) as FfprobeFormatOutput;
      const durationSeconds = Math.round(parseFloat(format.duration));

      await execa('ffmpeg', [
        '-y',
        '-ss',
        THUMBNAIL_SEEK_SECONDS,
        '-i',
        videoTmpPath,
        '-vframes',
        '1',
        thumbnailTmpPath,
      ]);
      const thumbnailBuffer = await fs.readFile(thumbnailTmpPath);
      await this.minioClient.putObject(
        this.storage.bucket,
        thumbnailKey,
        thumbnailBuffer,
      );

      const stat = await this.minioClient.statObject(
        this.storage.bucket,
        video.storage_key,
      );

      video.duration_seconds = durationSeconds;
      video.thumbnail_key = thumbnailKey;
      video.file_size_bytes = String(stat.size);
      video.status = VideoStatus.READY;
      await this.videoRepository.save(video);
    } catch (error) {
      video.processing_attempts += 1;
      video.last_error = this.extractStderr(error);
      video.status = VideoStatus.ERROR;
      await this.videoRepository.save(video);
      this.logger.error(
        `Failed to process video ${videoId}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  private extractStderr(error: unknown): string {
    if (this.isExecaError(error)) {
      return error.stderr ? String(error.stderr) : error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }

  private isExecaError(error: unknown): error is ExecaError {
    return error instanceof Error && 'stderr' in error && 'exitCode' in error;
  }
}
