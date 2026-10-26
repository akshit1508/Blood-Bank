import { IsOptional, IsString } from 'class-validator';

export class ReserveCrossmatchDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
