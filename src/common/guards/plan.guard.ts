import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { REQUIRED_PLAN_LEVEL_KEY } from '../decorators/required-plan.decorator';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

type AuthenticatedRequest = FastifyRequest & { user?: JwtPayload };

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredLevel = this.reflector.getAllAndOverride<number | undefined>(
      REQUIRED_PLAN_LEVEL_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredLevel === undefined || requiredLevel === null) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    const userPlanLevel = user?.planLevel ?? 0;

    if (userPlanLevel < requiredLevel) {
      throw new ForbiddenException(
        'Bạn cần nâng cấp gói để truy cập nội dung này',
      );
    }

    return true;
  }
}
