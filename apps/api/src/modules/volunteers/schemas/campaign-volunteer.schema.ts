import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  VolunteerAttendanceStatus,
  VolunteerRole,
} from '../constants/volunteer.constants';

export type CampaignVolunteerDocument = CampaignVolunteer & Document;

@Schema({ timestamps: true, collection: 'campaign_volunteers' })
export class CampaignVolunteer {
  @Prop({ type: Types.ObjectId, ref: 'Campaign', required: true, index: true })
  campaignId: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  campaignCode: string;

  @Prop({ type: Types.ObjectId, ref: 'Volunteer', required: true, index: true })
  volunteerId: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true })
  volunteerCode: string;

  @Prop({ required: true, trim: true })
  volunteerName: string;

  @Prop({ required: true, trim: true })
  volunteerPhone: string;

  @Prop({ trim: true, uppercase: true })
  volunteerBloodGroup?: string;

  @Prop({
    type: String,
    enum: Object.values(VolunteerRole),
    default: VolunteerRole.GENERAL,
  })
  role: string;

  @Prop({
    type: String,
    enum: Object.values(VolunteerAttendanceStatus),
    default: VolunteerAttendanceStatus.PENDING,
    index: true,
  })
  attendanceStatus: VolunteerAttendanceStatus;

  @Prop()
  attendanceMarkedAt?: Date;

  @Prop({ trim: true })
  attendanceMarkedBy?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop()
  notifiedViaWhatsAppAt?: Date;
}

export const CampaignVolunteerSchema = SchemaFactory.createForClass(CampaignVolunteer);

// A volunteer can only be assigned once per campaign drive
CampaignVolunteerSchema.index({ campaignId: 1, volunteerId: 1 }, { unique: true });
