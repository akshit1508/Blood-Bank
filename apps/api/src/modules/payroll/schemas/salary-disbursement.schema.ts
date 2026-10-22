import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { DisbursementPaymentMethod } from '../constants/payroll.constants';

export type SalaryDisbursementDocument = SalaryDisbursement & Document;

@Schema({
  collection: 'salary_disbursements',
  timestamps: true,
})
export class SalaryDisbursement {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  disbursementNumber: string; // Format: DISB-YYYYMM-XXXX

  @Prop({ type: Types.ObjectId, ref: 'SalarySlip', required: true, index: true })
  salarySlipId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'MonthlyPayrollRun', required: true, index: true })
  payrollRunId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employeeId: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 1 })
  amountPaise: number;

  @Prop({ required: true, type: Number, min: 0.01 })
  amount: number;

  @Prop({
    required: true,
    enum: Object.values(DisbursementPaymentMethod),
    default: DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS,
    index: true,
  })
  paymentMethod: DisbursementPaymentMethod;

  @Prop({ required: true, trim: true })
  transactionReference: string; // UTR / NEFT / Cheque / Bank Transfer ID

  @Prop({ required: true, default: Date.now, index: true })
  paymentDate: Date;

  @Prop({ required: true, trim: true })
  recipientBankName: string;

  @Prop({ required: true, trim: true })
  recipientAccountNumber: string;

  @Prop({ required: true, trim: true })
  recipientIfscCode: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  disbursedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  disbursedByName: string;

  @Prop({ required: false, trim: true })
  disbursedByRole?: string;

  @Prop({ required: false, trim: true })
  notes?: string;

  @Prop({ required: false, trim: true })
  receiptDocumentRef?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const SalaryDisbursementSchema = SchemaFactory.createForClass(SalaryDisbursement);
