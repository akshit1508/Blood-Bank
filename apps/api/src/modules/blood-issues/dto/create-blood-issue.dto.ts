import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBloodIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  issuedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
