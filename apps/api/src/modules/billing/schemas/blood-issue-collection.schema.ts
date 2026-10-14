import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CollectionPaymentMethod } from '../constants/billing.constants';

export type BloodIssueCollectionDocument = BloodIssueCollection & Document;

@Schema({
  collection: 'blood_issue_collections',
  timestamps: true,
})
export class BloodIssueCollection {
  /** Unique printable money receipt number: REC-YYYYMMDD-XXXX */
  @Prop({ required: true, unique: true, uppercase: true, index: true })
  receiptNumber: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'BloodIssueInvoice',
    required: true,
    index: true,
  })
  invoiceId: Types.ObjectId;

  @Prop({ required: true, uppercase: true, index: true })
  invoiceNumber: string;

  /** Authoritative collected amount in integer paise (>= 1) */
  @Prop({ required: true, type: Number, min: 1 })
  amountPaise: number;

  /** Derived amount in INR (amountPaise / 100) */
  @Prop({ required: true, type: Number, min: 0.01 })
  amount: number;

  @Prop({
    required: true,
    enum: Object.values(CollectionPaymentMethod),
    index: true,
  })
  paymentMethod: CollectionPaymentMethod;

  /** Mandatory reference: Cash Voucher #, UPI Reference ID, Card Auth Code, or Hospital Credit Folio */
  @Prop({ required: true, trim: true })
  referenceNumber: string;

  /** Date and time of payment receipt */
  @Prop({ required: true, default: Date.now, index: true })
  paymentDate: Date;

  /** Permanent unique idempotency key preventing duplicate collections */
  @Prop({ required: true, unique: true, trim: true, index: true })
  idempotencyKey: string;

  /** SHA-256 hash of canonical payment request payload */
  @Prop({ required: true, trim: true })
  requestPayloadHash: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  collectedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  collectedByName: string;

  @Prop({ required: false, trim: true })
  notes?: string;

  @Prop({ required: false, trim: true })
  receiptDocumentKey?: string;

  @Prop({ required: true, default: false })
  isReversed: boolean;

  @Prop({ required: false })
  reversedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  reversedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  reversalReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodIssueCollectionSchema = SchemaFactory.createForClass(BloodIssueCollection);

BloodIssueCollectionSchema.index({ invoiceId: 1, paymentDate: -1 });
BloodIssueCollectionSchema.index({ paymentMethod: 1, paymentDate: -1 });
BloodIssueCollectionSchema.index({ collectedBy: 1, paymentDate: -1 });
BloodIssueCollectionSchema.index({ createdAt: -1 });
