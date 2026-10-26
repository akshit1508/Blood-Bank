import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCrossmatchDto {
  @IsNotEmpty({ message: 'bloodRequestId is required' })
  @IsString()
  bloodRequestId: string;

  @IsOptional()
  @IsString()
  sampleId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
