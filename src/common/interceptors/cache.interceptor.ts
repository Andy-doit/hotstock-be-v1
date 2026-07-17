import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { getSafeErrorLogMessage } from '../utils/log-redaction';

export async function clearCache(
  redis: Redis,
  pattern: string,
  useUnlink = false,
): Promise<void> {
  const logger = new Logger('ClearCache');
  let cursor = '0';
  let totalDeleted = 0;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        if (useUnlink) {
          // UNLINK is async in Redis — returns immediately, Redis deletes in background
          void redis.unlink(...keys);
        } else {
          await redis.del(...keys);
        }
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');

    if (totalDeleted > 0) {
      logger.debug(
        `Queued deletion of ${totalDeleted} keys matching "${pattern}"`,
      );
    }
  } catch (error) {
    const message = getSafeErrorLogMessage(error);
    logger.error(`Failed to clear cache for pattern "${pattern}": ${message}`);
  }
}
