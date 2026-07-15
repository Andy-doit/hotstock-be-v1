import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
}

/**
 * Global exception filter that catches ALL exceptions — both NestJS
 * HttpExceptions and unexpected errors (TypeErrors, Prisma errors, etc.) —
 * and returns a consistent, sanitized JSON response shape.
 *
 * Unexpected (non-HttpException) errors always return a generic 500 message
 * to the client; the real error and stack are logged server-side only, so
 * a bug never leaks internal details (DB schema, file paths, library
 * internals) to callers.
 *
 * Response format:
 * {
 *   statusCode: 400,
 *   message: "...",
 *   error: "Bad Request",
 *   timestamp: "2024-01-01T00:00:00.000Z",
 *   path: "/api/v1/..."
 * }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extract message — for unexpected errors, never forward the real
    // error message to the client (may contain internal details).
    let message: string;
    if (isHttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(responseObj.message)) {
          // class-validator returns an array of messages
          message = (responseObj.message as string[]).join('; ');
        } else if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    } else {
      message = 'Internal Server Error';
    }

    // Map status code to error name
    const error = this.getErrorName(status);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log 5xx errors as errors, 4xx as warnings. For non-HttpException
    // errors, log the real message/stack server-side even though the
    // client only ever sees the generic message above.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const err =
        exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${err.message}`,
        err.stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${message}`,
      );
    }

    response.status(status).send(errorResponse);
  }

  private getErrorName(status: number): string {
    const statusNames: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
      [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
      [HttpStatus.GATEWAY_TIMEOUT]: 'Gateway Timeout',
    };

    return statusNames[status] || 'Error';
  }
}
