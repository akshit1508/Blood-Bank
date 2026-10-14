import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CustomLineChargeDto {
  @IsString()
  unitCode: string;

  /** Override base fee in INR if customized */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  processingFee?: number;

  /** Override crossmatch fee in INR if customized */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  crossmatchFee?: number;
}

export class GenerateInvoiceDto {
  /** If true, includes crossmatch fees on red cell components (PRBC, Whole Blood). Default: true */
  @IsBoolean()
  @IsOptional()
  applyCrossmatchFee?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomLineChargeDto)
  @IsOptional()
  customCharges?: CustomLineChargeDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CancelInvoiceDto {
  @IsString()
  reason: string;
}
