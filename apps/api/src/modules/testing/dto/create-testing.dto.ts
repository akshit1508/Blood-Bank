import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTestingDto {
  @IsMongoId({ message: 'bloodUnitId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'bloodUnitId is required' })
  bloodUnitId: string;

  @IsString()
  @IsOptional()
  performedBy?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
