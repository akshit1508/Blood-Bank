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
 * Each item will generate `acceptedQuantity` individual Blood Unit records upon inspection completion.
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

  /** Formal quantity billed by supplier on invoice */
  @Prop({ required: true, min: 1, type: Number })
  invoicedQuantity: number;

  /** Units physically delivered at the intake dock */
  @Prop({ required: true, min: 0, type: Number })
  receivedQuantity: number;

  /** Units awaiting inspection/unpacking - Must be 0 before committing unit creation */
  @Prop({ required: false, default: 0, min: 0, type: Number })
  pendingInspectionQuantity: number;

  /** Units passing intake physical inspection - canonical traceable unit count */
  @Prop({ required: true, min: 0, type: Number })
  acceptedQuantity: number;

  /** Units damaged, clotted, hemolyzed, or expired upon arrival */
  @Prop({ required: false, default: 0, min: 0, type: Number })
  rejectedQuantity: number;

  /** Legacy / canonical alias matching acceptedQuantity */
  @Prop({ required: true, min: 0, type: Number })
  quantity: number;

  /** Unit price in INR */
  @Prop({ required: false, type: Number, min: 0 })
  unitCost?: number;

  /** Unit price in authoritative integer paise */
  @Prop({ required: false, type: Number, min: 0 })
  unitCostPaise?: number;

  /** Line item total cost in integer paise */
  @Prop({ required: false, type: Number, min: 0 })
  totalCostPaise?: number;

  /**
   * If true, generated Blood Units must enter the existing Testing workflow.
   * If false, Blood Units can enter Inventory directly ONLY with authorized medical certification.
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

  /** Reason if units were rejected during physical intake inspection */
  @Prop({ required: false, trim: true })
  rejectionReason?: string;

  /** Optional notes specific to this blood entry */
  @Prop({ required: false, trim: true })
  itemNotes?: string;
}

export const BloodAcquisitionItemSchema =
  SchemaFactory.createForClass(BloodAcquisitionItem);

/**
 * Sub-schema for auditable supplier credit notes, refunds, and dispute settlements.
 */
@Schema({ _id: true, timestamps: true })
export class BloodAcquisitionAdjustment {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['CREDIT_NOTE', 'SUPPLIER_REFUND', 'DISPUTE_SETTLEMENT'],
  })
  adjustmentType: string;

  /** Formal supplier credit note or refund reference / UTR */
  @Prop({ required: true, trim: true })
  referenceNumber: string;

  /** Alias for referenceNumber */
  @Prop({ required: false, trim: true })
  creditNoteReference?: string;

  /** Adjustment amount in integer paise (>= 1) */
  @Prop({ required: true, type: Number, min: 1 })
  creditAmountPaise: number;

  /** Alias for creditAmountPaise */
  @Prop({ required: false, type: Number })
  amountPaise?: number;

  /** Derived INR (creditAmountPaise / 100) */
  @Prop({ required: true, type: Number, min: 0.01 })
  creditAmount: number;

  /** Alias for creditAmount */
  @Prop({ required: false, type: Number })
  amount?: number;

  /** Mandatory detailed justification (>= 10 characters) */
  @Prop({ required: true, trim: true })
  reason: string;

  /** Acquisition line item IDs involved */
  @Prop({ type: [Types.ObjectId], default: [] })
  affectedItemIds: Types.ObjectId[];

  /** Traceable blood unit codes (e.g. if rejected during laboratory testing) */
  @Prop({ type: [String], default: [] })
  affectedUnitCodes: string[];

  /** Document proof storage key */
  @Prop({ required: false, trim: true })
  documentProofKey?: string;

  @Prop({ required: false, trim: true })
  supportingDocumentKey?: string;

  @Prop({ required: false, trim: true })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  authorizedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  authorizedByName: string;

  @Prop({ required: false, trim: true })
  approvedByName?: string;

  @Prop({ required: true, trim: true })
  authorizedByEmail: string;

  @Prop({ required: true, default: Date.now })
  authorizedAt: Date;

  @Prop({ required: false })
  approvedAt?: Date;
}

export const BloodAcquisitionAdjustmentSchema =
  SchemaFactory.createForClass(BloodAcquisitionAdjustment);

/**
 * Represents a single external blood receipt event.
 *
 * One receipt can contain multiple blood entries (different blood groups/components).
 * Each entry generates individually traceable Blood Unit records once physical inspection is complete.
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

  /** Unique client-supplied or generated idempotency key */
  @Prop({ required: true, unique: true, trim: true, index: true })
  idempotencyKey: string;

  /** Canonical SHA-256 payload fingerprint */
  @Prop({ required: true, trim: true })
  requestPayloadHash: string;

  @Prop({
    required: true,
    enum: Object.values(ExternalSourceType),
    index: true,
  })
  sourceType: ExternalSourceType;

  /** Name of the external blood bank, hospital, or organisation */
  @Prop({ required: true, trim: true, index: true })
  sourceName: string;

  /** Supplier's formal tax invoice number */
  @Prop({ required: false, trim: true, index: true })
  invoiceNumber?: string;

  /** Optional reference/batch/consignment number from the external source */
  @Prop({ required: false, trim: true, index: true })
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
  @Prop({ required: true, min: 0 })
  totalUnitsGenerated: number;

  /** Blood entries included in this receipt */
  @Prop({ type: [BloodAcquisitionItemSchema], required: true })
  items: BloodAcquisitionItem[];

  // --- Financial & Vendor Master Linkage ---

  /** Linked Phase 3 registered Vendor profile (if registered) */
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: false, index: true })
  vendorId?: Types.ObjectId;

  /** Linked Phase 3 Expense liability */
  @Prop({ type: Types.ObjectId, ref: 'Expense', required: false, index: true })
  expenseId?: Types.ObjectId;

  /** Base acquisition cost in integer paise */
  @Prop({ required: false, type: Number, default: 0, min: 0 })
  acquisitionCostPaise: number;

  /** Cold-chain transport and additional charges in integer paise */
  @Prop({ required: false, type: Number, default: 0, min: 0 })
  transportChargesPaise: number;

  /** Total invoiced payable amount in integer paise (base + transport) */
  @Prop({ required: false, type: Number, default: 0, min: 0 })
  totalPayablePaise: number;

  /** Total invoiced payable in INR */
  @Prop({ required: false, type: Number, default: 0, min: 0 })
  totalPayable: number;

  /** Document key of attached supplier bill/invoice */
  @Prop({ required: false, trim: true })
  invoiceDocumentKey?: string;

  @Prop({ required: false, trim: true })
  invoiceDocumentUrl?: string;

  // --- Medical Clearance Governance for Direct Intake ---

  /** Documented certificate/batch test report number issued by source */
  @Prop({ required: false, trim: true })
  clearanceCertificateNumber?: string;

  /** Affirmative attestation of negative infectious disease screening and ABO/Rh typing */
  @Prop({ required: false, type: Boolean, default: false })
  sourceTestingCertified: boolean;

  /** Medical staff who authorized direct intake */
  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: false })
  clearanceAuthorizedByStaffId?: Types.ObjectId;

  @Prop({ required: false, trim: true })
  clearanceAuthorizedByName?: string;

  @Prop({ required: false, trim: true })
  clearanceAuthorizedByEmail?: string;

  @Prop({ required: false })
  clearanceAuthorizationDate?: Date;

  /** Document key of attached test certificate */
  @Prop({ required: false, trim: true })
  certificateDocumentKey?: string;

  @Prop({ required: false, trim: true })
  clearanceCertificateKey?: string;

  @Prop({ required: false, trim: true })
  clearanceCertificateUrl?: string;

  // --- Reconciliation & Auditable Adjustments ---

  /** True if invoiced != received or any units were rejected at intake */
  @Prop({ required: true, default: false })
  hasDiscrepancy: boolean;

  /** Mandatory explanation if discrepancy exists */
  @Prop({ required: false, trim: true })
  reconciliationNotes?: string;

  /** Immutable credit memos, refunds, and adjustments */
  @Prop({ type: [BloodAcquisitionAdjustmentSchema], default: [] })
  adjustments: BloodAcquisitionAdjustment[];

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true })
  createdBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  createdByName: string;

  @Prop({ required: true, trim: true })
  createdByEmail: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BloodAcquisitionSchema =
  SchemaFactory.createForClass(BloodAcquisition);

BloodAcquisitionSchema.index({ createdAt: -1 });
BloodAcquisitionSchema.index({ sourceType: 1, status: 1 });
BloodAcquisitionSchema.index({ receivedDate: -1 });
// Compound business unique index: sourceName + invoiceNumber/referenceNumber + receivedDate
BloodAcquisitionSchema.index(
  { sourceName: 1, invoiceNumber: 1, referenceNumber: 1, receivedDate: 1 },
  { unique: true },
);
