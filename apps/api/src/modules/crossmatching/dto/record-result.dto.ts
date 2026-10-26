import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  CrossmatchMethod,
  CrossmatchResult,
} from '../constants/crossmatching.constants';

export class RecordResultDto {
  @IsNotEmpty({ message: 'Crossmatch methodology is required' })
  @IsEnum(CrossmatchMethod, {
    message: 'testMethod must be IMMEDIATE_SPIN, AHG_COOMBS, GEL_CARD, COMPUTERIZED_ELECTRONIC, or TUBE_AHG_37C',
  })
  testMethod: CrossmatchMethod;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  testPhases?: string[];

  @IsNotEmpty({ message: 'Observed laboratory crossmatch result is required' })
  @IsEnum(CrossmatchResult, {
    message: 'crossmatchResult must be PENDING, IN_PROGRESS, COMPATIBLE, INCOMPATIBLE, INVALID, or INCONCLUSIVE',
  })
  crossmatchResult: CrossmatchResult;

  @IsOptional()
  @IsString()
  reactionGrade?: string;

  @IsOptional()
  @IsString()
  testedAt?: string;

  @IsOptional()
  @IsString()
  testingNotes?: string;
}
