import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator that sets the required roles for a route handler.
 * Must be used together with RolesGuard (which reads this metadata).
 *
 * Usage:
 *   @Roles(Role.admin)
 *   @Roles(Role.admin, Role.editor)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
