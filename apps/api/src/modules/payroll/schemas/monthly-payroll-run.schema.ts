import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PayrollRunStatus } from '../constants/payroll.constants';

export type MonthlyPayrollRunDocument = MonthlyPayrollRun & Document;

@Schema({
  collection: 'payroll_runs',
  timestamps: true,
})
export class MonthlyPayrollRun {
  @Prop({ required: true, unique: true, trim: true, index: true })
  payrollPeriod: string; // Format: YYYY-MM (e.g. 2026-10)

  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  runCode: string; // Format: RUN-YYYYMM-XXXX

  @Prop({ required: true })
  periodStartDate: Date;

  @Prop({ required: true })
  periodEndDate: Date;

  @Prop({
    required: true,
    enum: Object.values(PayrollRunStatus),
    default: PayrollRunStatus.DRAFT,
    index: true,
  })
  status: PayrollRunStatus;

  @Prop({ required: true, min: 0 })
  totalEmployees: number;

  // Totals in Integer Paise & Derived INR
  @Prop({ required: true, type: Number, min: 0 })
  totalGrossPaise: number;

  @Prop({ required: true, type: Number, min: 0 })
  totalGross: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  totalDeductionsPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  totalDeductions: number;

  @Prop({ required: true, type: Number, min: 0 })
  totalNetPayablePaise: number;

  @Prop({ required: true, type: Number, min: 0 })
  totalNetPayable: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  totalDisbursedPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  totalDisbursed: number;

  @Prop({ required: true, type: Number, min: 0 })
  totalOutstandingPaise: number;

  @Prop({ required: true, type: Number, min: 0 })
  totalOutstanding: number;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  generatedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  generatedByName: string;

  @Prop({ required: false, trim: true })
  generatedByRole?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  approvedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  approvedByName?: string;

  @Prop({ required: false, trim: true })
  approvedByRole?: string;

  @Prop({ required: false })
  approvedAt?: Date;

  @Prop({ required: false, trim: true })
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const MonthlyPayrollRunSchema = SchemaFactory.createForClass(MonthlyPayrollRun);
