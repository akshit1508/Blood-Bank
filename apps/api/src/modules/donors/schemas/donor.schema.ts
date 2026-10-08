import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
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

  createdAt: Date;
  updatedAt: Date;
}

export const DonorSchema = SchemaFactory.createForClass(Donor);

DonorSchema.index({ createdAt: -1 });
