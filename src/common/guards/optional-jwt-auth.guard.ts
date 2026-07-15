import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Optional JWT guard — authenticates if a token is present but
 * does NOT reject unauthenticated requests.
 *
 * request.user will be JwtPayload if authenticated, or undefined/null if not.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // Silently allow unauthenticated access
    }
    return true;
  }

  // Override returns the user untouched (or null) while satisfying Passport's
  // generic signature. This avoids `as any` and provides a stable
  // JwtPayload | null return for downstream controllers.
  handleRequest<TUser = JwtPayload | null>(
    err: Error | null,
    user: TUser | false,
    info?: unknown,
    context?: ExecutionContext,
    status?: unknown,
  ): TUser {
    if (err || !user) {
      return null as TUser;
    }
    return user;
  }
}
