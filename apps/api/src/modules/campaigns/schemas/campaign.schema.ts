import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CampaignStatus } from '../constants/campaign.constants';

export type CampaignDocument = Campaign & Document;

@Schema({
  collection: 'campaigns',
  timestamps: true,
})
export class Campaign {
  /** Human-readable unique code: CAMP-YYYYMM-XXXX */
  @Prop({ required: true, unique: true, uppercase: true, index: true })
  campaignCode: string;

  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ required: true, trim: true })
  venue: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, index: true })
  startDate: Date;

  @Prop({ required: true, index: true })
  endDate: Date;

  @Prop({
    required: true,
    enum: Object.values(CampaignStatus),
    default: CampaignStatus.PLANNED,
    index: true,
  })
  status: CampaignStatus;

  /** Target physical donation units */
  @Prop({ required: true, type: Number, min: 0, default: 0 })
  targetDonations: number;

  /** Authoritative approved budget in integer paise (1 INR = 100 paise) */
  @Prop({ required: true, type: Number, min: 0, default: 0, index: true })
  approvedBudgetPaise: number;

  /** Mirrored display approved budget in INR (approvedBudgetPaise / 100) */
  @Prop({ required: true, type: Number, min: 0, default: 0 })
  approvedBudget: number;

  /** Immutable initial baseline budget in integer paise */
  @Prop({ required: true, type: Number, min: 0, default: 0 })
  initialBudgetPaise: number;

  @Prop({ required: true, default: 'INR', uppercase: true })
  currency: string;

  /** Total count of budget revisions */
  @Prop({ required: true, default: 0 })
  budgetRevisionCount: number;

  /** Optimistic locking version key for concurrent revisions */
  @Prop({ required: true, default: 1 })
  budgetVersion: number;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true, index: true })
  createdBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  createdByName: string;

  @Prop({ required: false, trim: true })
  createdByRole?: string;

  @Prop({ trim: true })
  description?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);

CampaignSchema.index({ status: 1, startDate: -1 });
CampaignSchema.index({ city: 1, status: 1 });
CampaignSchema.index({ createdAt: -1 });
