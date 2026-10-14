import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsPositive,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../constants/payment.constants';
import { IsValidInrCurrency } from '../../../common/validators/currency.validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  expenseId: string;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsValidInrCurrency()
  @Type(() => Number)
  amount: number;

  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be one of: UPI, NEFT, RTGS, IMPS, CHEQUE, CASH',
  })
  paymentMethod: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  referenceNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'paymentDate must be a valid date-only string in YYYY-MM-DD format.',
  })
  paymentDate: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(100)
  idempotencyKey: string;
}

export class CancelPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'A mandatory cancellation reason of at least 10 characters is required.',
  })
  @MaxLength(500)
  reason: string;
}

export class QueryPaymentsDto {
  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsString()
  @IsOptional()
  expenseId?: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
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
