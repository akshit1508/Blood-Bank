import { IsOptional, IsString } from 'class-validator';

export class CompleteBloodRequestDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
