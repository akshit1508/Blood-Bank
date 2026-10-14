import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SalaryStructureDocument = SalaryStructure & Document;

@Schema({
  collection: 'salary_structures',
  timestamps: true,
})
export class SalaryStructure {
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true, index: true })
  employeeId: Types.ObjectId;

  @Prop({ required: true, default: 1 })
  revisionNumber: number;

  @Prop({ required: true, default: true, index: true })
  isActive: boolean;

  @Prop({ required: true, index: true })
  effectiveFrom: Date;

  @Prop({ required: false })
  effectiveTo?: Date;

  // Earnings in integer paise
  @Prop({ required: true, type: Number, min: 0 })
  basicSalaryPaise: number;

  @Prop({ required: true, type: Number, min: 0 })
  basicSalary: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  hraPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  hra: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  allowancesPaise: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  allowances: number;

  @Prop({ required: true, type: Number, min: 0 })
  grossSalaryPaise: number;

  @Prop({ required: true, type: Number, min: 0 })
  grossSalary: number;

  // Deductions in integer paise
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

  // Net payable
  @Prop({ required: true, type: Number, min: 0 })
  netSalaryPaise: number;

  @Prop({ required: true, type: Number, min: 0 })
  netSalary: number;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  createdBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  createdByName: string;

  @Prop({ required: false, trim: true })
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const SalaryStructureSchema = SchemaFactory.createForClass(SalaryStructure);

SalaryStructureSchema.index({ employeeId: 1, isActive: 1 });
SalaryStructureSchema.index({ employeeId: 1, effectiveFrom: -1 });
