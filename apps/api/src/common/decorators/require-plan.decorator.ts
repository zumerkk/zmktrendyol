import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PLAN_KEY = 'requirePlan';
export const RequirePlan = (...plans: string[]) => SetMetadata(REQUIRE_PLAN_KEY, plans);
