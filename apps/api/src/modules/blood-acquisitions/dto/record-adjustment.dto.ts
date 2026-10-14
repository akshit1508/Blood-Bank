import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
  IsArray,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordAcquisitionAdjustmentDto {
  @IsEnum(['CREDIT_NOTE', 'SUPPLIER_REFUND', 'DISPUTE_SETTLEMENT'], {
    message: 'adjustmentType must be CREDIT_NOTE, SUPPLIER_REFUND, or DISPUTE_SETTLEMENT',
  })
  adjustmentType: 'CREDIT_NOTE' | 'SUPPLIER_REFUND' | 'DISPUTE_SETTLEMENT';

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  creditNoteReference?: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a valid monetary value' })
  @IsPositive({ message: 'amount must be greater than zero' })
  @Type(() => Number)
  amount: number;

  @IsString()
  @MinLength(10, { message: 'reason must be at least 10 characters' })
  reason: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedItemIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedUnitCodes?: string[];

  @IsOptional()
  @IsString()
  supportingDocumentKey?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
