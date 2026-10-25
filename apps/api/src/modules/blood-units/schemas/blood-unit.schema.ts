import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  BloodUnitComponent,
  BloodUnitStatus,
} from '../constants/blood-unit.constants';
import { BloodGroup } from '../../donors/constants/donor.constants';
import { BloodUnitSourceType } from '../../blood-acquisitions/constants/blood-acquisition.constants';

export type BloodUnitDocument = BloodUnit & Document;

@Schema({
  collection: 'blood_units',
  timestamps: true,
})
export class BloodUnit {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  unitCode: string;

  /**
   * Identifies the origin source of this Blood Unit.
   * DONATION: Generated from an internal donor donation.
   * EXTERNAL_RECEIPT: Acquired from an external source (blood bank, hospital, etc.)
   */
  @Prop({
    type: String,
    required: true,
    enum: Object.values(BloodUnitSourceType),
    default: BloodUnitSourceType.DONATION,
    index: true,
  })
  sourceType: BloodUnitSourceType;

  /**
   * Reference to the Donation record (only set when sourceType = DONATION).
   * NOT set for external receipt units.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Donation',
    required: false,
    sparse: true,
  })
  donationId?: Types.ObjectId;

  /**
   * Reference to the Donor record (only set when sourceType = DONATION).
   * NOT set for external receipt units — no fabricated donor is created.
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
   * Reference to the Campaign record (set when donation is collected during a mobile campaign drive).
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
   * Reference to the BloodAcquisition receipt record (only set when sourceType = EXTERNAL_RECEIPT).
   * NOT set for donation-based units.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'BloodAcquisition',
    required: false,
    index: true,
    sparse: true,
  })
  externalReceiptId?: Types.ObjectId;

  /**
   * Reference to the specific line item in BloodAcquisition.items
   */
  @Prop({
    type: Types.ObjectId,
    required: false,
    index: true,
    sparse: true,
  })
  acquisitionItemId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: Object.values(BloodGroup),
    index: true,
  })
  bloodGroup: BloodGroup;

  @Prop({
    required: true,
    enum: Object.values(BloodUnitComponent),
    index: true,
  })
  componentType: BloodUnitComponent;

  @Prop({ required: true, index: true })
  collectionDate: Date;

  @Prop({ required: false, index: true })
  expiryDate?: Date;

  @Prop({ required: false, min: 1 })
  volume?: number;

  @Prop({
    required: true,
    enum: Object.values(BloodUnitStatus),
    default: BloodUnitStatus.TESTING,
    index: true,
  })
  status: BloodUnitStatus;

  @Prop({ required: false, trim: true })
  storageLocation?: string;

  // --- Traceable Phlebotomy & Bag Metadata (Phase 2) ---
  @Prop({ required: false, trim: true, uppercase: true, index: true, sparse: true })
  bagBarcode?: string;

  @Prop({ required: false, trim: true })
  bagType?: string;

  @Prop({
    required: false,
    enum: ['INTACT', 'LEAKING', 'CLOTTED', 'DEFECTIVE'],
    default: 'INTACT',
  })
  bagIntegrity?: string;

  @Prop({
    required: false,
    enum: ['SUCCESSFUL', 'UNDER_COLLECTED', 'UNSUCCESSFUL_VENIPUNCTURE', 'DISCARDED_AT_COLLECTION'],
    default: 'SUCCESSFUL',
  })
  collectionOutcome?: string;

  @Prop({ required: false, trim: true })
  notes?: string;

  // --- Component Separation & Parent-Child Traceability (Phase 3) ---
  @Prop({ type: Types.ObjectId, ref: 'BloodUnit', required: false, index: true, sparse: true })
  parentUnitId?: Types.ObjectId;

  @Prop({ required: false, trim: true, uppercase: true })
  parentUnitCode?: string;

  @Prop({ default: false, index: true })
  isComponentDerived?: boolean;

  @Prop({ required: false, trim: true })
  storageRequirement?: string;

  @Prop({ required: false })
  preparedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  preparedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  preparedByName?: string;

  @Prop({ required: false, trim: true })
  preparedByRole?: string;

  @Prop({ required: false, trim: true })
  separationMethod?: string;

  // --- Staff User Attribution & Accountability ---
  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false, index: true })
  createdBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  createdByName?: string;

  @Prop({ required: false, trim: true })
  createdByRole?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  statusUpdatedBy?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  statusUpdatedByName?: string;

  @Prop({ required: false })
  statusUpdatedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodUnitSchema = SchemaFactory.createForClass(BloodUnit);

// Query-supporting compound and sorting indexes
BloodUnitSchema.index({ createdAt: -1 });
BloodUnitSchema.index({ status: 1, bloodGroup: 1 });
BloodUnitSchema.index({ collectionDate: -1 });
BloodUnitSchema.index({ sourceType: 1, externalReceiptId: 1 });
BloodUnitSchema.index({ createdBy: 1 });
// Partial unique index: donationId must be unique ONLY when it is an actual ObjectId
BloodUnitSchema.index(
  { donationId: 1 },
  {
    unique: true,
    partialFilterExpression: { donationId: { $type: 'objectId' } },
  },
);
