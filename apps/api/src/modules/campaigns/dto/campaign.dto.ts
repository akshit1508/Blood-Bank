import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  IsDateString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignStatus } from '../constants/campaign.constants';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  venue: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  targetDonations: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  initialBudget?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  targetDonations?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class ReviseCampaignBudgetDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  newBudget: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Revision reason must be at least 3 characters long' })
  reason: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  budgetVersion: number;
}

export class LinkExpenseDto {
  @IsString()
  @IsNotEmpty()
  expenseId: string;
}

export class QueryCampaignsDto {
  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

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
