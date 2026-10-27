import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import {
  CrossmatchRecord,
  CrossmatchRecordDocument,
} from './schemas/crossmatch-record.schema';
import {
  CrossmatchStatus,
  SampleCondition,
  CrossmatchResult,
  ReviewDecision,
  isRbcComponent,
  checkTheoreticalRbcEligibility,
  evaluateComponentCompatibility,
} from './constants/crossmatching.constants';
import { CreateCrossmatchDto } from './dto/create-crossmatch.dto';
import { VerifySampleDto } from './dto/verify-sample.dto';
import { SelectUnitDto } from './dto/select-unit.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { ReviewAuthorizationDto } from './dto/review-authorization.dto';
import { ReserveCrossmatchDto } from './dto/reserve-crossmatch.dto';
import { IssueCrossmatchDto } from './dto/issue-crossmatch.dto';
import { CancelCrossmatchDto } from './dto/cancel-crossmatch.dto';
import { RepeatCrossmatchDto } from './dto/repeat-crossmatch.dto';
import { QueryCrossmatchesDto } from './dto/query-crossmatches.dto';
import {
  BloodRequest,
  BloodRequestDocument,
} from '../../blood-requests/schemas/blood-request.schema';
import { BloodRequestStatus } from '../../blood-requests/blood-request.constants';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import {
  BloodUnit,
  BloodUnitDocument,
} from '../blood-units/schemas/blood-unit.schema';
import { BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';
import { ReservationsService } from '../reservations/reservations.service';
import { BloodIssuesService } from '../blood-issues/blood-issues.service';
import { InvoicesService } from '../billing/services/invoices.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AuditActionType,
  AuditEntityType,
} from '../audit-logs/constants/audit-log.constants';

@Injectable()
export class CrossmatchingService {
  constructor(
    @InjectModel(CrossmatchRecord.name)
    private readonly crossmatchModel: Model<CrossmatchRecordDocument>,
    @InjectModel(BloodRequest.name)
    private readonly bloodRequestModel: Model<BloodRequestDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel: Model<BloodUnitDocument>,
    private readonly reservationsService: ReservationsService,
    private readonly bloodIssuesService: BloodIssuesService,
    @Optional()
    private readonly invoicesService?: InvoicesService,
    @Optional()
    private readonly auditLogsService?: AuditLogsService,
  ) {}

  private generateCrossmatchCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `XM-${datePart}-${rand}`;
  }

  /**
   * Initiates a new Crossmatch process linked to an existing Blood Request.
   */
  async create(
    dto: CreateCrossmatchDto,
    actor?: any,
  ): Promise<CrossmatchRecord> {
    let bloodRequest: BloodRequestDocument | null = null;
    if (isValidObjectId(dto.bloodRequestId)) {
      bloodRequest = await this.bloodRequestModel
        .findById(dto.bloodRequestId)
        .exec();
    }
    if (!bloodRequest) {
      bloodRequest = await this.bloodRequestModel
        .findOne({ requestCode: dto.bloodRequestId.toUpperCase() })
        .exec();
    }

    if (!bloodRequest) {
      throw new NotFoundException({
        message: `Blood request '${dto.bloodRequestId}' was not found.`,
        code: 'BLOOD_REQUEST_NOT_FOUND',
      });
    }

    // Safety Gate: Cannot start crossmatching on completed, rejected or cancelled requests
    if (
      [
        BloodRequestStatus.COMPLETED,
        BloodRequestStatus.REJECTED,
        BloodRequestStatus.CANCELLED,
      ].includes(bloodRequest.status)
    ) {
      throw new BadRequestException({
        message: `Cannot start crossmatching for Blood Request '${bloodRequest.requestCode}' in status '${bloodRequest.status}'.`,
        code: 'INVALID_REQUEST_STATUS_FOR_CROSSMATCH',
      });
    }

    const crossmatchCode = this.generateCrossmatchCode();

    const crossmatch = new this.crossmatchModel({
      crossmatchCode,
      bloodRequestId: bloodRequest._id,
      requestCode: bloodRequest.requestCode,
      patient: {
        name: bloodRequest.patient.name,
        age: bloodRequest.patient.age,
        gender: bloodRequest.patient.gender,
        phone: bloodRequest.patient.phone,
        hospitalName: bloodRequest.hospitalName,
        doctorName: bloodRequest.doctorName,
        doctorContact: bloodRequest.doctorContact,
        hospitalCaseNumber: bloodRequest.hospitalCaseNumber,
      },
      patientBloodGroup: bloodRequest.bloodGroup,
      requestedComponent: bloodRequest.componentType,
      urgency: bloodRequest.priority,
      unitsRequested: bloodRequest.unitsRequested,
      sample: {
        sampleId: dto.sampleId || undefined,
        isSampleValid: false,
        sampleIdentityVerified: false,
      },
      status: CrossmatchStatus.PENDING_SAMPLE_VERIFICATION,
      timeline: [
        {
          fromStatus: 'INITIAL',
          toStatus: CrossmatchStatus.PENDING_SAMPLE_VERIFICATION,
          actorId: actor?._id || actor?.id,
          actorName: actor?.fullName || actor?.name || 'Authorized Staff',
          actorRole: actor?.role || 'STAFF',
          action: 'INITIATED',
          timestamp: new Date(),
          notes: dto.notes || `Crossmatch order created for ${bloodRequest.requestCode}`,
        },
      ],
    });

    const saved = await crossmatch.save();

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: actor?._id || actor?.id,
        actorName: actor?.fullName || actor?.name || 'Staff',
        actorEmail: actor?.email || 'staff@bloodbank.org',
        actorRole: actor?.role || 'STAFF',
        action: AuditActionType.CROSSMATCH_INITIATED,
        entityType: AuditEntityType.CROSSMATCH,
        entityId: saved._id.toString(),
        entityIdentifier: saved.crossmatchCode,
        description: `Crossmatch initiated for patient ${saved.patient.name} (${saved.requestCode})`,
        beforeState: null,
        afterState: { status: saved.status, crossmatchCode: saved.crossmatchCode },
      });
    }

    return saved;
  }

  /**
   * Retrieves a paginated list of crossmatch records with filtering and search.
   */
  async findAll(query: QueryCrossmatchesDto) {
    const filter: any = {};

    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }

    if (query.patientBloodGroup && query.patientBloodGroup !== 'ALL') {
      filter.patientBloodGroup = query.patientBloodGroup;
    }

    if (query.component && query.component !== 'ALL') {
      filter.requestedComponent = query.component;
    }

    if (query.urgency && query.urgency !== 'ALL') {
      filter.urgency = query.urgency;
    }

    if (query.bloodRequestId && query.bloodRequestId !== 'ALL') {
      if (isValidObjectId(query.bloodRequestId)) {
        filter.bloodRequestId = new Types.ObjectId(query.bloodRequestId);
      } else {
        filter.bloodRequestId = query.bloodRequestId;
      }
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { crossmatchCode: { $regex: term, $options: 'i' } },
        { requestCode: { $regex: term, $options: 'i' } },
        { 'patient.name': { $regex: term, $options: 'i' } },
        { 'patient.hospitalCaseNumber': { $regex: term, $options: 'i' } },
        { 'sample.sampleId': { $regex: term, $options: 'i' } },
        { 'selectedUnit.unitCode': { $regex: term, $options: 'i' } },
      ];
    }

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit || '50', 10)));
    const skip = (page - 1) * limit;

    const [crossmatches, total] = await Promise.all([
      this.crossmatchModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.crossmatchModel.countDocuments(filter).exec(),
    ]);

    return {
      crossmatches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Returns real-time database-backed dashboard metrics.
   */
  async getDashboardMetrics() {
    const [
      pendingSampleVerification,
      sampleVerifiedReady,
      testingInProgress,
      resultRecordedAwaitingReview,
      authorizedCompatibleAwaitingIssue,
      incompatibleCount,
      invalidOrInconclusiveCount,
      reservedCount,
      issuedCount,
      cancelledCount,
      totalCount,
    ] = await Promise.all([
      this.crossmatchModel
        .countDocuments({ status: CrossmatchStatus.PENDING_SAMPLE_VERIFICATION })
        .exec(),
      this.crossmatchModel
        .countDocuments({ status: CrossmatchStatus.SAMPLE_VERIFIED })
        .exec(),
      this.crossmatchModel
        .countDocuments({
          status: {
            $in: [
              CrossmatchStatus.UNIT_SELECTED,
              CrossmatchStatus.TESTING_IN_PROGRESS,
            ],
          },
        })
        .exec(),
      this.crossmatchModel
        .countDocuments({ status: CrossmatchStatus.RESULT_RECORDED })
        .exec(),
      this.crossmatchModel
        .countDocuments({ status: CrossmatchStatus.AUTHORIZED_COMPATIBLE })
        .exec(),
      this.crossmatchModel
        .countDocuments({ status: CrossmatchStatus.INCOMPATIBLE })
        .exec(),
      this.crossmatchModel
        .countDocuments({
          status: {
            $in: [
              CrossmatchStatus.INVALID_SAMPLE,
              CrossmatchStatus.INCONCLUSIVE,
            ],
          },
        })
        .exec(),
      this.crossmatchModel
        .countDocuments({ status: CrossmatchStatus.RESERVED })
        .exec(),
      this.crossmatchModel
        .countDocuments({ status: CrossmatchStatus.ISSUED })
        .exec(),
      this.crossmatchModel
        .countDocuments({ status: CrossmatchStatus.CANCELLED })
        .exec(),
      this.crossmatchModel.countDocuments().exec(),
    ]);

    return {
      pendingSampleVerification,
      sampleVerifiedReady,
      testingInProgress,
      resultRecordedAwaitingReview,
      authorizedCompatibleAwaitingIssue,
      incompatibleCount,
      invalidOrInconclusiveCount,
      reservedCount,
      issuedCount,
      cancelledCount,
      totalCount,
    };
  }

  /**
   * Retrieves single crossmatch record by ID or crossmatchCode.
   */
  async findOne(id: string): Promise<CrossmatchRecord> {
    let crossmatch: any = null;
    if (isValidObjectId(id)) {
      crossmatch = await this.crossmatchModel
        .findById(id)
        .populate('bloodRequestId')
        .populate('selectedUnit.bloodUnitId')
        .populate('selectedUnit.inventoryId')
        .populate('reservationId')
        .populate('bloodIssueId')
        .exec();
    }

    if (!crossmatch) {
      crossmatch = await this.crossmatchModel
        .findOne({ crossmatchCode: id.toUpperCase() })
        .populate('bloodRequestId')
        .populate('selectedUnit.bloodUnitId')
        .populate('selectedUnit.inventoryId')
        .populate('reservationId')
        .populate('bloodIssueId')
        .exec();
    }

    if (!crossmatch) {
      throw new NotFoundException({
        message: `Crossmatch record '${id}' was not found.`,
        code: 'CROSSMATCH_NOT_FOUND',
      });
    }

    return crossmatch;
  }

  /**
   * Step 3: Candidate Unit Selection Query
   * Fetches candidate inventory units and computes ABO/RhD and clinical eligibility.
   */
  async getEligibleUnits(crossmatchId: string) {
    const crossmatch = await this.findOne(crossmatchId);
    const now = new Date();

    // Find all inventory items marked AVAILABLE
    const inventoryItems = await this.inventoryModel
      .find({ status: InventoryStatus.AVAILABLE })
      .populate({
        path: 'bloodUnitId',
        select:
          'unitCode bloodGroup componentType expiryDate collectionDate storageLocation status',
      })
      .lean()
      .exec();

    // Check which units are currently locked by an active crossmatch
    const activeCrossmatches = await this.crossmatchModel
      .find({
        status: {
          $in: [
            CrossmatchStatus.UNIT_SELECTED,
            CrossmatchStatus.TESTING_IN_PROGRESS,
            CrossmatchStatus.RESULT_RECORDED,
            CrossmatchStatus.AUTHORIZED_COMPATIBLE,
            CrossmatchStatus.RESERVED,
          ],
        },
        _id: { $ne: (crossmatch as any)._id },
      })
      .select('selectedUnit.inventoryId')
      .lean()
      .exec();

    const lockedInventoryIds = new Set(
      activeCrossmatches
        .map((x) => x.selectedUnit?.inventoryId?.toString())
        .filter(Boolean),
    );

    const evaluatedUnits: Array<{
      inventoryId: string;
      bloodUnitId: string;
      unitCode: string;
      bloodGroup: string;
      componentType: string;
      expiryDate: string | null;
      collectionDate: string | null;
      storageLocation: string;
      isEligible: boolean;
      eligibilityReason: string;
      isTheoreticalRbcMatch: boolean;
      daysUntilExpiry: number | null;
    }> = [];

    const patientBloodGroup = crossmatch.patientBloodGroup;
    const requestedComponent = crossmatch.requestedComponent;
    const isRedCell = isRbcComponent(requestedComponent);

    for (const item of inventoryItems) {
      const unit = item.bloodUnitId as any;
      if (!unit) continue;

      let isEligible = true;
      let eligibilityReason = 'Eligible for laboratory crossmatch consideration.';
      let isTheoreticalRbcMatch = false;

      // Check 1: Quarantine / Lab Release
      if (unit.status !== BloodUnitStatus.APPROVED) {
        isEligible = false;
        eligibilityReason = `Unit is not approved (Current status: ${unit.status}).`;
      }

      // Check 2: Component type match
      if (isEligible && unit.componentType !== requestedComponent) {
        isEligible = false;
        eligibilityReason = `Component mismatch: Unit is ${unit.componentType}, requested ${requestedComponent}.`;
      }

      // Check 3: Expiry Date
      const unitExpiry = unit.expiryDate ? new Date(unit.expiryDate) : null;
      let daysUntilExpiry: number | null = null;
      if (unitExpiry) {
        daysUntilExpiry = Math.ceil(
          (unitExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (unitExpiry < now) {
          isEligible = false;
          eligibilityReason = `Unit expired on ${unitExpiry.toISOString().slice(0, 10)}.`;
        }
      }

      // Check 4: Locked by another active crossmatch
      if (isEligible && lockedInventoryIds.has((item._id as any).toString())) {
        isEligible = false;
        eligibilityReason = 'Unit is currently engaged in another active crossmatch test.';
      }

      // Check 5: Component-Specific ABO / RhD Transfusion Compatibility
      if (isEligible) {
        const evalResult = evaluateComponentCompatibility(
          unit.bloodGroup,
          patientBloodGroup,
          requestedComponent,
        );
        isTheoreticalRbcMatch = evalResult.compatible;
        if (!evalResult.compatible) {
          isEligible = false;
          eligibilityReason = evalResult.reason;
        } else {
          eligibilityReason = evalResult.reason;
        }
      }

      evaluatedUnits.push({
        inventoryId: (item._id as any).toString(),
        bloodUnitId: (unit._id as any).toString(),
        unitCode: unit.unitCode,
        bloodGroup: unit.bloodGroup,
        componentType: unit.componentType,
        expiryDate: unitExpiry ? unitExpiry.toISOString() : null,
        collectionDate: unit.collectionDate
          ? new Date(unit.collectionDate).toISOString()
          : null,
        storageLocation: unit.storageLocation || 'Unassigned',
        isEligible,
        eligibilityReason,
        isTheoreticalRbcMatch,
        daysUntilExpiry,
      });
    }

    // Sort: eligible units first (FEFO: earliest expiry first), then ineligible units
    evaluatedUnits.sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

    return {
      crossmatch: {
        id: (crossmatch as any)._id.toString(),
        crossmatchCode: crossmatch.crossmatchCode,
        requestCode: crossmatch.requestCode,
        patientBloodGroup: crossmatch.patientBloodGroup,
        requestedComponent: crossmatch.requestedComponent,
        urgency: crossmatch.urgency,
      },
      candidateUnits: evaluatedUnits,
      eligibleCount: evaluatedUnits.filter((u) => u.isEligible).length,
      totalStockInspected: evaluatedUnits.length,
    };
  }

  /**
   * Step 2: Sample Verification
   */
  async verifySample(
    id: string,
    dto: VerifySampleDto,
    actor?: any,
  ): Promise<CrossmatchRecord> {
    const crossmatch = await this.findOne(id);

    if (
      [
        CrossmatchStatus.ISSUED,
        CrossmatchStatus.CANCELLED,
      ].includes(crossmatch.status)
    ) {
      throw new BadRequestException({
        message: `Cannot verify sample on a crossmatch in status '${crossmatch.status}'.`,
        code: 'CROSSMATCH_TERMINAL_STATE',
      });
    }

    const collectedAt = new Date(dto.sampleCollectedAt);
    const receivedAt = new Date(dto.sampleReceivedAt);

    if (isNaN(collectedAt.getTime()) || isNaN(receivedAt.getTime())) {
      throw new BadRequestException({
        message: 'Invalid sample collection or receipt timestamps provided.',
        code: 'INVALID_TIMESTAMPS',
      });
    }

    if (collectedAt > receivedAt) {
      throw new BadRequestException({
        message: 'Sample collection timestamp cannot be later than receipt timestamp.',
        code: 'COLLECTION_AFTER_RECEIPT',
      });
    }

    const isPhysicalConditionValid =
      dto.sampleCondition === SampleCondition.VALID;
    const isIdentityConfirmed = dto.sampleIdentityVerified === true;
    const isSampleApproved = isPhysicalConditionValid && isIdentityConfirmed;

    const previousStatus = crossmatch.status;
    const targetStatus = isSampleApproved
      ? CrossmatchStatus.SAMPLE_VERIFIED
      : CrossmatchStatus.INVALID_SAMPLE;

    const rejectionReason = !isPhysicalConditionValid
      ? `Sample rejected due to physical compromise: ${dto.sampleCondition}.`
      : !isIdentityConfirmed
      ? 'Sample rejected: Patient identity wristband/tube mismatch.'
      : null;

    crossmatch.sample = {
      sampleId: dto.sampleId.toUpperCase(),
      sampleCollectedAt: collectedAt,
      sampleReceivedAt: receivedAt,
      sampleCondition: dto.sampleCondition,
      isSampleValid: isSampleApproved,
      sampleIdentityVerified: isIdentityConfirmed,
      verifiedAboRh: dto.verifiedAboRh.toUpperCase(),
      antibodyScreenResult: dto.antibodyScreenResult,
      antibodyScreenNotes: dto.antibodyScreenNotes,
      sampleVerifiedAt: new Date(),
      sampleVerifiedBy: actor?._id || actor?.id,
      sampleVerifiedByName: actor?.fullName || actor?.name || 'Lab Technician',
      sampleVerifiedByRole: actor?.role || 'LAB_TECHNICIAN',
      sampleVerificationNotes: dto.notes || rejectionReason || 'Sample verified successfully.',
    };

    crossmatch.status = targetStatus;

    crossmatch.timeline.push({
      fromStatus: previousStatus,
      toStatus: targetStatus,
      actorId: actor?._id || actor?.id,
      actorName: actor?.fullName || actor?.name || 'Lab Technician',
      actorRole: actor?.role || 'LAB_TECHNICIAN',
      action: isSampleApproved ? 'SAMPLE_VERIFIED' : 'SAMPLE_REJECTED',
      timestamp: new Date(),
      notes: isSampleApproved
        ? `Sample ${dto.sampleId} verified (Condition: VALID, Antibody screen: ${dto.antibodyScreenResult})`
        : `Sample verification failed: ${rejectionReason}`,
    } as any);

    const saved = await (crossmatch as any).save();

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: actor?._id || actor?.id,
        actorName: actor?.fullName || actor?.name || 'Lab Tech',
        actorEmail: actor?.email || 'tech@bloodbank.org',
        actorRole: actor?.role || 'LAB_TECHNICIAN',
        action: AuditActionType.CROSSMATCH_SAMPLE_VERIFIED,
        entityType: AuditEntityType.CROSSMATCH,
        entityId: saved._id.toString(),
        entityIdentifier: saved.crossmatchCode,
        description: `Patient sample ${dto.sampleId} evaluated for ${saved.crossmatchCode}: ${targetStatus}`,
        beforeState: { status: previousStatus },
        afterState: { status: targetStatus, sample: crossmatch.sample },
      });
    }

    return saved;
  }

  /**
   * Step 3: Select Candidate Blood Unit from Inventory
   */
  async selectUnit(
    id: string,
    dto: SelectUnitDto,
    actor?: any,
  ): Promise<CrossmatchRecord> {
    const crossmatch = await this.findOne(id);

    // Gate: Patient sample must be valid
    if (!crossmatch.sample?.isSampleValid) {
      throw new BadRequestException({
        message:
          'Cannot select unit: Patient sample is invalid, missing or unverified. Complete sample verification first.',
        code: 'SAMPLE_NOT_VERIFIED',
      });
    }

    if (
      [
        CrossmatchStatus.AUTHORIZED_COMPATIBLE,
        CrossmatchStatus.RESERVED,
        CrossmatchStatus.ISSUED,
        CrossmatchStatus.CANCELLED,
      ].includes(crossmatch.status)
    ) {
      throw new BadRequestException({
        message: `Cannot alter unit selection when crossmatch is in status '${crossmatch.status}'.`,
        code: 'INVALID_STATUS_FOR_UNIT_SELECTION',
      });
    }

    const targetInventoryIds: string[] = Array.from(
      new Set(
        (dto.inventoryIds && dto.inventoryIds.length > 0
          ? dto.inventoryIds
          : [dto.inventoryId]
        ).filter(Boolean) as string[],
      ),
    );

    if (targetInventoryIds.length === 0) {
      throw new BadRequestException({
        message: 'At least one candidate inventory unit ID is required.',
        code: 'NO_INVENTORY_ID',
      });
    }

    if (targetInventoryIds.length > crossmatch.unitsRequested) {
      throw new BadRequestException({
        message: `Cannot select ${targetInventoryIds.length} units. Request requires a maximum of ${crossmatch.unitsRequested} unit(s).`,
        code: 'QUANTITY_EXCEEDED',
      });
    }

    const selectedSubdocs: any[] = [];
    const notesSummary: string[] = [];

    for (const invId of targetInventoryIds) {
      const inventoryItem = await this.inventoryModel
        .findById(invId)
        .populate('bloodUnitId')
        .exec();

      if (!inventoryItem) {
        throw new NotFoundException({
          message: `Inventory record '${invId}' was not found.`,
          code: 'INVENTORY_NOT_FOUND',
        });
      }

      if (inventoryItem.status !== InventoryStatus.AVAILABLE) {
        throw new BadRequestException({
          message: `Unit is not available for crossmatching (Current inventory status: ${inventoryItem.status}).`,
          code: 'UNIT_NOT_AVAILABLE',
        });
      }

      const unit = inventoryItem.bloodUnitId as any;
      if (!unit || unit.status !== BloodUnitStatus.APPROVED) {
        throw new BadRequestException({
          message: `Blood unit is not released from quarantine (Status: ${unit?.status || 'UNKNOWN'}).`,
          code: 'UNIT_NOT_APPROVED',
        });
      }

      // Expiry check
      if (unit.expiryDate && new Date(unit.expiryDate) < new Date()) {
        throw new BadRequestException({
          message: `Blood unit '${unit.unitCode}' has expired and cannot be crossmatched.`,
          code: 'UNIT_EXPIRED',
        });
      }

      // Component match
      if (unit.componentType !== crossmatch.requestedComponent) {
        throw new BadRequestException({
          message: `Component mismatch: Unit is ${unit.componentType}, requested ${crossmatch.requestedComponent}.`,
          code: 'COMPONENT_MISMATCH',
        });
      }

      // Evaluate component-specific theoretical ABO/RhD match
      const evalRes = evaluateComponentCompatibility(
        unit.bloodGroup,
        crossmatch.patientBloodGroup,
        crossmatch.requestedComponent,
      );
      const isAboRhCompatible = evalRes.compatible;
      const ruleRef = evalRes.reason;

      selectedSubdocs.push({
        bloodUnitId: unit._id,
        unitCode: unit.unitCode,
        inventoryId: inventoryItem._id,
        donorBloodGroup: unit.bloodGroup,
        componentType: unit.componentType,
        expiryDate: unit.expiryDate,
        collectionDate: unit.collectionDate,
        storageLocation: unit.storageLocation,
        isAboRhCompatible,
        compatibilityRuleReference: ruleRef,
        unitSelectedAt: new Date(),
        unitSelectedBy: actor?._id || actor?.id,
        unitSelectedByName: actor?.fullName || actor?.name || 'Staff',
        unitSelectedByRole: actor?.role || 'STAFF',
      });

      notesSummary.push(`${unit.unitCode} (${unit.bloodGroup})`);
    }

    const previousStatus = crossmatch.status;
    const targetStatus = CrossmatchStatus.UNIT_SELECTED;

    crossmatch.selectedUnits = selectedSubdocs as any;
    crossmatch.selectedUnit = selectedSubdocs[0];
    crossmatch.status = targetStatus;

    crossmatch.timeline.push({
      fromStatus: previousStatus,
      toStatus: targetStatus,
      actorId: actor?._id || actor?.id,
      actorName: actor?.fullName || actor?.name || 'Staff',
      actorRole: actor?.role || 'STAFF',
      action: 'UNIT_SELECTED',
      timestamp: new Date(),
      notes: `Selected ${selectedSubdocs.length} candidate unit(s): ${notesSummary.join(', ')}.`,
    } as any);

    const saved = await (crossmatch as any).save();

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: actor?._id || actor?.id,
        actorName: actor?.fullName || actor?.name || 'Staff',
        actorEmail: actor?.email || 'staff@bloodbank.org',
        actorRole: actor?.role || 'STAFF',
        action: AuditActionType.CROSSMATCH_UNIT_SELECTED,
        entityType: AuditEntityType.CROSSMATCH,
        entityId: saved._id.toString(),
        entityIdentifier: saved.crossmatchCode,
        description: `Selected ${selectedSubdocs.length} donor unit(s) [${notesSummary.join(', ')}] for crossmatch ${saved.crossmatchCode}`,
        beforeState: { status: previousStatus },
        afterState: { status: targetStatus, selectedUnit: crossmatch.selectedUnit },
      });
    }

    return saved;
  }

  /**
   * Step 4: Record Physical Laboratory Test Result
   */
  async recordResult(
    id: string,
    dto: RecordResultDto,
    actor?: any,
  ): Promise<CrossmatchRecord> {
    const crossmatch = await this.findOne(id);

    if (!crossmatch.sample?.isSampleValid) {
      throw new BadRequestException({
        message: 'Cannot record test result: Patient sample is not valid or verified.',
        code: 'INVALID_SAMPLE',
      });
    }

    if (!crossmatch.selectedUnit?.bloodUnitId) {
      throw new BadRequestException({
        message: 'Cannot record test result: No donor blood unit has been selected.',
        code: 'NO_UNIT_SELECTED',
      });
    }

    if (
      [
        CrossmatchStatus.AUTHORIZED_COMPATIBLE,
        CrossmatchStatus.RESERVED,
        CrossmatchStatus.ISSUED,
        CrossmatchStatus.CANCELLED,
      ].includes(crossmatch.status)
    ) {
      throw new BadRequestException({
        message: `Cannot record test result when crossmatch is in status '${crossmatch.status}'.`,
        code: 'INVALID_STATUS_FOR_RESULT_RECORDING',
      });
    }

    const previousStatus = crossmatch.status;
    let targetStatus: CrossmatchStatus;

    switch (dto.crossmatchResult) {
      case CrossmatchResult.COMPATIBLE:
        // Compatible results require authorized review before release
        targetStatus = CrossmatchStatus.RESULT_RECORDED;
        break;
      case CrossmatchResult.INCOMPATIBLE:
        targetStatus = CrossmatchStatus.INCOMPATIBLE;
        break;
      case CrossmatchResult.INVALID:
        targetStatus = CrossmatchStatus.INVALID_SAMPLE;
        break;
      case CrossmatchResult.INCONCLUSIVE:
        targetStatus = CrossmatchStatus.INCONCLUSIVE;
        break;
      case CrossmatchResult.IN_PROGRESS:
        targetStatus = CrossmatchStatus.TESTING_IN_PROGRESS;
        break;
      default:
        targetStatus = CrossmatchStatus.TESTING_IN_PROGRESS;
    }

    const testedAt = dto.testedAt ? new Date(dto.testedAt) : new Date();

    crossmatch.laboratoryTest = {
      testMethod: dto.testMethod,
      testPhases: dto.testPhases || [],
      crossmatchResult: dto.crossmatchResult,
      reactionGrade: dto.reactionGrade || (dto.crossmatchResult === CrossmatchResult.COMPATIBLE ? '0' : undefined),
      testedAt,
      testedBy: actor?._id || actor?.id,
      testedByName: actor?.fullName || actor?.name || 'Laboratory Technician',
      testedByRole: actor?.role || 'LAB_TECHNICIAN',
      testingNotes: dto.testingNotes || '',
      isRepeatTest: crossmatch.laboratoryTest?.isRepeatTest || false,
      previousCrossmatchId: crossmatch.laboratoryTest?.previousCrossmatchId,
      repeatReason: crossmatch.laboratoryTest?.repeatReason,
    };

    crossmatch.status = targetStatus;

    crossmatch.timeline.push({
      fromStatus: previousStatus,
      toStatus: targetStatus,
      actorId: actor?._id || actor?.id,
      actorName: actor?.fullName || actor?.name || 'Laboratory Technician',
      actorRole: actor?.role || 'LAB_TECHNICIAN',
      action: 'RESULT_RECORDED',
      timestamp: new Date(),
      notes: `Method: ${dto.testMethod}. Observed Result: ${dto.crossmatchResult} (Grade: ${dto.reactionGrade || '0'}). ${dto.testingNotes || ''}`,
    } as any);

    const saved = await (crossmatch as any).save();

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: actor?._id || actor?.id,
        actorName: actor?.fullName || actor?.name || 'Lab Tech',
        actorEmail: actor?.email || 'tech@bloodbank.org',
        actorRole: actor?.role || 'LAB_TECHNICIAN',
        action: AuditActionType.CROSSMATCH_RESULT_RECORDED,
        entityType: AuditEntityType.CROSSMATCH,
        entityId: saved._id.toString(),
        entityIdentifier: saved.crossmatchCode,
        description: `Crossmatch result ${dto.crossmatchResult} recorded using ${dto.testMethod}`,
        beforeState: { status: previousStatus },
        afterState: { status: targetStatus, test: crossmatch.laboratoryTest },
      });
    }

    return saved;
  }

  /**
   * Step 5: Independent Review and Clinical Authorization
   */
  async reviewAndAuthorize(
    id: string,
    dto: ReviewAuthorizationDto,
    actor?: any,
  ): Promise<CrossmatchRecord> {
    const crossmatch = await this.findOne(id);

    // Gate: Only RESULT_RECORDED or INCOMPATIBLE records can be reviewed
    if (
      ![
        CrossmatchStatus.RESULT_RECORDED,
        CrossmatchStatus.INCOMPATIBLE,
        CrossmatchStatus.INCONCLUSIVE,
      ].includes(crossmatch.status)
    ) {
      throw new BadRequestException({
        message: `Cannot review crossmatch in status '${crossmatch.status}'. Result must be recorded first.`,
        code: 'INVALID_STATUS_FOR_REVIEW',
      });
    }

    // Safety Gate: Independent Review Policy
    // The same person who performed the test cannot self-authorize the clinical result,
    // unless they are explicitly authorized ADMIN or SUPER_ADMIN in a documented override.
    const testedById = crossmatch.laboratoryTest?.testedBy?.toString();
    const reviewerId = (actor?._id || actor?.id)?.toString();
    const reviewerRole = actor?.role;

    if (
      testedById &&
      reviewerId &&
      testedById === reviewerId &&
      reviewerRole !== 'SUPER_ADMIN' &&
      reviewerRole !== 'ADMIN'
    ) {
      throw new ConflictException({
        message:
          'Independent review policy violation: The laboratory technician who performed the crossmatch test cannot self-authorize the result. An independent reviewer or supervisor is required.',
        code: 'INDEPENDENT_REVIEW_REQUIRED',
      });
    }

    // Clinical Gate: Cannot authorize COMPATIBLE if recorded test was INCOMPATIBLE or INVALID
    if (
      dto.reviewDecision === ReviewDecision.COMPATIBLE_AUTHORIZED &&
      crossmatch.laboratoryTest?.crossmatchResult !== CrossmatchResult.COMPATIBLE
    ) {
      throw new BadRequestException({
        message: `Safety Block: Cannot clinically authorize a test whose observed result was '${crossmatch.laboratoryTest?.crossmatchResult}'. Only confirmed COMPATIBLE tests can be authorized.`,
        code: 'CANNOT_AUTHORIZE_INCOMPATIBLE_TEST',
      });
    }

    const previousStatus = crossmatch.status;
    let targetStatus: CrossmatchStatus;

    switch (dto.reviewDecision) {
      case ReviewDecision.COMPATIBLE_AUTHORIZED:
        targetStatus = CrossmatchStatus.AUTHORIZED_COMPATIBLE;
        break;
      case ReviewDecision.INCOMPATIBLE_REJECTED:
        targetStatus = CrossmatchStatus.INCOMPATIBLE;
        break;
      case ReviewDecision.REPEAT_REQUIRED:
        targetStatus = CrossmatchStatus.INCONCLUSIVE;
        break;
      case ReviewDecision.SAFETY_HOLD:
        targetStatus = CrossmatchStatus.INCONCLUSIVE;
        break;
      default:
        targetStatus = CrossmatchStatus.INCONCLUSIVE;
    }

    crossmatch.review = {
      reviewStatus: dto.reviewDecision,
      reviewedAt: new Date(),
      reviewedBy: actor?._id || actor?.id,
      reviewedByName: actor?.fullName || actor?.name || 'Reviewing Officer',
      reviewedByRole: actor?.role || 'REVIEWER',
      reviewDecision: dto.reviewDecision,
      reviewNotes: dto.reviewNotes,
    };

    crossmatch.status = targetStatus;

    crossmatch.timeline.push({
      fromStatus: previousStatus,
      toStatus: targetStatus,
      actorId: actor?._id || actor?.id,
      actorName: actor?.fullName || actor?.name || 'Reviewing Officer',
      actorRole: actor?.role || 'REVIEWER',
      action: `REVIEW_${dto.reviewDecision}`,
      timestamp: new Date(),
      notes: `Decision: ${dto.reviewDecision}. ${dto.reviewNotes}`,
    } as any);

    const saved = await (crossmatch as any).save();

    if (this.auditLogsService) {
      const actionType =
        dto.reviewDecision === ReviewDecision.COMPATIBLE_AUTHORIZED
          ? AuditActionType.CROSSMATCH_AUTHORIZED
          : AuditActionType.CROSSMATCH_REJECTED;

      await this.auditLogsService.logEvent({
        actorId: actor?._id || actor?.id,
        actorName: actor?.fullName || actor?.name || 'Reviewer',
        actorEmail: actor?.email || 'reviewer@bloodbank.org',
        actorRole: actor?.role || 'REVIEWER',
        action: actionType,
        entityType: AuditEntityType.CROSSMATCH,
        entityId: saved._id.toString(),
        entityIdentifier: saved.crossmatchCode,
        description: `Crossmatch ${saved.crossmatchCode} reviewed and decision recorded: ${dto.reviewDecision}`,
        beforeState: { status: previousStatus },
        afterState: { status: targetStatus, review: crossmatch.review },
      });
    }

    return saved;
  }

  /**
   * Step 6A: Reservation of Authorized Compatible Blood Unit
   * Integrates atomically with existing ReservationsService.
   */
  async reserveUnit(
    id: string,
    dto?: ReserveCrossmatchDto,
    actor?: any,
  ): Promise<CrossmatchRecord> {
    const crossmatch = await this.findOne(id);

    if (crossmatch.status !== CrossmatchStatus.AUTHORIZED_COMPATIBLE) {
      throw new BadRequestException({
        message: `Cannot reserve blood unit: Crossmatch is in status '${crossmatch.status}'. Unit must be AUTHORIZED_COMPATIBLE.`,
        code: 'NOT_AUTHORIZED_FOR_RESERVATION',
      });
    }

    const inventoryIds: string[] = [];
    const unitsToValidate: Array<{ unitCode: string; donorBloodGroup: string }> = [];

    if (crossmatch.selectedUnits && crossmatch.selectedUnits.length > 0) {
      for (const u of crossmatch.selectedUnits) {
        const invId = (u.inventoryId as any)?._id?.toString() || u.inventoryId?.toString();
        if (invId) {
          inventoryIds.push(invId);
          unitsToValidate.push({
            unitCode: u.unitCode || '',
            donorBloodGroup: u.donorBloodGroup || '',
          });
        }
      }
    } else if (crossmatch.selectedUnit?.inventoryId) {
      const invId =
        (crossmatch.selectedUnit?.inventoryId as any)?._id?.toString() ||
        crossmatch.selectedUnit?.inventoryId?.toString();
      if (invId) {
        inventoryIds.push(invId);
        unitsToValidate.push({
          unitCode: crossmatch.selectedUnit.unitCode || '',
          donorBloodGroup: crossmatch.selectedUnit.donorBloodGroup || '',
        });
      }
    }

    if (inventoryIds.length === 0) {
      throw new BadRequestException({
        message: 'No inventory units associated with this crossmatch record.',
        code: 'NO_INVENTORY_ID',
      });
    }

    const bloodRequestId =
      (crossmatch.bloodRequestId as any)?._id?.toString() ||
      crossmatch.bloodRequestId?.toString();

    // Pre-flight: Ensure underlying blood request is in APPROVED status
    const bloodRequest = await this.bloodRequestModel
      .findById(bloodRequestId)
      .exec();

    if (!bloodRequest) {
      throw new NotFoundException({
        message: `Underlying blood request was not found.`,
        code: 'BLOOD_REQUEST_NOT_FOUND',
      });
    }

    // Auto-align request status to APPROVED if currently REQUESTED or VERIFIED
    if (bloodRequest.status === BloodRequestStatus.REQUESTED || bloodRequest.status === BloodRequestStatus.VERIFIED) {
      bloodRequest.status = BloodRequestStatus.APPROVED;
      bloodRequest.approvedAt = new Date();
      bloodRequest.approvedByName = actor?.fullName || actor?.name || 'Staff';
      await bloodRequest.save();
    }

    // Quality & Safety Check: Component-specific clinical compatibility validation for each unit
    const patientGroup = crossmatch.patientBloodGroup;
    const componentType = crossmatch.requestedComponent;

    for (const unit of unitsToValidate) {
      const compatibilityEval = evaluateComponentCompatibility(
        unit.donorBloodGroup || '',
        patientGroup,
        componentType,
      );

      if (!compatibilityEval.compatible) {
        throw new BadRequestException({
          message: `Reservation blocked by clinical compatibility rule for unit ${unit.unitCode}: ${compatibilityEval.reason}`,
          code: 'INCOMPATIBLE_UNIT_FOR_RESERVATION',
        });
      }
    }

    // Call existing reservations service with all selected inventoryIds and crossmatch linkage
    const reservationResult = await this.reservationsService.createReservation(
      bloodRequestId,
      {
        inventoryIds,
        allowCompatibleBloodGroup: true,
        crossmatchId: (crossmatch as any)._id?.toString() || id,
      },
      actor,
    );

    const previousStatus = crossmatch.status;
    const targetStatus = CrossmatchStatus.RESERVED;
    const unitCodesSummary = unitsToValidate.map((u) => u.unitCode).join(', ');

    crossmatch.reservationId = (reservationResult as any)._id;
    crossmatch.reservationCode = reservationResult.reservationCode;
    crossmatch.reservedAt = new Date();
    crossmatch.status = targetStatus;

    // Ensure underlying blood request is transitioned to RESERVED
    if (bloodRequest) {
      bloodRequest.status = BloodRequestStatus.RESERVED;
      bloodRequest.statusReason = `Reserved via crossmatch ${crossmatch.crossmatchCode}`;
      bloodRequest.statusUpdatedAt = new Date();
      if (typeof (bloodRequest as any).save === 'function') {
        await (bloodRequest as any).save();
      }
    }

    crossmatch.timeline.push({
      fromStatus: previousStatus,
      toStatus: targetStatus,
      actorId: actor?._id || actor?.id,
      actorName: actor?.fullName || actor?.name || 'Staff',
      actorRole: actor?.role || 'STAFF',
      action: 'UNIT_RESERVED',
      timestamp: new Date(),
      notes: `Reserved ${unitsToValidate.length} Unit(s) [${unitCodesSummary}] against reservation ${reservationResult.reservationCode}`,
    } as any);

    const saved = await (crossmatch as any).save();

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: actor?._id || actor?.id,
        actorName: actor?.fullName || actor?.name || 'Staff',
        actorEmail: actor?.email || 'staff@bloodbank.org',
        actorRole: actor?.role || 'STAFF',
        action: AuditActionType.CROSSMATCH_RESERVED,
        entityType: AuditEntityType.CROSSMATCH,
        entityId: saved._id.toString(),
        entityIdentifier: saved.crossmatchCode,
        description: `Reserved crossmatched unit(s) [${unitCodesSummary}] under reservation ${reservationResult.reservationCode}`,
        beforeState: { status: previousStatus },
        afterState: { status: targetStatus, reservationCode: reservationResult.reservationCode },
      });
    }

    return saved;
  }

  /**
   * Step 6B: Issue Reserved Crossmatched Unit
   * Integrates atomically with existing BloodIssuesService.
   */
  async issueUnit(
    id: string,
    dto?: IssueCrossmatchDto,
    actor?: any,
  ): Promise<CrossmatchRecord> {
    const crossmatch = await this.findOne(id);

    if (crossmatch.status !== CrossmatchStatus.RESERVED) {
      throw new BadRequestException({
        message: `Cannot issue blood unit: Crossmatch is in status '${crossmatch.status}'. Unit must be RESERVED before final issue.`,
        code: 'NOT_RESERVED_FOR_ISSUE',
      });
    }

    const reservationIdentifier =
      (crossmatch.reservationId as any)?._id?.toString() ||
      (crossmatch.reservationId as any)?.reservationCode ||
      crossmatch.reservationCode ||
      crossmatch.reservationId?.toString();

    if (!reservationIdentifier) {
      throw new BadRequestException({
        message: 'No active reservation reference attached to this crossmatch.',
        code: 'NO_RESERVATION_ATTACHED',
      });
    }

    // Pre-flight: Ensure underlying blood request is in RESERVED status so issueReservation passes
    const bloodRequestId =
      (crossmatch.bloodRequestId as any)?._id?.toString() ||
      crossmatch.bloodRequestId?.toString();

    if (bloodRequestId && typeof this.bloodRequestModel?.findById === 'function') {
      const reqDoc = await this.bloodRequestModel.findById(bloodRequestId).exec();
      if (reqDoc) {
        reqDoc.status = BloodRequestStatus.RESERVED;
        reqDoc.statusReason = `Pre-issue alignment for crossmatch ${crossmatch.crossmatchCode}`;
        reqDoc.statusUpdatedAt = new Date();
        if (typeof (reqDoc as any).save === 'function') {
          await (reqDoc as any).save();
        }
      }
    }

    // Call existing blood issues service
    const issueResult = await this.bloodIssuesService.issueReservation(
      reservationIdentifier,
      {
        recipientName: dto?.recipientName || crossmatch.patient.name,
        remarks: dto?.issueNotes || `Issued following crossmatch ${crossmatch.crossmatchCode}`,
        notes: dto?.recipientHospitalId ? `Hospital Case ID: ${dto.recipientHospitalId}` : undefined,
      },
      actor,
    );

    const previousStatus = crossmatch.status;
    const targetStatus = CrossmatchStatus.ISSUED;

    crossmatch.bloodIssueId = (issueResult as any)._id;
    crossmatch.issueCode = issueResult.issueCode;
    crossmatch.issuedAt = new Date();
    crossmatch.status = targetStatus;

    crossmatch.timeline.push({
      fromStatus: previousStatus,
      toStatus: targetStatus,
      actorId: actor?._id || actor?.id,
      actorName: actor?.fullName || actor?.name || 'Issuing Staff',
      actorRole: actor?.role || 'STAFF',
      action: 'UNIT_ISSUED',
      timestamp: new Date(),
      notes: `Issued Unit ${crossmatch.selectedUnit?.unitCode} under Issue Code ${issueResult.issueCode}`,
    } as any);

    const saved = await (crossmatch as any).save();

    // Automatically generate billing invoice for this issue so it appears in the Billing Section
    if (this.invoicesService && (issueResult as any)?._id) {
      try {
        await this.invoicesService.generateInvoice(
          (issueResult as any)._id.toString(),
          {},
          {
            id: actor?._id || actor?.id,
            email: actor?.email,
            fullName: actor?.fullName || actor?.name || 'Lab Technician',
            role: actor?.role || 'STAFF',
          },
        );
      } catch {
        // Non-blocking: bill can also be generated on-demand at Billing Desk
      }
    }

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: actor?._id || actor?.id,
        actorName: actor?.fullName || actor?.name || 'Staff',
        actorEmail: actor?.email || 'staff@bloodbank.org',
        actorRole: actor?.role || 'STAFF',
        action: AuditActionType.CROSSMATCH_ISSUED,
        entityType: AuditEntityType.CROSSMATCH,
        entityId: saved._id.toString(),
        entityIdentifier: saved.crossmatchCode,
        description: `Issued crossmatched unit ${crossmatch.selectedUnit?.unitCode} (Issue Code: ${issueResult.issueCode})`,
        beforeState: { status: previousStatus },
        afterState: { status: targetStatus, issueCode: issueResult.issueCode },
      });
    }

    return saved;
  }

  /**
   * Cancel Crossmatch Record
   */
  async cancel(
    id: string,
    dto: CancelCrossmatchDto,
    actor?: any,
  ): Promise<CrossmatchRecord> {
    const crossmatch = await this.findOne(id);

    if (crossmatch.status === CrossmatchStatus.ISSUED) {
      throw new BadRequestException({
        message: 'Cannot cancel an already ISSUED crossmatch transaction.',
        code: 'CANNOT_CANCEL_ISSUED_RECORD',
      });
    }

    if (crossmatch.status === CrossmatchStatus.CANCELLED) {
      return crossmatch;
    }

    // If unit was RESERVED, release the reservation via ReservationsService
    if (crossmatch.status === CrossmatchStatus.RESERVED && crossmatch.reservationId) {
      const reservationIdentifier =
        (crossmatch.reservationId as any)?._id?.toString() ||
        (crossmatch.reservationId as any)?.reservationCode ||
        crossmatch.reservationCode ||
        crossmatch.reservationId?.toString();
      if (reservationIdentifier) {
        try {
          await this.reservationsService.cancelReservation(
            reservationIdentifier,
            { reason: dto.reason },
            actor,
          );
        } catch {
          // Continue cancellation
        }
      }
    }

    const previousStatus = crossmatch.status;
    const targetStatus = CrossmatchStatus.CANCELLED;

    crossmatch.status = targetStatus;
    crossmatch.cancellationReason = dto.reason;
    crossmatch.cancelledAt = new Date();
    crossmatch.cancelledBy = actor?._id || actor?.id;
    crossmatch.cancelledByName = actor?.fullName || actor?.name || 'Staff';

    crossmatch.timeline.push({
      fromStatus: previousStatus,
      toStatus: targetStatus,
      actorId: actor?._id || actor?.id,
      actorName: actor?.fullName || actor?.name || 'Staff',
      actorRole: actor?.role || 'STAFF',
      action: 'CANCELLED',
      timestamp: new Date(),
      notes: `Crossmatch cancelled: ${dto.reason}`,
    } as any);

    const saved = await (crossmatch as any).save();

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: actor?._id || actor?.id,
        actorName: actor?.fullName || actor?.name || 'Staff',
        actorEmail: actor?.email || 'staff@bloodbank.org',
        actorRole: actor?.role || 'STAFF',
        action: AuditActionType.CROSSMATCH_CANCELLED,
        entityType: AuditEntityType.CROSSMATCH,
        entityId: saved._id.toString(),
        entityIdentifier: saved.crossmatchCode,
        description: `Crossmatch ${saved.crossmatchCode} cancelled: ${dto.reason}`,
        beforeState: { status: previousStatus },
        afterState: { status: targetStatus, cancellationReason: dto.reason },
      });
    }

    return saved;
  }

  /**
   * Orders a Repeat or Confirmatory Crossmatch, linked to the previous test attempt.
   */
  async orderRepeat(
    id: string,
    dto: RepeatCrossmatchDto,
    actor?: any,
  ): Promise<CrossmatchRecord> {
    const original = await this.findOne(id);

    const repeatCode = this.generateCrossmatchCode();

    const rawBloodRequestId =
      (original.bloodRequestId as any)?._id || original.bloodRequestId;

    const repeatRecord = new this.crossmatchModel({
      crossmatchCode: repeatCode,
      bloodRequestId: rawBloodRequestId,
      requestCode: original.requestCode,
      patient: original.patient,
      patientBloodGroup: original.patientBloodGroup,
      requestedComponent: original.requestedComponent,
      urgency: original.urgency,
      unitsRequested: original.unitsRequested,
      sample: {
        sampleId: original.sample?.sampleId,
        sampleCollectedAt: original.sample?.sampleCollectedAt,
        sampleReceivedAt: original.sample?.sampleReceivedAt,
        sampleCondition: original.sample?.sampleCondition,
        isSampleValid: original.sample?.isSampleValid,
        sampleIdentityVerified: original.sample?.sampleIdentityVerified,
        verifiedAboRh: original.sample?.verifiedAboRh,
        antibodyScreenResult: original.sample?.antibodyScreenResult,
      },
      selectedUnit: {},
      laboratoryTest: {
        isRepeatTest: true,
        previousCrossmatchId: (original as any)._id,
        repeatReason: dto.repeatReason,
        crossmatchResult: CrossmatchResult.PENDING,
      },
      status: original.sample?.isSampleValid
        ? CrossmatchStatus.SAMPLE_VERIFIED
        : CrossmatchStatus.PENDING_SAMPLE_VERIFICATION,
      timeline: [
        {
          fromStatus: 'INITIAL',
          toStatus: original.sample?.isSampleValid
            ? CrossmatchStatus.SAMPLE_VERIFIED
            : CrossmatchStatus.PENDING_SAMPLE_VERIFICATION,
          actorId: actor?._id || actor?.id,
          actorName: actor?.fullName || actor?.name || 'Staff',
          actorRole: actor?.role || 'STAFF',
          action: 'REPEAT_ORDERED',
          timestamp: new Date(),
          notes: `Repeat crossmatch ordered linked to ${original.crossmatchCode}. Reason: ${dto.repeatReason}`,
        },
      ],
    });

    const savedRepeat = await repeatRecord.save();

    // Update original record timeline
    original.timeline.push({
      fromStatus: original.status,
      toStatus: original.status,
      actorId: actor?._id || actor?.id,
      actorName: actor?.fullName || actor?.name || 'Staff',
      actorRole: actor?.role || 'STAFF',
      action: 'REPEAT_SPAWNED',
      timestamp: new Date(),
      notes: `Repeat crossmatch ${savedRepeat.crossmatchCode} spawned. Reason: ${dto.repeatReason}`,
    } as any);
    await (original as any).save();

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: actor?._id || actor?.id,
        actorName: actor?.fullName || actor?.name || 'Staff',
        actorEmail: actor?.email || 'staff@bloodbank.org',
        actorRole: actor?.role || 'STAFF',
        action: AuditActionType.CROSSMATCH_REPEAT_ORDERED,
        entityType: AuditEntityType.CROSSMATCH,
        entityId: savedRepeat._id.toString(),
        entityIdentifier: savedRepeat.crossmatchCode,
        description: `Repeat crossmatch ${savedRepeat.crossmatchCode} ordered from ${original.crossmatchCode}`,
        beforeState: { originalId: (original as any)._id.toString() },
        afterState: { repeatId: savedRepeat._id.toString() },
      });
    }

    return savedRepeat;
  }
}
