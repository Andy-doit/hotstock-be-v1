import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT authentication guard.
 * Extends Passport's AuthGuard to use the 'jwt' strategy.
 *
 * When applied, it validates the Bearer token from the Authorization header,
 * decodes the JWT payload, and attaches it to request.user as JwtPayload.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
