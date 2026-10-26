import { IsOptional, IsString } from 'class-validator';

export class IssueCrossmatchDto {
  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  recipientHospitalId?: string;

  @IsOptional()
  @IsString()
  issueNotes?: string;
}
