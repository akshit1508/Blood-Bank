import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  TestResultStatus,
  TestingDecision,
  TestingStatus,
} from '../constants/testing.constants';

export type BloodTestingDocument = BloodTesting & Document;

@Schema({ _id: false })
export class IndividualTestResult {
  @Prop({ required: true, uppercase: true, trim: true })
  testCode: string;

  @Prop({ required: true, trim: true })
  testName: string;

  @Prop({ trim: true })
  result?: string;

  @Prop({
    required: true,
    enum: Object.values(TestResultStatus),
    default: TestResultStatus.PENDING,
  })
  status: TestResultStatus;

  @Prop()
  testedAt?: Date;

  @Prop({ trim: true })
  remarks?: string;
}

export const IndividualTestResultSchema =
  SchemaFactory.createForClass(IndividualTestResult);

@Schema({
  collection: 'blood_testing',
  timestamps: true,
})
export class BloodTesting {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  testingCode: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'BloodUnit',
    required: true,
    unique: true,
    index: true,
  })
  bloodUnitId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Donation',
    required: true,
    index: true,
  })
  donationId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Donor',
    required: true,
    index: true,
  })
  donorId: Types.ObjectId;

  @Prop({ type: [IndividualTestResultSchema], default: [] })
  testResults: IndividualTestResult[];

  @Prop({
    required: true,
    enum: Object.values(TestingStatus),
    default: TestingStatus.IN_PROGRESS,
    index: true,
  })
  status: TestingStatus;

  @Prop({
    required: true,
    enum: Object.values(TestingDecision),
    default: TestingDecision.PENDING,
    index: true,
  })
  decision: TestingDecision;

  @Prop({ required: true, default: Date.now })
  startedAt: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ trim: true })
  performedBy?: string;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop({ trim: true })
  remarks?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodTestingSchema = SchemaFactory.createForClass(BloodTesting);

BloodTestingSchema.index({ createdAt: -1 });
BloodTestingSchema.index({ status: 1, decision: 1 });
