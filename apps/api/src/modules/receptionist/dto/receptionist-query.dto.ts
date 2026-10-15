import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ReceptionistPeriodFilter {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  LAST_15_DAYS = 'last_15_days',
  LAST_30_DAYS = 'last_30_days',
  THIS_MONTH = 'this_month',
  PREVIOUS_MONTH = 'previous_month',
  CUSTOM = 'custom',
}

export class ReceptionistDashboardQueryDto {
  @IsOptional()
  @IsEnum(ReceptionistPeriodFilter)
  period?: ReceptionistPeriodFilter;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;
}

export class AttachDocumentDto {
  @IsString()
  documentType: string;

  @IsString()
  fileName: string;

  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class VerifyDocumentsDto {
  @IsEnum(['VERIFIED', 'REJECTED'])
  status: 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsString()
  notes?: string;
}
