import { IsOptional, IsEnum, IsNumber, Min, IsString, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { InventoryStatus } from '../constants/inventory.constants';
import { BloodGroup } from '../../donors/constants/donor.constants';
import { BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';

export class QueryInventoryDto {
  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  expiringSoon?: boolean;

  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsEnum(BloodUnitComponent)
  componentType?: BloodUnitComponent;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
