import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';

export class UpdateTariffDto {
  @IsEnum(BloodUnitComponent)
  componentType: BloodUnitComponent;

  /** Standard processing fee in INR (e.g. 1450.00) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  processingFee: number;

  /** Crossmatching fee in INR (e.g. 300.00) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  crossmatchFee?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class BulkUpdateTariffsDto {
  tariffs: UpdateTariffDto[];
}
