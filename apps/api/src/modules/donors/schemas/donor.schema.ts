import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BloodGroup, DonorStatus, Gender } from '../constants/donor.constants';

export type DonorDocument = Donor & Document;

@Schema({ _id: false })
export class EmergencyContact {
  @Prop({ trim: true })
  name?: string;

  @Prop({ trim: true })
  phone?: string;
}

@Schema({
  collection: 'donors',
  timestamps: true,
})
export class Donor {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  donorCode: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop({
    required: true,
    enum: Object.values(Gender),
    default: Gender.MALE,
  })
  gender: Gender;

  @Prop({
    required: true,
    enum: Object.values(BloodGroup),
    index: true,
  })
  bloodGroup: BloodGroup;

  @Prop({ required: true, trim: true, index: true })
  phone: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ type: EmergencyContact })
  emergencyContact?: EmergencyContact;

  @Prop({
    required: true,
    enum: Object.values(DonorStatus),
    default: DonorStatus.PENDING_REVIEW,
    index: true,
  })
  status: DonorStatus;

  // --- Staff User Attribution & Accountability ---
  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false, index: true })
  registeredBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  registeredByName?: string;

  @Prop({ required: false, trim: true })
  registeredByRole?: string;

  @Prop({ required: false })
  registeredAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false, index: true })
  verifiedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  verifiedByName?: string;

  @Prop({ required: false, trim: true })
  verifiedByRole?: string;

  @Prop({ required: false })
  verifiedAt?: Date;

  // --- Deferral & Screening Tracking ---
  @Prop({
    required: false,
    enum: ['NONE', 'TEMPORARY', 'PERMANENT'],
    default: 'NONE',
    index: true,
  })
  deferralStatus?: string;

  @Prop({ required: false, index: true })
  deferredUntil?: Date;

  @Prop({ required: false, trim: true })
  deferralReason?: string;

  @Prop({ required: false, trim: true })
  deferralFollowUpNotes?: string;

  @Prop({ required: false })
  lastScreeningDate?: Date;

  @Prop({ required: false, trim: true })
  lastScreeningDecision?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  updatedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  updatedByName?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const DonorSchema = SchemaFactory.createForClass(Donor);

DonorSchema.index({ createdAt: -1 });
DonorSchema.index({ registeredBy: 1 });
DonorSchema.index({ verifiedBy: 1 });
