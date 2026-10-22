import { IsEmail, IsNotEmpty, IsString, MinLength, IsIn, IsBoolean, IsOptional } from 'class-validator';
import { AdminRole } from '../schemas/admin-user.schema';

export class AdminLoginDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}

export class CreateAdminDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsNotEmpty({ message: 'Role is required' })
  @IsIn([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN, AdminRole.FINANCE_RECEPTIONIST], {
    message: 'Role must be either SUPER_ADMIN, ADMIN, LAB_TECHNICIAN, or FINANCE_RECEPTIONIST',
  })
  role: AdminRole;
}

export class UpdateAdminDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  @IsIn([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN, AdminRole.FINANCE_RECEPTIONIST], {
    message: 'Role must be either SUPER_ADMIN, ADMIN, LAB_TECHNICIAN, or FINANCE_RECEPTIONIST',
  })
  role?: AdminRole;

  @IsString()
  @IsOptional()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAdminStatusDto {
  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsNotEmpty({ message: 'isActive is required' })
  isActive: boolean;
}

export class QueryAdminDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  role?: AdminRole;

  @IsString()
  @IsOptional()
  status?: string; // 'all' | 'active' | 'inactive'
}

