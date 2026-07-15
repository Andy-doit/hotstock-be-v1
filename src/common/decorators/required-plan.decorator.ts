import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PLAN_LEVEL_KEY = 'requiredPlanLevel';

/**
 * Decorator that sets the minimum plan level required to access a route.
 * Must be used together with PlanGuard (which reads this metadata).
 *
 * Usage:
 *   @RequiredPlan(1)  // Requires at least Titan plan (level 1)
 *   @RequiredPlan(2)  // Requires at least Premium plan (level 2)
 */
export const RequiredPlan = (level: number) =>
  SetMetadata(REQUIRED_PLAN_LEVEL_KEY, level);
