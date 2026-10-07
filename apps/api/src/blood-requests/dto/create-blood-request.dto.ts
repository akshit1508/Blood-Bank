import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BloodComponent,
  BloodGroup,
  RequestPriority,
} from '../blood-request.constants';

export class PatientDetailsDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  age: number;

  @IsString()
  @IsNotEmpty()
  gender: string;
}

export class ContactPersonDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  relationship: string;
}

export class CreateBloodRequestDto {
  @ValidateNested()
  @Type(() => PatientDetailsDto)
  @IsNotEmpty()
  patient: PatientDetailsDto;

  @IsEnum(BloodGroup, {
    message: 'bloodGroup must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-',
  })
  @IsNotEmpty()
  bloodGroup: BloodGroup;

  @IsEnum(BloodComponent, {
    message: 'componentType must be one of: WHOLE_BLOOD, PRBC, FFP, PLATELETS',
  })
  @IsNotEmpty()
  componentType: BloodComponent;

  @IsNumber()
  @Min(1, { message: 'unitsRequested must be at least 1' })
  unitsRequested: number;

  @IsString()
  @IsNotEmpty()
  hospitalName: string;

  @IsString()
  @IsNotEmpty()
  doctorName: string;

  @IsString()
  @IsOptional()
  doctorContact?: string;

  @IsString()
  @IsOptional()
  hospitalCaseNumber?: string;

  @IsEnum(RequestPriority, {
    message: 'priority must be one of: CRITICAL_EMERGENCY, URGENT, ROUTINE',
  })
  @IsNotEmpty()
  priority: RequestPriority;

  @ValidateNested()
  @Type(() => ContactPersonDto)
  @IsNotEmpty()
  contactPerson: ContactPersonDto;

  @IsDateString()
  @IsNotEmpty()
  requiredDate: string;

  @IsString()
  @IsOptional()
  medicalJustification?: string;

  @IsString()
  @IsOptional()
  additionalNotes?: string;
}
