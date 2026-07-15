import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Augment Fastify types to include the `user` property set by JwtAuthGuard
 * and OptionalJwtAuthGuard via request decorators. Eliminates `as any` casts
 * in controllers and interceptors.
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export {};
