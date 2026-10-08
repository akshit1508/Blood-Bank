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

  @Prop({ trim: true })
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const DonationSchema = SchemaFactory.createForClass(Donation);

DonationSchema.index({ createdAt: -1 });
DonationSchema.index({ donorId: 1, createdAt: -1 });
DonationSchema.index({ status: 1, donationDate: -1 });
