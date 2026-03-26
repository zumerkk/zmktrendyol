import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    UseGuards,
    Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SubscriptionGuard } from "../common/guards/subscription.guard";
import { RequirePlan } from "../common/decorators/require-plan.decorator";
import { AutomationService } from "./automation.service";

@ApiTags("Automation")
@Controller("automation")
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@RequirePlan("enterprise")
@ApiBearerAuth()
export class AutomationController {
    constructor(private automationService: AutomationService) { }

    @Get("rules")
    async getRules(@Req() req: any) {
        return this.automationService.getRules(req.user.tenantId);
    }

    @Post("rules")
    async createRule(@Req() req: any, @Body() body: any) {
        return this.automationService.createRule(req.user.tenantId, body);
    }

    @Put("rules/:id/toggle")
    async toggleRule(
        @Req() req: any,
        @Param("id") id: string,
        @Body() body: { isActive: boolean }
    ) {
        return this.automationService.toggleRule(req.user.tenantId, id, body.isActive);
    }

    @Post("evaluate")
    async evaluateManualTrigger() {
        // Usually triggered by Cron, but exposed for demo testing
        await this.automationService.evaluateAllRules();
        return { success: true, message: "Engine triggered successfully" };
    }
}
