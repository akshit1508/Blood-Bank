import { IsOptional, IsEnum, IsString, IsNumber, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import {
  FinancialPeriodPreset,
  FinancialTransactionType,
  FinancialTransactionDirection,
} from '../constants/financial-control-center.constants';

export class QueryFinancialLedgerDto {
  @IsOptional()
  @IsEnum(FinancialPeriodPreset)
  period?: FinancialPeriodPreset;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be in YYYY-MM-DD format' })
  endDate?: string;

  @IsOptional()
  @IsEnum(FinancialTransactionType)
  type?: FinancialTransactionType;

  @IsOptional()
  @IsEnum(FinancialTransactionDirection)
  direction?: FinancialTransactionDirection;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
