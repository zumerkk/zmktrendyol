import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrchestratorService } from "./orchestrator.service";
import { ReviewAnalyzerService } from "./review-analyzer.service";
import { SubscriptionGuard } from "../common/guards/subscription.guard";
import { RequirePlan } from "../common/decorators/require-plan.decorator";

@ApiTags("AI")
@Controller("ai")
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@ApiBearerAuth()
export class AiController {
  constructor(
    private orchestratorService: OrchestratorService,
    private reviewAnalyzerService: ReviewAnalyzerService,
  ) { }

  @Post("generate")
  @ApiOperation({
    summary: "Generate AI content (title, description, price suggestion, etc.)",
  })
  async generate(
    @Req() req: any,
    @Body()
    dto: { scenario: string; input: Record<string, any>; provider?: string },
  ) {
    return this.orchestratorService.generate(req.user.tenantId, dto);
  }

  @Get("usage")
  @ApiOperation({ summary: "Get AI usage stats" })
  async getUsageStats(@Req() req: any) {
    return this.orchestratorService.getUsageStats(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Review Analysis (ZMK Yorum Zekası)
  // ═══════════════════════════════════════════════

  @Post("analyze-reviews")
  @RequirePlan("pro")
  @ApiOperation({
    summary: "Analyze competitor reviews with AI — ZMK Review Intelligence",
  })
  async analyzeReviews(
    @Req() req: any,
    @Body()
    dto: {
      competitorProductId: string;
      reviews: Array<{
        text: string;
        rating: number;
        date?: string;
        author?: string;
      }>;
      provider?: string;
    },
  ) {
    return this.reviewAnalyzerService.analyzeReviews(
      req.user.tenantId,
      dto.competitorProductId,
      dto.reviews,
      dto.provider,
    );
  }

  @Get("review-insights/:competitorProductId")
  @ApiOperation({ summary: "Get latest review analysis results" })
  async getReviewInsights(
    @Param("competitorProductId") competitorProductId: string,
  ) {
    return this.reviewAnalyzerService.getLatestAnalysis(competitorProductId);
  }

  @Get("review-history/:competitorProductId")
  @ApiOperation({ summary: "Get review analysis history" })
  async getReviewHistory(
    @Param("competitorProductId") competitorProductId: string,
  ) {
    return this.reviewAnalyzerService.getAnalysisHistory(competitorProductId);
  }

  @Post("gap-analysis")
  @RequirePlan("enterprise")
  @ApiOperation({
    summary: "Generate Explainable AI Gap Analysis (Our Product vs Competitor)",
  })
  async generateGapAnalysis(
    @Req() req: any,
    @Body() dto: { myProductId: string; competitorProductId: string },
  ) {
    return this.reviewAnalyzerService.generateGapAnalysis(
      req.user.tenantId,
      dto.myProductId,
      dto.competitorProductId,
    );
  }
}
