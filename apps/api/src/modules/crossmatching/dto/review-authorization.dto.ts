import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ReviewDecision } from '../constants/crossmatching.constants';

export class ReviewAuthorizationDto {
  @IsNotEmpty({ message: 'Review decision is required' })
  @IsEnum(ReviewDecision, {
    message: 'reviewDecision must be COMPATIBLE_AUTHORIZED, INCOMPATIBLE_REJECTED, REPEAT_REQUIRED, or SAFETY_HOLD',
  })
  reviewDecision: ReviewDecision;

  @IsNotEmpty({ message: 'Review rationale and clinical documentation is required' })
  @IsString()
  reviewNotes: string;
}
