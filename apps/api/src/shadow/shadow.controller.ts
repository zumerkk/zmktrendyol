import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShadowIntelligenceService } from './shadow-intelligence.service';
import { ShadowStockSentinel } from './shadow-stock-sentinel.service';
import { ShadowReportGenerator } from './shadow-report-generator.service';
import { ShadowAgentFleet } from './shadow-agent-fleet.service';
import { ShadowAlertDispatcher } from './shadow-alert-dispatcher.service';
import {
  CreateShadowTargetDto, BatchAddTargetsDto, UpdateShadowTargetDto,
  TargetFilterDto, CreateWatchlistDto, UpdateWatchlistDto,
  AlertFilterDto, TimeRangeDto,
} from './dto/shadow.dto';

@ApiTags('Shadow Intelligence')
@Controller('shadow')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShadowController {
  constructor(
    private shadow: ShadowIntelligenceService,
    private stockSentinel: ShadowStockSentinel,
    private reports: ShadowReportGenerator,
    private agents: ShadowAgentFleet,
    private alertDispatcher: ShadowAlertDispatcher,
  ) {}

  // ═══════════════════════════════════════════════
  //  DASHBOARD SUMMARY
  // ═══════════════════════════════════════════════

  @Get('dashboard-summary')
  @ApiOperation({ summary: 'Get full dashboard summary with KPIs' })
  getDashboardSummary(@Req() req: any) {
    return this.shadow.getDashboardSummary(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  //  TARGET MANAGEMENT
  // ═══════════════════════════════════════════════

  @Post('targets')
  @ApiOperation({ summary: 'Add a new shadow target' })
  addTarget(@Req() req: any, @Body() dto: CreateShadowTargetDto) {
    return this.shadow.addTarget(req.user.tenantId, dto);
  }

  @Post('targets/batch')
  @ApiOperation({ summary: 'Batch add multiple targets' })
  batchAddTargets(@Req() req: any, @Body() dto: BatchAddTargetsDto) {
    return this.shadow.batchAddTargets(req.user.tenantId, dto);
  }

  @Get('targets')
  @ApiOperation({ summary: 'List all targets with filters' })
  getTargets(@Req() req: any, @Query() filters: TargetFilterDto) {
    return this.shadow.getTargets(req.user.tenantId, filters);
  }

  @Get('targets/:id')
  @ApiOperation({ summary: 'Get target detail with latest data' })
  getTargetDetail(@Req() req: any, @Param('id') id: string) {
    return this.shadow.getTargetDetail(req.user.tenantId, id);
  }

  @Put('targets/:id')
  @ApiOperation({ summary: 'Update a shadow target' })
  updateTarget(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateShadowTargetDto) {
    return this.shadow.updateTarget(req.user.tenantId, id, dto);
  }

  @Delete('targets/:id')
  @ApiOperation({ summary: 'Remove a shadow target' })
  removeTarget(@Req() req: any, @Param('id') id: string) {
    return this.shadow.removeTarget(req.user.tenantId, id);
  }

  // ═══════════════════════════════════════════════
  //  SCANNING
  // ═══════════════════════════════════════════════

  @Post('targets/:id/scan')
  @ApiOperation({ summary: 'Record a scan snapshot for a target' })
  recordSnapshot(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.shadow.recordSnapshot(req.user.tenantId, id, data);
  }

  // ═══════════════════════════════════════════════
  //  TIMELINES & ANALYTICS
  // ═══════════════════════════════════════════════

  @Get('targets/:id/stock-timeline')
  @ApiOperation({ summary: 'Get stock level timeline' })
  getStockTimeline(@Param('id') id: string, @Query() q: TimeRangeDto) {
    return this.shadow.getStockTimeline(id, parseInt(q.days || '7'));
  }

  @Get('targets/:id/price-timeline')
  @ApiOperation({ summary: 'Get price timeline' })
  getPriceTimeline(@Param('id') id: string, @Query() q: TimeRangeDto) {
    return this.shadow.getPriceTimeline(id, parseInt(q.days || '30'));
  }

  @Get('targets/:id/sales-analysis')
  @ApiOperation({ summary: 'Get sales analysis from stock delta' })
  getSalesAnalysis(@Req() req: any, @Param('id') id: string, @Query('period') period?: string) {
    return this.shadow.getSalesAnalysis(req.user.tenantId, id, (period as any) || 'daily');
  }

  @Get('targets/:id/compare')
  @ApiOperation({ summary: 'Compare target price with our product' })
  comparePriceWithOurs(@Req() req: any, @Param('id') id: string) {
    return this.shadow.comparePriceWithOurs(req.user.tenantId, id);
  }

  @Get('targets/:id/sales-velocity')
  @ApiOperation({ summary: 'Get real-time sales velocity' })
  getSalesVelocity(@Param('id') id: string, @Query('hours') hours?: string) {
    return this.stockSentinel.getSalesVelocity(id, parseInt(hours || '24'));
  }

  // ═══════════════════════════════════════════════
  //  ALERTS
  // ═══════════════════════════════════════════════

  @Get('alerts')
  @ApiOperation({ summary: 'Get alerts with filters' })
  getAlerts(@Req() req: any, @Query() filters: AlertFilterDto) {
    return this.shadow.getAlerts(req.user.tenantId, filters);
  }

  @Put('alerts/:id/read')
  @ApiOperation({ summary: 'Mark alert as read' })
  markAlertRead(@Req() req: any, @Param('id') id: string) {
    return this.shadow.markAlertRead(req.user.tenantId, id);
  }

  @Post('alerts/mark-all-read')
  @ApiOperation({ summary: 'Mark all alerts as read' })
  markAllRead(@Req() req: any) {
    return this.alertDispatcher.markAllRead(req.user.tenantId);
  }

  @Get('alerts/stats')
  @ApiOperation({ summary: 'Get alert statistics' })
  getAlertStats(@Req() req: any) {
    return this.shadow.getAlertStats(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  //  REPORTS
  // ═══════════════════════════════════════════════

  @Get('reports/daily')
  @ApiOperation({ summary: 'Get daily report' })
  getDailyReport(@Req() req: any) {
    // Return today's generated reports
    return this.reports.getWeeklyReport(req.user.tenantId); // falls back to weekly if daily not yet generated
  }

  @Get('reports/weekly')
  @ApiOperation({ summary: 'Get weekly report with sales rankings' })
  getWeeklyReport(@Req() req: any) {
    return this.reports.getWeeklyReport(req.user.tenantId);
  }

  @Get('reports/monthly')
  @ApiOperation({ summary: 'Get monthly report with revenue estimates' })
  getMonthlyReport(@Req() req: any) {
    return this.reports.getMonthlyReport(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  //  AGENTS
  // ═══════════════════════════════════════════════

  @Get('agents/status')
  @ApiOperation({ summary: 'Get all agent statuses' })
  getAgentStatus() {
    return this.agents.getFleetStatus();
  }

  @Post('agents/:type/toggle')
  @ApiOperation({ summary: 'Enable/disable an agent' })
  toggleAgent(@Param('type') type: string, @Body('enabled') enabled: boolean) {
    return this.agents.toggleAgent(type as any, enabled);
  }

  @Post('agents/:type/run')
  @ApiOperation({ summary: 'Manually trigger an agent' })
  runAgent(@Req() req: any, @Param('type') type: string) {
    return this.agents.runAgent(type as any, req.user.tenantId);
  }

  @Get('agents/log')
  @ApiOperation({ summary: 'Get agent execution log' })
  getAgentLog(@Req() req: any, @Query('limit') limit?: string) {
    return this.agents.getAgentLog(req.user.tenantId, parseInt(limit || '50'));
  }

  // ═══════════════════════════════════════════════
  //  WATCHLISTS
  // ═══════════════════════════════════════════════

  @Get('watchlists')
  @ApiOperation({ summary: 'Get all watchlists' })
  getWatchlists(@Req() req: any) {
    return this.shadow.getWatchlists(req.user.tenantId);
  }

  @Post('watchlists')
  @ApiOperation({ summary: 'Create a new watchlist' })
  createWatchlist(@Req() req: any, @Body() dto: CreateWatchlistDto) {
    return this.shadow.createWatchlist(req.user.tenantId, dto);
  }

  @Put('watchlists/:id')
  @ApiOperation({ summary: 'Update a watchlist' })
  updateWatchlist(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateWatchlistDto) {
    return this.shadow.updateWatchlist(req.user.tenantId, id, dto);
  }

  @Delete('watchlists/:id')
  @ApiOperation({ summary: 'Delete a watchlist' })
  deleteWatchlist(@Req() req: any, @Param('id') id: string) {
    return this.shadow.deleteWatchlist(req.user.tenantId, id);
  }

  // ═══════════════════════════════════════════════
  //  STOCK SENTINEL MANUAL
  // ═══════════════════════════════════════════════

  @Post('sentinel/run')
  @ApiOperation({ summary: 'Manually run stock sentinel' })
  runStockSentinel(@Req() req: any) {
    return this.stockSentinel.runStockSentinel(req.user.tenantId);
  }
}
