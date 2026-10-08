import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsDateString,
} from 'class-validator';
import { BloodUnitComponent } from '../constants/blood-unit.constants';

export class CreateBloodUnitDto {
  @IsMongoId({ message: 'donationId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'donationId is required' })
  donationId: string;

  @IsEnum(BloodUnitComponent, {
    message: 'componentType must be one of: WHOLE_BLOOD, PRBC, FFP, PLATELETS',
  })
  @IsOptional()
  componentType?: BloodUnitComponent;

  @IsDateString(
    {},
    { message: 'expiryDate must be a valid ISO date string if provided' },
  )
  @IsOptional()
  expiryDate?: string;

  @IsNumber({}, { message: 'volume must be a number' })
  @Min(1, { message: 'volume must be greater than 0' })
  @IsOptional()
  volume?: number;

  @IsString()
  @IsOptional()
  storageLocation?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
