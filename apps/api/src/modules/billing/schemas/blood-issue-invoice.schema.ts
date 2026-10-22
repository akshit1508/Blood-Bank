import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InvoiceStatus, WaiverCategory } from '../constants/billing.constants';

export type BloodIssueInvoiceDocument = BloodIssueInvoice & Document;

@Schema({ _id: false })
export class InvoiceLineItem {
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

  /** Base processing charge in integer paise */
  @Prop({ required: true, type: Number, min: 0 })
  baseProcessingFeePaise: number;

  /** Derived INR base fee */
  @Prop({ required: true, type: Number, min: 0 })
  baseProcessingFee: number;

  /** Crossmatching and compatibility fee in integer paise */
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  crossmatchFeePaise: number;

  /** Derived INR crossmatch fee */
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  crossmatchFee: number;

  /** Line item total in integer paise (baseProcessingFeePaise + crossmatchFeePaise) */
  @Prop({ required: true, type: Number, min: 0 })
  lineTotalPaise: number;

  /** Derived line total in INR */
  @Prop({ required: true, type: Number, min: 0 })
  lineTotal: number;
}

export const InvoiceLineItemSchema = SchemaFactory.createForClass(InvoiceLineItem);

@Schema({ _id: false })
export class InvoiceWaiverItem {
  @Prop({
    required: true,
    enum: Object.values(WaiverCategory),
  })
  category: WaiverCategory;

  @Prop({ required: true, trim: true })
  reason: string;

  /** Authoritative discount / waiver in integer paise */
  @Prop({ required: true, type: Number, min: 1 })
  amountPaise: number;

  /** Derived INR waiver amount */
  @Prop({ required: true, type: Number, min: 0.01 })
  amount: number;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  authorizedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  authorizedByName: string;

  @Prop({ required: true, trim: true })
  authorizedByRole: string;

  @Prop({ required: true, default: Date.now })
  appliedAt: Date;

  @Prop({ required: false, trim: true })
  documentRef?: string;
}

export const InvoiceWaiverItemSchema = SchemaFactory.createForClass(InvoiceWaiverItem);

@Schema({ _id: false })
export class PatientBillingSnapshot {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  age: number;

  @Prop({ required: true, trim: true })
  gender: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  hospitalCaseNumber?: string;
}

export const PatientBillingSnapshotSchema = SchemaFactory.createForClass(PatientBillingSnapshot);

@Schema({
  collection: 'blood_issue_invoices',
  timestamps: true,
})
export class BloodIssueInvoice {
  /** Human-readable unique invoice number: INV-YYYYMMDD-XXXX */
  @Prop({ required: true, unique: true, uppercase: true, index: true })
  invoiceNumber: string;

  /** Exactly one invoice per completed blood issue */
  @Prop({
    type: Types.ObjectId,
    ref: 'BloodIssue',
    required: true,
    unique: true,
    index: true,
  })
  issueId: Types.ObjectId;

  @Prop({ required: true, uppercase: true, index: true })
  issueCode: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'BloodRequest',
    required: true,
    index: true,
  })
  bloodRequestId: Types.ObjectId;

  @Prop({ required: true, uppercase: true, index: true })
  requestCode: string;

  @Prop({ type: PatientBillingSnapshotSchema, required: true })
  patient: PatientBillingSnapshot;

  @Prop({ required: true, trim: true, index: true })
  hospitalName: string;

  @Prop({ required: true, trim: true })
  doctorName: string;

  @Prop({ type: [InvoiceLineItemSchema], required: true })
  items: InvoiceLineItem[];

  /** Authoritative gross subtotal before waivers in integer paise */
  @Prop({ required: true, type: Number, min: 0 })
  subtotalPaise: number;

  /** Derived subtotal in INR */
  @Prop({ required: true, type: Number, min: 0 })
  subtotal: number;

  /** Total approved waivers / exemptions in integer paise */
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  waiverPaise: number;

  /** Derived waiver amount in INR */
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  waiverAmount: number;

  /** Net payable after waivers in integer paise (subtotalPaise - waiverPaise) */
  @Prop({ required: true, type: Number, min: 0 })
  netPayablePaise: number;

  /** Derived net payable in INR */
  @Prop({ required: true, type: Number, min: 0 })
  netPayable: number;

  /** Total collected to date in integer paise */
  @Prop({ required: true, type: Number, default: 0, min: 0, index: true })
  collectedPaise: number;

  /** Derived collected amount in INR */
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  collectedAmount: number;

  /** Remaining balance in integer paise (netPayablePaise - collectedPaise) */
  @Prop({ required: true, type: Number, min: 0, index: true })
  outstandingPaise: number;

  /** Derived outstanding in INR */
  @Prop({ required: true, type: Number, min: 0 })
  outstandingAmount: number;

  @Prop({
    required: true,
    enum: Object.values(InvoiceStatus),
    default: InvoiceStatus.PENDING,
    index: true,
  })
  status: InvoiceStatus;

  @Prop({ type: [InvoiceWaiverItemSchema], default: [] })
  waivers: InvoiceWaiverItem[];

  @Prop({ required: true, default: Date.now, index: true })
  invoiceDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  billedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  billedByName: string;

  @Prop({ required: false, trim: true })
  billedByRole?: string;

  @Prop({ required: false, trim: true })
  notes?: string;

  @Prop({ required: false })
  cancelledAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  cancelledBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  cancelledByName?: string;

  @Prop({ required: false, trim: true })
  cancelledByRole?: string;

  @Prop({ required: false, trim: true })
  cancellationReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodIssueInvoiceSchema = SchemaFactory.createForClass(BloodIssueInvoice);

BloodIssueInvoiceSchema.index({ status: 1, invoiceDate: -1 });
BloodIssueInvoiceSchema.index({ hospitalName: 1, status: 1 });
BloodIssueInvoiceSchema.index({ bloodRequestId: 1, status: 1 });
