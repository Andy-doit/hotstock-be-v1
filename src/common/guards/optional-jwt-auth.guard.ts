import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest } from 'fastify';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';
import {
  getSafeErrorLogMessage,
  getSafeErrorLogStack,
} from '../utils/log-redaction';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!this.hasToken(request)) {
      return true;
    }

    try {
      await super.canActivate(context);
      return true;
    } catch (error: unknown) {
      if (this.isExpectedAuthFailure(error)) {
        return true;
      }

      this.logger.error(
        'Optional JWT auth failed unexpectedly: ' +
          getSafeErrorLogMessage(error),
        getSafeErrorLogStack(error),
      );
      throw error;
    }
  }

  handleRequest<TUser = JwtPayload | null>(
    err: Error | null,
    user: TUser | false,
  ): TUser {
    if (err) {
      if (this.isExpectedAuthFailure(err)) {
        return null as TUser;
      }

      throw err;
    }

    if (!user) {
      return null as TUser;
    }

    return user;
  }

  private hasToken(request: FastifyRequest): boolean {
    return (
      this.hasBearerToken(request.headers.authorization) ||
      this.hasCookieToken(request, 'access_token') ||
      this.hasCookieToken(request, 'auth_token')
    );
  }

  private hasBearerToken(value: string | string[] | undefined): boolean {
    const authorization = Array.isArray(value) ? value[0] : value;
    return /^Bearer\s+\S+$/i.test(authorization ?? '');
  }

  private hasCookieToken(request: FastifyRequest, name: string): boolean {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return false;
    }

    return cookieHeader
      .split(';')
      .map((part) => part.trim())
      .some((part) => {
        if (!part.startsWith(`${name}=`)) {
          return false;
        }

        return part.slice(name.length + 1).trim().length > 0;
      });
  }

  private isExpectedAuthFailure(error: unknown): boolean {
    if (error instanceof UnauthorizedException) {
      return true;
    }

    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'NotBeforeError'
    );
  }
}
