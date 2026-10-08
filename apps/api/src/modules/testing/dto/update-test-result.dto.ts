import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { TestResultStatus } from '../constants/testing.constants';

export class UpdateTestResultDto {
  @IsEnum(TestResultStatus, {
    message: 'status must be one of: PENDING, PASS, FAIL',
  })
  @IsNotEmpty({ message: 'status is required' })
  status: TestResultStatus;

  @IsString()
  @IsOptional()
  result?: string;

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
