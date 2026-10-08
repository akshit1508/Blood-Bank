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

  @Prop({ required: false, trim: true })
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodUnitSchema = SchemaFactory.createForClass(BloodUnit);

// Query-supporting compound and sorting indexes
BloodUnitSchema.index({ createdAt: -1 });
BloodUnitSchema.index({ status: 1, bloodGroup: 1 });
BloodUnitSchema.index({ collectionDate: -1 });
BloodUnitSchema.index({ sourceType: 1, externalReceiptId: 1 });
// Partial unique index: donationId must be unique ONLY when it is an actual ObjectId
BloodUnitSchema.index(
  { donationId: 1 },
  {
    unique: true,
    partialFilterExpression: { donationId: { $type: 'objectId' } },
  },
);
