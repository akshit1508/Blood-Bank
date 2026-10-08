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

  createdAt: Date;
  updatedAt: Date;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

InventorySchema.index({ createdAt: -1 });
