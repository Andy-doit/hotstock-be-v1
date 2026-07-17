import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import {
  getSafeErrorLogMessage,
  getSafeErrorLogStack,
  redactSensitiveLogValue,
} from '../utils/log-redaction';

interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  error: string;
  timestamp: string;
  path: string;
}

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
    let exceptionResponse: string | object | undefined;
    if (isHttpException) {
      exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(responseObj.message)) {
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
    const internalServerErrorStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= internalServerErrorStatus) {
      message = 'Internal Server Error';
    }
    const error = this.getErrorName(status);
    const code = this.getErrorCode(status, exceptionResponse);
    const requestPath = request.url.split('?')[0];

    const errorResponse: ErrorResponse = {
      statusCode: status,
      code,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: requestPath,
    };

    // Log 5xx errors as errors, 4xx as warnings. For non-HttpException
    // errors, log the real message/stack server-side even though the
    // client only ever sees the generic message above.
    if (status >= internalServerErrorStatus) {
      const err =
        exception instanceof Error ? exception : new Error(String(exception));
      const safeMessage = getSafeErrorLogMessage(err);
      const safeStack = getSafeErrorLogStack(err);
      this.logger.error(
        `${request.method} ${requestPath} ${status} - ${safeMessage}`,
        safeStack,
      );
    } else {
      const safeMessage = redactSensitiveLogValue(message);
      this.logger.warn(
        `${request.method} ${requestPath} ${status} - ${safeMessage}`,
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

  private getErrorCode(
    status: number,
    exceptionResponse?: string | object,
  ): string {
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as Record<string, unknown>;
      if (typeof responseObj.code === 'string') {
        return responseObj.code;
      }
    }

    const statusCodes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
      [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
      [HttpStatus.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
    };

    return statusCodes[status] || 'ERROR';
  }
}
