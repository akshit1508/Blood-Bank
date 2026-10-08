import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  BloodUnitComponent,
} from '../../blood-units/constants/blood-unit.constants';
import { BloodGroup } from '../../donors/constants/donor.constants';
import {
  BloodAcquisitionStatus,
  ExternalSourceType,
} from '../constants/blood-acquisition.constants';

export type BloodAcquisitionDocument = BloodAcquisition & Document;

/**
 * Represents a single blood type entry within a bulk external receipt.
 * Each item will generate `quantity` individual Blood Unit records.
 */
@Schema({ _id: true })
export class BloodAcquisitionItem {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    enum: Object.values(BloodGroup),
    index: true,
  })
  bloodGroup: BloodGroup;

  @Prop({
    required: true,
    enum: Object.values(BloodUnitComponent),
  })
  componentType: BloodUnitComponent;

  @Prop({ required: true, min: 1 })
  quantity: number;

  /**
   * If true, generated Blood Units must enter the existing Testing workflow.
   * If false, Blood Units are considered pre-cleared and enter Inventory directly.
   */
  @Prop({ required: true, type: Boolean })
  testingRequired: boolean;

  /** Optional volume per individual unit in mL */
  @Prop({ required: false, min: 1 })
  volumePerUnit?: number;

  /** Optional expiry date for Blood Units generated from this entry */
  @Prop({ required: false })
  expiryDate?: Date;

  /** Optional common storage location for this batch */
  @Prop({ required: false, trim: true })
  storageLocation?: string;

  /** Optional notes specific to this blood entry */
  @Prop({ required: false, trim: true })
  itemNotes?: string;
}

export const BloodAcquisitionItemSchema =
  SchemaFactory.createForClass(BloodAcquisitionItem);

/**
 * Represents a single external blood receipt event.
 *
 * One receipt can contain multiple blood entries (different blood groups/components).
 * Each entry generates individually traceable Blood Unit records.
 *
 * This entity is distinct from internal Donation-based Blood Units.
 * No Donor or Donation records are created for external acquisitions.
 */
@Schema({
  collection: 'blood_acquisitions',
  timestamps: true,
})
export class BloodAcquisition {
  /**
   * Unique human-readable receipt code.
   * Format: EXT-YYYYMMDD-XXXX
   */
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  receiptCode: string;

  @Prop({
    required: true,
    enum: Object.values(ExternalSourceType),
    index: true,
  })
  sourceType: ExternalSourceType;

  /** Name of the external blood bank, hospital, or organisation */
  @Prop({ required: true, trim: true, index: true })
  sourceName: string;

  /** Optional reference/batch/shipment number from the external source */
  @Prop({ required: false, trim: true })
  referenceNumber?: string;

  /** Date the blood was physically received */
  @Prop({ required: true, index: true })
  receivedDate: Date;

  /** Optional general notes for the entire receipt */
  @Prop({ required: false, trim: true })
  notes?: string;

  /** High-level status reflecting processing state of the generated units */
  @Prop({
    required: true,
    enum: Object.values(BloodAcquisitionStatus),
    default: BloodAcquisitionStatus.PROCESSING,
    index: true,
  })
  status: BloodAcquisitionStatus;

  /** Total number of individual Blood Unit records generated from this receipt */
  @Prop({ required: true, min: 1 })
  totalUnitsGenerated: number;

  /** Blood entries included in this receipt */
  @Prop({ type: [BloodAcquisitionItemSchema], required: true })
  items: BloodAcquisitionItem[];

  createdAt: Date;
  updatedAt: Date;
}

export const BloodAcquisitionSchema =
  SchemaFactory.createForClass(BloodAcquisition);

BloodAcquisitionSchema.index({ createdAt: -1 });
BloodAcquisitionSchema.index({ sourceType: 1, status: 1 });
BloodAcquisitionSchema.index({ receivedDate: -1 });
