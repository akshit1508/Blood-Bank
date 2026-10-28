import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ReplacementTrackingStatus,
  ReplacementDonorRelationship,
} from '../constants/replacement-donation.constants';

export type ReplacementDonationDocument = ReplacementDonation & Document;

@Schema({ _id: false })
export class ReplacementTimelineEvent {
  @Prop({ required: true })
  event: string;

  @Prop({
    type: String,
    enum: Object.values(ReplacementTrackingStatus),
    required: true,
  })
  status: ReplacementTrackingStatus;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String, default: null })
  actorId?: string;

  @Prop({ type: String, default: 'System' })
  actorName: string;

  @Prop({ type: String, default: 'SYSTEM' })
  actorRole: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

export const ReplacementTimelineEventSchema =
  SchemaFactory.createForClass(ReplacementTimelineEvent);

@Schema({ timestamps: true, collection: 'replacement_donations' })
export class ReplacementDonation {
  _id?: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  trackingCode: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'BloodRequest',
    required: true,
    index: true,
  })
  bloodRequestId: Types.ObjectId;

  @Prop({ required: true, index: true })
  requestCode: string;

  @Prop({ required: true })
  patientName: string;

  @Prop({ required: true })
  patientBloodGroup: string;

  @Prop({ type: String, default: null })
  patientPhone?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Donor',
    required: true,
    index: true,
  })
  donorId: Types.ObjectId;

  @Prop({ required: true, index: true })
  donorCode: string;

  @Prop({ required: true })
  donorName: string;

  @Prop({ required: true })
  donorBloodGroup: string;

  @Prop({ type: String, default: null })
  donorPhone?: string;

  @Prop({
    type: String,
    enum: Object.values(ReplacementDonorRelationship),
    default: ReplacementDonorRelationship.FAMILY,
  })
  relationshipToPatient: ReplacementDonorRelationship;

  @Prop({
    type: Types.ObjectId,
    ref: 'Donation',
    default: null,
    index: true,
  })
  donationId?: Types.ObjectId;

  @Prop({ type: String, default: null, index: true })
  donationCode?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'BloodUnit',
    default: null,
    index: true,
  })
  bloodUnitId?: Types.ObjectId;

  @Prop({ type: String, default: null, index: true })
  unitCode?: string;

  @Prop({
    type: String,
    enum: Object.values(ReplacementTrackingStatus),
    default: ReplacementTrackingStatus.DONOR_ASSOCIATED,
    index: true,
  })
  status: ReplacementTrackingStatus;

  @Prop({ type: String, default: null })
  notes?: string;

  @Prop({ type: String, default: null })
  cancellationReason?: string;

  @Prop({ type: [ReplacementTimelineEventSchema], default: [] })
  timeline: ReplacementTimelineEvent[];

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', default: null })
  createdById?: Types.ObjectId;

  @Prop({ type: String, default: 'Staff' })
  createdByName?: string;

  @Prop({ type: String, default: 'STAFF' })
  createdByRole?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', default: null })
  updatedById?: Types.ObjectId;

  @Prop({ type: String, default: null })
  updatedByName?: string;

  @Prop({ type: String, default: null })
  updatedByRole?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ReplacementDonationSchema =
  SchemaFactory.createForClass(ReplacementDonation);

// Compound / Query Indexes
ReplacementDonationSchema.index({ bloodRequestId: 1, donorId: 1 });
ReplacementDonationSchema.index({ status: 1, createdAt: -1 });
