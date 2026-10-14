import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '../constants/payment.constants';

export type PaymentDocument = Payment & Document;

@Schema({
  collection: 'payments',
  timestamps: true,
})
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Expense', required: true, index: true })
  expenseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: false, index: true })
  vendorId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  vendorName: string;

  /** Authoritative monetary amount in integer paise (>= 1) */
  @Prop({ required: true, type: Number, min: 1 })
  amountPaise: number;

  /** Mirrored display amount in INR (strictly derived: amountPaise / 100) */
  @Prop({ required: true, type: Number, min: 0.01 })
  amount: number;

  @Prop({
    required: true,
    enum: Object.values(PaymentMethod),
    index: true,
  })
  paymentMethod: PaymentMethod;

  @Prop({ required: true, trim: true })
  referenceNumber: string;

  /** Canonical date of disbursement (stored normalized at UTC midnight) */
  @Prop({ required: true, index: true })
  paymentDate: Date;

  @Prop({ required: false, trim: true, default: '' })
  notes: string;

  @Prop({
    required: true,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.COMPLETED,
    index: true,
  })
  status: PaymentStatus;

  /** Permanent unique idempotency key (no TTL expiry) */
  @Prop({ required: true, unique: true, trim: true, index: true })
  idempotencyKey: string;

  /** SHA-256 canonical hash of material business fields */
  @Prop({ required: true, trim: true })
  requestPayloadHash: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  createdBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  createdByName: string;

  @Prop({ required: false, default: null })
  cancelledAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false, default: null })
  cancelledBy?: Types.ObjectId;

  @Prop({ required: false, trim: true, default: null })
  cancellationReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ vendorId: 1, createdAt: -1 });
PaymentSchema.index({ expenseId: 1, status: 1 });
