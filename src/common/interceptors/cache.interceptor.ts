import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import Redis from 'ioredis';
import { FastifyRequest } from 'fastify';

/**
 * Custom GET caching interceptor using ioredis.
 *
 * - Only caches GET requests
 * - Cache key format: `cache:GET:/api/v1/plans`
 * - On hit: returns parsed JSON immediately, skips handler
 * - On miss: executes handler, stores response as JSON string with TTL
 *
 * TTL rules by URL pattern:
 *   /plans       → 86400s (24h)
 *   /categories  → 3600s  (1h)
 *   /articles/:slug → 600s (10m)
 *   /articles    → 300s   (5m)
 *   /portfolios  → 3600s  (1h)
 *   default      → 300s   (5m)
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const method = request.method;

    // Only cache GET requests
    if (method !== 'GET') {
      return next.handle();
    }

    const url = request.url;
    const cacheKey = `cache:${method}:${url}`;

    try {
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return of(JSON.parse(cached));
      }
    } catch (error) {
      this.logger.warn(`Cache GET error for ${cacheKey}: ${(error as Error).message}`);
      // On Redis error, fall through to handler
    }

    this.logger.debug(`Cache MISS: ${cacheKey}`);
    const ttl = this.getTtl(url);

    return next.handle().pipe(
      tap((response) => {
        if (response !== undefined && response !== null) {
          this.redis
            .set(cacheKey, JSON.stringify(response), 'EX', ttl)
            .catch((error: Error) => {
              this.logger.warn(`Cache SET error for ${cacheKey}: ${error.message}`);
            });
        }
      }),
    );
  }

  /**
   * Determine cache TTL based on the URL pattern.
   */
  private getTtl(url: string): number {
    // Strip query string for pattern matching
    const path = url.split('?')[0];

    // Match /plans (exact or with trailing slash only)
    if (/\/plans\/?$/.test(path)) return 86400;
    // Match /plans/:slug
    if (/\/plans\/[^/]+/.test(path)) return 86400;

    // Match /categories
    if (/\/categories/.test(path)) return 3600;

    // Match /portfolios
    if (/\/portfolios/.test(path)) return 3600;

    // Match /articles/:slug (single article — has a slug segment after /articles/)
    if (/\/articles\/[^/]+/.test(path)) return 600;
    // Match /articles (list)
    if (/\/articles/.test(path)) return 300;

    return 300;
  }
}

/**
 * Clear cached keys matching a given pattern using Redis SCAN + DEL.
 *
 * Usage in services:
 *   await clearCache(this.redis, 'cache:GET:*plans*');
 *   await clearCache(this.redis, 'cache:GET:*articles*');
 *
 * @param redis - ioredis client instance
 * @param pattern - Redis key pattern (supports * wildcards)
 */
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
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = nextCursor;

      if (keys.length > 0) {
        if (useUnlink) {
          // UNLINK is async in Redis — returns immediately, Redis deletes in background
          redis.unlink(...keys);
        } else {
          await redis.del(...keys);
        }
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');

    if (totalDeleted > 0) {
      logger.debug(`Queued deletion of ${totalDeleted} keys matching "${pattern}"`);
    }
  } catch (error) {
    logger.error(
      `Failed to clear cache for pattern "${pattern}": ${(error as Error).message}`,
    );
  }
}
