import { IsOptional, IsString } from 'class-validator';

export class CompleteTestingDto {
  @IsString()
  @IsOptional()
  performedBy?: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
