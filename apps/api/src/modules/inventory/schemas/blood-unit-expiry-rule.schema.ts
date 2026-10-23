import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';

export type BloodUnitExpiryRuleDocument = BloodUnitExpiryRule & Document;

@Schema({
  collection: 'blood_unit_expiry_rules',
  timestamps: true,
})
export class BloodUnitExpiryRule {
  @Prop({
    required: true,
    enum: Object.values(BloodUnitComponent),
    unique: true,
    index: true,
  })
  componentType: BloodUnitComponent;

  /** Standard shelf life in days from collection date */
  @Prop({ required: true, type: Number, min: 1, default: 35 })
  shelfLifeDays: number;

  /** Optimal storage temperature range requirement (e.g., '2°C to 6°C', '-18°C or colder') */
  @Prop({ required: false, trim: true, default: '2°C to 6°C' })
  storageTemperature?: string;

  /** Clinical description and preservation guidelines */
  @Prop({ required: false, trim: true })
  description?: string;

  @Prop({ required: true, default: true, index: true })
  isActive: boolean;

  // --- Staff attribution ---
  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  updatedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  updatedByName?: string;

  @Prop({ required: false, trim: true })
  updatedByRole?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodUnitExpiryRuleSchema =
  SchemaFactory.createForClass(BloodUnitExpiryRule);

BloodUnitExpiryRuleSchema.index({ componentType: 1, isActive: 1 });
