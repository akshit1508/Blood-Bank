import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsDateString,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EmployeeDepartment,
  EmploymentType,
  EmployeeStatus,
} from '../constants/payroll.constants';

export class EmergencyContactDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  relationship?: string;
}

export class EmployeeBankDetailsDto {
  @IsString()
  bankName: string;

  @IsString()
  accountNumber: string;

  @IsString()
  ifscCode: string;

  @IsString()
  accountHolderName: string;

  @IsString()
  @IsOptional()
  panNumber?: string;
}

export class CreateEmployeeDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @ValidateNested()
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContact?: EmergencyContactDto;

  @IsString()
  designation: string;

  @IsEnum(EmployeeDepartment)
  department: EmployeeDepartment;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsDateString()
  dateOfJoining: string;

  @IsMongoId()
  @IsOptional()
  adminUserId?: string;

  @ValidateNested()
  @Type(() => EmployeeBankDetailsDto)
  bankDetails: EmployeeBankDetailsDto;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @ValidateNested()
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContact?: EmergencyContactDto;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsEnum(EmployeeDepartment)
  @IsOptional()
  department?: EmployeeDepartment;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsDateString()
  @IsOptional()
  dateOfJoining?: string;

  @IsDateString()
  @IsOptional()
  dateOfLeaving?: string;

  @IsMongoId()
  @IsOptional()
  adminUserId?: string;

  @ValidateNested()
  @Type(() => EmployeeBankDetailsDto)
  @IsOptional()
  bankDetails?: EmployeeBankDetailsDto;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryEmployeesDto {
  @IsEnum(EmployeeDepartment)
  @IsOptional()
  department?: EmployeeDepartment;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @IsString()
  @IsOptional()
  search?: string;
}
