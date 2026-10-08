import { IsEnum, IsMongoId, IsOptional, IsPositive, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { BloodUnitComponent, BloodUnitStatus } from '../constants/blood-unit.constants';
import { BloodGroup } from '../../donors/constants/donor.constants';

export class QueryBloodUnitsDto {
  @IsEnum(BloodUnitStatus)
  @IsOptional()
  status?: BloodUnitStatus;

  @IsEnum(BloodGroup)
  @IsOptional()
  bloodGroup?: BloodGroup;

  @IsEnum(BloodUnitComponent)
  @IsOptional()
  componentType?: BloodUnitComponent;

  @IsMongoId()
  @IsOptional()
  donorId?: string;

  @IsMongoId()
  @IsOptional()
  donationId?: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  limit?: number;
}
