import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';

export type BloodIssueTariffDocument = BloodIssueTariff & Document;

@Schema({
  collection: 'blood_issue_tariffs',
  timestamps: true,
})
export class BloodIssueTariff {
  @Prop({
    required: true,
    enum: Object.values(BloodUnitComponent),
    unique: true,
    index: true,
  })
  componentType: BloodUnitComponent;

  /** Base processing fee in authoritative integer paise (>= 0) */
  @Prop({ required: true, type: Number, min: 0 })
  processingFeePaise: number;

  /** Derived INR for base processing fee (processingFeePaise / 100) */
  @Prop({ required: true, type: Number, min: 0 })
  processingFee: number;

  /** Crossmatching fee in integer paise (>= 0) */
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  crossmatchFeePaise: number;

  /** Derived INR for crossmatch fee (crossmatchFeePaise / 100) */
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  crossmatchFee: number;

  @Prop({ required: false, trim: true })
  description?: string;

  @Prop({ required: true, default: true, index: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  updatedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  updatedByName?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodIssueTariffSchema = SchemaFactory.createForClass(BloodIssueTariff);
BloodIssueTariffSchema.index({ componentType: 1, isActive: 1 });
