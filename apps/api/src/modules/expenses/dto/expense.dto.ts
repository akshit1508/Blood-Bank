import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseCategory, CostCenter } from '../constants/expense.constants';
import { IsValidInrCurrency } from '../../../common/validators/currency.validator';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsEnum(CostCenter)
  costCenter: CostCenter;

  @IsDateString()
  expenseDate: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsValidInrCurrency()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vendorName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  invoiceNumber: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  gstinNumber?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  taxAmount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  campaignId?: string;
}

export class UpdateExpenseDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  title?: string;

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory;

  @IsEnum(CostCenter)
  @IsOptional()
  costCenter?: CostCenter;

  @IsDateString()
  @IsOptional()
  expenseDate?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsValidInrCurrency()
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  vendorName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  invoiceNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  gstinNumber?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  taxAmount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  correctionNotes?: string;

  @IsString()
  @IsOptional()
  campaignId?: string;
}

export class SubmitExpenseDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  submissionRemarks?: string;
}

export class ResubmitExpenseDto {
  @IsString()
  @IsNotEmpty({ message: 'Correction remarks are required when resubmitting a rejected expense.' })
  @MaxLength(500)
  submissionRemarks: string;
}

export class ApproveExpenseDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  approvalRemarks?: string;
}

export class RejectExpenseDto {
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required when rejecting an expense.' })
  @MaxLength(500)
  rejectionReason: string;
}

export class QueryExpensesDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  costCenter?: string;

  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class LinkVendorDto {
  @IsString()
  @IsNotEmpty()
  vendorId: string;
}
