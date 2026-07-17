import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiSuccessEnvelope } from '../dto/api-success-envelope.dto';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessEnvelope> {
    return next.handle().pipe(map((payload) => this.wrap(payload)));
  }

  private wrap(payload: unknown): ApiSuccessEnvelope {
    if (this.isSuccessEnvelope(payload)) {
      return payload;
    }

    const message = this.extractMessage(payload);
    const meta = this.extractMeta(payload);

    return {
      success: true,
      data: payload ?? null,
      ...(message !== undefined && { message }),
      ...(meta !== undefined && { meta }),
    };
  }

  private isSuccessEnvelope(payload: unknown): payload is ApiSuccessEnvelope {
    return (
      this.isRecord(payload) &&
      payload.success === true &&
      Object.prototype.hasOwnProperty.call(payload, 'data')
    );
  }

  private extractMessage(payload: unknown): string | undefined {
    if (!this.isRecord(payload)) {
      return undefined;
    }

    return typeof payload.message === 'string' ? payload.message : undefined;
  }

  private extractMeta(payload: unknown): Record<string, unknown> | undefined {
    if (!this.isRecord(payload)) {
      return undefined;
    }

    const metaKeys = [
      'nextCursor',
      'hasNextPage',
      'total',
      'page',
      'limit',
      'totalPages',
    ];
    const meta = metaKeys.reduce<Record<string, unknown>>((acc, key) => {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        acc[key] = payload[key];
      }

      return acc;
    }, {});

    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
