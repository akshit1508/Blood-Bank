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
}
