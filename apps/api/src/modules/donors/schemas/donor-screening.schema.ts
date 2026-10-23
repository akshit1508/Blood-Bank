import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { DonorScreeningDecision } from '../constants/screening.constants';

export type DonorScreeningDocument = DonorScreening & Document;

@Schema({ _id: false })
export class DonorVitals {
  @Prop({ required: true, min: 30, max: 200 })
  weightKg: number;

  @Prop({ required: false, min: 100, max: 250 })
  heightCm?: number;

  @Prop({ required: true, min: 5, max: 25 })
  hemoglobinGdl: number;

  @Prop({ required: true, min: 60, max: 250 })
  bloodPressureSystolic: number;

  @Prop({ required: true, min: 40, max: 150 })
  bloodPressureDiastolic: number;

  @Prop({ required: true, min: 40, max: 180 })
  pulseBpm: number;

  @Prop({ required: true, min: 35, max: 42 })
  temperatureCelsius: number;

  @Prop({ required: false, trim: true })
  generalAppearance?: string;

  @Prop({ required: false, enum: ['GOOD', 'FAIR', 'POOR'], default: 'GOOD' })
  veinAccess?: string;
}

@Schema({ _id: false })
export class MedicalQuestionnaire {
  @Prop({ default: false })
  hasDonatedBefore: boolean;

  @Prop({ default: true })
  feelingWellToday: boolean;

  @Prop({ default: false })
  recentIllnessOrFever: boolean;

  @Prop({ default: false })
  takingMedications: boolean;

  @Prop({ trim: true })
  medicationDetails?: string;

  @Prop({ default: false })
  majorSurgeryOrDentalRecent: boolean;

  @Prop({ default: false })
  tattooPiercingLast12Months: boolean;

  @Prop({ default: false })
  recentVaccinations: boolean;

  @Prop({ default: false })
  cardiacOrRespiratoryDisease: boolean;

  @Prop({ default: false })
  diabetesOrHypertension: boolean;

  @Prop({ default: false })
  bleedingDisorderOrEpilepsy: boolean;

  @Prop({ default: false })
  historyOfJaundiceOrHepatitis: boolean;

  @Prop({ default: false })
  highRiskBehaviorOrSTI: boolean;

  @Prop({ default: false })
  malariaTreatmentOrTravelHistory: boolean;

  @Prop({ default: false })
  pregnantOrLactating: boolean;

  @Prop({ default: false })
  alcoholIntakeLast24Hours: boolean;

  @Prop({ trim: true })
  healthRemarks?: string;
}

@Schema({ _id: false })
export class DonorConsent {
  @Prop({ required: true, default: true })
  consentAcknowledged: boolean;

  @Prop({ required: true, default: true })
  donorSignatureConfirmed: boolean;

  @Prop({ required: true, default: Date.now })
  consentTimestamp: Date;
}

@Schema({
  collection: 'donor_screenings',
  timestamps: true,
})
export class DonorScreening {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  screeningCode: string;

  @Prop({ type: Types.ObjectId, ref: 'Donor', required: true, index: true })
  donorId: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true, index: true })
  donorCode: string;

  @Prop({ required: true, trim: true })
  donorFullName: string;

  @Prop({ required: false, trim: true })
  donorBloodGroup?: string;

  @Prop({ required: false, trim: true })
  donorGender?: string;

  @Prop({ type: Types.ObjectId, ref: 'Campaign', required: false, index: true, sparse: true })
  campaignId?: Types.ObjectId;

  @Prop({ required: false, trim: true, uppercase: true })
  campaignCode?: string;

  // --- Clinical Physical Examination ---
  @Prop({ type: DonorVitals, required: true })
  vitals: DonorVitals;

  // --- Pre-Donation Questionnaire ---
  @Prop({ type: MedicalQuestionnaire, required: true })
  questionnaire: MedicalQuestionnaire;

  // --- Informed Consent ---
  @Prop({ type: DonorConsent, required: true })
  consent: DonorConsent;

  // --- Screening Outcome Decision ---
  @Prop({
    required: true,
    enum: Object.values(DonorScreeningDecision),
    default: DonorScreeningDecision.PENDING,
    index: true,
  })
  decision: DonorScreeningDecision;

  @Prop({ required: false, enum: ['TEMPORARY', 'PERMANENT'] })
  deferralType?: string;

  @Prop({ required: false, trim: true })
  deferralReason?: string;

  @Prop({ required: false, index: true })
  deferredUntil?: Date;

  @Prop({ required: false, trim: true })
  decisionRemarks?: string;

  // --- Downstream Collection Linkage ---
  @Prop({
    required: true,
    enum: ['PENDING_COLLECTION', 'COLLECTED', 'CANCELLED'],
    default: 'PENDING_COLLECTION',
    index: true,
  })
  collectionStatus: string;

  @Prop({ type: Types.ObjectId, ref: 'Donation', required: false, sparse: true })
  linkedDonationId?: Types.ObjectId;

  @Prop({ required: false, trim: true, uppercase: true })
  linkedDonationCode?: string;

  // --- Staff Attribution ---
  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true, index: true })
  screenedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  screenedByName: string;

  @Prop({ required: true, trim: true })
  screenedByRole: string;

  @Prop({ required: true, default: Date.now })
  screenedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const DonorScreeningSchema = SchemaFactory.createForClass(DonorScreening);

DonorScreeningSchema.index({ createdAt: -1 });
DonorScreeningSchema.index({ donorId: 1, createdAt: -1 });
DonorScreeningSchema.index({ decision: 1, collectionStatus: 1 });
