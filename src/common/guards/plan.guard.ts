import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PLAN_LEVEL_KEY } from '../decorators/required-plan.decorator';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Guard that checks if the authenticated user's plan level meets the minimum
 * required plan level for the route.
 *
 * Must be used AFTER JwtAuthGuard so that request.user is populated.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, PlanGuard)
 *   @RequiredPlan(2)
 */
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredLevel = this.reflector.getAllAndOverride<number | undefined>(
      REQUIRED_PLAN_LEVEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @RequiredPlan() decorator is set, allow through
    if (requiredLevel === undefined || requiredLevel === null) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    const userPlanLevel = user?.planLevel ?? 0;

    if (userPlanLevel < requiredLevel) {
      throw new ForbiddenException(
        'Bạn cần nâng cấp gói để truy cập nội dung này',
      );
    }

    return true;
  }
}
