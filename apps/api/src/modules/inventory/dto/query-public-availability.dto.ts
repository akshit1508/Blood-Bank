import { IsOptional, IsEnum } from 'class-validator';
import { BloodGroup } from '../../donors/constants/donor.constants';
import { BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';

export class QueryPublicAvailabilityDto {
  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsEnum(BloodUnitComponent)
  componentType?: BloodUnitComponent;
}
