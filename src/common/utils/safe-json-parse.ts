import { Logger } from '@nestjs/common';

/**
 * Safely parse a JSON string from cache. Returns null on parse failure and
 * logs a warning. Use this instead of `JSON.parse` directly for cached values
 * to prevent corrupted cache entries from crashing the request.
 */
export function safeJsonParse<T>(
  raw: string,
  logger: Logger,
  key: string,
): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn(
      `Corrupted cache entry for [${key}]: ${(error as Error).message}. Falling through to DB.`,
    );
    return null;
  }
}
