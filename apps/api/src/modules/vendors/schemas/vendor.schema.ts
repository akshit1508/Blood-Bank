import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ExpenseCategory } from '../../expenses/constants/expense.constants';

export type VendorDocument = Vendor & Document;

@Schema({ _id: false })
export class VendorBankDetails {
  @Prop({ required: true, trim: true })
  bankName: string;

  @Prop({ required: true, trim: true })
  accountNumber: string;

  @Prop({ required: true, trim: true, uppercase: true })
  ifscCode: string;

  @Prop({ required: false, trim: true, default: '' })
  branchName?: string;
}

export const VendorBankDetailsSchema = SchemaFactory.createForClass(VendorBankDetails);

@Schema({ _id: false })
export class VendorAuditHistoryItem {
  @Prop({ required: true, trim: true })
  action: string; // e.g. CREATED, UPDATED, BANK_DETAILS_UPDATED, STATUS_CHANGED

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  performedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  performedByName: string;

  @Prop({ required: true, trim: true })
  performedByEmail: string;

  @Prop({ required: false, trim: true })
  notes?: string;

  @Prop({ required: true, default: Date.now })
  timestamp: Date;
}

export const VendorAuditHistoryItemSchema = SchemaFactory.createForClass(VendorAuditHistoryItem);

@Schema({
  collection: 'vendors',
  timestamps: true,
})
export class Vendor {
  @Prop({ required: true, unique: true, trim: true, index: true })
  name: string;

  @Prop({
    required: true,
    enum: Object.values(ExpenseCategory),
    index: true,
  })
  category: ExpenseCategory;

  @Prop({ required: true, trim: true })
  contactPerson: string;

  @Prop({ required: false, trim: true, lowercase: true })
  email?: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: false, trim: true, uppercase: true })
  gstinNumber?: string;

  @Prop({ required: false, trim: true, uppercase: true })
  panNumber?: string;

  @Prop({ type: VendorBankDetailsSchema, required: false })
  bankDetails?: VendorBankDetails;

  @Prop({ required: true, default: true, index: true })
  isActive: boolean;

  @Prop({ required: false, trim: true })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  createdBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  createdByName: string;

  @Prop({ type: [VendorAuditHistoryItemSchema], default: [] })
  auditHistory: VendorAuditHistoryItem[];

  createdAt: Date;
  updatedAt: Date;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
VendorSchema.index({ name: 1, isActive: 1 });
