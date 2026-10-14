import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SalarySlipPaymentStatus } from '../constants/payroll.constants';

export type SalarySlipDocument = SalarySlip & Document;

@Schema({ _id: false })
export class EmployeeSlipSnapshot {
  @Prop({ required: true, trim: true })
  employeeCode: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, trim: true })
  designation: string;

  @Prop({ required: true, trim: true })
  department: string;

  @Prop({ required: true, trim: true })
  bankName: string;

  @Prop({ required: true, trim: true })
  accountNumber: string;

  @Prop({ required: true, trim: true })
  ifscCode: string;

  @Prop({ required: false, trim: true })
  panNumber?: string;
}
export const EmployeeSlipSnapshotSchema = SchemaFactory.createForClass(EmployeeSlipSnapshot);

@Schema({
  collection: 'salary_slips',
  timestamps: true,
})
export class SalarySlip {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  slipNumber: string; // Format: SLIP-YYYYMM-XXXX

  @Prop({ type: Types.ObjectId, ref: 'MonthlyPayrollRun', required: true, index: true })
  payrollRunId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employeeId: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  payPeriod: string; // Format: YYYY-MM

  @Prop({ type: EmployeeSlipSnapshotSchema, required: true })
  employeeSnapshot: EmployeeSlipSnapshot;

  // Attendance & Days
  @Prop({ required: true, min: 1 })
  daysInMonth: number;

  @Prop({ required: true, min: 0 })
  payableDays: number;

  @Prop({ required: true, default: 0, min: 0 })
  lossOfPayDays: number;

  // Earnings
  @Prop({ required: true, type: Number, min: 0 })
  basicPaise: number;

  @Prop({ required: true, type: Number, min: 0 })
  basic: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  hraPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  hra: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  allowancesPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  allowances: number;

  @Prop({ required: true, type: Number, min: 0 })
  grossEarningsPaise: number;

  @Prop({ required: true, type: Number, min: 0 })
  grossEarnings: number;

  // Deductions
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  pfDeductionPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  pfDeduction: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  taxDeductionPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  taxDeduction: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  otherDeductionsPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  otherDeductions: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  totalDeductionsPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  totalDeductions: number;

  // Net payable
  @Prop({ required: true, type: Number, min: 0 })
  netPayablePaise: number;

  @Prop({ required: true, type: Number, min: 0 })
  netPayable: number;

  // Disbursement progress
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  paidAmountPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  paidAmount: number;

  @Prop({ required: true, type: Number, min: 0 })
  remainingPaise: number;

  @Prop({ required: true, type: Number, min: 0 })
  remaining: number;

  @Prop({
    required: true,
    enum: Object.values(SalarySlipPaymentStatus),
    default: SalarySlipPaymentStatus.UNPAID,
    index: true,
  })
  paymentStatus: SalarySlipPaymentStatus;

  @Prop({ required: false })
  disbursedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const SalarySlipSchema = SchemaFactory.createForClass(SalarySlip);

SalarySlipSchema.index({ employeeId: 1, payPeriod: 1 }, { unique: true });
SalarySlipSchema.index({ payrollRunId: 1, paymentStatus: 1 });
