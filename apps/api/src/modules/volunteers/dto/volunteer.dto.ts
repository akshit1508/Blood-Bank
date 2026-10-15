import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  VolunteerStatus,
  VolunteerAttendanceStatus,
  VolunteerAvailability,
  VolunteerRole,
} from '../constants/volunteer.constants';

export class PublicRegisterVolunteerDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsEnum(VolunteerAvailability)
  @IsOptional()
  availability?: VolunteerAvailability;

  @IsString()
  @IsOptional()
  skills?: string;

  @IsEnum(VolunteerRole)
  @IsOptional()
  preferredRole?: VolunteerRole;
}

export class AdminCreateVolunteerDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsEnum(VolunteerAvailability)
  @IsOptional()
  availability?: VolunteerAvailability;

  @IsString()
  @IsOptional()
  skills?: string;

  @IsEnum(VolunteerRole)
  @IsOptional()
  preferredRole?: VolunteerRole;

  @IsEnum(VolunteerStatus)
  @IsOptional()
  status?: VolunteerStatus;

  @IsString()
  @IsOptional()
  adminNotes?: string;
}

export class VerifyVolunteerDto {
  @IsEnum(VolunteerStatus)
  @IsNotEmpty()
  status: VolunteerStatus.APPROVED | VolunteerStatus.REJECTED;

  @IsString()
  @IsOptional()
  adminNotes?: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

export class AssignVolunteerToCampaignDto {
  @IsString()
  @IsNotEmpty()
  volunteerId: string;

  @IsEnum(VolunteerRole)
  @IsOptional()
  role?: VolunteerRole;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RegisterAndAssignCampaignVolunteerDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsEnum(VolunteerRole)
  @IsOptional()
  role?: VolunteerRole;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateVolunteerAttendanceDto {
  @IsEnum(VolunteerAttendanceStatus)
  @IsNotEmpty()
  attendanceStatus: VolunteerAttendanceStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryVolunteersDto {
  @IsEnum(VolunteerStatus)
  @IsOptional()
  status?: VolunteerStatus;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
