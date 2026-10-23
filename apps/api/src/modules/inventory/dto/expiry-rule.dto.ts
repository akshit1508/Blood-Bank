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

export class UpdateExpiryRuleDto {
  @IsEnum(BloodUnitComponent)
  componentType: BloodUnitComponent;

  /** Standard shelf life in days from collection date (>= 1) */
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  shelfLifeDays: number;

  @IsString()
  @IsOptional()
  storageTemperature?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class BulkUpdateExpiryRulesDto {
  rules: UpdateExpiryRuleDto[];
}
