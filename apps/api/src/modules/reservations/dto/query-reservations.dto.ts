import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ReservationStatus } from '../constants/reservation.constants';

export class QueryReservationsDto {
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsString()
  bloodRequestId?: string;

  @IsOptional()
  @IsString()
  requestCode?: string;

  @IsOptional()
  @IsString()
  reservationCode?: string;
}
