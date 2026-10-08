import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString, IsArray, ValidateNested, ArrayMinSize, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ExternalSourceType } from '../constants/blood-acquisition.constants';
import { BloodGroup } from '../../donors/constants/donor.constants';
import { BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';

export class BloodAcquisitionItemDto {
  @IsEnum(BloodGroup, {
    message: `bloodGroup must be a valid blood group: ${Object.values(BloodGroup).join(', ')}`,
  })
  bloodGroup: BloodGroup;

  @IsEnum(BloodUnitComponent, {
    message: `componentType must be one of: ${Object.values(BloodUnitComponent).join(', ')}`,
  })
  componentType: BloodUnitComponent;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity: number;

  @IsBoolean({ message: 'testingRequired must be a boolean (true or false)' })
  testingRequired: boolean;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'volumePerUnit must be at least 1 mL' })
  volumePerUnit?: number;

  @IsOptional()
  @IsDateString({}, { message: 'expiryDate must be a valid ISO date string' })
  expiryDate?: string;

  @IsOptional()
  @IsString()
  storageLocation?: string;

  @IsOptional()
  @IsString()
  itemNotes?: string;
}

export class CreateBloodAcquisitionDto {
  @IsEnum(ExternalSourceType, {
    message: `sourceType must be one of: ${Object.values(ExternalSourceType).join(', ')}`,
  })
  sourceType: ExternalSourceType;

  @IsString()
  @IsNotEmpty({ message: 'sourceName is required' })
  sourceName: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsDateString({}, { message: 'receivedDate must be a valid ISO date string' })
  receivedDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray({ message: 'items must be an array of blood entries' })
  @ArrayMinSize(1, { message: 'At least one blood entry is required' })
  @ValidateNested({ each: true })
  @Type(() => BloodAcquisitionItemDto)
  items: BloodAcquisitionItemDto[];
}
