import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CampaignBudgetRevisionDocument = CampaignBudgetRevision & Document;

@Schema({
  collection: 'campaign_budget_revisions',
  timestamps: true,
})
export class CampaignBudgetRevision {
  @Prop({ type: Types.ObjectId, ref: 'Campaign', required: true, index: true })
  campaignId: Types.ObjectId;

  @Prop({ required: true, type: Number })
  revisionNumber: number;

  @Prop({ required: true, type: Number })
  previousBudgetPaise: number;

  @Prop({ required: true, type: Number })
  newBudgetPaise: number;

  @Prop({ required: true, type: Number })
  deltaPaise: number;

  @Prop({ required: true, type: Number })
  previousBudget: number;

  @Prop({ required: true, type: Number })
  newBudget: number;

  @Prop({ required: true, type: Number })
  delta: number;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  actorId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  actorName: string;

  @Prop({ required: true, trim: true })
  actorEmail: string;

  @Prop({ required: true, trim: true })
  actorRole: string;

  @Prop({ required: true, default: Date.now, index: true })
  timestamp: Date;
}

export const CampaignBudgetRevisionSchema =
  SchemaFactory.createForClass(CampaignBudgetRevision);

CampaignBudgetRevisionSchema.index({ campaignId: 1, revisionNumber: -1 });
