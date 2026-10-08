import { IsEnum, IsNotEmpty } from 'class-validator';
import { DonorStatus } from '../constants/donor.constants';

export class UpdateDonorStatusDto {
  @IsEnum(DonorStatus, {
    message: 'status must be one of: PENDING_REVIEW, ACTIVE, INACTIVE',
  })
  @IsNotEmpty({ message: 'status is required' })
  status: DonorStatus;
}
