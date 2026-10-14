import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WaiverCategory } from '../constants/billing.constants';

export class ApplyWaiverDto {
  @IsEnum(WaiverCategory)
  category: WaiverCategory;

  @IsString()
  reason: string;

  /** Waiver amount in INR (ignored if isFullWaiver is true) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  /** If true, waives the entire remaining outstanding balance on the invoice */
  @IsBoolean()
  @IsOptional()
  isFullWaiver?: boolean;

  /** Certificate / ID / Scheme Reference Number (e.g. BPL card #, Ayushman ID) */
  @IsString()
  @IsOptional()
  documentRef?: string;
}
