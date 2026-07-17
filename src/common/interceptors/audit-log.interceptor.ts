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
import type { AuditLogJobData } from '../../modules/queue/types/email-job.types';
import {
  getSafeErrorLogMessage,
  getSafeErrorLogStack,
} from '../utils/log-redaction';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    @InjectQueue('email')
    private readonly auditQueue: Queue<AuditLogJobData, void, 'audit_log'>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const method = request.method;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const url = request.url;
    const userId = request.user?.sub ?? null;
    const ipAddress = request.ip;
    const userAgent = this.getHeaderValue(request.headers['user-agent']);
    const resource = this.extractResource(url);
    const action = `${method}:${url.split('?')[0]}`;

    return next.handle().pipe(
      tap((responseBody) => {
        const resourceId = this.extractResourceId(responseBody);

        // Non-blocking — fire and forget to queue
        this.auditQueue
          .add(
            'audit_log',
            {
              userId,
              action,
              resource,
              resourceId,
              ipAddress,
              userAgent,
            },
            {
              removeOnComplete: true,
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
            },
          )
          .catch((error: Error) => {
            const message = getSafeErrorLogMessage(error);
            const stack = getSafeErrorLogStack(error);
            this.logger.error(`Failed to queue audit log: ${message}`, stack);
          });
      }),
    );
  }

  private extractResource(url: string): string {
    const path = url.split('?')[0];
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

  private extractResourceId(responseBody: unknown): string | null {
    if (
      responseBody &&
      typeof responseBody === 'object' &&
      'data' in responseBody
    ) {
      const nestedResourceId = this.extractResourceId(
        (responseBody as Record<string, unknown>).data,
      );
      if (nestedResourceId !== null) {
        return nestedResourceId;
      }
    }

    if (
      responseBody &&
      typeof responseBody === 'object' &&
      'id' in responseBody
    ) {
      const id = (responseBody as Record<string, unknown>).id;
      if (
        typeof id === 'string' ||
        typeof id === 'number' ||
        typeof id === 'bigint'
      ) {
        return id.toString();
      }
    }

    return null;
  }

  private getHeaderValue(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return value ?? null;
  }
}
