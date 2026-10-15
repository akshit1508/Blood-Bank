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

export class RecordCampaignDonationDto {
  @IsString()
  @IsOptional()
  donorId?: string;

  @IsString()
  @IsOptional()
  donorFullName?: string;

  @IsString()
  @IsOptional()
  donorBloodGroup?: string;

  @IsString()
  @IsOptional()
  donorGender?: string;

  @IsString()
  @IsOptional()
  donorPhone?: string;

  @IsString()
  @IsOptional()
  donorEmail?: string;

  @IsDateString()
  @IsOptional()
  donationDate?: string;

  @IsString()
  @IsOptional()
  donationType?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  quantity?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  volume?: number;

  @IsString()
  @IsOptional()
  componentType?: string;

  @IsString()
  @IsOptional()
  storageLocation?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  immediateScreeningDecision?: string; // 'PENDING' | 'APPROVED' | 'REJECTED'
}

export class UpdateCampaignUnitTestingDecisionDto {
  @IsString()
  @IsNotEmpty()
  decision: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsString()
  @IsOptional()
  performedBy?: string;
}
