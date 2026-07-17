import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PLAN_LEVEL_KEY = 'requiredPlanLevel';

export const RequiredPlan = (level: number) =>
  SetMetadata(REQUIRED_PLAN_LEVEL_KEY, level);
