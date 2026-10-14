import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, isValidObjectId } from 'mongoose';
import * as crypto from 'crypto';
import {
  BloodAcquisition,
  BloodAcquisitionDocument,
} from './schemas/blood-acquisition.schema';
import {
  BloodUnit,
  BloodUnitDocument,
} from '../blood-units/schemas/blood-unit.schema';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import {
  BloodTesting,
  BloodTestingDocument,
} from '../testing/schemas/blood-testing.schema';
import {
  Expense,
  ExpenseDocument,
} from '../expenses/schemas/expense.schema';
import {
  Vendor,
  VendorDocument,
} from '../vendors/schemas/vendor.schema';
import { InventoryService } from '../inventory/inventory.service';
import { CreateBloodAcquisitionDto } from './dto/create-blood-acquisition.dto';
import { RecordAcquisitionAdjustmentDto } from './dto/record-adjustment.dto';
import { QueryBloodAcquisitionsDto } from './dto/query-blood-acquisitions.dto';
import {
  BloodAcquisitionStatus,
  BloodUnitSourceType,
  ExternalSourceType,
} from './constants/blood-acquisition.constants';
import {
  BloodUnitComponent,
  BloodUnitStatus,
} from '../blood-units/constants/blood-unit.constants';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import { BloodGroup } from '../donors/constants/donor.constants';
import {
  ExpenseCategory,
  CostCenter,
  ExpenseStatus,
  ExpensePaymentStatus,
  ExpenseAuditEventType,
} from '../expenses/constants/expense.constants';
import { CurrencyUtil } from '../../common/utils/currency.util';
import { StorageService } from '../expenses/storage/storage.service';

export interface PaginatedBloodAcquisitions {
  items: any[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AcquisitionSummaryStats {
  totalReceipts: number;
  totalUnitsReceived: number;
  directToInventory: number;
  pendingTesting: number;
}

@Injectable()
export class BloodAcquisitionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BloodAcquisitionsService.name);

  constructor(
    @InjectModel(BloodAcquisition.name)
    private readonly bloodAcquisitionModel: Model<BloodAcquisitionDocument>,
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel: Model<BloodUnitDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(BloodTesting.name)
    private readonly bloodTestingModel: Model<BloodTestingDocument>,
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
    private readonly inventoryService: InventoryService,
    private readonly storageService: StorageService,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.bloodAcquisitionModel.collection.createIndex(
        { idempotencyKey: 1 },
        { unique: true, background: true },
      );
      await this.bloodAcquisitionModel.collection.createIndex(
        { sourceName: 1, invoiceNumber: 1, referenceNumber: 1, receivedDate: 1 },
        { unique: true, background: true },
      );
      this.logger.log('Preflight verified: Unique indexes on blood_acquisitions are active.');
    } catch (err: any) {
      this.logger.warn(`Could not verify or create blood_acquisitions indexes: ${err.message}`);
    }
  }

  /**
   * Generates a unique server-side acquisition receipt code.
   * Format: EXT-YYYYMMDD-XXXX (e.g. EXT-20261008-A8F3)
   */
  private generateReceiptCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `EXT-${datePart}-${randomPart}`;
  }

  /**
   * Generates a unique server-side blood unit code.
   * Format: UNIT-YYYYMMDD-XXXX
   */
  private generateUnitCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `UNIT-${datePart}-${randomPart}`;
  }

  private generateExpenseCode(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `EXP-${yyyy}${mm}${dd}-${rand}`;
  }

  computeCanonicalPayloadHash(dto: CreateBloodAcquisitionDto): string {
    const canonical = {
      sourceType: dto.sourceType,
      sourceName: dto.sourceName.trim().toUpperCase(),
      invoiceNumber: (dto.invoiceNumber || '').trim().toUpperCase(),
      referenceNumber: (dto.referenceNumber || '').trim().toUpperCase(),
      receivedDate: new Date(dto.receivedDate).toISOString().slice(0, 10),
      items: dto.items.map((it) => ({
        bloodGroup: it.bloodGroup,
        componentType: it.componentType,
        invoicedQuantity: it.invoicedQuantity,
        receivedQuantity: it.receivedQuantity,
        acceptedQuantity: it.acceptedQuantity,
        rejectedQuantity: it.rejectedQuantity || 0,
        unitCost: it.unitCost || 0,
        testingRequired: Boolean(it.testingRequired),
      })),
      transportCharges: dto.transportCharges || 0,
      vendorId: dto.vendorId || '',
      notes: (dto.notes || '').trim(),
      reconciliationNotes: (dto.reconciliationNotes || '').trim(),
    };
    return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  async create(createDto: CreateBloodAcquisitionDto, currentAdmin: any, clientProvidedIdempotencyKey?: string) {
    // 1. Validate receivedDate
    const receivedDate = new Date(createDto.receivedDate);
    if (isNaN(receivedDate.getTime())) {
      throw new BadRequestException({
        message: 'Invalid receivedDate format.',
        code: 'INVALID_RECEIVED_DATE',
      });
    }

    const now = new Date();
    if (receivedDate.getTime() > now.getTime() + 120 * 1000) {
      throw new BadRequestException({
        message: 'Received date cannot be in the future.',
        code: 'RECEIVED_DATE_IN_FUTURE',
      });
    }

    // 2. Validate items array
    if (!createDto.items || createDto.items.length === 0) {
      throw new BadRequestException({
        message: 'At least one blood entry item is required.',
        code: 'EMPTY_ACQUISITION_ITEMS',
      });
    }

    // 3. Mathematical Quantity Invariants and Inspection Completion Rule
    let totalInvoicedUnits = 0;
    let totalAcceptedUnits = 0;
    let totalRejectedUnits = 0;
    let totalAcquisitionCostPaise = 0;
    let anyDiscrepancy = false;

    for (let i = 0; i < createDto.items.length; i++) {
      const item = createDto.items[i];
      const invoiced = Number(item.invoicedQuantity);
      const received = Number(item.receivedQuantity);
      const accepted = Number(item.acceptedQuantity);
      const rejected = Number(item.rejectedQuantity || 0);
      const pending = Number(item.pendingInspectionQuantity || 0);

      if (invoiced < 1) {
        throw new BadRequestException({
          message: `Item row ${i + 1}: Invoiced quantity must be at least 1.`,
          code: 'INVALID_ITEM_QUANTITY',
        });
      }

      if (received < 0 || accepted < 0 || rejected < 0) {
        throw new BadRequestException({
          message: `Item row ${i + 1}: Quantities cannot be negative.`,
          code: 'NEGATIVE_QUANTITY_NOT_ALLOWED',
        });
      }

      // Inspection completion gate: All units on the consignment must have finished inspection before committing unit creation
      if (pending > 0) {
        throw new BadRequestException({
          message: `Item row ${i + 1}: Has ${pending} units pending inspection. All physical intake inspections must be completed (pending = 0) before committing traceable blood units.`,
          code: 'INSPECTION_NOT_COMPLETE',
        });
      }

      // Intake invariant: received == accepted + rejected
      if (received !== accepted + rejected) {
        throw new BadRequestException({
          message: `Item row ${i + 1}: Quantity mismatch! Received (${received}) must equal accepted (${accepted}) + rejected (${rejected}).`,
          code: 'QUANTITY_INSPECTION_MISMATCH',
        });
      }

      if (rejected > 0 && (!item.rejectionReason || item.rejectionReason.trim().length === 0)) {
        throw new BadRequestException({
          message: `Item row ${i + 1}: Rejection reason is mandatory when rejectedQuantity > 0.`,
          code: 'REJECTION_REASON_REQUIRED',
        });
      }

      if (invoiced !== received || rejected > 0) {
        anyDiscrepancy = true;
      }

      const unitCost = item.unitCost ? Number(item.unitCost) : 0;
      const unitCostPaise = CurrencyUtil.toPaise(unitCost);
      const itemTotalCostPaise = invoiced * unitCostPaise;

      totalInvoicedUnits += invoiced;
      totalAcceptedUnits += accepted;
      totalRejectedUnits += rejected;
      totalAcquisitionCostPaise += itemTotalCostPaise;

      if (item.expiryDate) {
        const exp = new Date(item.expiryDate);
        if (isNaN(exp.getTime()) || exp <= receivedDate) {
          throw new BadRequestException({
            message: `Expiry date for blood entry (${item.bloodGroup} ${item.componentType}) must be a valid date after received date.`,
            code: 'INVALID_EXPIRY_DATE',
          });
        }
      }
    }

    if (anyDiscrepancy && (!createDto.reconciliationNotes || createDto.reconciliationNotes.trim().length === 0)) {
      throw new BadRequestException({
        message: 'A discrepancy exists between invoiced and accepted quantities. Mandatory reconciliationNotes must be provided.',
        code: 'RECONCILIATION_NOTES_REQUIRED',
      });
    }

    // 4. Financial Costing Calculations
    const transportCharges = createDto.transportCharges ? Number(createDto.transportCharges) : 0;
    const transportChargesPaise = CurrencyUtil.toPaise(transportCharges);
    const totalPayablePaise = totalAcquisitionCostPaise + transportChargesPaise;
    const totalPayableInr = CurrencyUtil.toInr(totalPayablePaise);

    // 5. Vendor Linkage Validation (if provided)
    let linkedVendor: VendorDocument | null = null;
    if (createDto.vendorId) {
      if (!isValidObjectId(createDto.vendorId)) {
        throw new BadRequestException('Invalid vendorId format.');
      }
      linkedVendor = await this.vendorModel.findById(createDto.vendorId).exec();
      if (!linkedVendor || !linkedVendor.isActive) {
        throw new BadRequestException('Selected vendor does not exist or is inactive.');
      }
    }

    // 6. Direct Intake Medical Clearance Gate Verification (if any item has testingRequired === false)
    const hasAnyDirectIntake = createDto.items.some((it) => it.testingRequired === false);
    let clearanceAuthorizedStaff: any = null;

    if (hasAnyDirectIntake) {
      const isRegulatedSource = [
        ExternalSourceType.GOVERNMENT_BLOOD_CENTRE,
        ExternalSourceType.BLOOD_BANK,
        ExternalSourceType.HOSPITAL,
      ].includes(createDto.sourceType);

      const hasCertificate = Boolean(
        createDto.clearanceCertificateNumber && createDto.clearanceCertificateNumber.trim().length > 0,
      );
      const hasAttestation = Boolean(createDto.sourceTestingCertified === true);

      if (!isRegulatedSource || !hasCertificate || !hasAttestation) {
        throw new BadRequestException({
          message: 'Direct inventory intake (testingRequired = false) requires a regulated source, valid clearance certificate number, and source-testing attestation. Incomplete documentation.',
          code: 'EXTERNAL_CLEARANCE_DOCUMENTATION_MISSING',
        });
      }

      // Medical clearance sign-off
      clearanceAuthorizedStaff = {
        staffId: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
        name: currentAdmin.fullName || 'Medical Officer',
        email: currentAdmin.email,
        date: new Date(),
      };
    }

    // 7. Idempotency Key & Canonical Fingerprint
    const idempotencyKey = (clientProvidedIdempotencyKey || crypto.randomUUID()).trim();
    const payloadHash = this.computeCanonicalPayloadHash(createDto);

    // Check existing by idempotencyKey
    const existingByIdempotency = await this.bloodAcquisitionModel.findOne({ idempotencyKey }).exec();
    if (existingByIdempotency) {
      if (existingByIdempotency.requestPayloadHash === payloadHash) {
        return {
          receipt: existingByIdempotency,
          totalUnitsCreated: existingByIdempotency.totalUnitsGenerated,
          isIdempotentReplay: true,
        };
      }
      throw new ConflictException({
        statusCode: 409,
        error: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
        message: 'The idempotency key was previously used with different acquisition parameters.',
      });
    }

    // Check duplicate business acquisition
    const duplicateQuery: any = {
      sourceName: createDto.sourceName.trim(),
      receivedDate,
    };
    if (createDto.invoiceNumber?.trim()) {
      duplicateQuery.invoiceNumber = createDto.invoiceNumber.trim();
    }
    if (createDto.referenceNumber?.trim()) {
      duplicateQuery.referenceNumber = createDto.referenceNumber.trim();
    }
    if (!createDto.invoiceNumber?.trim() && !createDto.referenceNumber?.trim()) {
      duplicateQuery.invoiceNumber = { $in: [null, undefined, ''] };
      duplicateQuery.referenceNumber = { $in: [null, undefined, ''] };
    }

    const existingBusinessDuplicate = await this.bloodAcquisitionModel.findOne(duplicateQuery).exec();
    if (existingBusinessDuplicate) {
      throw new ConflictException({
        statusCode: 409,
        error: 'DUPLICATE_ACQUISITION_INVOICE',
        message: `An acquisition record (${existingBusinessDuplicate.receiptCode}) with identical supplier and invoice/reference already exists for this received date.`,
      });
    }

    // 8. Generate Unique Receipt Code
    let receiptCode = this.generateReceiptCode();
    while (await this.bloodAcquisitionModel.exists({ receiptCode })) {
      receiptCode = this.generateReceiptCode();
    }

    // 9. Multi-document Atomic Transaction Execution
    const session = await this.connection.startSession();
    try {
      let createdReceipt: BloodAcquisitionDocument | null = null;
      let createdUnits: BloodUnitDocument[] = [];
      let directUnits: BloodUnitDocument[] = [];
      let testingUnits: BloodUnitDocument[] = [];
      let createdExpense: ExpenseDocument | null = null;

      await session.withTransaction(async () => {
        createdUnits = [];
        directUnits = [];
        testingUnits = [];
        createdExpense = null;

        // A. Insert BloodAcquisition document
        const acquisitionDoc = new this.bloodAcquisitionModel({
          receiptCode,
          idempotencyKey,
          requestPayloadHash: payloadHash,
          sourceType: createDto.sourceType,
          sourceName: createDto.sourceName.trim(),
          invoiceNumber: createDto.invoiceNumber?.trim() || undefined,
          referenceNumber: createDto.referenceNumber?.trim() || undefined,
          receivedDate,
          notes: createDto.notes?.trim() || undefined,
          status: BloodAcquisitionStatus.PROCESSING,
          totalUnitsGenerated: totalAcceptedUnits,
          items: createDto.items.map((it) => {
            const unitCost = it.unitCost ? Number(it.unitCost) : 0;
            const unitCostPaise = CurrencyUtil.toPaise(unitCost);
            const totalCostPaise = it.invoicedQuantity * unitCostPaise;
            return {
              _id: new Types.ObjectId(),
              bloodGroup: it.bloodGroup,
              componentType: it.componentType,
              invoicedQuantity: it.invoicedQuantity,
              receivedQuantity: it.receivedQuantity,
              pendingInspectionQuantity: 0,
              acceptedQuantity: it.acceptedQuantity,
              rejectedQuantity: it.rejectedQuantity || 0,
              quantity: it.acceptedQuantity,
              unitCost,
              unitCostPaise,
              totalCostPaise,
              testingRequired: Boolean(it.testingRequired),
              volumePerUnit: it.volumePerUnit || 450,
              expiryDate: it.expiryDate ? new Date(it.expiryDate) : undefined,
              storageLocation: it.storageLocation?.trim() || undefined,
              rejectionReason: it.rejectionReason?.trim() || undefined,
              itemNotes: it.itemNotes?.trim() || undefined,
            };
          }),
          vendorId: linkedVendor ? linkedVendor._id : undefined,
          acquisitionCostPaise: totalAcquisitionCostPaise,
          transportChargesPaise,
          totalPayablePaise,
          totalPayable: totalPayableInr,
          clearanceCertificateNumber: createDto.clearanceCertificateNumber?.trim() || undefined,
          sourceTestingCertified: Boolean(createDto.sourceTestingCertified),
          clearanceAuthorizedByStaffId: clearanceAuthorizedStaff?.staffId,
          clearanceAuthorizedByName: clearanceAuthorizedStaff?.name,
          clearanceAuthorizedByEmail: clearanceAuthorizedStaff?.email,
          clearanceAuthorizationDate: clearanceAuthorizedStaff?.date,
          hasDiscrepancy: anyDiscrepancy,
          reconciliationNotes: createDto.reconciliationNotes?.trim() || undefined,
          adjustments: [],
          createdBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
          createdByName: currentAdmin.fullName || 'Admin Staff',
          createdByEmail: currentAdmin.email,
        });

        createdReceipt = await acquisitionDoc.save({ session });

        // B. Generate individual Blood Units for acceptedQuantity
        for (const item of createdReceipt.items) {
          for (let i = 0; i < item.acceptedQuantity; i++) {
            let unitCode = this.generateUnitCode();
            while (await this.bloodUnitModel.exists({ unitCode }).session(session)) {
              unitCode = this.generateUnitCode();
            }

            const isTestingRequired = item.testingRequired;
            const unitStatus = isTestingRequired ? BloodUnitStatus.TESTING : BloodUnitStatus.APPROVED;

            const unitDoc = new this.bloodUnitModel({
              unitCode,
              sourceType: BloodUnitSourceType.EXTERNAL_RECEIPT,
              externalReceiptId: createdReceipt._id,
              acquisitionItemId: item._id,
              bloodGroup: item.bloodGroup,
              componentType: item.componentType,
              collectionDate: receivedDate,
              expiryDate: item.expiryDate,
              volume: item.volumePerUnit || 450,
              status: unitStatus,
              storageLocation: item.storageLocation,
              notes: item.itemNotes
                ? `Acquired from ${createdReceipt.sourceName} (${createdReceipt.receiptCode}): ${item.itemNotes}`
                : `Acquired from ${createdReceipt.sourceName} (${createdReceipt.receiptCode})`,
            });

            const savedUnit = await unitDoc.save({ session });
            createdUnits.push(savedUnit);

            if (isTestingRequired) {
              testingUnits.push(savedUnit);
            } else {
              directUnits.push(savedUnit);
            }
          }
        }

        // C. Direct Inventory Intake for pre-cleared certified units
        for (const unit of directUnits) {
          const invDoc = new this.inventoryModel({
            bloodUnitId: unit._id,
            status: InventoryStatus.AVAILABLE,
          });
          await invDoc.save({ session });
        }

        // D. Create linked Phase 3 Expense liability in DRAFT (if costing provided)
        if (totalPayablePaise > 0) {
          let expenseCode = this.generateExpenseCode();
          while (await this.expenseModel.exists({ expenseCode }).session(session)) {
            expenseCode = this.generateExpenseCode();
          }

          const expenseDoc = new this.expenseModel({
            expenseCode,
            title: `Blood Consignment: ${createdReceipt.sourceName} (${createdReceipt.receiptCode})`,
            category: ExpenseCategory.MEDICAL_SUPPLIES,
            costCenter: CostCenter.BLOOD_BANK_OPERATIONS,
            expenseDate: receivedDate,
            amount: totalPayableInr,
            amountPaise: totalPayablePaise,
            paidAmountPaise: 0,
            paidAmount: 0,
            paymentStatus: ExpensePaymentStatus.UNPAID,
            currency: 'INR',
            vendorId: linkedVendor ? linkedVendor._id : undefined,
            vendorName: linkedVendor ? linkedVendor.name : createdReceipt.sourceName,
            invoiceNumber: createdReceipt.invoiceNumber || createdReceipt.referenceNumber || createdReceipt.receiptCode,
            status: ExpenseStatus.DRAFT,
            creatorId: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
            creatorEmail: currentAdmin.email,
            creatorRole: currentAdmin.role,
            acquisitionId: createdReceipt._id,
            description: `Authoritative payable for blood acquisition receipt ${createdReceipt.receiptCode}. Total units accepted: ${totalAcceptedUnits}. Invoiced units: ${totalInvoicedUnits}.`,
            isDeleted: false,
            auditHistory: [
              {
                action: ExpenseAuditEventType.CREATED,
                toStatus: ExpenseStatus.DRAFT,
                performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
                performedByEmail: currentAdmin.email,
                performedByName: currentAdmin.fullName || 'Admin Staff',
                notes: `Expense draft created from blood acquisition ${createdReceipt.receiptCode}.`,
                timestamp: new Date(),
              },
            ],
          });

          createdExpense = await expenseDoc.save({ session });
          createdReceipt.expenseId = createdExpense._id;
          await createdReceipt.save({ session });
        }

        // Mark receipt COMPLETED if all units entered inventory and none need testing
        if (testingUnits.length === 0 && directUnits.length > 0) {
          createdReceipt.status = BloodAcquisitionStatus.COMPLETED;
          await createdReceipt.save({ session });
        }
      });

      await session.endSession();

      return {
        receipt: createdReceipt!,
        totalUnitsCreated: createdUnits.length,
        directInventoryCount: directUnits.length,
        pendingTestingCount: testingUnits.length,
        expense: createdExpense,
        isIdempotentReplay: false,
      };
    } catch (err: any) {
      await session.endSession();
      this.logger.error(`Failed to commit blood acquisition transaction: ${err.message}`, err.stack);
      if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
        if (err.keyPattern?.idempotencyKey) {
          throw new ConflictException({
            statusCode: 409,
            error: 'IDEMPOTENCY_KEY_CONFLICT',
            message: 'Concurrent request detected for this idempotency key. Please retry.',
          });
        }
        throw new ConflictException({
          statusCode: 409,
          error: 'DUPLICATE_ACQUISITION_INVOICE',
          message: 'An acquisition with identical supplier, invoice/reference, and received date already exists.',
        });
      }
      throw err;
    }
  }

  /**
   * Retrieves paginated list of external receipts with optional filters.
   */
  async findAll(query: QueryBloodAcquisitionsDto): Promise<PaginatedBloodAcquisitions> {
    const filter: Record<string, any> = {};

    if (query.sourceType) {
      filter.sourceType = query.sourceType;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.search?.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { receiptCode: regex },
        { sourceName: regex },
        { referenceNumber: regex },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.bloodAcquisitionModel
        .find(filter)
        .sort({ receivedDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bloodAcquisitionModel.countDocuments(filter).exec(),
    ]);

    // Augment items with live unit breakdown counts and financial summary
    const augmentedItems = await Promise.all(
      items.map(async (item) => {
        const units = await this.bloodUnitModel
          .find({ externalReceiptId: item._id })
          .select('status')
          .lean()
          .exec();

        const testingCount = units.filter(
          (u) => u.status === BloodUnitStatus.TESTING,
        ).length;
        const approvedCount = units.filter(
          (u) => u.status === BloodUnitStatus.APPROVED,
        ).length;
        const rejectedCount = units.filter(
          (u) => u.status === BloodUnitStatus.REJECTED,
        ).length;

        let linkedExpense: ExpenseDocument | null = null;
        if (item.expenseId) {
          linkedExpense = await this.expenseModel.findById(item.expenseId).select('paidAmountPaise paymentStatus status expenseCode').lean().exec() as any;
        }

        const totalAdjustmentsPaise = (item.adjustments || []).reduce(
          (sum: number, adj: any) => sum + (adj.amountPaise || 0),
          0,
        );
        const effectiveNetLiabilityPaise = Math.max(0, (item.totalPayablePaise || 0) - totalAdjustmentsPaise);
        const paidAmountPaise = linkedExpense ? (linkedExpense.paidAmountPaise || 0) : 0;
        const outstandingBalancePaise = Math.max(0, effectiveNetLiabilityPaise - paidAmountPaise);
        const supplierRefundReceivablePaise = Math.max(0, paidAmountPaise - effectiveNetLiabilityPaise);

        return {
          ...item.toObject(),
          unitsSummary: {
            total: units.length,
            testing: testingCount,
            approved: approvedCount,
            rejected: rejectedCount,
          },
          financials: {
            totalPayablePaise: item.totalPayablePaise || 0,
            totalPayable: item.totalPayable || CurrencyUtil.toInr(item.totalPayablePaise || 0),
            totalAdjustmentsPaise,
            totalAdjustments: CurrencyUtil.toInr(totalAdjustmentsPaise),
            effectiveNetLiabilityPaise,
            effectiveNetLiability: CurrencyUtil.toInr(effectiveNetLiabilityPaise),
            paidAmountPaise,
            paidAmount: CurrencyUtil.toInr(paidAmountPaise),
            outstandingBalancePaise,
            outstandingBalance: CurrencyUtil.toInr(outstandingBalancePaise),
            supplierRefundReceivablePaise,
            supplierRefundReceivable: CurrencyUtil.toInr(supplierRefundReceivablePaise),
            paymentStatus: linkedExpense ? linkedExpense.paymentStatus : ExpensePaymentStatus.UNPAID,
            expenseStatus: linkedExpense ? linkedExpense.status : null,
            expenseCode: linkedExpense ? linkedExpense.expenseCode : null,
          },
        };
      }),
    );

    return {
      items: augmentedItems,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single receipt details with traceability and financial summary.
   */
  async findOne(idOrCode: string) {
    let receipt: BloodAcquisitionDocument | null = null;

    if (isValidObjectId(idOrCode)) {
      receipt = await this.bloodAcquisitionModel.findById(idOrCode).exec();
    }
    if (!receipt) {
      receipt = await this.bloodAcquisitionModel
        .findOne({ receiptCode: idOrCode.toUpperCase() })
        .exec();
    }

    if (!receipt) {
      throw new NotFoundException({
        message: `Blood acquisition receipt '${idOrCode}' was not found.`,
        code: 'RECEIPT_NOT_FOUND',
      });
    }

    // Load generated units summary
    const units = await this.bloodUnitModel
      .find({ externalReceiptId: receipt._id })
      .select('unitCode bloodGroup componentType status')
      .lean()
      .exec();

    const testingUnits = units.filter(
      (u) => u.status === BloodUnitStatus.TESTING,
    );
    const approvedUnits = units.filter(
      (u) => u.status === BloodUnitStatus.APPROVED,
    );
    const rejectedUnits = units.filter(
      (u) => u.status === BloodUnitStatus.REJECTED,
    );

    // Check inventory count for approved units
    const unitIds = units.map((u) => u._id);
    const inInventoryCount = await this.inventoryModel
      .countDocuments({
        bloodUnitId: { $in: unitIds },
        status: { $in: [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED] },
      })
      .exec();

    let linkedExpense: ExpenseDocument | null = null;
    if (receipt.expenseId) {
      linkedExpense = await this.expenseModel.findById(receipt.expenseId).exec();
    }

    const totalAdjustmentsPaise = (receipt.adjustments || []).reduce(
      (sum, adj) => sum + (adj.amountPaise || 0),
      0,
    );
    const effectiveNetLiabilityPaise = Math.max(0, (receipt.totalPayablePaise || 0) - totalAdjustmentsPaise);
    const paidAmountPaise = linkedExpense ? (linkedExpense.paidAmountPaise || 0) : 0;
    const outstandingBalancePaise = Math.max(0, effectiveNetLiabilityPaise - paidAmountPaise);
    const supplierRefundReceivablePaise = Math.max(0, paidAmountPaise - effectiveNetLiabilityPaise);

    const financials = {
      totalPayablePaise: receipt.totalPayablePaise || 0,
      totalPayable: receipt.totalPayable || CurrencyUtil.toInr(receipt.totalPayablePaise || 0),
      totalAdjustmentsPaise,
      totalAdjustments: CurrencyUtil.toInr(totalAdjustmentsPaise),
      effectiveNetLiabilityPaise,
      effectiveNetLiability: CurrencyUtil.toInr(effectiveNetLiabilityPaise),
      paidAmountPaise,
      paidAmount: CurrencyUtil.toInr(paidAmountPaise),
      outstandingBalancePaise,
      outstandingBalance: CurrencyUtil.toInr(outstandingBalancePaise),
      supplierRefundReceivablePaise,
      supplierRefundReceivable: CurrencyUtil.toInr(supplierRefundReceivablePaise),
      paymentStatus: linkedExpense ? linkedExpense.paymentStatus : ExpensePaymentStatus.UNPAID,
      expenseStatus: linkedExpense ? linkedExpense.status : null,
      expenseCode: linkedExpense ? linkedExpense.expenseCode : null,
      expenseId: linkedExpense ? linkedExpense._id : null,
    };

    return {
      ...receipt.toObject(),
      stats: {
        totalUnits: units.length,
        testing: testingUnits.length,
        approved: approvedUnits.length,
        rejected: rejectedUnits.length,
        inInventory: inInventoryCount,
      },
      financials,
      expense: linkedExpense ? linkedExpense.toObject() : null,
    };
  }

  /**
   * Records a supplier credit note or refund adjustment against an acquisition receipt.
   */
  async recordAdjustment(
    idOrCode: string,
    dto: RecordAcquisitionAdjustmentDto,
    currentAdmin: any,
  ) {
    let receipt: BloodAcquisitionDocument | null = null;
    if (isValidObjectId(idOrCode)) {
      receipt = await this.bloodAcquisitionModel.findById(idOrCode).exec();
    }
    if (!receipt) {
      receipt = await this.bloodAcquisitionModel
        .findOne({ receiptCode: idOrCode.toUpperCase() })
        .exec();
    }
    if (!receipt) {
      throw new NotFoundException({
        message: `Blood acquisition receipt '${idOrCode}' was not found.`,
        code: 'RECEIPT_NOT_FOUND',
      });
    }

    const amountPaise = CurrencyUtil.toPaise(dto.amount);
    if (amountPaise <= 0) {
      throw new BadRequestException({
        message: 'Adjustment amount must be greater than zero.',
        code: 'INVALID_ADJUSTMENT_AMOUNT',
      });
    }

    const ref = (dto.creditNoteReference || dto.referenceNumber || '').trim();
    if (!ref) {
      throw new BadRequestException({
        message: 'Credit note reference or reference number is required.',
        code: 'REFERENCE_REQUIRED',
      });
    }

    // Check duplicate credit note reference on this acquisition
    const existingRef = (receipt.adjustments || []).find(
      (adj) =>
        (adj.creditNoteReference || adj.referenceNumber || '').trim().toUpperCase() ===
        ref.toUpperCase(),
    );
    if (existingRef) {
      throw new ConflictException({
        message: `Adjustment with reference '${ref}' already exists for this acquisition.`,
        code: 'DUPLICATE_ADJUSTMENT_REFERENCE',
      });
    }

    // Check cumulative adjustments
    const currentCreditNotesPaise = (receipt.adjustments || [])
      .filter((adj) => adj.adjustmentType !== 'SUPPLIER_REFUND')
      .reduce((sum, adj) => sum + (adj.creditAmountPaise || adj.amountPaise || 0), 0);

    const currentRefundsPaise = (receipt.adjustments || [])
      .filter((adj) => adj.adjustmentType === 'SUPPLIER_REFUND')
      .reduce((sum, adj) => sum + (adj.creditAmountPaise || adj.amountPaise || 0), 0);

    let expense: ExpenseDocument | null = null;
    if (receipt.expenseId) {
      expense = await this.expenseModel.findById(receipt.expenseId).exec();
    }

    const originalLiabilityPaise = expense ? (expense.amountPaise || 0) : receipt.totalPayablePaise;
    let effectiveNetLiabilityPaise = Math.max(0, originalLiabilityPaise - currentCreditNotesPaise);

    if (dto.adjustmentType === 'SUPPLIER_REFUND') {
      const paidAmountPaise = expense ? (expense.paidAmountPaise || 0) : 0;
      const grossRefundReceivable = Math.max(0, paidAmountPaise - effectiveNetLiabilityPaise);
      const netRefundDuePaise = Math.max(0, grossRefundReceivable - currentRefundsPaise);

      if (netRefundDuePaise <= 0) {
        throw new BadRequestException({
          message: 'No supplier refund is due for this acquisition. A refund can only be recorded when the paid amount exceeds effective net liability.',
          code: 'NO_REFUND_DUE',
        });
      }

      if (amountPaise > netRefundDuePaise) {
        throw new BadRequestException({
          message: `Supplier refund amount (₹${CurrencyUtil.toInr(amountPaise)}) exceeds outstanding refund receivable of ₹${CurrencyUtil.toInr(netRefundDuePaise)}.`,
          code: 'REFUND_EXCEEDS_RECEIVABLE',
        });
      }
    } else {
      // CREDIT_NOTE or DISPUTE_SETTLEMENT
      const newTotalCreditsPaise = currentCreditNotesPaise + amountPaise;
      if (newTotalCreditsPaise > receipt.totalPayablePaise) {
        throw new BadRequestException({
          message: `Total credit adjustments (₹${CurrencyUtil.toInr(newTotalCreditsPaise)}) cannot exceed total acquisition payable amount (₹${receipt.totalPayable}).`,
          code: 'CREDIT_EXCEEDS_INVOICE_AMOUNT',
        });
      }
      effectiveNetLiabilityPaise = Math.max(0, originalLiabilityPaise - newTotalCreditsPaise);
    }

    const currentAdminId = new Types.ObjectId(currentAdmin.id || currentAdmin._id);
    const currentAdminName = currentAdmin.fullName || 'Admin Staff';
    const currentAdminEmail = currentAdmin.email || '';

    // Create adjustment entry
    const newAdjustment = {
      adjustmentType: dto.adjustmentType,
      referenceNumber: ref,
      creditNoteReference: ref,
      creditAmountPaise: amountPaise,
      amountPaise,
      creditAmount: dto.amount,
      amount: dto.amount,
      reason: dto.reason,
      affectedItemIds: dto.affectedItemIds?.map((id: string) => new Types.ObjectId(id)) || [],
      affectedUnitCodes: dto.affectedUnitCodes || [],
      documentProofKey: dto.supportingDocumentKey,
      supportingDocumentKey: dto.supportingDocumentKey,
      authorizedBy: currentAdminId,
      authorizedByName: currentAdminName,
      approvedByName: currentAdminName,
      authorizedByEmail: currentAdminEmail,
      authorizedAt: new Date(),
      approvedAt: new Date(),
      notes: dto.notes?.trim() || undefined,
    };

    receipt.adjustments.push(newAdjustment as any);
    await receipt.save();

    // If there is a linked expense, update its paymentStatus and append audit history
    if (expense) {
      const paidAmountPaise = expense.paidAmountPaise || 0;
      const outstandingPaise = Math.max(0, effectiveNetLiabilityPaise - paidAmountPaise);

      if (outstandingPaise === 0 && paidAmountPaise > 0) {
        expense.paymentStatus = ExpensePaymentStatus.PAID;
      } else if (paidAmountPaise > 0 && outstandingPaise > 0) {
        expense.paymentStatus = ExpensePaymentStatus.PARTIALLY_PAID;
      } else if (paidAmountPaise === 0) {
        expense.paymentStatus = ExpensePaymentStatus.UNPAID;
      }

      expense.auditHistory.push({
        action: ExpenseAuditEventType.UPDATED,
        fromStatus: expense.status,
        toStatus: expense.status,
        performedBy: currentAdminId,
        performedByEmail: currentAdminEmail,
        performedByName: currentAdminName,
        notes:
          dto.adjustmentType === 'SUPPLIER_REFUND'
            ? `Supplier refund receipt recorded: Ref ${ref}, Amount: ₹${dto.amount}. Net liability remains: ₹${CurrencyUtil.toInr(effectiveNetLiabilityPaise)}.`
            : `Credit adjustment recorded: Ref ${ref}, Amount: ₹${dto.amount}. Net liability: ₹${CurrencyUtil.toInr(effectiveNetLiabilityPaise)}.`,
        timestamp: new Date(),
      } as any);

      await expense.save();
    }

    return this.findOne(receipt._id.toString());
  }

  /**
   * Uploads and attaches invoice/bill document for an acquisition receipt.
   */
  async attachInvoiceDocument(
    idOrCode: string,
    file: Express.Multer.File,
    currentAdmin: any,
  ) {
    let receipt: BloodAcquisitionDocument | null = null;
    if (isValidObjectId(idOrCode)) {
      receipt = await this.bloodAcquisitionModel.findById(idOrCode).exec();
    }
    if (!receipt) {
      receipt = await this.bloodAcquisitionModel
        .findOne({ receiptCode: idOrCode.toUpperCase() })
        .exec();
    }
    if (!receipt) {
      throw new NotFoundException({
        message: `Blood acquisition receipt '${idOrCode}' was not found.`,
        code: 'RECEIPT_NOT_FOUND',
      });
    }

    const fileId = `acq_inv_${receipt.receiptCode}_${Date.now()}`;
    const stored = await this.storageService.saveReceipt(file, fileId);

    receipt.invoiceDocumentKey = stored.fileId;
    receipt.invoiceDocumentUrl = `/api/blood-acquisitions/${receipt._id}/invoice-file`;
    await receipt.save();

    if (receipt.expenseId) {
      const expense = await this.expenseModel.findById(receipt.expenseId).exec();
      if (expense && !expense.receipt) {
        expense.receipt = {
          fileId: stored.fileId,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          uploadedAt: new Date(),
          uploadedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
        };
        await expense.save();
      }
    }

    return receipt;
  }

  /**
   * Uploads and attaches medical clearance certificate document for an acquisition receipt.
   */
  async attachCertificateDocument(
    idOrCode: string,
    file: Express.Multer.File,
    currentAdmin: any,
  ) {
    let receipt: BloodAcquisitionDocument | null = null;
    if (isValidObjectId(idOrCode)) {
      receipt = await this.bloodAcquisitionModel.findById(idOrCode).exec();
    }
    if (!receipt) {
      receipt = await this.bloodAcquisitionModel
        .findOne({ receiptCode: idOrCode.toUpperCase() })
        .exec();
    }
    if (!receipt) {
      throw new NotFoundException({
        message: `Blood acquisition receipt '${idOrCode}' was not found.`,
        code: 'RECEIPT_NOT_FOUND',
      });
    }

    const fileId = `acq_cert_${receipt.receiptCode}_${Date.now()}`;
    const stored = await this.storageService.saveReceipt(file, fileId);

    receipt.clearanceCertificateKey = stored.fileId;
    receipt.clearanceCertificateUrl = `/api/blood-acquisitions/${receipt._id}/certificate-file`;
    receipt.certificateDocumentKey = stored.fileId;
    await receipt.save();

    return receipt;
  }

  /**
   * Streams stored invoice or certificate file.
   */
  async getDocumentStream(
    idOrCode: string,
    type: 'invoice' | 'certificate',
  ) {
    let receipt: BloodAcquisitionDocument | null = null;
    if (isValidObjectId(idOrCode)) {
      receipt = await this.bloodAcquisitionModel.findById(idOrCode).exec();
    }
    if (!receipt) {
      receipt = await this.bloodAcquisitionModel
        .findOne({ receiptCode: idOrCode.toUpperCase() })
        .exec();
    }
    if (!receipt) {
      throw new NotFoundException(`Blood acquisition receipt '${idOrCode}' was not found.`);
    }

    const fileId =
      type === 'invoice'
        ? receipt.invoiceDocumentKey
        : receipt.clearanceCertificateKey || receipt.certificateDocumentKey;
    if (!fileId) {
      throw new NotFoundException(`No ${type} document attached to receipt.`);
    }

    const { stream, exists } = this.storageService.getReceiptStream(fileId);
    if (!exists) {
      throw new NotFoundException(`Document file not found on disk.`);
    }

    return { stream, fileId };
  }

  /**
   * Retrieves all individual Blood Units generated from a specific receipt,
   * including testing record and inventory status for each.
   */
  async findUnitsByReceiptId(idOrCode: string) {
    const receipt = await this.findOne(idOrCode);

    const units = await this.bloodUnitModel
      .find({ externalReceiptId: receipt._id })
      .sort({ createdAt: 1 })
      .exec();

    const unitIds = units.map((u) => u._id);

    const [testingRecords, inventoryRecords] = await Promise.all([
      this.bloodTestingModel
        .find({ bloodUnitId: { $in: unitIds } })
        .lean()
        .exec(),
      this.inventoryModel
        .find({ bloodUnitId: { $in: unitIds } })
        .lean()
        .exec(),
    ]);

    const testingMap = new Map(
      testingRecords.map((t) => [t.bloodUnitId.toString(), t]),
    );
    const inventoryMap = new Map(
      inventoryRecords.map((inv) => [inv.bloodUnitId.toString(), inv]),
    );

    return units.map((unit) => {
      const testing = testingMap.get(unit._id.toString());
      const inventory = inventoryMap.get(unit._id.toString());

      return {
        _id: unit._id,
        unitCode: unit.unitCode,
        bloodGroup: unit.bloodGroup,
        componentType: unit.componentType,
        collectionDate: unit.collectionDate,
        expiryDate: unit.expiryDate,
        volume: unit.volume,
        storageLocation: unit.storageLocation,
        status: unit.status,
        testing: testing
          ? {
              _id: testing._id,
              testingCode: testing.testingCode,
              status: testing.status,
              decision: testing.decision,
            }
          : null,
        inventory: inventory
          ? {
              _id: inventory._id,
              status: inventory.status,
            }
          : null,
      };
    });
  }

  /**
   * Summary KPI metrics for admin stat cards.
   */
  async getSummary(): Promise<AcquisitionSummaryStats> {
    const totalReceipts = await this.bloodAcquisitionModel.countDocuments().exec();

    const externalUnits = await this.bloodUnitModel
      .find({ sourceType: BloodUnitSourceType.EXTERNAL_RECEIPT })
      .select('status')
      .lean()
      .exec();

    const totalUnitsReceived = externalUnits.length;
    const pendingTesting = externalUnits.filter(
      (u) => u.status === BloodUnitStatus.TESTING,
    ).length;

    const unitIds = externalUnits.map((u) => u._id);
    const directToInventory = await this.inventoryModel
      .countDocuments({
        bloodUnitId: { $in: unitIds },
      })
      .exec();

    return {
      totalReceipts,
      totalUnitsReceived,
      directToInventory,
      pendingTesting,
    };
  }
}
