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
  @IsIn([AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN], {
    message: 'Role must be either ADMIN or LAB_TECHNICIAN',
  })
  role: AdminRole.ADMIN | AdminRole.LAB_TECHNICIAN;
}

export class UpdateAdminStatusDto {
  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsNotEmpty({ message: 'isActive is required' })
  isActive: boolean;
}

