import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  DonationStatus,
  DonationType,
} from '../constants/donation.constants';

export type DonationDocument = Donation & Document;

@Schema({
  collection: 'donations',
  timestamps: true,
})
export class Donation {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  donationCode: string;

  @Prop({ type: Types.ObjectId, ref: 'Donor', required: true, index: true })
  donorId: Types.ObjectId;

  @Prop({ required: true, index: true })
  donationDate: Date;

  @Prop({
    required: true,
    enum: Object.values(DonationType),
    default: DonationType.WHOLE_BLOOD,
  })
  donationType: DonationType;

  @Prop({ required: true, min: 1, default: 1 })
  quantity: number;

  @Prop({
    required: true,
    enum: Object.values(DonationStatus),
    default: DonationStatus.RECORDED,
    index: true,
  })
  status: DonationStatus;

  @Prop({ type: Types.ObjectId, ref: 'Campaign', required: false, index: true, sparse: true })
  campaignId?: Types.ObjectId;

  @Prop({ required: false, trim: true, uppercase: true })
  campaignCode?: string;

  @Prop({ trim: true })
  notes?: string;

  // --- Staff User Attribution & Accountability ---
  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false, index: true })
  recordedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  recordedByName?: string;

  @Prop({ required: false, trim: true })
  recordedByRole?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  processedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  processedByName?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  completedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  completedByName?: string;

  @Prop({ required: false })
  completedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  cancelledBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  cancelledByName?: string;

  @Prop({ required: false })
  cancelledAt?: Date;

  @Prop({ required: false, trim: true })
  cancellationReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const DonationSchema = SchemaFactory.createForClass(Donation);

DonationSchema.index({ createdAt: -1 });
DonationSchema.index({ donorId: 1, createdAt: -1 });
DonationSchema.index({ status: 1, donationDate: -1 });
DonationSchema.index({ campaignId: 1, status: 1 });
DonationSchema.index({ recordedBy: 1 });
