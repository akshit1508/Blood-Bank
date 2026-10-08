import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InventoryStatus } from '../constants/inventory.constants';

export type InventoryHistoryDocument = InventoryHistory & Document;

@Schema({
  collection: 'inventory_history',
  timestamps: { createdAt: 'changedAt', updatedAt: false },
})
export class InventoryHistory {
  @Prop({
    type: Types.ObjectId,
    ref: 'Inventory',
    required: true,
    index: true,
  })
  inventoryId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(InventoryStatus),
    required: false,
    default: null,
  })
  fromStatus?: InventoryStatus | null;

  @Prop({
    type: String,
    enum: Object.values(InventoryStatus),
    required: true,
  })
  toStatus: InventoryStatus;

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  reason?: string;

  changedAt: Date;
}

export const InventoryHistorySchema = SchemaFactory.createForClass(InventoryHistory);

InventoryHistorySchema.index({ inventoryId: 1, changedAt: -1 });
