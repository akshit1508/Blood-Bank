import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  ValidateNested,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DonorScreeningDecision } from '../constants/screening.constants';

export class DonorVitalsDto {
  @IsNumber()
  @Min(30, { message: 'Weight must be at least 30 kg' })
  @Max(200, { message: 'Weight exceeds plausible limits' })
  @Type(() => Number)
  weightKg: number;

  @IsNumber()
  @IsOptional()
  @Min(100)
  @Max(250)
  @Type(() => Number)
  heightCm?: number;

  @IsNumber()
  @Min(5, { message: 'Hemoglobin must be at least 5 g/dL' })
  @Max(25, { message: 'Hemoglobin exceeds plausible limits' })
  @Type(() => Number)
  hemoglobinGdl: number;

  @IsNumber()
  @Min(60)
  @Max(250)
  @Type(() => Number)
  bloodPressureSystolic: number;

  @IsNumber()
  @Min(40)
  @Max(150)
  @Type(() => Number)
  bloodPressureDiastolic: number;

  @IsNumber()
  @Min(40)
  @Max(180)
  @Type(() => Number)
  pulseBpm: number;

  @IsNumber()
  @Min(35)
  @Max(42)
  @Type(() => Number)
  temperatureCelsius: number;

  @IsString()
  @IsOptional()
  generalAppearance?: string;

  @IsString()
  @IsOptional()
  veinAccess?: string;
}

export class MedicalQuestionnaireDto {
  @IsBoolean()
  @IsOptional()
  hasDonatedBefore?: boolean;

  @IsBoolean()
  @IsOptional()
  feelingWellToday?: boolean;

  @IsBoolean()
  @IsOptional()
  recentIllnessOrFever?: boolean;

  @IsBoolean()
  @IsOptional()
  takingMedications?: boolean;

  @IsString()
  @IsOptional()
  medicationDetails?: string;

  @IsBoolean()
  @IsOptional()
  majorSurgeryOrDentalRecent?: boolean;

  @IsBoolean()
  @IsOptional()
  tattooPiercingLast12Months?: boolean;

  @IsBoolean()
  @IsOptional()
  recentVaccinations?: boolean;

  @IsBoolean()
  @IsOptional()
  cardiacOrRespiratoryDisease?: boolean;

  @IsBoolean()
  @IsOptional()
  diabetesOrHypertension?: boolean;

  @IsBoolean()
  @IsOptional()
  bleedingDisorderOrEpilepsy?: boolean;

  @IsBoolean()
  @IsOptional()
  historyOfJaundiceOrHepatitis?: boolean;

  @IsBoolean()
  @IsOptional()
  highRiskBehaviorOrSTI?: boolean;

  @IsBoolean()
  @IsOptional()
  malariaTreatmentOrTravelHistory?: boolean;

  @IsBoolean()
  @IsOptional()
  pregnantOrLactating?: boolean;

  @IsBoolean()
  @IsOptional()
  alcoholIntakeLast24Hours?: boolean;

  @IsString()
  @IsOptional()
  healthRemarks?: string;
}

export class DonorConsentDto {
  @IsBoolean()
  @IsOptional()
  consentAcknowledged?: boolean;

  @IsBoolean()
  @IsOptional()
  donorSignatureConfirmed?: boolean;
}

export class CreateDonorScreeningDto {
  @IsString()
  @IsNotEmpty({ message: 'Donor ID is required' })
  donorId: string;

  @IsString()
  @IsOptional()
  campaignId?: string;

  @ValidateNested()
  @Type(() => DonorVitalsDto)
  @IsNotEmpty({ message: 'Donor examination vitals are required' })
  vitals: DonorVitalsDto;

  @ValidateNested()
  @Type(() => MedicalQuestionnaireDto)
  @IsOptional()
  questionnaire?: MedicalQuestionnaireDto;

  @ValidateNested()
  @Type(() => DonorConsentDto)
  @IsOptional()
  consent?: DonorConsentDto;

  @IsEnum(DonorScreeningDecision)
  @IsOptional()
  decision?: DonorScreeningDecision;

  @IsString()
  @IsOptional()
  deferralType?: 'TEMPORARY' | 'PERMANENT';

  @IsString()
  @IsOptional()
  deferralReason?: string;

  @IsDateString()
  @IsOptional()
  deferredUntil?: string;

  @IsString()
  @IsOptional()
  decisionRemarks?: string;
}
