import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsDateString,
  IsMongoId,
} from 'class-validator';
import { DonationType } from '../constants/donation.constants';

export class CreateDonationDto {
  @IsMongoId({ message: 'donorId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'donorId is required' })
  donorId: string;

  @IsDateString({}, { message: 'donationDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'donationDate is required' })
  donationDate: string;

  @IsEnum(DonationType, {
    message: 'donationType must be WHOLE_BLOOD',
  })
  @IsNotEmpty({ message: 'donationType is required' })
  donationType: DonationType;

  @IsNumber({}, { message: 'quantity must be a number' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
