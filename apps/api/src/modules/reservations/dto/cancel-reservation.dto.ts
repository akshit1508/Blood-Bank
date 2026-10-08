import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelReservationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Cancellation reason cannot exceed 255 characters' })
  reason?: string;
}
