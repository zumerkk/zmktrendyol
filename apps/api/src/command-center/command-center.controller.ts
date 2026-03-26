import {
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CommandCenterService } from "./command-center.service";

@ApiTags("Command Center")
@Controller("command-center")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommandCenterController {
  constructor(private readonly commandCenterService: CommandCenterService) {}

  @Get("insights")
  @ApiOperation({
    summary: "Get active insights and recommended actions for the tenant",
  })
  async getInsights(@Req() req: any) {
    return this.commandCenterService.getPendingInsights(req.user.tenantId);
  }

  @Post("insights/generate")
  @ApiOperation({ summary: "Force trigger insight generation engine" })
  async runEngine(@Req() req: any) {
    return this.commandCenterService.generateDailyInsights(req.user.tenantId);
  }

  @Put("insights/:id/dismiss")
  @ApiOperation({ summary: "Dismiss a recommended action" })
  async dismissInsight(@Req() req: any, @Param("id") insightId: string) {
    return this.commandCenterService.dismissInsight(
      insightId,
      req.user.tenantId,
    );
  }

  @Put("insights/:id/complete")
  @ApiOperation({ summary: "Mark a recommended action as completed" })
  async completeInsight(@Req() req: any, @Param("id") insightId: string) {
    return this.commandCenterService.completeInsight(
      insightId,
      req.user.tenantId,
    );
  }
}
