import { IsEnum, IsNotEmpty } from 'class-validator';
import { DonationStatus } from '../constants/donation.constants';

export class UpdateDonationStatusDto {
  @IsEnum(DonationStatus, {
    message: 'status must be one of: RECORDED, PROCESSING, COMPLETED, CANCELLED',
  })
  @IsNotEmpty({ message: 'status is required' })
  status: DonationStatus;
}
