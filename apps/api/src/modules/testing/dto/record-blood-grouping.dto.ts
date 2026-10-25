import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';

export class RecordBloodGroupingDto {
  @IsString()
  @IsNotEmpty({ message: 'aboGroup is required' })
  @IsIn(['A', 'B', 'AB', 'O'], {
    message: 'aboGroup must be one of: A, B, AB, O',
  })
  aboGroup: string;

  @IsString()
  @IsNotEmpty({ message: 'rhFactor is required' })
  @IsIn(['POSITIVE', 'NEGATIVE'], {
    message: 'rhFactor must be POSITIVE or NEGATIVE',
  })
  rhFactor: string;

  @IsString()
  @IsNotEmpty({ message: 'confirmedBloodGroup is required' })
  @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], {
    message: 'confirmedBloodGroup must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-',
  })
  confirmedBloodGroup: string;

  @IsString()
  @IsOptional()
  groupingMethod?: string;

  @IsString()
  @IsOptional()
  cellGroupingAntiA?: string;

  @IsString()
  @IsOptional()
  cellGroupingAntiB?: string;

  @IsString()
  @IsOptional()
  cellGroupingAntiD?: string;

  @IsString()
  @IsOptional()
  serumGroupingACells?: string;

  @IsString()
  @IsOptional()
  serumGroupingBCells?: string;

  @IsString()
  @IsOptional()
  serumGroupingOCells?: string;

  @IsString()
  @IsOptional()
  kitLotNumber?: string;

  @IsString()
  @IsOptional()
  kitExpiryDate?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
