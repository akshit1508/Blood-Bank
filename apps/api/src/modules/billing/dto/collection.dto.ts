import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CollectionPaymentMethod } from '../constants/billing.constants';

export class RecordCollectionDto {
  /** Collected amount in INR (>= 0.01) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsEnum(CollectionPaymentMethod)
  paymentMethod: CollectionPaymentMethod;

  /** Cash receipt #, UPI reference, Card auth, or hospital account folio */
  @IsString()
  referenceNumber: string;

  /** Client-supplied unique idempotency key */
  @IsString()
  idempotencyKey: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReverseCollectionDto {
  @IsString()
  reason: string;
}
