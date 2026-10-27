import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  CrossmatchStatus,
  SampleCondition,
  AntibodyScreenResult,
  CrossmatchMethod,
  CrossmatchResult,
  ReviewDecision,
} from '../constants/crossmatching.constants';

export type CrossmatchRecordDocument = CrossmatchRecord & Document;

@Schema({ _id: false })
export class PatientDetailsSubdoc {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  age: number;

  @Prop({ required: true, trim: true })
  gender: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  hospitalName?: string;

  @Prop({ trim: true })
  doctorName?: string;

  @Prop({ trim: true })
  doctorContact?: string;

  @Prop({ trim: true })
  hospitalCaseNumber?: string;
}

export const PatientDetailsSubdocSchema =
  SchemaFactory.createForClass(PatientDetailsSubdoc);

@Schema({ _id: false })
export class SampleVerificationSubdoc {
  @Prop({ required: false, trim: true, uppercase: true })
  sampleId?: string;

  @Prop({ required: false })
  sampleCollectedAt?: Date;

  @Prop({ required: false })
  sampleReceivedAt?: Date;

  @Prop({
    type: String,
    enum: Object.values(SampleCondition),
    default: SampleCondition.VALID,
  })
  sampleCondition?: SampleCondition;

  @Prop({ default: false })
  isSampleValid: boolean;

  @Prop({ default: false })
  sampleIdentityVerified: boolean;

  @Prop({ trim: true, uppercase: true })
  verifiedAboRh?: string;

  @Prop({
    type: String,
    enum: Object.values(AntibodyScreenResult),
    default: AntibodyScreenResult.NOT_PERFORMED,
  })
  antibodyScreenResult?: AntibodyScreenResult;

  @Prop({ trim: true })
  antibodyScreenNotes?: string;

  @Prop()
  sampleVerifiedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  sampleVerifiedBy?: Types.ObjectId;

  @Prop({ trim: true })
  sampleVerifiedByName?: string;

  @Prop({ trim: true })
  sampleVerifiedByRole?: string;

  @Prop({ trim: true })
  sampleVerificationNotes?: string;
}

export const SampleVerificationSubdocSchema =
  SchemaFactory.createForClass(SampleVerificationSubdoc);

@Schema({ _id: false })
export class SelectedUnitSubdoc {
  @Prop({ type: Types.ObjectId, ref: 'BloodUnit' })
  bloodUnitId?: Types.ObjectId;

  @Prop({ trim: true, uppercase: true })
  unitCode?: string;

  @Prop({ type: Types.ObjectId, ref: 'Inventory' })
  inventoryId?: Types.ObjectId;

  @Prop({ trim: true, uppercase: true })
  donorBloodGroup?: string;

  @Prop({ trim: true })
  componentType?: string;

  @Prop()
  expiryDate?: Date;

  @Prop()
  collectionDate?: Date;

  @Prop({ trim: true })
  storageLocation?: string;

  @Prop({ default: false })
  isAboRhCompatible: boolean;

  @Prop({ trim: true })
  compatibilityRuleReference?: string;

  @Prop()
  unitSelectedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  unitSelectedBy?: Types.ObjectId;

  @Prop({ trim: true })
  unitSelectedByName?: string;

  @Prop({ trim: true })
  unitSelectedByRole?: string;
}

export const SelectedUnitSubdocSchema =
  SchemaFactory.createForClass(SelectedUnitSubdoc);

@Schema({ _id: false })
export class LaboratoryTestSubdoc {
  @Prop({
    type: String,
    enum: Object.values(CrossmatchMethod),
  })
  testMethod?: CrossmatchMethod;

  @Prop({ type: [String], default: [] })
  testPhases?: string[];

  @Prop({
    type: String,
    enum: Object.values(CrossmatchResult),
    default: CrossmatchResult.PENDING,
  })
  crossmatchResult: CrossmatchResult;

  @Prop({ trim: true })
  reactionGrade?: string; // 0 (negative/compatible), 1+, 2+, 3+, 4+, etc.

  @Prop()
  testedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  testedBy?: Types.ObjectId;

  @Prop({ trim: true })
  testedByName?: string;

  @Prop({ trim: true })
  testedByRole?: string;

  @Prop({ trim: true })
  testingNotes?: string;

  @Prop({ default: false })
  isRepeatTest: boolean;

  @Prop({ type: Types.ObjectId, ref: 'CrossmatchRecord' })
  previousCrossmatchId?: Types.ObjectId;

  @Prop({ trim: true })
  repeatReason?: string;
}

export const LaboratoryTestSubdocSchema =
  SchemaFactory.createForClass(LaboratoryTestSubdoc);

@Schema({ _id: false })
export class ReviewAuthorizationSubdoc {
  @Prop({ trim: true, default: 'PENDING_REVIEW' })
  reviewStatus?: string;

  @Prop()
  reviewedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  reviewedBy?: Types.ObjectId;

  @Prop({ trim: true })
  reviewedByName?: string;

  @Prop({ trim: true })
  reviewedByRole?: string;

  @Prop({
    type: String,
    enum: Object.values(ReviewDecision),
  })
  reviewDecision?: ReviewDecision;

  @Prop({ trim: true })
  reviewNotes?: string;
}

export const ReviewAuthorizationSubdocSchema =
  SchemaFactory.createForClass(ReviewAuthorizationSubdoc);

@Schema({ _id: false })
export class TimelineEntrySubdoc {
  @Prop({ required: true })
  fromStatus: string;

  @Prop({ required: true })
  toStatus: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  actorId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  actorName: string;

  @Prop({ required: true, trim: true })
  actorRole: string;

  @Prop({ required: true, default: Date.now })
  timestamp: Date;

  @Prop({ required: true, trim: true })
  action: string;

  @Prop({ trim: true })
  notes?: string;
}

export const TimelineEntrySubdocSchema =
  SchemaFactory.createForClass(TimelineEntrySubdoc);

@Schema({
  collection: 'crossmatch_records',
  timestamps: true,
})
export class CrossmatchRecord {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  crossmatchCode: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'BloodRequest',
    required: true,
    index: true,
  })
  bloodRequestId: Types.ObjectId;

  @Prop({ required: true, index: true, uppercase: true })
  requestCode: string;

  @Prop({ type: PatientDetailsSubdocSchema, required: true })
  patient: PatientDetailsSubdoc;

  @Prop({ required: true, index: true, uppercase: true })
  patientBloodGroup: string;

  @Prop({ required: true, index: true, uppercase: true })
  requestedComponent: string;

  @Prop({ required: true, default: 'ROUTINE', uppercase: true })
  urgency: string;

  @Prop({ required: true, min: 1, default: 1 })
  unitsRequested: number;

  @Prop({ type: SampleVerificationSubdocSchema, default: () => ({}) })
  sample: SampleVerificationSubdoc;

  @Prop({ type: SelectedUnitSubdocSchema, default: () => ({}) })
  selectedUnit: SelectedUnitSubdoc;

  @Prop({ type: [SelectedUnitSubdocSchema], default: () => [] })
  selectedUnits: SelectedUnitSubdoc[];

  @Prop({ type: LaboratoryTestSubdocSchema, default: () => ({}) })
  laboratoryTest: LaboratoryTestSubdoc;

  @Prop({ type: ReviewAuthorizationSubdocSchema, default: () => ({}) })
  review: ReviewAuthorizationSubdoc;

  // Reservation & Issue Linkage
  @Prop({ type: Types.ObjectId, ref: 'Reservation', index: true })
  reservationId?: Types.ObjectId;

  @Prop({ trim: true, uppercase: true })
  reservationCode?: string;

  @Prop()
  reservedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'BloodIssue', index: true })
  bloodIssueId?: Types.ObjectId;

  @Prop({ trim: true, uppercase: true })
  issueCode?: string;

  @Prop()
  issuedAt?: Date;

  // State Management
  @Prop({
    required: true,
    enum: Object.values(CrossmatchStatus),
    default: CrossmatchStatus.PENDING_SAMPLE_VERIFICATION,
    index: true,
  })
  status: CrossmatchStatus;

  @Prop({ trim: true })
  cancellationReason?: string;

  @Prop()
  cancelledAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  cancelledBy?: Types.ObjectId;

  @Prop({ trim: true })
  cancelledByName?: string;

  @Prop({ type: [TimelineEntrySubdocSchema], default: [] })
  timeline: TimelineEntrySubdoc[];

  createdAt: Date;
  updatedAt: Date;
}

export const CrossmatchRecordSchema =
  SchemaFactory.createForClass(CrossmatchRecord);

CrossmatchRecordSchema.index({ createdAt: -1 });
CrossmatchRecordSchema.index({ status: 1, urgency: 1 });
CrossmatchRecordSchema.index({ 'selectedUnit.bloodUnitId': 1 }, { sparse: true });
CrossmatchRecordSchema.index({ 'selectedUnit.inventoryId': 1 }, { sparse: true });
CrossmatchRecordSchema.index({ 'selectedUnits.inventoryId': 1 }, { sparse: true });
CrossmatchRecordSchema.index({ 'sample.sampleId': 1 }, { sparse: true });
