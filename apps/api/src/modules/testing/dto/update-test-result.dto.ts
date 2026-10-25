import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { TestResultStatus } from '../constants/testing.constants';

export class UpdateTestResultDto {
  @IsEnum(TestResultStatus, {
    message: 'status must be one of: PENDING, PASS, FAIL, INDETERMINATE',
  })
  @IsNotEmpty({ message: 'status is required' })
  status: TestResultStatus;

  @IsString()
  @IsOptional()
  result?: string;

  @IsString()
  @IsOptional()
  method?: string;

  @IsString()
  @IsOptional()
  kitLotNumber?: string;

  @IsDateString(
    {},
    { message: 'kitExpiryDate must be a valid ISO date string if provided' },
  )
  @IsOptional()
  kitExpiryDate?: string;

  @IsBoolean()
  @IsOptional()
  isRepeatOrConfirmatory?: boolean;

  @IsString()
  @IsOptional()
  repeatReason?: string;

  @IsDateString(
    {},
    { message: 'testedAt must be a valid ISO date string if provided' },
  )
  @IsOptional()
  testedAt?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
