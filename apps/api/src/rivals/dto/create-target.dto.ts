import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class CreateRivalTargetDto {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  ourProductId?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  targetMinPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  scanIntervalMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
