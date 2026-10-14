import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ExpenseStatus,
  ExpensePaymentStatus,
  ExpenseCategory,
  CostCenter,
  ExpenseAuditEventType,
} from '../constants/expense.constants';

export type ExpenseDocument = Expense & Document;

@Schema({ _id: false })
export class ExpenseReceipt {
  @Prop({ required: true, trim: true })
  fileId: string; // Stored unique key in storage driver

  @Prop({ required: true, trim: true })
  originalName: string;

  @Prop({ required: true, trim: true })
  mimeType: string;

  @Prop({ required: true, type: Number })
  sizeBytes: number;

  @Prop({ required: true, default: Date.now })
  uploadedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  uploadedBy: Types.ObjectId;
}

export const ExpenseReceiptSchema = SchemaFactory.createForClass(ExpenseReceipt);

@Schema({ _id: false })
export class ExpenseAuditHistoryItem {
  @Prop({
    required: true,
    enum: Object.values(ExpenseAuditEventType),
  })
  action: ExpenseAuditEventType;

  @Prop({
    type: String,
    enum: Object.values(ExpenseStatus),
    required: false,
    default: null,
  })
  fromStatus?: ExpenseStatus | null;

  @Prop({
    type: String,
    enum: Object.values(ExpenseStatus),
    required: true,
  })
  toStatus: ExpenseStatus;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  performedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  performedByEmail: string;

  @Prop({ required: true, trim: true })
  performedByName: string;

  @Prop({ required: false, trim: true })
  notes?: string;

  @Prop({ required: true, default: Date.now })
  timestamp: Date;
}

export const ExpenseAuditHistoryItemSchema = SchemaFactory.createForClass(ExpenseAuditHistoryItem);

@Schema({
  collection: 'expenses',
  timestamps: true,
})
export class Expense {
  /** Human-readable unique code: EXP-YYYYMMDD-XXXX */
  @Prop({ required: true, unique: true, uppercase: true, index: true })
  expenseCode: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    required: true,
    enum: Object.values(ExpenseCategory),
    index: true,
  })
  category: ExpenseCategory;

  @Prop({
    required: true,
    enum: Object.values(CostCenter),
    index: true,
  })
  costCenter: CostCenter;

  @Prop({ required: true, index: true })
  expenseDate: Date;

  /** Stored monetary amount in INR (>= 0.01) - Mirrored for compatibility */
  @Prop({ required: true, type: Number, min: 0.01 })
  amount: number;

  /** Authoritative total amount in integer paise (1 INR = 100 paise) */
  @Prop({ required: false, type: Number, min: 1, index: true })
  amountPaise?: number;

  /** Authoritative disbursed amount in integer paise */
  @Prop({ required: false, type: Number, default: 0, min: 0, index: true })
  paidAmountPaise: number;

  /** Derived disbursed amount in INR (strictly derived: paidAmountPaise / 100) */
  @Prop({ required: false, type: Number, default: 0, min: 0 })
  paidAmount: number;

  /** Payment status lifecycle */
  @Prop({
    required: false,
    type: String,
    enum: Object.values(ExpensePaymentStatus),
    default: ExpensePaymentStatus.UNPAID,
    index: true,
  })
  paymentStatus: ExpensePaymentStatus;

  @Prop({ required: true, default: 'INR', uppercase: true })
  currency: string;

  /** Verified registered vendor reference (required before disbursement) */
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: false, default: null, index: true })
  vendorId?: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  vendorName: string;

  @Prop({ required: false, trim: true })
  migrationStatus?: string;

  @Prop({ required: false, default: false })
  isPaymentLocked?: boolean;

  /** Reference to linked BloodAcquisition if liability originated from external blood consignment */
  @Prop({ type: Types.ObjectId, ref: 'BloodAcquisition', required: false, index: true, sparse: true })
  acquisitionId?: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  invoiceNumber: string;

  /** Optional supplier GSTIN in India */
  @Prop({ required: false, trim: true, uppercase: true })
  gstinNumber?: string;

  /** Optional documented tax/GST amount in INR */
  @Prop({ required: false, type: Number, min: 0, default: 0 })
  taxAmount?: number;

  @Prop({ required: false, trim: true })
  description?: string;

  @Prop({
    required: true,
    enum: Object.values(ExpenseStatus),
    default: ExpenseStatus.DRAFT,
    index: true,
  })
  status: ExpenseStatus;

  @Prop({ type: ExpenseReceiptSchema, required: false })
  receipt?: ExpenseReceipt;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true, index: true })
  creatorId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  creatorEmail: string;

  @Prop({ required: true, trim: true })
  creatorRole: string;

  @Prop({ required: false })
  submittedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  reviewedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  reviewedByEmail?: string;

  @Prop({ required: false })
  reviewedAt?: Date;

  @Prop({ required: false, trim: true })
  rejectionReason?: string;

  @Prop({ required: false, trim: true })
  approvalRemarks?: string;

  /** Preserved audit history across all status lifecycles */
  @Prop({ type: [ExpenseAuditHistoryItemSchema], default: [] })
  auditHistory: ExpenseAuditHistoryItem[];

  /** Soft deletion flag for drafts */
  @Prop({ required: true, default: false, index: true })
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);

// Compound indexes for optimal query and duplicate warning performance
ExpenseSchema.index({ status: 1, expenseDate: -1 });
ExpenseSchema.index({ category: 1, expenseDate: -1 });
ExpenseSchema.index({ vendorName: 1, invoiceNumber: 1 });
ExpenseSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });
ExpenseSchema.index({ creatorId: 1, status: 1 });
