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

  @Prop({ trim: true })
  method?: string;

  @Prop({ trim: true })
  kitLotNumber?: string;

  @Prop()
  kitExpiryDate?: Date;

  @Prop({ default: false })
  isRepeatOrConfirmatory?: boolean;

  @Prop({ trim: true })
  repeatReason?: string;

  @Prop()
  testedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  performedBy?: Types.ObjectId;

  @Prop({ trim: true })
  performedByName?: string;

  @Prop({ trim: true })
  performedByRole?: string;

  @Prop({ trim: true })
  remarks?: string;
}

export const IndividualTestResultSchema =
  SchemaFactory.createForClass(IndividualTestResult);

@Schema({ _id: false })
export class BloodGroupingResult {
  @Prop({ trim: true, uppercase: true })
  aboGroup?: string;

  @Prop({ trim: true, uppercase: true })
  rhFactor?: string; // POSITIVE or NEGATIVE

  @Prop({ trim: true, uppercase: true })
  confirmedBloodGroup?: string; // A+, A-, B+, B-, AB+, AB-, O+, O-

  @Prop({ trim: true })
  groupingMethod?: string; // TUBE_METHOD, GEL_CARD, MICROPLATE

  @Prop({ trim: true })
  cellGroupingAntiA?: string; // 0, 1+, 2+, 3+, 4+

  @Prop({ trim: true })
  cellGroupingAntiB?: string;

  @Prop({ trim: true })
  cellGroupingAntiD?: string;

  @Prop({ trim: true })
  serumGroupingACells?: string;

  @Prop({ trim: true })
  serumGroupingBCells?: string;

  @Prop({ trim: true })
  serumGroupingOCells?: string;

  @Prop()
  testedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  testedBy?: Types.ObjectId;

  @Prop({ trim: true })
  testedByName?: string;

  @Prop({ trim: true })
  remarks?: string;
}

export const BloodGroupingResultSchema =
  SchemaFactory.createForClass(BloodGroupingResult);

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

  /**
   * Reference to the Donation associated with this blood unit.
   * Only set when the blood unit originates from an internal donor donation.
   * NOT set for externally acquired blood units.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Donation',
    required: false,
    sparse: true,
  })
  donationId?: Types.ObjectId;

  /**
   * Reference to the Donor associated with this blood unit.
   * Only set when the blood unit originates from an internal donor donation.
   * NOT set for externally acquired blood units.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Donor',
    required: false,
    index: true,
    sparse: true,
  })
  donorId?: Types.ObjectId;

  /**
   * Reference to the Campaign record (if the blood unit was collected during a campaign drive).
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Campaign',
    required: false,
    index: true,
    sparse: true,
  })
  campaignId?: Types.ObjectId;

  @Prop({ required: false, trim: true, uppercase: true })
  campaignCode?: string;

  /**
   * Reference to the BloodAcquisition receipt (if blood unit was acquired externally).
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'BloodAcquisition',
    required: false,
    index: true,
    sparse: true,
  })
  externalReceiptId?: Types.ObjectId;

  @Prop({ type: [IndividualTestResultSchema], default: [] })
  testResults: IndividualTestResult[];

  @Prop({ type: BloodGroupingResultSchema, required: false })
  bloodGrouping?: BloodGroupingResult;

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

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  startedBy?: Types.ObjectId;

  @Prop({ trim: true })
  startedByName?: string;

  @Prop({ trim: true })
  startedByRole?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  verifiedBy?: Types.ObjectId;

  @Prop({ trim: true })
  verifiedByName?: string;

  @Prop({ trim: true })
  verifiedByRole?: string;

  @Prop()
  verifiedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  rejectedBy?: Types.ObjectId;

  @Prop({ trim: true })
  rejectedByName?: string;

  @Prop({ trim: true })
  rejectedByRole?: string;

  @Prop()
  rejectedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  completedBy?: Types.ObjectId;

  @Prop({ trim: true })
  completedByName?: string;

  @Prop({ trim: true })
  completedByRole?: string;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop({ trim: true })
  remarks?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  authorizedBy?: Types.ObjectId;

  @Prop({ trim: true })
  authorizedByName?: string;

  @Prop({ trim: true })
  authorizedByRole?: string;

  @Prop()
  authorizedAt?: Date;

  @Prop({ trim: true })
  authorizationRemarks?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodTestingSchema = SchemaFactory.createForClass(BloodTesting);

BloodTestingSchema.index({ createdAt: -1 });
BloodTestingSchema.index({ status: 1, decision: 1 });
// Sparse unique index for donationId (only when present)
BloodTestingSchema.index({ donationId: 1 }, { sparse: true });
