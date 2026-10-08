import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsPositive,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TestingDecision,
  TestingStatus,
} from '../constants/testing.constants';

export class QueryTestingDto {
  @IsEnum(TestingStatus)
  @IsOptional()
  status?: TestingStatus;

  @IsEnum(TestingDecision)
  @IsOptional()
  decision?: TestingDecision;

  @IsMongoId()
  @IsOptional()
  bloodUnitId?: string;

  @IsMongoId()
  @IsOptional()
  donationId?: string;

  @IsMongoId()
  @IsOptional()
  donorId?: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  limit?: number;
}
