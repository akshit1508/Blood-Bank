import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  EmployeeDepartment,
  EmploymentType,
  EmployeeStatus,
} from '../constants/payroll.constants';

export type EmployeeDocument = Employee & Document;

@Schema({ _id: false })
export class EmergencyContact {
  @Prop({ required: false, trim: true })
  name?: string;

  @Prop({ required: false, trim: true })
  phone?: string;

  @Prop({ required: false, trim: true })
  relationship?: string;
}
export const EmergencyContactSchema = SchemaFactory.createForClass(EmergencyContact);

@Schema({ _id: false })
export class EmployeeBankDetails {
  @Prop({ required: true, trim: true })
  bankName: string;

  @Prop({ required: true, trim: true })
  accountNumber: string;

  @Prop({ required: true, uppercase: true, trim: true })
  ifscCode: string;

  @Prop({ required: true, trim: true })
  accountHolderName: string;

  @Prop({ required: false, uppercase: true, trim: true })
  panNumber?: string;
}
export const EmployeeBankDetailsSchema = SchemaFactory.createForClass(EmployeeBankDetails);

@Schema({
  collection: 'employees',
  timestamps: true,
})
export class Employee {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  employeeCode: string;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ type: EmergencyContactSchema, required: false })
  emergencyContact?: EmergencyContact;

  @Prop({ required: true, trim: true })
  designation: string;

  @Prop({
    required: true,
    enum: Object.values(EmployeeDepartment),
    index: true,
  })
  department: EmployeeDepartment;

  @Prop({
    required: true,
    enum: Object.values(EmploymentType),
    default: EmploymentType.PERMANENT,
  })
  employmentType: EmploymentType;

  @Prop({
    required: true,
    enum: Object.values(EmployeeStatus),
    default: EmployeeStatus.ACTIVE,
    index: true,
  })
  status: EmployeeStatus;

  @Prop({ required: true, index: true })
  dateOfJoining: Date;

  @Prop({ required: false })
  dateOfLeaving?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'AdminUser',
    required: false,
    sparse: true,
  })
  adminUserId?: Types.ObjectId;

  @Prop({ type: EmployeeBankDetailsSchema, required: true })
  bankDetails: EmployeeBankDetails;

  @Prop({ required: false, trim: true })
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);

EmployeeSchema.index({ department: 1, status: 1 });
