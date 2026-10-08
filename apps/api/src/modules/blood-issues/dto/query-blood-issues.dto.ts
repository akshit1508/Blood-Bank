import { IsOptional, IsString } from 'class-validator';

export class QueryBloodIssuesDto {
  @IsOptional()
  @IsString()
  bloodRequestId?: string;

  @IsOptional()
  @IsString()
  requestCode?: string;

  @IsOptional()
  @IsString()
  reservationCode?: string;

  @IsOptional()
  @IsString()
  issueCode?: string;
}
