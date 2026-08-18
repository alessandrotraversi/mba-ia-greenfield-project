import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import queueConfig from '../config/queue.config';
import { VideosService } from './videos.service';
import { UPLOAD_NOTIFICATION_REDIS_KEY } from './videos.constants';

interface MinioRedisEventRecord {
  eventName?: string;
  s3?: { object?: { key?: string } };
}

interface MinioRedisNotificationEntry {
  Event?: MinioRedisEventRecord[];
  EventTime?: string;
}

const VIDEO_OBJECT_KEY_PATTERN = /\/videos\/([0-9a-fA-F-]{36})\.mp4$/;

@Injectable()
export class UploadNotificationListener
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(UploadNotificationListener.name);
  private readonly redis: Redis;
  private listening = false;

  constructor(
    @Inject(queueConfig.KEY)
    private readonly queueSettings: ConfigType<typeof queueConfig>,
    private readonly videosService: VideosService,
  ) {
    this.redis = new Redis({
      host: this.queueSettings.host,
      port: this.queueSettings.port,
    });
  }

  onModuleInit(): void {
    this.listening = true;
    void this.consumeLoop();
  }

  onModuleDestroy(): void {
    this.listening = false;
    this.redis.disconnect();
  }

  private async consumeLoop(): Promise<void> {
    while (this.listening) {
      try {
        const result = await this.redis.blpop(UPLOAD_NOTIFICATION_REDIS_KEY, 0);
        if (!result) {
          continue;
        }
        const [, rawEntry] = result;
        await this.handleEntry(rawEntry);
      } catch (error) {
        this.logger.error(
          'Failed to process upload-completion notification',
          error as Error,
        );
      }
    }
  }

  private async handleEntry(rawEntry: string): Promise<void> {
    const [entry] = JSON.parse(rawEntry) as MinioRedisNotificationEntry[];
    const record = entry?.Event?.[0];
    const objectKey = record?.s3?.object?.key;
    if (!record?.eventName?.startsWith('s3:ObjectCreated:') || !objectKey) {
      return;
    }

    const videoId = this.extractVideoId(decodeURIComponent(objectKey));
    if (!videoId) {
      return;
    }

    await this.videosService.markProcessing(videoId);
  }

  private extractVideoId(objectKey: string): string | null {
    const match = VIDEO_OBJECT_KEY_PATTERN.exec(objectKey);
    return match ? match[1] : null;
  }
}
