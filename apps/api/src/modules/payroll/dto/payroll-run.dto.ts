import {
  IsString,
  Matches,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PayrollRunStatus,
  DisbursementPaymentMethod,
} from '../constants/payroll.constants';

export class GeneratePayrollRunDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'payrollPeriod must be in YYYY-MM format (e.g. 2026-10)',
  })
  payrollPeriod: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ApprovePayrollRunDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class DisburseSalarySlipDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsEnum(DisbursementPaymentMethod)
  paymentMethod: DisbursementPaymentMethod;

  @IsString()
  transactionReference: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  receiptDocumentRef?: string;
}

export class BatchDisbursePayrollDto {
  @IsEnum(DisbursementPaymentMethod)
  paymentMethod: DisbursementPaymentMethod;

  @IsString()
  transactionReferencePrefix: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryPayrollRunsDto {
  @IsEnum(PayrollRunStatus)
  @IsOptional()
  status?: PayrollRunStatus;

  @IsString()
  @IsOptional()
  payrollPeriod?: string;
}

export class DirectPayEmployeeDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'period must be in YYYY-MM format (e.g. 2026-10)',
  })
  @IsOptional()
  period?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsEnum(DisbursementPaymentMethod)
  paymentMethod: DisbursementPaymentMethod;

  @IsString()
  transactionReference: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  receiptDocumentRef?: string;
}

export class QueryPayrollRosterDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'period must be in YYYY-MM format (e.g. 2026-10)',
  })
  @IsOptional()
  period?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
