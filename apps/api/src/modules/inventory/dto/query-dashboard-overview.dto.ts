import { IsOptional, IsEnum, IsISO8601 } from 'class-validator';

export enum DashboardPeriodPreset {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = '7days',
  LAST_15_DAYS = '15days',
  LAST_30_DAYS = '30days',
  ALL_TIME = 'all',
  CUSTOM = 'custom',
}

export class QueryDashboardOverviewDto {
  @IsOptional()
  @IsEnum(DashboardPeriodPreset, {
    message: 'Period must be one of: today, yesterday, 7days, 15days, 30days, all, custom',
  })
  period?: DashboardPeriodPreset;

  @IsOptional()
  @IsISO8601({}, { message: 'startDate must be a valid ISO 8601 date string (e.g. YYYY-MM-DD)' })
  startDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endDate must be a valid ISO 8601 date string (e.g. YYYY-MM-DD)' })
  endDate?: string;
}
