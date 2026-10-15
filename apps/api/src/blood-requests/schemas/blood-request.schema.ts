import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  BloodComponent,
  BloodGroup,
  BloodRequestStatus,
  RequestPriority,
} from '../blood-request.constants';

export type BloodRequestDocument = BloodRequest & Document;

@Schema({ _id: false })
export class ContactPerson {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, trim: true })
  relationship: string;
}

@Schema({ _id: false })
export class PatientDetails {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  age: number;

  @Prop({ required: true, trim: true })
  gender: string;

  @Prop({ trim: true })
  phone?: string;
}

@Schema({ _id: false })
export class SupportingDocument {
  @Prop({ required: true, trim: true })
  documentType: string;

  @Prop({ required: true, trim: true })
  fileName: string;

  @Prop({ required: true, trim: true })
  fileUrl: string;

  @Prop({ type: Number })
  fileSize?: number;

  @Prop({ default: true })
  isVerified: boolean;

  @Prop({ trim: true })
  verifiedBy?: string;

  @Prop()
  verifiedAt?: Date;

  @Prop({ trim: true })
  notes?: string;
}

export const SupportingDocumentSchema = SchemaFactory.createForClass(SupportingDocument);

@Schema({
  collection: 'blood_requests',
  timestamps: true,
})
export class BloodRequest {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  requestCode: string;

  @Prop({ type: PatientDetails, required: true })
  patient: PatientDetails;

  @Prop({
    required: true,
    enum: Object.values(BloodGroup),
    index: true,
  })
  bloodGroup: BloodGroup;

  @Prop({
    required: true,
    enum: Object.values(BloodComponent),
  })
  componentType: BloodComponent;

  @Prop({ required: true, min: 1 })
  unitsRequested: number;

  @Prop({ required: true, trim: true })
  hospitalName: string;

  @Prop({ required: true, trim: true })
  doctorName: string;

  @Prop({ trim: true })
  doctorContact?: string;

  @Prop({ trim: true })
  hospitalCaseNumber?: string;

  @Prop({
    required: true,
    enum: Object.values(RequestPriority),
    default: RequestPriority.ROUTINE,
    index: true,
  })
  priority: RequestPriority;

  @Prop({ type: ContactPerson, required: true })
  contactPerson: ContactPerson;

  @Prop({ required: true })
  requiredDate: Date;

  @Prop({ trim: true })
  medicalJustification?: string;

  @Prop({ trim: true })
  additionalNotes?: string;

  @Prop({
    required: true,
    enum: Object.values(BloodRequestStatus),
    default: BloodRequestStatus.REQUESTED,
    index: true,
  })
  status: BloodRequestStatus;

  @Prop({ trim: true })
  statusReason?: string;

  @Prop()
  statusUpdatedAt?: Date;

  @Prop({ type: [SupportingDocumentSchema], default: [] })
  documents: SupportingDocument[];

  @Prop({ enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' })
  documentVerificationStatus: string;

  @Prop({ trim: true })
  documentVerifiedBy?: string;

  @Prop()
  documentVerifiedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodRequestSchema = SchemaFactory.createForClass(BloodRequest);

BloodRequestSchema.index({ createdAt: -1 });
BloodRequestSchema.index({ status: 1, priority: 1 });
