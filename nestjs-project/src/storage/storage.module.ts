import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import {
  Client,
  NotificationConfig,
  QueueConfig,
  buildARN,
  ObjectCreatedPut,
} from 'minio';
import storageConfig from '../config/storage.config';

export const MINIO_CLIENT = 'MINIO_CLIENT';

const REDIS_NOTIFICATION_TARGET_ID = 'PRIMARY';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [storageConfig.KEY],
      useFactory: (config: ConfigType<typeof storageConfig>): Client =>
        new Client({
          endPoint: config.endpoint,
          port: 9000,
          useSSL: false,
          accessKey: config.accessKey,
          secretKey: config.secretKey,
        }),
    },
  ],
  exports: [MINIO_CLIENT],
})
export class StorageModule implements OnModuleInit {
  constructor(
    @Inject(MINIO_CLIENT)
    private readonly minioClient: Client,
    @Inject(storageConfig.KEY)
    private readonly storage: ConfigType<typeof storageConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    const exists = await this.minioClient.bucketExists(this.storage.bucket);
    if (!exists) {
      await this.minioClient.makeBucket(this.storage.bucket);
    }

    const notificationConfig = new NotificationConfig();
    const arn = buildARN(
      'minio',
      'sqs',
      '',
      REDIS_NOTIFICATION_TARGET_ID,
      'redis',
    );
    const queueConfig = new QueueConfig(arn);
    queueConfig.addEvent(ObjectCreatedPut);
    notificationConfig.add(queueConfig);
    await this.minioClient.setBucketNotification(
      this.storage.bucket,
      notificationConfig,
    );
  }
}
