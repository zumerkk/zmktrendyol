import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Target DTOs ─────────────────────────────────

export class CreateShadowTargetDto {
  @ApiProperty({ description: 'Trendyol product URL' })
  url!: string;

  @ApiPropertyOptional()
  productName?: string;

  @ApiPropertyOptional()
  brand?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  watchlistId?: string;

  @ApiPropertyOptional()
  ourProductId?: string;

  @ApiPropertyOptional({ default: 15 })
  scanInterval?: number;

  @ApiPropertyOptional({ default: false })
  stockProbeEnabled?: boolean;

  @ApiPropertyOptional({ default: 5 })
  stockAlertThreshold?: number;
}

export class BatchAddTargetsDto {
  @ApiProperty({ type: [String], description: 'Array of Trendyol URLs' })
  urls!: string[];

  @ApiPropertyOptional()
  watchlistId?: string;
}

export class UpdateShadowTargetDto {
  @ApiPropertyOptional()
  productName?: string;

  @ApiPropertyOptional()
  ourProductId?: string;

  @ApiPropertyOptional()
  watchlistId?: string;

  @ApiPropertyOptional()
  scanInterval?: number;

  @ApiPropertyOptional()
  stockProbeEnabled?: boolean;

  @ApiPropertyOptional()
  stockAlertThreshold?: number;

  @ApiPropertyOptional()
  priceAlertEnabled?: boolean;

  @ApiPropertyOptional()
  isActive?: boolean;
}

// ─── Watchlist DTOs ──────────────────────────────

export class CreateWatchlistDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ default: 1 })
  priority?: number;
}

export class UpdateWatchlistDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  priority?: number;

  @ApiPropertyOptional()
  isActive?: boolean;
}

// ─── Filter / Query DTOs ─────────────────────────

export class TargetFilterDto {
  @ApiPropertyOptional()
  watchlistId?: string;

  @ApiPropertyOptional({ description: 'in_stock | low | critical | out_of_stock' })
  stockSignal?: string;

  @ApiPropertyOptional()
  brand?: string;

  @ApiPropertyOptional()
  isActive?: string; // 'true' | 'false'

  @ApiPropertyOptional({ default: '50' })
  limit?: string;

  @ApiPropertyOptional({ default: '0' })
  offset?: string;
}

export class TimeRangeDto {
  @ApiPropertyOptional({ default: '7', description: 'Number of days' })
  days?: string;
}

export class AlertFilterDto {
  @ApiPropertyOptional({ description: 'info | warning | critical | emergency' })
  severity?: string;

  @ApiPropertyOptional()
  type?: string;

  @ApiPropertyOptional({ default: 'false' })
  unreadOnly?: string;

  @ApiPropertyOptional({ default: '50' })
  limit?: string;
}

export class ReportPeriodDto {
  @ApiPropertyOptional({ description: 'daily | weekly | monthly' })
  period?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  to?: string;
}
