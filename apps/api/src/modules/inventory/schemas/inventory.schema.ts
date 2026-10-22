import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InventoryStatus } from '../constants/inventory.constants';

export type InventoryDocument = Inventory & Document;

@Schema({
  collection: 'inventory',
  timestamps: true,
})
export class Inventory {
  @Prop({
    type: Types.ObjectId,
    ref: 'BloodUnit',
    required: true,
    unique: true,
    index: true,
  })
  bloodUnitId: Types.ObjectId;

  @Prop({
    required: true,
    enum: Object.values(InventoryStatus),
    default: InventoryStatus.AVAILABLE,
    index: true,
  })
  status: InventoryStatus;

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  discardReason?: string;

  @Prop({
    type: Date,
    required: false,
  })
  discardedAt?: Date;

  // --- Staff User Attribution & Accountability ---
  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false, index: true })
  receivedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  receivedByName?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  lastAdjustedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  lastAdjustedByName?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  discardedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  discardedByName?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

InventorySchema.index({ createdAt: -1 });
InventorySchema.index({ receivedBy: 1 });
