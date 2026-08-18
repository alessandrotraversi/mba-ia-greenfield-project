import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import queueConfig from './config/queue.config';

describe('AppModule (Bull wiring)', () => {
  it('should compile BullModule.forRootAsync + registerQueue given valid queue config', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [queueConfig],
        }),
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [queueConfig.KEY],
          useFactory: (config: ConfigType<typeof queueConfig>) => ({
            redis: { host: config.host, port: config.port },
          }),
        }),
        BullModule.registerQueue({ name: 'video-processing' }),
      ],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  }, 30000);
});
