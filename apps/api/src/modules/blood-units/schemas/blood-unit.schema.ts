import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  BloodUnitComponent,
  BloodUnitStatus,
} from '../constants/blood-unit.constants';
import { BloodGroup } from '../../donors/constants/donor.constants';

export type BloodUnitDocument = BloodUnit & Document;

@Schema({
  collection: 'blood_units',
  timestamps: true,
})
export class BloodUnit {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  unitCode: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Donation',
    required: true,
    unique: true,
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
