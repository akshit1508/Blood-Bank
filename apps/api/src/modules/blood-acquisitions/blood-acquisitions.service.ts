import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
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
import { InventoryService } from '../inventory/inventory.service';
import { CreateBloodAcquisitionDto } from './dto/create-blood-acquisition.dto';
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
export class BloodAcquisitionsService {
  constructor(
    @InjectModel(BloodAcquisition.name)
    private readonly bloodAcquisitionModel: Model<BloodAcquisitionDocument>,
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel: Model<BloodUnitDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(BloodTesting.name)
    private readonly bloodTestingModel: Model<BloodTestingDocument>,
    private readonly inventoryService: InventoryService,
  ) {}

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

  /**
   * Creates a new external blood receipt event and generates individual traceable Blood Units.
   *
   * Business Rules Enforced:
   * 1. Valid source type & non-empty source name.
   * 2. receivedDate cannot be in the future.
   * 3. At least one blood entry item with quantity >= 1.
   * 4. For each item with quantity N, creates N individual BloodUnit records.
   * 5. If testingRequired = false -> BloodUnit status = APPROVED, directly entered into Inventory as AVAILABLE.
   * 6. If testingRequired = true -> BloodUnit status = TESTING, enters existing Testing workflow.
   * 7. Traceability: sourceType = EXTERNAL_RECEIPT, externalReceiptId = receipt._id.
   *    No fake Donor or Donation records are created.
   * 8. Atomic consistency: clean rollback if any unit fails during creation.
   */
  async create(createDto: CreateBloodAcquisitionDto) {
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

    // 2. Validate items
    if (!createDto.items || createDto.items.length === 0) {
      throw new BadRequestException({
        message: 'At least one blood entry item is required.',
        code: 'EMPTY_ACQUISITION_ITEMS',
      });
    }

    let totalUnits = 0;
    for (const item of createDto.items) {
      if (!item.quantity || item.quantity < 1) {
        throw new BadRequestException({
          message: 'Quantity for each blood entry must be at least 1.',
          code: 'INVALID_ITEM_QUANTITY',
        });
      }
      totalUnits += item.quantity;

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

    // 3. Generate unique receiptCode
    let receiptCode = this.generateReceiptCode();
    let attempts = 0;
    while (await this.bloodAcquisitionModel.exists({ receiptCode })) {
      receiptCode = this.generateReceiptCode();
      attempts++;
      if (attempts > 5) {
        receiptCode = `EXT-${Date.now()}`;
        break;
      }
    }

    // 4. Create receipt document
    const receipt = new this.bloodAcquisitionModel({
      receiptCode,
      sourceType: createDto.sourceType,
      sourceName: createDto.sourceName.trim(),
      referenceNumber: createDto.referenceNumber?.trim() || undefined,
      receivedDate,
      notes: createDto.notes?.trim() || undefined,
      status: BloodAcquisitionStatus.PROCESSING,
      totalUnitsGenerated: totalUnits,
      items: createDto.items.map((it) => ({
        bloodGroup: it.bloodGroup,
        componentType: it.componentType,
        quantity: it.quantity,
        testingRequired: Boolean(it.testingRequired),
        volumePerUnit: it.volumePerUnit,
        expiryDate: it.expiryDate ? new Date(it.expiryDate) : undefined,
        storageLocation: it.storageLocation?.trim() || undefined,
        itemNotes: it.itemNotes?.trim() || undefined,
      })),
    });

    const savedReceipt = await receipt.save();

    // 5. Generate individual Blood Units
    const createdUnits: BloodUnitDocument[] = [];
    const directInventoryUnits: BloodUnitDocument[] = [];
    const testingRequiredUnits: BloodUnitDocument[] = [];

    try {
      for (const item of savedReceipt.items) {
        for (let i = 0; i < item.quantity; i++) {
          let unitCode = this.generateUnitCode();
          let unitAttempts = 0;
          while (await this.bloodUnitModel.exists({ unitCode })) {
            unitCode = this.generateUnitCode();
            unitAttempts++;
            if (unitAttempts > 5) {
              unitCode = `UNIT-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
              break;
            }
          }

          const isTestingRequired = item.testingRequired;
          const unitStatus = isTestingRequired
            ? BloodUnitStatus.TESTING
            : BloodUnitStatus.APPROVED;

          const bloodUnit = new this.bloodUnitModel({
            unitCode,
            sourceType: BloodUnitSourceType.EXTERNAL_RECEIPT,
            externalReceiptId: savedReceipt._id,
            bloodGroup: item.bloodGroup,
            componentType: item.componentType,
            collectionDate: receivedDate,
            expiryDate: item.expiryDate,
            volume: item.volumePerUnit || 450,
            status: unitStatus,
            storageLocation: item.storageLocation,
            notes: item.itemNotes
              ? `Acquired from ${savedReceipt.sourceName} (${savedReceipt.receiptCode}): ${item.itemNotes}`
              : `Acquired from ${savedReceipt.sourceName} (${savedReceipt.receiptCode})`,
          });

          const savedUnit = await bloodUnit.save();
          createdUnits.push(savedUnit);

          if (isTestingRequired) {
            testingRequiredUnits.push(savedUnit);
          } else {
            directInventoryUnits.push(savedUnit);
          }
        }
      }

      // 6. Direct entry into Inventory for non-testing units
      for (const unit of directInventoryUnits) {
        await this.inventoryService.createFromBloodUnit(unit._id.toString());
      }

      // 7. If all units were direct to inventory (no testing needed), mark receipt COMPLETED
      if (testingRequiredUnits.length === 0) {
        savedReceipt.status = BloodAcquisitionStatus.COMPLETED;
        await savedReceipt.save();
      }

      return {
        receipt: savedReceipt,
        totalUnitsCreated: createdUnits.length,
        directInventoryCount: directInventoryUnits.length,
        pendingTestingCount: testingRequiredUnits.length,
        units: createdUnits.map((u) => ({
          _id: u._id,
          unitCode: u.unitCode,
          bloodGroup: u.bloodGroup,
          componentType: u.componentType,
          status: u.status,
          testingRequired: u.status === BloodUnitStatus.TESTING,
        })),
      };
    } catch (err) {
      // Rollback on failure to prevent partial inconsistent state
      for (const unit of createdUnits) {
        await this.inventoryModel.deleteOne({ bloodUnitId: unit._id }).exec();
        await this.bloodUnitModel.deleteOne({ _id: unit._id }).exec();
      }
      await this.bloodAcquisitionModel.deleteOne({ _id: savedReceipt._id }).exec();
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

    // Augment items with live unit breakdown counts
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

        return {
          ...item.toObject(),
          unitsSummary: {
            total: units.length,
            testing: testingCount,
            approved: approvedCount,
            rejected: rejectedCount,
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
   * Retrieves single receipt details with traceability summary.
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

    return {
      ...receipt.toObject(),
      stats: {
        totalUnits: units.length,
        testing: testingUnits.length,
        approved: approvedUnits.length,
        rejected: rejectedUnits.length,
        inInventory: inInventoryCount,
      },
    };
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
