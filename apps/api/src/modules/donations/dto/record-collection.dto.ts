import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BagType,
  CollectionOutcome,
  AdverseReactionType,
  BagIntegrity,
} from '../../donors/constants/screening.constants';
import { DonationType } from '../constants/donation.constants';

export class RecordCollectionDto {
  @IsString()
  @IsNotEmpty({ message: 'Donor ID is mandatory for blood collection' })
  donorId: string;

  @IsString()
  @IsOptional()
  screeningId?: string;

  @IsDateString()
  @IsOptional()
  donationDate?: string;

  @IsEnum(DonationType)
  @IsOptional()
  donationType?: DonationType;

  @IsString()
  @IsOptional()
  campaignId?: string;

  @IsEnum(BagType)
  @IsOptional()
  bagType?: BagType;

  @IsNumber()
  @IsOptional()
  @Min(50)
  @Max(600)
  @Type(() => Number)
  collectedVolumeMl?: number;

  @IsString()
  @IsOptional()
  venipunctureSite?: string;

  @IsEnum(CollectionOutcome)
  @IsOptional()
  collectionOutcome?: CollectionOutcome;

  @IsEnum(AdverseReactionType)
  @IsOptional()
  adverseReaction?: AdverseReactionType;

  @IsString()
  @IsOptional()
  adverseReactionNotes?: string;

  @IsEnum(BagIntegrity)
  @IsOptional()
  bagIntegrity?: BagIntegrity;

  @IsString()
  @IsOptional()
  collectionLocation?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
