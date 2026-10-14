import {
  IsNumber,
  Min,
  IsDateString,
  IsString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalaryStructureDto {
  @IsDateString()
  effectiveFrom: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  basicSalary: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  hra?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  allowances?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  pfDeduction?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  taxDeduction?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  otherDeductions?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
