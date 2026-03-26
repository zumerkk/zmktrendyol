import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRE_PLAN_KEY } from '../decorators/require-plan.decorator';

/**
 * Checks if the tenant has the required SaaS subscription plan to access a specific feature.
 * Hierarchy: enterprise > pro > starter
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
    private planHierarchy = ['starter', 'pro', 'enterprise'];

    constructor(private reflector: Reflector, private prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPlans = this.reflector.getAllAndOverride<string[]>(REQUIRE_PLAN_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no plan is strictly required, let it pass
        if (!requiredPlans || requiredPlans.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || !user.tenantId) {
            throw new ForbiddenException('User or Tenant ID is missing.');
        }

        // Fetch the tenant's current active subscription
        const subscription = await this.prisma.subscription.findFirst({
            where: { tenantId: user.tenantId, status: 'active' },
            orderBy: { createdAt: 'desc' },
        });

        const currentPlan = subscription?.plan || 'starter'; // Default to starter if no active sub

        // Determine if user's plan is >= required plan
        const minRequiredPlan = requiredPlans[0]; // Assuming decorator takes the minimum required, e.g. @RequirePlan('pro')
        const userPlanRank = this.planHierarchy.indexOf(currentPlan);
        const requiredPlanRank = this.planHierarchy.indexOf(minRequiredPlan);

        if (userPlanRank < requiredPlanRank) {
            throw new ForbiddenException(
                `This feature requires [${minRequiredPlan}] plan, but you are currently on [${currentPlan}]. Please upgrade your package.`,
            );
        }

        return true;
    }
}
