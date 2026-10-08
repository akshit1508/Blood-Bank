import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BloodGroup, Gender } from '../constants/donor.constants';

export class EmergencyContactDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}

export class CreateDonorDto {
  @IsString()
  @IsNotEmpty({ message: 'fullName is required' })
  fullName: string;

  @IsDateString({}, { message: 'dateOfBirth must be a valid ISO date string' })
  @IsOptional()
  dateOfBirth?: string;

  @IsEnum(Gender, {
    message: 'gender must be one of: MALE, FEMALE, OTHER',
  })
  @IsNotEmpty({ message: 'gender is required' })
  gender: Gender;

  @IsEnum(BloodGroup, {
    message: 'bloodGroup must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-',
  })
  @IsNotEmpty({ message: 'bloodGroup is required' })
  bloodGroup: BloodGroup;

  @IsString()
  @IsNotEmpty({ message: 'phone is required' })
  phone: string;

  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @ValidateNested()
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContact?: EmergencyContactDto;
}
