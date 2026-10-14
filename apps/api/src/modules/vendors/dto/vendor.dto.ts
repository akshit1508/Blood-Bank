import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsEmail,
  Matches,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseCategory } from '../../expenses/constants/expense.constants';

export class BankDetailsDto {
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{9,18}$/, {
    message: 'Bank account number must be between 9 and 18 digits.',
  })
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'IFSC code must be a valid 11-character Indian financial code (e.g., SBIN0001234).',
  })
  ifscCode: string;

  @IsString()
  @IsOptional()
  branchName?: string;
}

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ExpenseCategory, {
    message: 'category must be a valid ExpenseCategory enum value.',
  })
  category: ExpenseCategory;

  @IsString()
  @IsNotEmpty()
  contactPerson: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9+\-\s]{8,15}$/, {
    message: 'Phone number must be between 8 and 15 digits/characters.',
  })
  phone: string;

  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'GSTIN must be a valid 15-character Indian GST format (e.g. 29AAAAA0000A1Z5).',
  })
  gstinNumber?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'PAN must be a valid 10-character Indian PAN format (e.g. ABCDE1234F).',
  })
  panNumber?: string;

  @ValidateNested()
  @Type(() => BankDetailsDto)
  @IsOptional()
  bankDetails?: BankDetailsDto;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateVendorDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory;

  @IsString()
  @IsOptional()
  contactPerson?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[0-9+\-\s]{8,15}$/)
  phone?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
  gstinNumber?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
  panNumber?: string;

  @ValidateNested()
  @Type(() => BankDetailsDto)
  @IsOptional()
  bankDetails?: BankDetailsDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
