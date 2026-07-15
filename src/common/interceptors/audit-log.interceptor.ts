import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest } from 'fastify';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Interceptor that writes audit log entries for state-changing requests
 * (POST, PATCH, PUT, DELETE).
 *
 * The database write is non-blocking — errors are caught and logged
 * but never propagate to the client.
 *
 * Extracts:
 * - userId from request.user?.sub (nullable for unauthenticated routes)
 * - action as `METHOD:/route/path`
 * - resource from the first meaningful path segment
 * - resourceId from response body?.id
 * - ipAddress from request.ip
 * - userAgent from request headers
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    @InjectQueue('email') private readonly auditQueue: Queue,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const method = request.method;

    // Only audit state-changing methods
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const url = request.url;
    // Fastify request augmentation makes `user` typed as JwtPayload | undefined
    const user = (request as any).user;
    const userId = user?.sub ?? null;
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'] ?? null;
    const resource = this.extractResource(url);
    const action = `${method}:${url.split('?')[0]}`;

    return next.handle().pipe(
      tap((responseBody) => {
        const resourceId = this.extractResourceId(responseBody);

        // Non-blocking — fire and forget to queue
        this.auditQueue
          .add('audit_log', {
            userId,
            action,
            resource,
            resourceId,
            ipAddress,
            userAgent,
          }, {
            removeOnComplete: true,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 }
          })
          .catch((error: Error) => {
            this.logger.error(
              `Failed to queue audit log: ${error.message}`,
              error.stack,
            );
          });
      }),
    );
  }

  /**
   * Extracts the primary resource name from the URL path.
   * Example: /api/v1/articles/some-slug → "articles"
   */
  private extractResource(url: string): string {
    const path = url.split('?')[0]; // Strip query string
    const segments = path.split('/').filter(Boolean);

    // Skip common prefixes like "api" and version segments like "v1"
    for (const segment of segments) {
      if (segment === 'api' || /^v\d+$/.test(segment)) {
        continue;
      }
      return segment;
    }

    return 'unknown';
  }

  /**
   * Extracts the resource ID from the response body.
   * Returns the ID as a string, or null if not available.
   */
  private extractResourceId(responseBody: unknown): string | null {
    if (
      responseBody &&
      typeof responseBody === 'object' &&
      'id' in responseBody
    ) {
      const id = (responseBody as Record<string, unknown>).id;
      return id !== undefined && id !== null ? String(id) : null;
    }
    return null;
  }
}
