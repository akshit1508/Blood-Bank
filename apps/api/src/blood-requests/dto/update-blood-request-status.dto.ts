import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BloodRequestStatus } from '../blood-request.constants';

export class UpdateBloodRequestStatusDto {
  @IsEnum(BloodRequestStatus, {
    message:
      'status must be one of: REQUESTED, VERIFIED, APPROVED, RESERVED, ISSUED, COMPLETED, REJECTED, CANCELLED',
  })
  @IsNotEmpty()
  status: BloodRequestStatus;

  @IsString()
  @IsOptional()
  statusReason?: string;
}
