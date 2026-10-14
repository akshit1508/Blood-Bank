import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus, CollectionPaymentMethod } from '../constants/billing.constants';

export class QueryInvoicesDto {
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @IsString()
  @IsOptional()
  hospitalName?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class QueryCollectionsDto {
  @IsEnum(CollectionPaymentMethod)
  @IsOptional()
  paymentMethod?: CollectionPaymentMethod;

  @IsString()
  @IsOptional()
  invoiceId?: string;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
