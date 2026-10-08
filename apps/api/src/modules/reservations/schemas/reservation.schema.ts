import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ReservationStatus } from '../constants/reservation.constants';

export type ReservationDocument = Reservation & Document;

@Schema({ _id: false })
export class ReservedUnitItem {
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

  @Prop({ required: true, default: 'RESERVED' })
  status: string;
}

@Schema({
  collection: 'reservations',
  timestamps: true,
})
export class Reservation {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  reservationCode: string;

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
    type: [{ type: Types.ObjectId, ref: 'Inventory' }],
    required: true,
  })
  inventoryIds: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'BloodUnit' }],
    required: true,
  })
  bloodUnitIds: Types.ObjectId[];

  @Prop({ type: [ReservedUnitItem], required: true })
  reservedUnits: ReservedUnitItem[];

  @Prop({
    required: true,
    enum: Object.values(ReservationStatus),
    default: ReservationStatus.ACTIVE,
    index: true,
  })
  status: ReservationStatus;

  @Prop({ required: true, default: Date.now })
  reservedAt: Date;

  @Prop({ type: Date, required: false, default: null })
  expiresAt?: Date | null;

  @Prop({ type: Date, required: false })
  cancelledAt?: Date;

  @Prop({ type: String, trim: true, required: false })
  cancellationReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);

// Unique partial index: no physical unit or inventory record can be simultaneously reserved in more than one ACTIVE reservation
ReservationSchema.index(
  { inventoryIds: 1 },
  { unique: true, partialFilterExpression: { status: ReservationStatus.ACTIVE } },
);
ReservationSchema.index(
  { bloodUnitIds: 1 },
  { unique: true, partialFilterExpression: { status: ReservationStatus.ACTIVE } },
);

ReservationSchema.index({ bloodRequestId: 1, status: 1 });
ReservationSchema.index({ createdAt: -1 });
