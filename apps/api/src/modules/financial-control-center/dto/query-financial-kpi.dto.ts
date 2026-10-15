import { IsOptional, IsEnum, IsString, Matches } from 'class-validator';
import { FinancialPeriodPreset } from '../constants/financial-control-center.constants';

export class QueryFinancialKpiDto {
  @IsOptional()
  @IsEnum(FinancialPeriodPreset)
  period?: FinancialPeriodPreset = FinancialPeriodPreset.THIS_MONTH;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be in YYYY-MM-DD format' })
  endDate?: string;
}
