import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const hits = await this.redis.incr(key);
    if (hits === 1) {
      await this.redis.expire(key, Math.ceil(ttl / 1000));
    }
    const timeToExpire = await this.redis.ttl(key);

    return {
      totalHits: hits,
      timeToExpire: timeToExpire * 1000,
      isBlocked: hits > limit,
      timeToBlockExpire: 0,
    };
  }
}
