import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BloodIssueStatus } from '../constants/blood-issue.constants';

export type BloodIssueDocument = BloodIssue & Document;

@Schema({ _id: false })
export class IssuedUnitItem {
  @Prop({ type: Types.ObjectId, ref: 'Inventory', required: true })
  inventoryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BloodUnit', required: true })
  bloodUnitId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  unitCode: string;

  @Prop({ required: true, trim: true })
  bloodGroup: string;

  @Prop({ required: true, trim: true })
  componentType: string;

  @Prop({ required: false, type: Number })
  volume?: number;

  @Prop({ required: true, default: 'ISSUED' })
  status: string;
}

@Schema({
  collection: 'blood_issues',
  timestamps: true,
})
export class BloodIssue {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  issueCode: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'BloodRequest',
    required: true,
    index: true,
  })
  bloodRequestId: Types.ObjectId;

  @Prop({ required: true, index: true, uppercase: true })
  requestCode: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Reservation',
    required: true,
    unique: true,
    index: true,
  })
  reservationId: Types.ObjectId;

  @Prop({ required: true, index: true, uppercase: true })
  reservationCode: string;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Inventory' }],
    required: true,
  })
  inventoryIds: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'BloodUnit' }],
    required: true,
  })
  bloodUnitIds: Types.ObjectId[];

  @Prop({ type: [IssuedUnitItem], required: true })
  issuedUnits: IssuedUnitItem[];

  @Prop({
    required: true,
    enum: Object.values(BloodIssueStatus),
    default: BloodIssueStatus.COMPLETED,
    index: true,
  })
  status: BloodIssueStatus;

  @Prop({ required: true, default: Date.now })
  issuedAt: Date;

  @Prop({ type: String, trim: true, required: false })
  issuedBy?: string;

  @Prop({ type: String, trim: true, required: false })
  remarks?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodIssueSchema = SchemaFactory.createForClass(BloodIssue);

// Partial unique indexes ensuring units cannot be re-issued
BloodIssueSchema.index({ inventoryIds: 1 }, { unique: true });
BloodIssueSchema.index({ bloodUnitIds: 1 }, { unique: true });
BloodIssueSchema.index({ bloodRequestId: 1, status: 1 });
BloodIssueSchema.index({ createdAt: -1 });
