import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { getSafeErrorLogMessage } from '../utils/log-redaction';

const THROTTLER_INCREMENT_SCRIPT = `
local hitKey = KEYS[1]
local blockKey = KEYS[2]
local ttlMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDurationMs = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', hitKey) or limit + 1)
  local hitTtl = redis.call('PTTL', hitKey)
  if hitTtl < 0 then
    hitTtl = 0
  end
  return { hits, hitTtl, 1, blockTtl }
end

if blockTtl == -1 then
  redis.call('PEXPIRE', blockKey, blockDurationMs)
  local hits = tonumber(redis.call('GET', hitKey) or limit + 1)
  local hitTtl = redis.call('PTTL', hitKey)
  if hitTtl < 0 then
    hitTtl = 0
  end
  return { hits, hitTtl, 1, blockDurationMs }
end

local hits = redis.call('INCR', hitKey)
local hitTtl = redis.call('PTTL', hitKey)
if hits == 1 or hitTtl < 0 then
  redis.call('PEXPIRE', hitKey, ttlMs)
  hitTtl = ttlMs
end

if hits > limit then
  redis.call('PSETEX', blockKey, blockDurationMs, '1')
  return { hits, hitTtl, 1, blockDurationMs }
end

return { hits, hitTtl, 0, 0 }
`;

type RedisScriptResult = [number, number, number, number];

type RedisThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<RedisThrottlerStorageRecord> {
    const ttlMs = this.toPositiveInteger(ttl);
    const blockDurationMs = this.toPositiveInteger(blockDuration || ttlMs);
    const blockKey = `${key}:blocked`;

    try {
      const result = await this.redis.eval(
        THROTTLER_INCREMENT_SCRIPT,
        2,
        key,
        blockKey,
        ttlMs,
        limit,
        blockDurationMs,
      );
      const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] =
        this.parseScriptResult(result);

      return {
        totalHits,
        timeToExpire: this.toHeaderSeconds(timeToExpireMs),
        isBlocked: isBlocked === 1,
        timeToBlockExpire: this.toHeaderSeconds(timeToBlockExpireMs),
      };
    } catch (error: unknown) {
      const message = getSafeErrorLogMessage(error);

      this.logger.error(
        'Redis throttler storage failed closed for ' +
          throttlerName +
          ': ' +
          message,
      );
      throw error;
    }
  }

  private parseScriptResult(result: unknown): RedisScriptResult {
    if (!Array.isArray(result) || result.length !== 4) {
      throw new Error('Invalid Redis throttler script result');
    }

    const values = result.map((value) => Number(value));
    if (values.some((value) => !Number.isFinite(value))) {
      throw new Error('Invalid Redis throttler script numeric values');
    }

    return values as RedisScriptResult;
  }

  private toHeaderSeconds(milliseconds: number): number {
    return Math.max(0, Math.ceil(milliseconds / 1000));
  }

  private toPositiveInteger(value: number): number {
    return Math.max(1, Math.ceil(value));
  }
}
