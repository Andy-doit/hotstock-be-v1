import {
  Module,
  Global,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getSafeErrorLogMessage } from '../../common/utils/log-redaction';

const UNKNOWN_REDIS_DISCONNECT_ERROR = 'Unknown Redis disconnect error';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password') || undefined,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.log('Redis client disconnected gracefully');
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? getSafeErrorLogMessage(error)
          : UNKNOWN_REDIS_DISCONNECT_ERROR;
      this.logger.error(`Error during Redis disconnect: ${message}`);
    }
  }
}
