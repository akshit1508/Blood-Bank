import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ExternalSourceType, BloodAcquisitionStatus } from '../constants/blood-acquisition.constants';

export class QueryBloodAcquisitionsDto {
  @IsOptional()
  @IsEnum(ExternalSourceType)
  sourceType?: ExternalSourceType;

  @IsOptional()
  @IsEnum(BloodAcquisitionStatus)
  status?: BloodAcquisitionStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  expenseStatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
