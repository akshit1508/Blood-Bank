import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Inventory, InventoryDocument } from './schemas/inventory.schema';
import {
  InventoryHistory,
  InventoryHistoryDocument,
} from './schemas/inventory-history.schema';
import {
  InventoryStatus,
  EXPIRING_SOON_WINDOW_DAYS,
} from './constants/inventory.constants';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { DiscardInventoryDto } from './dto/discard-inventory.dto';
import { QueryPublicAvailabilityDto } from './dto/query-public-availability.dto';
import {
  BloodUnit,
  BloodUnitDocument,
} from '../blood-units/schemas/blood-unit.schema';
import {
  BloodTesting,
  BloodTestingDocument,
} from '../testing/schemas/blood-testing.schema';
import {
  BloodUnitStatus,
  BloodUnitComponent,
} from '../blood-units/constants/blood-unit.constants';
import {
  TestingStatus,
  TestingDecision,
} from '../testing/constants/testing.constants';
import { BloodGroup } from '../donors/constants/donor.constants';
import {
  BloodAcquisition,
  BloodAcquisitionDocument,
} from '../blood-acquisitions/schemas/blood-acquisition.schema';
import {
  ExternalSourceType,
  BloodUnitSourceType,
} from '../blood-acquisitions/constants/blood-acquisition.constants';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AuditActionType,
  AuditEntityType,
} from '../audit-logs/constants/audit-log.constants';
import { ExpiryRulesService } from './services/expiry-rules.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(InventoryHistory.name)
    private readonly inventoryHistoryModel: Model<InventoryHistoryDocument>,
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel: Model<BloodUnitDocument>,
    @InjectModel(BloodTesting.name)
    private readonly bloodTestingModel: Model<BloodTestingDocument>,
    @InjectModel(BloodAcquisition.name)
    private readonly bloodAcquisitionModel: Model<BloodAcquisitionDocument>,
    @Optional()
    private readonly auditLogsService?: AuditLogsService,
    @Optional()
    private readonly expiryRulesService?: ExpiryRulesService,
  ) {}

  /**
   * Helper to format an Inventory record into an admin-traceable representation.
   * Blood Unit remains the physical unit source of truth.
   * Does NOT expose unnecessary donor personal information (phone, address, etc.) in general listings.
   */
  private formatInventoryItem(
    inventory: any,
    bloodUnit: any,
    testing: any,
    history?: any[],
    acq?: any,
  ) {
    const rawUnit = bloodUnit || {};
    const rawDonation =
      rawUnit.donationId && typeof rawUnit.donationId === 'object'
        ? rawUnit.donationId
        : null;
    const rawDonor =
      rawUnit.donorId && typeof rawUnit.donorId === 'object'
        ? rawUnit.donorId
        : null;

    const now = new Date();
    const expiryDate = rawUnit.expiryDate ? new Date(rawUnit.expiryDate) : null;
    const isExpired =
      inventory.status === InventoryStatus.EXPIRED ||
      (expiryDate !== null && expiryDate < now);

    const expiringSoonThreshold = new Date(
      now.getTime() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const isExpiringSoon =
      inventory.status === InventoryStatus.AVAILABLE &&
      expiryDate !== null &&
      expiryDate >= now &&
      expiryDate <= expiringSoonThreshold;

    const approvedByName =
      testing?.authorizedByName ||
      testing?.verifiedByName ||
      testing?.completedByName ||
      testing?.performedBy ||
      acq?.clearanceAuthorizedByName ||
      acq?.createdByName ||
      inventory?.receivedByName ||
      null;

    const formattedTesting = testing
      ? {
          _id: testing._id,
          testingCode: testing.testingCode,
          decision: testing.decision || 'APPROVED',
          status: testing.status || 'COMPLETED',
          completedAt: testing.completedAt,
          verifiedByName: testing.verifiedByName || null,
          verifiedByRole: testing.verifiedByRole || null,
          completedByName: testing.completedByName || null,
          completedByRole: testing.completedByRole || null,
          performedBy: testing.performedBy || null,
          approvedByName,
        }
      : acq
      ? {
          _id: acq._id,
          testingCode: acq.clearanceCertificateNumber || acq.receiptCode || 'EXTERNAL',
          decision: 'APPROVED',
          status: 'COMPLETED',
          completedAt: acq.clearanceAuthorizationDate || acq.createdAt,
          verifiedByName: acq.clearanceAuthorizedByName || acq.createdByName || null,
          approvedByName,
          isExternalClearance: true,
        }
      : {
          _id: null,
          testingCode: null,
          decision: 'APPROVED',
          status: 'COMPLETED',
          completedAt: inventory.receivedAt || inventory.createdAt,
          verifiedByName: inventory.receivedByName || null,
          approvedByName: approvedByName || inventory.receivedByName || null,
        };

    return {
      _id: inventory._id,
      status: inventory.status,
      discardReason: inventory.discardReason || null,
      discardedAt: inventory.discardedAt || null,
      discardedBy: inventory.discardedBy || null,
      discardedByName: inventory.discardedByName || null,
      discardedByRole: inventory.discardedByRole || null,
      receivedBy: inventory.receivedBy || null,
      receivedByName: inventory.receivedByName || null,
      receivedByRole: inventory.receivedByRole || null,
      receivedAt: inventory.receivedAt || null,
      lastAdjustedBy: inventory.lastAdjustedBy || null,
      lastAdjustedByName: inventory.lastAdjustedByName || null,
      lastAdjustedAt: inventory.lastAdjustedAt || null,
      approvedByName: approvedByName || inventory.receivedByName || null,
      isExpired,
      isExpiringSoon,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
      bloodUnit: {
        _id: rawUnit._id,
        unitCode: rawUnit.unitCode,
        sourceType: rawUnit.sourceType || BloodUnitSourceType.DONATION,
        externalReceiptId: rawUnit.externalReceiptId || null,
        bloodGroup: rawUnit.bloodGroup,
        componentType: rawUnit.componentType,
        collectionDate: rawUnit.collectionDate,
        expiryDate: rawUnit.expiryDate,
        volume: rawUnit.volume,
        storageLocation: rawUnit.storageLocation,
        status: rawUnit.status,
      },
      donation: rawDonation?._id
        ? {
            _id: rawDonation._id,
            donationCode: rawDonation.donationCode,
            donationDate: rawDonation.donationDate,
            donationType: rawDonation.donationType,
            status: rawDonation.status,
          }
        : null,
      donor: rawDonor?._id
        ? {
            _id: rawDonor._id,
            donorCode: rawDonor.donorCode,
            bloodGroup: rawDonor.bloodGroup,
          }
        : null,
      testing: formattedTesting,
      history: history
        ? history.map((h) => ({
            _id: h._id,
            inventoryId: h.inventoryId,
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            reason: h.reason,
            changedBy: h.changedBy || null,
            changedByName: h.changedByName || null,
            changedByRole: h.changedByRole || null,
            changedAt: h.changedAt,
          }))
        : undefined,
    };
  }

  /**
   * Records a status transition into the inventory audit history.
   */
  private async recordHistory(
    inventoryId: Types.ObjectId,
    toStatus: InventoryStatus,
    fromStatus: InventoryStatus | null = null,
    reason?: string,
    actor?: any,
  ) {
    return this.inventoryHistoryModel.create({
      inventoryId,
      fromStatus,
      toStatus,
      reason,
      changedBy: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : undefined,
      changedByName: actor?.fullName || actor?.name || undefined,
      changedByRole: actor?.role || undefined,
    });
  }

  /**
   * Creates an operational Inventory record for an APPROVED physical Blood Unit.
   *
   * Business Rules Enforced (Phase 5A Gate):
   * 1. Valid Blood Unit ID format.
   * 2. Blood Unit must exist in database.
   * 3. 1 Blood Unit -> 1 Inventory record (duplicate creation blocked with INVENTORY_RECORD_ALREADY_EXISTS).
   * 4. Blood Unit status MUST be APPROVED (TESTING, REJECTED, etc. strictly rejected).
   * 5. Testing module MUST confirm laboratory approval (status = COMPLETED, decision = APPROVED).
   * 6. Authoritative physical fields (bloodGroup, componentType, collectionDate, etc.) remain in Blood Unit.
   * 7. Initial inventory status is strictly AVAILABLE.
   */
  async createFromBloodUnit(bloodUnitId: string, actor?: any) {
    if (!isValidObjectId(bloodUnitId)) {
      throw new BadRequestException({
        message: 'Invalid blood unit ID format',
        code: 'INVALID_BLOOD_UNIT_REFERENCE',
      });
    }

    const unitObjectId = new Types.ObjectId(bloodUnitId);

    // 1. Check for duplicate inventory record
    const existingInventory = await this.inventoryModel
      .findOne({ bloodUnitId: unitObjectId })
      .exec();

    if (existingInventory) {
      throw new ConflictException({
        message: 'An inventory record already exists for this physical blood unit.',
        code: 'INVENTORY_RECORD_ALREADY_EXISTS',
      });
    }

    // 2. Fetch authoritative Blood Unit
    const bloodUnit = await this.bloodUnitModel
      .findById(unitObjectId)
      .populate([
        {
          path: 'donationId',
          select: 'donationCode donationDate donationType quantity status notes',
        },
        {
          path: 'donorId',
          select: 'donorCode fullName bloodGroup gender status phone',
        },
      ])
      .exec();

    if (!bloodUnit) {
      throw new NotFoundException({
        message: `Blood unit with ID '${bloodUnitId}' was not found.`,
        code: 'BLOOD_UNIT_NOT_FOUND',
      });
    }

    // 3. Approval Gate: Blood Unit status must be APPROVED
    if (bloodUnit.status !== BloodUnitStatus.APPROVED) {
      throw new BadRequestException({
        message: `Blood unit '${bloodUnit.unitCode}' is in status '${bloodUnit.status}'. Only APPROVED blood units that passed laboratory testing may enter inventory.`,
        code: 'BLOOD_UNIT_NOT_APPROVED_FOR_INVENTORY',
      });
    }

    // 4. Approval Gate: Verify corresponding laboratory testing record or authorized external clearance
    const testingRecord = await this.bloodTestingModel
      .findOne({ bloodUnitId: bloodUnit._id })
      .exec();

    let isAuthorizedExternalDirectIntake = false;
    let receipt: any = null;

    if (bloodUnit.sourceType === BloodUnitSourceType.EXTERNAL_RECEIPT && !testingRecord) {
      if (!bloodUnit.externalReceiptId) {
        throw new BadRequestException({
          message: `Blood unit '${bloodUnit.unitCode}' lacks external receipt reference. Cannot verify clearance.`,
          code: 'EXTERNAL_CLEARANCE_DOCUMENTATION_MISSING',
        });
      }

      receipt = await this.bloodAcquisitionModel.findById(bloodUnit.externalReceiptId).exec();
      if (!receipt) {
        throw new BadRequestException({
          message: `Blood unit '${bloodUnit.unitCode}' referenced receipt was not found. Cannot verify clearance.`,
          code: 'EXTERNAL_CLEARANCE_DOCUMENTATION_MISSING',
        });
      }

      // Strict 4-point Medical Clearance Verification Gate:
      // 1. Regulated source
      const isRegulatedSource = [
        ExternalSourceType.GOVERNMENT_BLOOD_CENTRE,
        ExternalSourceType.BLOOD_BANK,
        ExternalSourceType.HOSPITAL,
      ].includes(receipt.sourceType);

      // 2. Documented certificate number
      const hasCertificateNumber = Boolean(
        receipt.clearanceCertificateNumber && receipt.clearanceCertificateNumber.trim().length > 0,
      );

      // 3. Affirmative source testing attestation
      const hasTestingAttestation = Boolean(receipt.sourceTestingCertified === true);

      // 4. Authorized medical staff sign-off
      const hasMedicalOfficerSignOff = Boolean(
        receipt.clearanceAuthorizedByStaffId && receipt.clearanceAuthorizationDate,
      );

      if (
        !isRegulatedSource ||
        !hasCertificateNumber ||
        !hasTestingAttestation ||
        !hasMedicalOfficerSignOff
      ) {
        throw new BadRequestException({
          message: `Direct inventory intake for external blood unit '${bloodUnit.unitCode}' rejected. Incomplete medical clearance documentation (requires regulated source, certificate number, source testing attestation, and authorized medical officer sign-off). Unit must enter in-house laboratory testing or quarantine.`,
          code: 'EXTERNAL_CLEARANCE_DOCUMENTATION_MISSING',
        });
      }

      isAuthorizedExternalDirectIntake = true;
    }

    if (!isAuthorizedExternalDirectIntake) {
      if (
        !testingRecord ||
        testingRecord.status !== TestingStatus.COMPLETED ||
        testingRecord.decision !== TestingDecision.APPROVED
      ) {
        throw new BadRequestException({
          message: `Blood unit '${bloodUnit.unitCode}' does not have a confirmed laboratory approval record.`,
          code: 'BLOOD_UNIT_NOT_APPROVED_FOR_INVENTORY',
        });
      }
    }

    // 5. Create Inventory Record
    const inventory = await this.inventoryModel.create({
      bloodUnitId: bloodUnit._id,
      status: InventoryStatus.AVAILABLE,
      receivedBy: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : undefined,
      receivedByName: actor?.fullName || actor?.name || undefined,
      receivedByRole: actor?.role || undefined,
      receivedAt: new Date(),
    });

    // 6. Record Initial History Entry
    const initialReason = isAuthorizedExternalDirectIntake
      ? 'Initial operational inventory entry from medically certified external blood acquisition'
      : 'Initial operational inventory entry from laboratory-approved blood unit';

    await this.recordHistory(
      inventory._id,
      InventoryStatus.AVAILABLE,
      null,
      initialReason,
      actor,
    );

    await this.auditLogsService?.logEvent({
      actorId: actor?._id || actor?.id,
      actorName: actor?.fullName || actor?.name,
      actorEmail: actor?.email,
      actorRole: actor?.role,
      action: AuditActionType.INVENTORY_INTAKE_COMPLETED,
      entityType: AuditEntityType.INVENTORY,
      entityId: inventory._id.toString(),
      entityIdentifier: bloodUnit.unitCode,
      description: `Blood unit ${bloodUnit.unitCode} added to available inventory`,
      afterState: {
        status: inventory.status,
        bloodUnitId: bloodUnit._id.toString(),
        unitCode: bloodUnit.unitCode,
        bloodGroup: bloodUnit.bloodGroup,
        componentType: bloodUnit.componentType,
      },
    });

    return this.formatInventoryItem(inventory, bloodUnit, testingRecord, undefined, receipt);
  }

  /**
   * Retrieves paginated list of inventory items with optional filters.
   * Expiry-aware: accounts for expiring soon, expired, and discarded states.
   */
  async findAll(query: QueryInventoryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 10));
    const skip = (page - 1) * limit;
    const now = new Date();

    const inventoryFilter: any = {};

    // Physical unit search / bloodGroup / componentType criteria
    const unitCriteria: any = {};
    if (query.bloodGroup) {
      unitCriteria.bloodGroup = query.bloodGroup;
    }
    if (query.componentType) {
      unitCriteria.componentType = query.componentType;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      const regex = new RegExp(term, 'i');
      unitCriteria.$or = [
        { unitCode: regex },
        { storageLocation: regex },
      ];
    }

    if (query.expiringSoon) {
      // Must be AVAILABLE and expiring within 7 days
      inventoryFilter.status = InventoryStatus.AVAILABLE;
      const sevenDaysLater = new Date(
        now.getTime() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );
      unitCriteria.expiryDate = { $gte: now, $lte: sevenDaysLater };
    } else if (query.status === InventoryStatus.AVAILABLE) {
      // Must be AVAILABLE and not past expiry date
      inventoryFilter.status = InventoryStatus.AVAILABLE;
      unitCriteria.$or = [
        { expiryDate: { $gte: now } },
        { expiryDate: null },
        { expiryDate: { $exists: false } },
      ];
    } else if (query.status === InventoryStatus.EXPIRED) {
      // Unit is marked EXPIRED, or marked AVAILABLE but physical expiryDate < now
      const expiredUnits = await this.bloodUnitModel
        .find({ ...unitCriteria, expiryDate: { $lt: now } })
        .select('_id')
        .lean()
        .exec();
      const expiredUnitIds = expiredUnits.map((u) => u._id);

      if (Object.keys(unitCriteria).length > 0) {
        const allMatchingUnits = await this.bloodUnitModel
          .find(unitCriteria)
          .select('_id')
          .lean()
          .exec();
        const allMatchingIds = allMatchingUnits.map((u) => u._id);

        inventoryFilter.$or = [
          { status: InventoryStatus.EXPIRED, bloodUnitId: { $in: allMatchingIds } },
          { status: InventoryStatus.AVAILABLE, bloodUnitId: { $in: expiredUnitIds } },
        ];
      } else {
        inventoryFilter.$or = [
          { status: InventoryStatus.EXPIRED },
          { status: InventoryStatus.AVAILABLE, bloodUnitId: { $in: expiredUnitIds } },
        ];
      }
    } else if (query.status) {
      inventoryFilter.status = query.status;
    }

    // Apply unit criteria to inventory filter if not already handled by EXPIRED branch
    if (query.status !== InventoryStatus.EXPIRED && Object.keys(unitCriteria).length > 0) {
      const matchingUnits = await this.bloodUnitModel
        .find(unitCriteria)
        .select('_id')
        .lean()
        .exec();
      const unitIds = matchingUnits.map((u) => u._id);
      inventoryFilter.bloodUnitId = { $in: unitIds };
    }

    const total = await this.inventoryModel.countDocuments(inventoryFilter).exec();

    const items = await this.inventoryModel
      .find(inventoryFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'bloodUnitId',
        populate: [
          {
            path: 'donationId',
            select: 'donationCode donationDate donationType quantity status notes',
          },
          {
            path: 'donorId',
            select: 'donorCode fullName bloodGroup gender status phone',
          },
        ],
      })
      .exec();

    // Batch-query associated Testing records
    const unitObjectIds = items
      .map((item) => {
        const u = item.bloodUnitId as any;
        return u?._id || item.bloodUnitId;
      })
      .filter(Boolean);

    const testingRecords = await this.bloodTestingModel
      .find({ bloodUnitId: { $in: unitObjectIds } })
      .select('testingCode decision status completedAt bloodUnitId verifiedByName verifiedByRole completedByName completedByRole performedBy')
      .lean()
      .exec();

    const testingMap = new Map<string, any>();
    for (const t of testingRecords) {
      testingMap.set(String(t.bloodUnitId), t);
    }

    const acqObjectIds = items
      .map((item) => {
        const u = item.bloodUnitId as any;
        return u?.externalReceiptId;
      })
      .filter(Boolean);

    const acqRecords =
      acqObjectIds.length > 0
        ? await this.bloodAcquisitionModel
            .find({ _id: { $in: acqObjectIds } })
            .select(
              'receiptCode clearanceCertificateNumber clearanceAuthorizedByName clearanceAuthorizationDate createdByName createdAt',
            )
            .lean()
            .exec()
        : [];

    const acqMap = new Map<string, any>();
    for (const a of acqRecords) {
      acqMap.set(String(a._id), a);
    }

    const formattedItems = items.map((inv) => {
      const u = inv.bloodUnitId as any;
      const t = u?._id ? testingMap.get(String(u._id)) : null;
      const a = u?.externalReceiptId ? acqMap.get(String(u.externalReceiptId)) : null;
      return this.formatInventoryItem(inv, u, t, undefined, a);
    });

    return {
      items: formattedItems,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single inventory record by its MongoDB ID, including lifecycle history.
   */
  async findOne(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException({
        message: 'Invalid inventory ID format',
        code: 'INVALID_INVENTORY_REFERENCE',
      });
    }

    const inventory = await this.inventoryModel
      .findById(id)
      .populate({
        path: 'bloodUnitId',
        populate: [
          {
            path: 'donationId',
            select: 'donationCode donationDate donationType quantity status notes',
          },
          {
            path: 'donorId',
            select: 'donorCode fullName bloodGroup gender status phone',
          },
        ],
      })
      .exec();

    if (!inventory) {
      throw new NotFoundException({
        message: `Inventory record with ID '${id}' was not found.`,
        code: 'INVENTORY_RECORD_NOT_FOUND',
      });
    }

    const rawUnit = inventory.bloodUnitId as any;
    const testing = rawUnit?._id
      ? await this.bloodTestingModel
          .findOne({ bloodUnitId: rawUnit._id })
          .select('testingCode decision status completedAt bloodUnitId verifiedByName verifiedByRole completedByName completedByRole performedBy')
          .lean()
          .exec()
      : null;

    const acq = rawUnit?.externalReceiptId
      ? await this.bloodAcquisitionModel
          .findById(rawUnit.externalReceiptId)
          .select('receiptCode clearanceCertificateNumber clearanceAuthorizedByName clearanceAuthorizationDate createdByName createdAt')
          .lean()
          .exec()
      : null;

    const history = await this.getHistory(id);

    return this.formatInventoryItem(inventory, rawUnit, testing, history, acq);
  }

  /**
   * Retrieves the inventory record associated with a specific Blood Unit, including lifecycle history.
   */
  async findByBloodUnitId(bloodUnitId: string) {
    if (!isValidObjectId(bloodUnitId)) {
      throw new BadRequestException({
        message: 'Invalid blood unit ID format',
        code: 'INVALID_BLOOD_UNIT_REFERENCE',
      });
    }

    const unitObjectId = new Types.ObjectId(bloodUnitId);

    const inventory = await this.inventoryModel
      .findOne({ bloodUnitId: unitObjectId })
      .populate({
        path: 'bloodUnitId',
        populate: [
          {
            path: 'donationId',
            select: 'donationCode donationDate donationType quantity status notes',
          },
          {
            path: 'donorId',
            select: 'donorCode fullName bloodGroup gender status phone',
          },
        ],
      })
      .exec();

    if (!inventory) {
      throw new NotFoundException({
        message: `No inventory record found for blood unit '${bloodUnitId}'.`,
        code: 'INVENTORY_RECORD_NOT_FOUND',
      });
    }

    const rawUnit = inventory.bloodUnitId as any;
    const testing = rawUnit?._id
      ? await this.bloodTestingModel
          .findOne({ bloodUnitId: rawUnit._id })
          .select('testingCode decision status completedAt bloodUnitId verifiedByName verifiedByRole completedByName completedByRole performedBy')
          .lean()
          .exec()
      : null;

    const acq = rawUnit?.externalReceiptId
      ? await this.bloodAcquisitionModel
          .findById(rawUnit.externalReceiptId)
          .select('receiptCode clearanceCertificateNumber clearanceAuthorizedByName clearanceAuthorizationDate createdByName createdAt')
          .lean()
          .exec()
      : null;

    const history = await this.getHistory(String(inventory._id));

    return this.formatInventoryItem(inventory, rawUnit, testing, history, acq);
  }

  /**
   * Discards an inventory item with a mandatory reason.
   *
   * Business Rules:
   * 1. Requires valid non-empty discard reason.
   * 2. Only AVAILABLE or EXPIRED items can be discarded.
   * 3. Cannot discard an item that is already DISCARDED.
   * 4. Atomic status transition to DISCARDED with discardReason and discardedAt.
   * 5. Physical Blood Unit status remains unaffected (distinct lifecycles).
   * 6. Transition is recorded in InventoryHistory.
   */
  async discardItem(id: string, dto: DiscardInventoryDto, actor?: any) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException({
        message: 'Invalid inventory ID format',
        code: 'INVALID_INVENTORY_REFERENCE',
      });
    }

    const reason = dto?.reason?.trim();
    if (!reason) {
      throw new BadRequestException({
        message: 'A non-empty discard reason is required to discard an inventory item.',
        code: 'DISCARD_REASON_REQUIRED',
      });
    }

    const existing = await this.inventoryModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException({
        message: `Inventory record with ID '${id}' was not found.`,
        code: 'INVENTORY_RECORD_NOT_FOUND',
      });
    }

    if (existing.status === InventoryStatus.DISCARDED) {
      throw new BadRequestException({
        message: 'This inventory item has already been discarded.',
        code: 'INVENTORY_ALREADY_DISCARDED',
      });
    }

    const previousStatus = existing.status;

    // Atomic update
    const updated = await this.inventoryModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          status: { $in: [InventoryStatus.AVAILABLE, InventoryStatus.EXPIRED] },
        },
        {
          $set: {
            status: InventoryStatus.DISCARDED,
            discardReason: reason,
            discardedAt: new Date(),
            discardedBy: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : undefined,
            discardedByName: actor?.fullName || actor?.name || undefined,
            discardedByRole: actor?.role || undefined,
          },
        },
        { new: true },
      )
      .populate({
        path: 'bloodUnitId',
        populate: [
          {
            path: 'donationId',
            select: 'donationCode donationDate donationType quantity status notes',
          },
          {
            path: 'donorId',
            select: 'donorCode fullName bloodGroup gender status phone',
          },
        ],
      })
      .exec();

    if (!updated) {
      throw new BadRequestException({
        message: 'Failed to discard item. The record may have already been discarded concurrently.',
        code: 'INVENTORY_ALREADY_DISCARDED',
      });
    }

    // Record lifecycle transition
    await this.recordHistory(
      updated._id,
      InventoryStatus.DISCARDED,
      previousStatus,
      reason,
      actor,
    );

    const rawUnit = updated.bloodUnitId as any;

    await this.auditLogsService?.logEvent({
      actorId: actor?._id || actor?.id,
      actorName: actor?.fullName || actor?.name,
      actorEmail: actor?.email,
      actorRole: actor?.role,
      action: AuditActionType.INVENTORY_DISCARDED,
      entityType: AuditEntityType.INVENTORY,
      entityId: updated._id.toString(),
      entityIdentifier: rawUnit?.unitCode || id,
      description: `Inventory unit discarded: ${reason}`,
      beforeState: { status: previousStatus },
      afterState: {
        status: InventoryStatus.DISCARDED,
        discardReason: reason,
      },
      metadata: { reason },
    });

    const testing = rawUnit?._id
      ? await this.bloodTestingModel
          .findOne({ bloodUnitId: rawUnit._id })
          .select('testingCode decision status completedAt bloodUnitId verifiedByName verifiedByRole completedByName completedByRole performedBy')
          .lean()
          .exec()
      : null;

    const acq = rawUnit?.externalReceiptId
      ? await this.bloodAcquisitionModel
          .findById(rawUnit.externalReceiptId)
          .select('receiptCode clearanceCertificateNumber clearanceAuthorizedByName clearanceAuthorizationDate createdByName createdAt')
          .lean()
          .exec()
      : null;

    const history = await this.getHistory(id);

    return this.formatInventoryItem(updated, rawUnit, testing, history, acq);
  }

  /**
   * Evaluates all AVAILABLE inventory units against physical BloodUnit.expiryDate.
   * If expiryDate has passed (expiryDate < now), transitions the unit to EXPIRED.
   *
   * Business Rules:
   * 1. BloodUnit.expiryDate is the authoritative source of truth.
   * 2. Units with no expiryDate cannot be automatically expired.
   * 3. Transitions AVAILABLE -> EXPIRED and records history.
   * 4. Physical BloodUnit.status is NOT altered.
   */
  async evaluateExpiry() {
    const now = new Date();

    const availableItems = await this.inventoryModel
      .find({ status: InventoryStatus.AVAILABLE })
      .populate({
        path: 'bloodUnitId',
        select: 'expiryDate unitCode',
      })
      .exec();

    let expiredCount = 0;

    for (const item of availableItems) {
      const unit = item.bloodUnitId as any;
      if (unit && unit.expiryDate && new Date(unit.expiryDate) < now) {
        const updated = await this.inventoryModel.findOneAndUpdate(
          { _id: item._id, status: InventoryStatus.AVAILABLE },
          { $set: { status: InventoryStatus.EXPIRED } },
          { new: true },
        );

        if (updated) {
          expiredCount++;
          await this.recordHistory(
            item._id,
            InventoryStatus.EXPIRED,
            InventoryStatus.AVAILABLE,
            `Automatic expiry evaluation: Physical blood unit '${unit.unitCode}' passed expiration date (${new Date(unit.expiryDate).toISOString()})`,
          );
        }
      }
    }

    return {
      evaluatedCount: availableItems.length,
      expiredCount,
    };
  }

  /**
   * Retrieves the audit lifecycle history for an inventory record.
   */
  async getHistory(inventoryId: string) {
    if (!isValidObjectId(inventoryId)) {
      throw new BadRequestException({
        message: 'Invalid inventory ID format',
        code: 'INVALID_INVENTORY_REFERENCE',
      });
    }

    return this.inventoryHistoryModel
      .find({ inventoryId: new Types.ObjectId(inventoryId) })
      .sort({ changedAt: -1 })
      .lean()
      .exec();
  }

  /**
   * Aggregates real operational inventory summary data with expiry awareness.
   * Returns:
   * - Total Available Units (excluding expired and discarded)
   * - Expiring Soon Units (within next 7 days)
   * - Expired Units (EXPIRED status or physically past expiryDate)
   * - Discarded Units (DISCARDED status)
   * - Counts broken down by all 8 standard blood groups (A+, A-, B+, B-, AB+, AB-, O+, O-) for valid available units
   * - Counts broken down by component type for valid available units
   */
  async getSummary() {
    const now = new Date();
    const sevenDaysLater = new Date(
      now.getTime() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const allInventory = await this.inventoryModel
      .find()
      .populate({
        path: 'bloodUnitId',
        select: 'bloodGroup componentType expiryDate',
      })
      .lean()
      .exec();

    let totalAvailable = 0;
    let expiringSoon = 0;
    let expired = 0;
    let discarded = 0;

    // Initialize all 8 blood groups with 0
    const byBloodGroup: Record<string, number> = {
      [BloodGroup.A_POSITIVE]: 0,
      [BloodGroup.A_NEGATIVE]: 0,
      [BloodGroup.B_POSITIVE]: 0,
      [BloodGroup.B_NEGATIVE]: 0,
      [BloodGroup.AB_POSITIVE]: 0,
      [BloodGroup.AB_NEGATIVE]: 0,
      [BloodGroup.O_POSITIVE]: 0,
      [BloodGroup.O_NEGATIVE]: 0,
    };

    const byComponentType: Record<string, number> = {};

    for (const item of allInventory) {
      const unit = item.bloodUnitId as any;
      const expiryDate = unit?.expiryDate ? new Date(unit.expiryDate) : null;

      if (item.status === InventoryStatus.DISCARDED) {
        discarded++;
        continue;
      }

      const isPhysicallyExpired = expiryDate !== null && expiryDate < now;
      if (item.status === InventoryStatus.EXPIRED || isPhysicallyExpired) {
        expired++;
        continue;
      }

      if (item.status === InventoryStatus.AVAILABLE) {
        totalAvailable++;

        if (expiryDate !== null && expiryDate >= now && expiryDate <= sevenDaysLater) {
          expiringSoon++;
        }

        if (unit?.bloodGroup && byBloodGroup[unit.bloodGroup] !== undefined) {
          byBloodGroup[unit.bloodGroup]++;
        }
        if (unit?.componentType) {
          byComponentType[unit.componentType] =
            (byComponentType[unit.componentType] || 0) + 1;
        }
      }
    }

    return {
      totalAvailable,
      expiringSoon,
      expired,
      discarded,
      byBloodGroup,
      byComponentType,
    };
  }

  /**
   * Aggregates sanitized public blood availability.
   *
   * Privacy & Security Boundaries (Phase 5C):
   * 1. ONLY valid AVAILABLE units are counted.
   * 2. EXPIRED, DISCARDED, TESTING, and REJECTED units are strictly excluded.
   * 3. Units with past expiryDate (expiryDate < now) are excluded even if stored status is AVAILABLE.
   * 4. Results are aggregated by bloodGroup and componentType.
   * 5. Zero availability is clearly represented across all 8 standard blood groups.
   * 6. Absolutely NO donor, donation, testing, storage, patient, or internal ID fields are exposed.
   */
  async getPublicAvailability(query?: QueryPublicAvailabilityDto) {
    const now = new Date();

    const ALL_BLOOD_GROUPS = [
      BloodGroup.A_POSITIVE,
      BloodGroup.A_NEGATIVE,
      BloodGroup.B_POSITIVE,
      BloodGroup.B_NEGATIVE,
      BloodGroup.AB_POSITIVE,
      BloodGroup.AB_NEGATIVE,
      BloodGroup.O_POSITIVE,
      BloodGroup.O_NEGATIVE,
    ];

    const ALL_COMPONENTS = [
      BloodUnitComponent.WHOLE_BLOOD,
      BloodUnitComponent.PRBC,
      BloodUnitComponent.FFP,
      BloodUnitComponent.PLATELETS,
    ];

    // Initialize counts matrix: counts[bloodGroup][componentType] = 0
    const counts: Record<string, Record<string, number>> = {};
    for (const bg of ALL_BLOOD_GROUPS) {
      counts[bg] = {};
      for (const comp of ALL_COMPONENTS) {
        counts[bg][comp] = 0;
      }
    }

    // Query exclusively AVAILABLE inventory records
    const availableItems = await this.inventoryModel
      .find({ status: InventoryStatus.AVAILABLE })
      .populate({
        path: 'bloodUnitId',
        select: 'bloodGroup componentType expiryDate status',
      })
      .lean()
      .exec();

    let totalAvailableUnits = 0;

    for (const item of availableItems) {
      const unit = item.bloodUnitId as any;

      // Gate 1: Physical unit must exist and be APPROVED
      if (!unit || unit.status !== BloodUnitStatus.APPROVED) {
        continue;
      }

      // Gate 2: Exclude un-evaluated expired units
      if (unit.expiryDate && new Date(unit.expiryDate) < now) {
        continue;
      }

      const bg = unit.bloodGroup;
      const comp = unit.componentType;

      if (counts[bg] && counts[bg][comp] !== undefined) {
        counts[bg][comp]++;
        totalAvailableUnits++;
      }
    }

    // Filter blood groups if query parameter provided
    const targetBloodGroups = query?.bloodGroup
      ? ALL_BLOOD_GROUPS.filter((bg) => bg === query.bloodGroup)
      : ALL_BLOOD_GROUPS;

    // Filter components if query parameter provided
    const targetComponents = query?.componentType
      ? ALL_COMPONENTS.filter((comp) => comp === query.componentType)
      : ALL_COMPONENTS;

    const groups = targetBloodGroups.map((bg) => {
      let groupTotal = 0;
      const components = targetComponents.map((comp) => {
        const availableUnits = counts[bg]?.[comp] || 0;
        groupTotal += availableUnits;
        return {
          componentType: comp,
          availableUnits,
          availability: (availableUnits > 0 ? 'AVAILABLE' : 'NOT_AVAILABLE') as
            | 'AVAILABLE'
            | 'NOT_AVAILABLE',
        };
      });

      return {
        bloodGroup: bg,
        totalUnits: groupTotal,
        availability: (groupTotal > 0 ? 'AVAILABLE' : 'NOT_AVAILABLE') as
          | 'AVAILABLE'
          | 'NOT_AVAILABLE',
        components,
      };
    });

    // Flattened items list for consumers preferring flat list
    const items: Array<{
      bloodGroup: string;
      componentType: string;
      availableUnits: number;
      availability: 'AVAILABLE' | 'NOT_AVAILABLE';
    }> = [];

    for (const g of groups) {
      for (const c of g.components) {
        items.push({
          bloodGroup: g.bloodGroup,
          componentType: c.componentType,
          availableUnits: c.availableUnits,
          availability: c.availability,
        });
      }
    }

    return {
      lastUpdated: now.toISOString(),
      totalAvailableUnits,
      groups,
      items,
    };
  }

  /**
   * Finds currently AVAILABLE and APPROVED inventory units matching the specified
   * blood group and component type for request fulfillment evaluation (Phase 6A).
   *
   * Rules:
   * 1. Exact bloodGroup match.
   * 2. Exact componentType match.
   * 3. Inventory status === AVAILABLE.
   * 4. BloodUnit status === APPROVED.
   * 5. BloodUnit not expired (expiryDate >= now).
   * 6. Sorted by expiryDate ascending (FEFO - first expiry first out).
   * 7. Sanitized: strictly no donor personal data or testing lab details.
   */
  async findMatches(bloodGroup: string, componentType: string) {
    const now = new Date();

    const availableItems = await this.inventoryModel
      .find({ status: InventoryStatus.AVAILABLE })
      .populate({
        path: 'bloodUnitId',
        select:
          'unitCode bloodGroup componentType expiryDate collectionDate storageLocation status createdAt',
      })
      .lean()
      .exec();

    const matchingUnits: Array<{
      inventoryId: string;
      bloodUnitId: string;
      unitCode: string;
      bloodGroup: string;
      componentType: string;
      collectionDate?: string | null;
      expiryDate: string | null;
      storageLocation: string;
      status: string;
    }> = [];

    for (const item of availableItems) {
      const unit = item.bloodUnitId as any;
      if (!unit) continue;

      // Gate 1: Physical unit must be APPROVED
      if (unit.status !== BloodUnitStatus.APPROVED) continue;

      // Calculate effective expiry date if not already present
      let effectiveExpiryDate: Date | null = unit.expiryDate
        ? new Date(unit.expiryDate)
        : null;

      if (!effectiveExpiryDate || isNaN(effectiveExpiryDate.getTime())) {
        let baseDate: Date | null = unit.collectionDate
          ? new Date(unit.collectionDate)
          : null;
        if (!baseDate || isNaN(baseDate.getTime())) {
          if (unit.createdAt) {
            baseDate = new Date(unit.createdAt);
          } else if (
            unit.unitCode &&
            /UNIT-(\d{4})(\d{2})(\d{2})-/i.test(unit.unitCode)
          ) {
            const m = unit.unitCode.match(/UNIT-(\d{4})(\d{2})(\d{2})-/i);
            if (m) {
              baseDate = new Date(`${m[1]}-${m[2]}-${m[3]}`);
            }
          }
        }
        if (!baseDate || isNaN(baseDate.getTime())) {
          baseDate = (item as any).createdAt
            ? new Date((item as any).createdAt)
            : new Date();
        }

        if (this.expiryRulesService) {
          effectiveExpiryDate =
            await this.expiryRulesService.calculateExpiryDate(
              baseDate,
              unit.componentType as any,
            );
        } else {
          const compDays =
            unit.componentType === 'PLATELETS'
              ? 5
              : unit.componentType === 'FFP'
                ? 365
                : unit.componentType === 'PRBC'
                  ? 42
                  : 35;
          effectiveExpiryDate = new Date(
            baseDate.getTime() + compDays * 24 * 60 * 60 * 1000,
          );
        }

        // Auto-heal legacy blood unit record asynchronously so future queries have it saved
        this.bloodUnitModel
          .updateOne(
            { _id: unit._id },
            { $set: { expiryDate: effectiveExpiryDate } },
          )
          .exec()
          .catch(() => {});
      }

      // Gate 2: Exclude expired units
      if (effectiveExpiryDate && effectiveExpiryDate < now) continue;

      // Gate 3: Exact blood group match
      if (unit.bloodGroup !== bloodGroup) continue;

      // Gate 4: Exact component type match
      if (unit.componentType !== componentType) continue;

      matchingUnits.push({
        inventoryId: (item._id as any).toString(),
        bloodUnitId: (unit._id as any).toString(),
        unitCode: unit.unitCode,
        bloodGroup: unit.bloodGroup,
        componentType: unit.componentType,
        collectionDate: unit.collectionDate
          ? new Date(unit.collectionDate).toISOString()
          : null,
        expiryDate: effectiveExpiryDate
          ? effectiveExpiryDate.toISOString()
          : null,
        storageLocation: unit.storageLocation || 'N/A',
        status: item.status,
      });
    }

    // Sort by expiryDate ascending (nulls last)
    matchingUnits.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

    return matchingUnits;
  }
}

