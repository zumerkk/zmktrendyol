import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { KeywordResearchService } from "./keyword-research.service";
import { RankTrackerService } from "./rank-tracker.service";

@ApiTags("Keywords")
@Controller("keywords")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KeywordResearchController {
  constructor(
    private keywordResearch: KeywordResearchService,
    private rankTracker: RankTrackerService,
  ) {}

  // ─── Keyword Research ──────────────────────────

  @Post("research")
  @ApiOperation({ summary: "Anahtar kelime araştırma — zorluk, hacim, fırsat skoru" })
  async researchKeyword(
    @Req() req: any,
    @Body() dto: { keyword: string; categoryId?: number },
  ) {
    return this.keywordResearch.researchKeyword(
      req.user.tenantId,
      dto.keyword,
      dto.categoryId,
    );
  }

  @Post("research/bulk")
  @ApiOperation({ summary: "Toplu anahtar kelime araştırma" })
  async researchKeywords(
    @Req() req: any,
    @Body() dto: { keywords: string[]; categoryId?: number },
  ) {
    return this.keywordResearch.researchKeywords(
      req.user.tenantId,
      dto.keywords,
      dto.categoryId,
    );
  }

  @Get("suggestions")
  @ApiOperation({ summary: "Anahtar kelime önerileri" })
  async getKeywordSuggestions(
    @Req() req: any,
    @Query("seed") seed: string,
    @Query("limit") limit?: number,
  ) {
    return this.keywordResearch.getKeywordSuggestions(
      req.user.tenantId,
      seed,
      limit,
    );
  }

  @Get("seo-score/:productId")
  @ApiOperation({ summary: "Ürün SEO skorkartı" })
  async getSeoScoreCard(
    @Req() req: any,
    @Param("productId") productId: string,
  ) {
    return this.keywordResearch.getSeoScoreCard(req.user.tenantId, productId);
  }

  @Get("competitor-analysis")
  @ApiOperation({ summary: "Rakip anahtar kelime analizi" })
  async analyzeCompetitorKeywords(
    @Req() req: any,
    @Query("limit") limit?: number,
  ) {
    return this.keywordResearch.analyzeCompetitorKeywords(
      req.user.tenantId,
      limit,
    );
  }

  // ─── Rank Tracker ─────────────────────────────

  @Post("tracking")
  @ApiOperation({ summary: "Anahtar kelime takibe ekle" })
  async addKeywordTracking(
    @Req() req: any,
    @Body()
    dto: {
      keyword: string;
      productId?: string;
      categoryId?: number;
      checkIntervalMinutes?: number;
    },
  ) {
    return this.rankTracker.addKeyword(
      req.user.tenantId,
      dto.keyword,
      dto.productId,
      dto.categoryId,
      dto.checkIntervalMinutes,
    );
  }

  @Delete("tracking/:keyword")
  @ApiOperation({ summary: "Anahtar kelime takipten çıkar" })
  async removeKeywordTracking(
    @Req() req: any,
    @Param("keyword") keyword: string,
  ) {
    return this.rankTracker.removeKeyword(req.user.tenantId, keyword);
  }

  @Get("tracking")
  @ApiOperation({ summary: "Takip edilen anahtar kelimeler ve sıralamalar" })
  async getTrackedKeywords(@Req() req: any) {
    return this.rankTracker.getTrackedKeywords(req.user.tenantId);
  }

  @Get("tracking/history/:keyword")
  @ApiOperation({ summary: "Anahtar kelime sıralama geçmişi" })
  async getKeywordRankHistory(
    @Req() req: any,
    @Param("keyword") keyword: string,
    @Query("days") days?: number,
  ) {
    return this.rankTracker.getKeywordRankHistory(
      req.user.tenantId,
      keyword,
      days,
    );
  }

  @Get("tracking/comparison")
  @ApiOperation({ summary: "Sıralama karşılaştırması — tüm kelimeler" })
  async getRankComparison(@Req() req: any) {
    return this.rankTracker.getRankComparison(req.user.tenantId);
  }
}
