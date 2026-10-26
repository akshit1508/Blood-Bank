import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  SampleCondition,
  AntibodyScreenResult,
} from '../constants/crossmatching.constants';

export class VerifySampleDto {
  @IsNotEmpty({ message: 'Sample ID is mandatory for chain-of-custody verification' })
  @IsString()
  sampleId: string;

  @IsNotEmpty({ message: 'Sample collection date/time is required' })
  @IsString()
  sampleCollectedAt: string;

  @IsNotEmpty({ message: 'Sample laboratory receipt date/time is required' })
  @IsString()
  sampleReceivedAt: string;

  @IsNotEmpty({ message: 'Sample physical integrity condition must be assessed' })
  @IsEnum(SampleCondition, {
    message: 'sampleCondition must be a recognized clinical sample condition',
  })
  sampleCondition: SampleCondition;

  @IsNotEmpty({ message: 'Patient identity verification confirmation is required' })
  @IsBoolean()
  sampleIdentityVerified: boolean;

  @IsNotEmpty({ message: 'Verified patient ABO/Rh group typing is required' })
  @IsString()
  verifiedAboRh: string;

  @IsNotEmpty({ message: 'Antibody screening result reference is required' })
  @IsEnum(AntibodyScreenResult, {
    message: 'antibodyScreenResult must be NEGATIVE, POSITIVE, INCONCLUSIVE, or NOT_PERFORMED',
  })
  antibodyScreenResult: AntibodyScreenResult;

  @IsOptional()
  @IsString()
  antibodyScreenNotes?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
