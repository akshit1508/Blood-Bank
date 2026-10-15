import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  VolunteerStatus,
  VolunteerAvailability,
  VolunteerRole,
} from '../constants/volunteer.constants';

export type VolunteerDocument = Volunteer & Document;

@Schema({ timestamps: true, collection: 'volunteers' })
export class Volunteer {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  volunteerCode: string;

  @Prop({ required: true, trim: true, index: true })
  fullName: string;

  @Prop({ required: true, trim: true, index: true })
  phone: string;

  @Prop({ trim: true, lowercase: true, index: true })
  email?: string;

  @Prop({ trim: true, uppercase: true })
  bloodGroup?: string;

  @Prop({ trim: true, uppercase: true, default: 'OTHER' })
  gender?: string;

  @Prop({ required: true, trim: true, index: true })
  city: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  occupation?: string;

  @Prop({
    type: String,
    enum: Object.values(VolunteerAvailability),
    default: VolunteerAvailability.WEEKENDS,
  })
  availability?: string;

  @Prop({ trim: true })
  skills?: string;

  @Prop({
    type: String,
    enum: Object.values(VolunteerRole),
    default: VolunteerRole.GENERAL,
  })
  preferredRole?: string;

  @Prop({
    type: String,
    enum: Object.values(VolunteerStatus),
    default: VolunteerStatus.PENDING,
    index: true,
  })
  status: VolunteerStatus;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop({ trim: true })
  adminNotes?: string;

  @Prop({
    type: String,
    enum: ['PUBLIC_PORTAL', 'ADMIN_MANUAL', 'CAMPAIGN_DIRECT'],
    default: 'PUBLIC_PORTAL',
  })
  registeredVia: string;

  @Prop()
  verifiedAt?: Date;

  @Prop({ trim: true })
  verifiedBy?: string;

  @Prop({ default: 0 })
  assignedCampaignsCount: number;

  @Prop({ default: 0 })
  attendedCampaignsCount: number;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const VolunteerSchema = SchemaFactory.createForClass(Volunteer);

VolunteerSchema.index({ fullName: 'text', phone: 'text', city: 'text' });
