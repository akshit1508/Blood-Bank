import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ReplacementDonorRelationship,
  ReplacementTrackingStatus,
} from '../constants/replacement-donation.constants';
import { CreateDonorDto } from '../../donors/dto/create-donor.dto';

export class CreateReplacementTrackingDto {
  @IsNotEmpty({ message: 'bloodRequestId is required' })
  @IsMongoId({ message: 'bloodRequestId must be a valid MongoDB ObjectId' })
  bloodRequestId: string;

  @IsOptional()
  @IsMongoId({ message: 'donorId must be a valid MongoDB ObjectId' })
  donorId?: string;

  @IsNotEmpty({ message: 'relationshipToPatient is required' })
  @IsEnum(ReplacementDonorRelationship, {
    message: `relationshipToPatient must be one of: ${Object.values(
      ReplacementDonorRelationship,
    ).join(', ')}`,
  })
  relationshipToPatient: ReplacementDonorRelationship;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDonorDto)
  newDonor?: CreateDonorDto;
}

export class AssociateDonorDto {
  @IsNotEmpty({ message: 'donorId is required' })
  @IsMongoId({ message: 'donorId must be a valid MongoDB ObjectId' })
  donorId: string;

  @IsOptional()
  @IsEnum(ReplacementDonorRelationship)
  relationshipToPatient?: ReplacementDonorRelationship;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class LinkDonationDto {
  @IsNotEmpty({ message: 'donationId is required' })
  @IsMongoId({ message: 'donationId must be a valid MongoDB ObjectId' })
  donationId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelReplacementTrackingDto {
  @IsNotEmpty({ message: 'cancellationReason is required' })
  @IsString()
  @MinLength(3, { message: 'cancellationReason must be at least 3 characters' })
  cancellationReason: string;
}

export class UpdateReplacementTrackingNotesDto {
  @IsNotEmpty({ message: 'notes cannot be empty' })
  @IsString()
  notes: string;
}

export class QueryReplacementDonationsDto {
  @IsOptional()
  @IsString()
  bloodRequestId?: string;

  @IsOptional()
  @IsString()
  donorId?: string;

  @IsOptional()
  @IsEnum(ReplacementTrackingStatus)
  status?: ReplacementTrackingStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
