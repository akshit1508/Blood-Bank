import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import { BloodUnit, BloodUnitDocument } from './schemas/blood-unit.schema';
import { Donation, DonationDocument } from '../donations/schemas/donation.schema';
import { Donor, DonorDocument } from '../donors/schemas/donor.schema';
import { CreateBloodUnitDto } from './dto/create-blood-unit.dto';
import { QueryBloodUnitsDto } from './dto/query-blood-units.dto';
import { PrepareComponentsDto } from './dto/prepare-components.dto';
import {
  BloodUnitComponent,
  BloodUnitStatus,
} from './constants/blood-unit.constants';
import { DonationStatus } from '../donations/constants/donation.constants';
import { AdminRole } from '../auth/schemas/admin-user.schema';
import { ExpiryRulesService } from '../inventory/services/expiry-rules.service';
import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import { InventoryStatus } from '../inventory/constants/inventory.constants';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditActionType, AuditEntityType } from '../audit-logs/constants/audit-log.constants';

export interface PaginatedBloodUnits {
  items: BloodUnit[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class BloodUnitsService {
  constructor(
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel: Model<BloodUnitDocument>,
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Donor.name)
    private readonly donorModel: Model<DonorDocument>,
    @Optional()
    @InjectModel(Inventory.name)
    private readonly inventoryModel?: Model<InventoryDocument>,
    @Optional()
    private readonly auditLogsService?: AuditLogsService,
    @Optional()
    private readonly expiryRulesService?: ExpiryRulesService,
  ) {}

  /**
   * Generates a unique server-side blood unit code.
   * Format: UNIT-YYYYMMDD-XXXX (e.g. UNIT-20261008-A81F)
   */
  private generateUnitCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `UNIT-${datePart}-${randomPart}`;
  }

  /**
   * Creates an individual physical Blood Unit from a valid COMPLETED donation.
   *
   * Business Rules Enforced:
   * 1. Donation must exist.
   * 2. Donation status MUST be COMPLETED.
   * 3. 1 Donation -> 1 Blood Unit (duplicate creation is prevented).
   * 4. Donor relationship and blood group are authoritatively derived.
   * 5. Initial status is strictly TESTING.
   * 6. Unit code is generated server-side.
   */
  async create(createDto: CreateBloodUnitDto, actor?: any): Promise<BloodUnit> {
    if (!isValidObjectId(createDto.donationId)) {
      throw new BadRequestException({
        message: 'Invalid donation ID format',
        code: 'INVALID_DONATION_REFERENCE',
      });
    }

    // 1. Verify donation existence
    const donation = await this.donationModel
      .findById(createDto.donationId)
      .exec();

    if (!donation) {
      throw new NotFoundException({
        message: `Donation with ID '${createDto.donationId}' was not found.`,
        code: 'DONATION_NOT_FOUND',
      });
    }

    // 2. Verify donation is in COMPLETED status
    if (donation.status !== DonationStatus.COMPLETED) {
      throw new BadRequestException({
        message: `Cannot create a blood unit from a donation in status '${donation.status}'. Only COMPLETED donations can produce a blood unit.`,
        code: 'DONATION_NOT_COMPLETED',
      });
    }

    // 3. Pre-check for duplicate Blood Unit for this donation
    const existingUnit = await this.bloodUnitModel
      .findOne({ donationId: donation._id })
      .exec();

    if (existingUnit) {
      throw new ConflictException({
        message: `A blood unit (${existingUnit.unitCode}) has already been created for donation '${donation.donationCode}'.`,
        code: 'BLOOD_UNIT_ALREADY_EXISTS',
      });
    }

    // 4. Authoritatively retrieve donor
    const donor = await this.donorModel.findById(donation.donorId).exec();
    if (!donor) {
      throw new NotFoundException({
        message: `Associated donor was not found for donation '${donation.donationCode}'.`,
        code: 'DONOR_NOT_FOUND',
      });
    }

    // 5. Derive collection date and validate not in future
    const collectionDate = new Date(donation.donationDate);
    const now = new Date();
    if (collectionDate.getTime() > now.getTime() + 120 * 1000) {
      throw new BadRequestException({
        message: 'Collection date cannot be in the future.',
        code: 'INVALID_COLLECTION_DATE',
      });
    }

    // 6. Resolve component type (defaults to WHOLE_BLOOD)
    const resolvedComponent =
      createDto.componentType || BloodUnitComponent.WHOLE_BLOOD;

    // 7. Resolve expiry date (use provided or auto-calculate based on shelf-life rule)
    let parsedExpiryDate: Date | undefined;
    if (createDto.expiryDate) {
      parsedExpiryDate = new Date(createDto.expiryDate);
      if (
        isNaN(parsedExpiryDate.getTime()) ||
        parsedExpiryDate <= collectionDate
      ) {
        throw new BadRequestException({
          message: 'Expiry date must be a valid date after the collection date.',
          code: 'INVALID_EXPIRY_DATE',
        });
      }
    } else if (this.expiryRulesService) {
      parsedExpiryDate = await this.expiryRulesService.calculateExpiryDate(
        collectionDate,
        resolvedComponent,
      );
    } else {
      // Default standard 35 days
      parsedExpiryDate = new Date(collectionDate.getTime() + 35 * 24 * 60 * 60 * 1000);
    }

    // 8. Generate unique unitCode
    let unitCode = this.generateUnitCode();
    let attempts = 0;
    while (await this.bloodUnitModel.exists({ unitCode })) {
      unitCode = this.generateUnitCode();
      attempts++;
      if (attempts > 5) {
        unitCode = `UNIT-${Date.now()}`;
        break;
      }
    }

    // 9. Instantiate and save blood unit
    try {
      const unitData: any = {
        unitCode,
        donationId: donation._id,
        donorId: donor._id,
        campaignId: (donation as any).campaignId,
        campaignCode: (donation as any).campaignCode,
        bloodGroup: donor.bloodGroup,
        componentType: resolvedComponent,
        collectionDate,
        expiryDate: parsedExpiryDate,
        volume: createDto.volume,
        status: BloodUnitStatus.TESTING,
        storageLocation: createDto.storageLocation?.trim() || undefined,
        notes: createDto.notes?.trim() || undefined,
      };

      if (actor && actor.id) {
        unitData.createdBy = actor.id;
        unitData.createdByName = actor.fullName;
        unitData.createdByRole = actor.role;
      }

      const bloodUnit = new this.bloodUnitModel(unitData);
      const saved = await bloodUnit.save();

      if (actor && actor.id) {
        await this.auditLogsService?.logEvent({
          actor,
          action: AuditActionType.BLOOD_UNIT_CREATED,
          entityType: AuditEntityType.BLOOD_UNIT,
          entityId: saved._id.toString(),
          entityIdentifier: saved.unitCode,
          description: `Staff member created blood unit ${saved.unitCode} (${saved.bloodGroup} ${saved.componentType}) from donation ${donation.donationCode}`,
          afterState: { unitCode: saved.unitCode, bloodGroup: saved.bloodGroup, status: saved.status },
        });
      }

      return (await saved.populate([
        {
          path: 'donorId',
          select: 'donorCode fullName bloodGroup gender status phone',
        },
        {
          path: 'donationId',
          select: 'donationCode donationDate donationType status',
        },
      ])) as BloodUnit;
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException({
          message: `A blood unit has already been created for donation '${donation.donationCode}'.`,
          code: 'BLOOD_UNIT_ALREADY_EXISTS',
        });
      }
      throw err;
    }
  }

  /**
   * Internal staff query of paginated blood units with filtering.
   */
  async findAll(query: QueryBloodUnitsDto): Promise<PaginatedBloodUnits> {
    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }
    if (query.bloodGroup) {
      filter.bloodGroup = query.bloodGroup;
    }
    if (query.componentType) {
      filter.componentType = query.componentType;
    }
    if (query.donorId && isValidObjectId(query.donorId)) {
      filter.donorId = new Types.ObjectId(query.donorId);
    }
    if (query.donationId && isValidObjectId(query.donationId)) {
      filter.donationId = new Types.ObjectId(query.donationId);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.bloodUnitModel
        .find(filter)
        .populate([
          {
            path: 'donorId',
            select: 'donorCode fullName bloodGroup gender status phone',
          },
          {
            path: 'donationId',
            select: 'donationCode donationDate donationType status campaignId campaignCode',
            populate: {
              path: 'campaignId',
              select: 'name campaignCode venue city startDate endDate status targetUnits',
            },
          },
          {
            path: 'campaignId',
            select: 'name campaignCode venue city startDate endDate status targetUnits',
          },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bloodUnitModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Dedicated testing scope endpoint: Retrieves blood units in TESTING status.
   * Strips all donor PII (phone, full name) and donation notes.
   * Accessible to LAB_TECHNICIAN, ADMIN, SUPER_ADMIN.
   */
  async findAwaitingTesting(limit: number = 50) {
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const items = await this.bloodUnitModel
      .find({ status: BloodUnitStatus.TESTING })
      .select('unitCode status bloodGroup componentType collectionDate volume storageLocation createdAt campaignId campaignCode sourceType externalReceiptId')
      .populate([
        {
          path: 'donorId',
          select: 'donorCode gender status',
        },
        {
          path: 'donationId',
          select: 'donationCode donationDate donationType status campaignId campaignCode',
          populate: {
            path: 'campaignId',
            select: 'name campaignCode venue city startDate endDate status targetUnits',
          },
        },
        {
          path: 'campaignId',
          select: 'name campaignCode venue city startDate endDate status targetUnits',
        },
        {
          path: 'externalReceiptId',
          select: 'receiptCode sourceName sourceType invoiceNumber referenceNumber receivedDate',
        },
      ])
      .sort({ createdAt: -1, collectionDate: -1 })
      .limit(safeLimit)
      .exec();

    const total = await this.bloodUnitModel.countDocuments({ status: BloodUnitStatus.TESTING }).exec();

    return {
      items,
      total,
    };
  }

  /**
   * Retrieves a single blood unit by MongoDB ObjectId or human-readable unitCode.
   * If callerRole is LAB_TECHNICIAN, enforces unit must be in TESTING status and omits donor PII.
   */
  async findOne(idOrCode: string, callerRole?: string): Promise<BloodUnit> {
    const isLabRole = callerRole === AdminRole.LAB_TECHNICIAN;

    const donorSelect = isLabRole
      ? 'donorCode gender status'
      : 'donorCode fullName bloodGroup gender status phone';

    const donationSelect = isLabRole
      ? 'donationCode donationDate donationType status campaignId campaignCode'
      : 'donationCode donationDate donationType status quantity notes campaignId campaignCode';

    const populateOpts: any[] = [
      {
        path: 'donorId',
        select: donorSelect,
      },
      {
        path: 'donationId',
        select: donationSelect,
        populate: {
          path: 'campaignId',
          select: 'name campaignCode venue city startDate endDate status targetUnits',
        },
      },
      {
        path: 'campaignId',
        select: 'name campaignCode venue city startDate endDate status targetUnits',
      },
    ];

    let bloodUnit: any = null;

    if (isValidObjectId(idOrCode)) {
      bloodUnit = await this.bloodUnitModel
        .findById(idOrCode)
        .populate(populateOpts)
        .exec();
    }

    if (!bloodUnit) {
      bloodUnit = await this.bloodUnitModel
        .findOne({ unitCode: idOrCode.toUpperCase() })
        .populate(populateOpts)
        .exec();
    }

    if (!bloodUnit) {
      throw new NotFoundException({
        message: `Blood unit '${idOrCode}' was not found.`,
        code: 'BLOOD_UNIT_NOT_FOUND',
      });
    }

    // Lab Technician restriction: can only access blood units in TESTING status
    if (isLabRole && bloodUnit.status !== BloodUnitStatus.TESTING) {
      throw new ForbiddenException(
        'Access restricted: Lab Technicians may only inspect blood units in TESTING status.',
      );
    }

    return bloodUnit;
  }

  /**
   * Retrieves the Blood Unit produced from a specific Donation.
   */
  async findByDonationId(donationId: string): Promise<BloodUnit | null> {
    if (!isValidObjectId(donationId)) {
      throw new BadRequestException({
        message: 'Invalid donation ID format',
        code: 'INVALID_DONATION_REFERENCE',
      });
    }

    const bloodUnit = await this.bloodUnitModel
      .findOne({ donationId: new Types.ObjectId(donationId) })
      .populate([
        {
          path: 'donorId',
          select: 'donorCode fullName bloodGroup gender status phone',
        },
        {
          path: 'donationId',
          select:
            'donationCode donationDate donationType status quantity notes',
        },
      ])
      .exec();

    if (!bloodUnit) {
      throw new NotFoundException({
        message: `No blood unit found for donation '${donationId}'.`,
        code: 'BLOOD_UNIT_NOT_FOUND',
      });
    }

    return bloodUnit;
  }

  /**
   * Prepares derived blood components from an eligible whole blood parent unit.
   *
   * Business Rules Enforced:
   * 1. Parent blood unit must exist.
   * 2. Parent unit must be WHOLE_BLOOD (cannot separate already-separated components).
   * 3. Parent unit must NOT already be PROCESSED_INTO_COMPONENTS, DISCARDED, or EXPIRED.
   * 4. Validates requested components (non-empty, no duplicate component types in batch).
   * 5. Calculates component-specific expiry using ExpiryRulesService.
   * 6. Deactivates parent unit inventory and updates parent status to PROCESSED_INTO_COMPONENTS.
   * 7. Creates child blood units with parent traceability (parentUnitId, parentUnitCode, isComponentDerived: true).
   * 8. If parent unit was APPROVED, child components become available in inventory.
   */
  async prepareComponents(
    parentUnitId: string,
    dto: PrepareComponentsDto,
    actor?: any,
  ): Promise<{ parentUnit: BloodUnit; childUnits: BloodUnit[] }> {
    if (!isValidObjectId(parentUnitId)) {
      throw new BadRequestException({
        message: 'Invalid parent blood unit ID format',
        code: 'INVALID_PARENT_UNIT_ID',
      });
    }

    const parentUnit = await this.bloodUnitModel.findById(parentUnitId).exec();
    if (!parentUnit) {
      throw new NotFoundException({
        message: `Parent blood unit with ID '${parentUnitId}' was not found.`,
        code: 'PARENT_UNIT_NOT_FOUND',
      });
    }

    if (parentUnit.componentType !== BloodUnitComponent.WHOLE_BLOOD) {
      throw new BadRequestException({
        message: `Cannot separate blood unit '${parentUnit.unitCode}': Only Whole Blood units can be separated into components (current component: ${parentUnit.componentType}).`,
        code: 'NOT_WHOLE_BLOOD',
      });
    }

    if (parentUnit.status === BloodUnitStatus.PROCESSED_INTO_COMPONENTS) {
      throw new ConflictException({
        message: `Blood unit '${parentUnit.unitCode}' has already been processed into components.`,
        code: 'ALREADY_PROCESSED_INTO_COMPONENTS',
      });
    }

    if (
      parentUnit.status === BloodUnitStatus.REJECTED ||
      parentUnit.status === BloodUnitStatus.QUARANTINED ||
      (parentUnit.expiryDate && new Date(parentUnit.expiryDate) < new Date())
    ) {
      throw new BadRequestException({
        message: `Cannot prepare components from unit '${parentUnit.unitCode}' with status '${parentUnit.status}' or expired status.`,
        code: 'INVALID_PARENT_UNIT_STATUS',
      });
    }

    if (!dto.components || dto.components.length === 0) {
      throw new BadRequestException({
        message: 'At least one component must be specified for preparation.',
        code: 'NO_COMPONENTS_SPECIFIED',
      });
    }

    // Check for duplicate components in request
    const componentTypes = dto.components.map((c) => c.componentType);
    const uniqueTypes = new Set(componentTypes);
    if (uniqueTypes.size !== componentTypes.length) {
      throw new BadRequestException({
        message: 'Duplicate component types specified in separation batch.',
        code: 'DUPLICATE_COMPONENT_TYPES',
      });
    }

    // Verify shelf-life and create child units
    const childUnits: BloodUnitDocument[] = [];
    const collectionDate = new Date(parentUnit.collectionDate);

    for (const item of dto.components) {
      let expiryDate: Date;
      if (this.expiryRulesService) {
        expiryDate = await this.expiryRulesService.calculateExpiryDate(
          collectionDate,
          item.componentType,
        );
      } else {
        let shelfLifeDays = 35;
        if (item.componentType === BloodUnitComponent.PLATELETS) shelfLifeDays = 5;
        else if (item.componentType === BloodUnitComponent.FFP) shelfLifeDays = 365;
        else if (item.componentType === BloodUnitComponent.CRYOPRECIPITATE) shelfLifeDays = 365;
        expiryDate = new Date(collectionDate.getTime() + shelfLifeDays * 24 * 60 * 60 * 1000);
      }

      let storageRequirement = '2°C to 6°C';
      if (
        item.componentType === BloodUnitComponent.FFP ||
        item.componentType === BloodUnitComponent.CRYOPRECIPITATE
      ) {
        storageRequirement = '-18°C or colder';
      } else if (item.componentType === BloodUnitComponent.PLATELETS) {
        storageRequirement = '20°C to 24°C with continuous agitation';
      }

      const compSuffix = item.componentType.slice(0, 4);
      let childCode = `${parentUnit.unitCode}-${compSuffix}`;
      let attempts = 0;
      while (await this.bloodUnitModel.exists({ unitCode: childCode })) {
        attempts++;
        childCode = `${parentUnit.unitCode}-${compSuffix}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        if (attempts > 5) break;
      }

      const childUnitData: any = {
        unitCode: childCode,
        parentUnitId: parentUnit._id,
        parentUnitCode: parentUnit.unitCode,
        isComponentDerived: true,
        donorId: parentUnit.donorId,
        campaignId: parentUnit.campaignId,
        campaignCode: parentUnit.campaignCode,
        bloodGroup: parentUnit.bloodGroup,
        componentType: item.componentType,
        collectionDate: parentUnit.collectionDate,
        expiryDate,
        volume: item.volume,
        status: parentUnit.status,
        storageLocation: item.storageLocation?.trim() || parentUnit.storageLocation,
        storageRequirement,
        preparedAt: new Date(),
        preparedBy: isValidObjectId(actor?._id || actor?.id)
          ? new Types.ObjectId(actor._id || actor.id)
          : undefined,
        preparedByName: actor?.fullName || actor?.name || undefined,
        notes: dto.notes?.trim() || undefined,
      };

      const childDoc = new this.bloodUnitModel(childUnitData);
      const savedChild = await childDoc.save();
      childUnits.push(savedChild);

      if (parentUnit.status === BloodUnitStatus.APPROVED && this.inventoryModel) {
        try {
          await this.inventoryModel.create({
            bloodUnitId: savedChild._id,
            status: InventoryStatus.AVAILABLE,
            receivedBy: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : undefined,
            receivedByName: actor?.fullName || actor?.name || undefined,
            receivedByRole: actor?.role || undefined,
            receivedAt: new Date(),
          });
        } catch {
          // ignore duplicate inventory index error
        }
      }
    }

    // Transition parent unit status
    parentUnit.status = BloodUnitStatus.PROCESSED_INTO_COMPONENTS;
    const updatedParent = await parentUnit.save();

    // Decommission parent unit from inventory to prevent duplicate inventory
    if (this.inventoryModel) {
      await this.inventoryModel.updateMany(
        { bloodUnitId: parentUnit._id },
        {
          status: InventoryStatus.DISCARDED,
          notes: 'Decommissioned: Whole blood separated into child components',
        },
      ).exec();
    }

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: actor?._id || actor?.id,
        actorName: actor?.fullName || actor?.name,
        actorEmail: actor?.email,
        actorRole: actor?.role,
        action: AuditActionType.BLOOD_UNIT_CREATED,
        entityType: AuditEntityType.BLOOD_UNIT,
        entityId: parentUnit._id.toString(),
        entityIdentifier: parentUnit.unitCode,
        description: `Whole blood unit ${parentUnit.unitCode} separated into ${childUnits.length} components: ${dto.components.map((c) => c.componentType).join(', ')}`,
        afterState: {
          parentUnitCode: parentUnit.unitCode,
          parentStatus: parentUnit.status,
          childUnits: childUnits.map((u) => ({
            unitCode: u.unitCode,
            componentType: u.componentType,
            volume: u.volume,
          })),
        },
      });
    }

    return {
      parentUnit: updatedParent,
      childUnits,
    };
  }
}

