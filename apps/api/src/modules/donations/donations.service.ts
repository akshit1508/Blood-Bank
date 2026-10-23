import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import { Donation, DonationDocument } from './schemas/donation.schema';
import { Donor, DonorDocument } from '../donors/schemas/donor.schema';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationStatusDto } from './dto/update-donation-status.dto';
import {
  ALLOWED_DONATION_STATUS_TRANSITIONS,
  DonationStatus,
  DonationType,
} from './constants/donation.constants';
import { BloodGroup, DonorStatus } from '../donors/constants/donor.constants';
import {
  getWholeBloodIntervalDays,
  getCalendarDaysDifference,
  calculateNextEligibleDate,
} from '../../common/constants/eligibility.constants';
import { DonorEligibilityService } from '../donors/services/donor-eligibility.service';
import { RecordCollectionDto } from './dto/record-collection.dto';
import {
  DonorScreening,
  DonorScreeningDocument,
} from '../donors/schemas/donor-screening.schema';
import {
  DonorScreeningDecision,
  BagType,
  CollectionOutcome,
  AdverseReactionType,
  BagIntegrity,
  CLINICAL_SCREENING_THRESHOLDS,
} from '../donors/constants/screening.constants';
import {
  BloodUnit,
  BloodUnitDocument,
} from '../blood-units/schemas/blood-unit.schema';
import {
  BloodUnitStatus,
  BloodUnitComponent,
} from '../blood-units/constants/blood-unit.constants';
import {
  BloodTesting,
  BloodTestingDocument,
} from '../testing/schemas/blood-testing.schema';
import {
  TestingDecision,
  TestingStatus,
  TestResultStatus,
} from '../testing/constants/testing.constants';
import { ExpiryRulesService } from '../inventory/services/expiry-rules.service';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditActionType, AuditEntityType } from '../audit-logs/constants/audit-log.constants';

export interface PaginatedDonations {
  items: Donation[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class DonationsService {
  constructor(
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
    @InjectModel(Donor.name)
    private readonly donorModel: Model<DonorDocument>,
    @Optional()
    @InjectModel(DonorScreening.name)
    private readonly donorScreeningModel?: Model<DonorScreeningDocument>,
    @Optional()
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel?: Model<BloodUnitDocument>,
    @Optional()
    @InjectModel(BloodTesting.name)
    private readonly bloodTestingModel?: Model<BloodTestingDocument>,
    @Optional()
    private readonly auditLogsService?: AuditLogsService,
    @Optional()
    private readonly donorEligibilityService?: DonorEligibilityService,
    @Optional()
    private readonly expiryRulesService?: ExpiryRulesService,
  ) {}

  /**
   * Generates a unique server-side blood bag barcode identifier.
   * Format: BAG-YYYYMMDD-XXXX (e.g. BAG-20261023-K72L)
   */
  private generateBagBarcode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BAG-${datePart}-${randomPart}`;
  }

  /**
   * Generates a unique server-side physical blood unit code.
   * Format: UNIT-YYYYMMDD-XXXX
   */
  private generateUnitCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `UNIT-${datePart}-${randomPart}`;
  }

  /**
   * Generates a unique server-side donation code.
   * Format: DONATION-YYYYMMDD-XXXX (e.g. DONATION-20261007-A8F3)
   */
  private generateDonationCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `DONATION-${datePart}-${randomPart}`;
  }

  /**
   * Records a physical blood donation event by an existing donor.
   * Validates that the referenced donor exists.
   * Enforces initial status: RECORDED.
   */
  async create(createDto: CreateDonationDto, actor?: any): Promise<Donation> {
    if (!isValidObjectId(createDto.donorId)) {
      throw new BadRequestException('Invalid donor ID format');
    }

    const donor = await this.donorModel.findById(createDto.donorId).exec();
    if (!donor) {
      throw new NotFoundException(
        `Donor with ID '${createDto.donorId}' was not found. Donation can only be recorded for existing registered donors.`,
      );
    }

    // Authoritative Eligibility Gate
    if (this.donorEligibilityService) {
      await this.donorEligibilityService.validateEligibility(
        donor,
        createDto.donationDate,
        createDto.donationType,
      );
    } else {
      if (donor.status === DonorStatus.PENDING_REVIEW) {
        throw new BadRequestException(
          'Donor requires review before a donation can be recorded.',
        );
      }

      if (donor.status === DonorStatus.INACTIVE) {
        throw new BadRequestException('Donor is inactive.');
      }

      // 1. Future date validation
      const donationDateTime = new Date(createDto.donationDate);
      if (isNaN(donationDateTime.getTime())) {
        throw new BadRequestException('Invalid donation date provided');
      }
      const now = new Date();
      // Allow up to 2 minutes clock skew
      if (donationDateTime.getTime() > now.getTime() + 120 * 1000) {
        throw new BadRequestException('Donation date cannot be in the future.');
      }

      // 2. Donation interval validation for WHOLE_BLOOD
      const resolvedDonationType =
        createDto.donationType || DonationType.WHOLE_BLOOD;
      if (resolvedDonationType === DonationType.WHOLE_BLOOD) {
        const lastCompletedDonation = await this.donationModel
          .findOne({
            donorId: donor._id,
            donationType: DonationType.WHOLE_BLOOD,
            status: DonationStatus.COMPLETED,
          })
          .sort({ donationDate: -1 })
          .exec();

        if (lastCompletedDonation) {
          const intervalDays = getWholeBloodIntervalDays(donor.gender);
          const lastDate = new Date(lastCompletedDonation.donationDate);
          const daysElapsed = getCalendarDaysDifference(lastDate, donationDateTime);

          if (daysElapsed < intervalDays) {
            const nextEligibleDate = calculateNextEligibleDate(
              lastDate,
              donor.gender,
            );
            const remainingDays = intervalDays - daysElapsed;
            throw new BadRequestException({
              message:
                'This donor is not yet eligible for another whole-blood donation.',
              code: 'DONATION_INTERVAL_NOT_COMPLETED',
              lastDonationDate: lastDate.toISOString().slice(0, 10),
              nextEligibleDate: nextEligibleDate.toISOString().slice(0, 10),
              remainingDays,
            });
          }
        }
      }
    }

    let donationCode = this.generateDonationCode();
    let attempts = 0;
    while (await this.donationModel.exists({ donationCode })) {
      donationCode = this.generateDonationCode();
      attempts++;
      if (attempts > 5) {
        donationCode = `DONATION-${Date.now()}`;
        break;
      }
    }

    const donationData: any = {
      donationCode,
      donorId: new Types.ObjectId(createDto.donorId),
      donationDate: new Date(createDto.donationDate),
      donationType: createDto.donationType || DonationType.WHOLE_BLOOD,
      quantity: createDto.quantity,
      status: DonationStatus.RECORDED,
      campaignId: createDto.campaignId ? new Types.ObjectId(createDto.campaignId) : undefined,
      campaignCode: createDto.campaignCode?.trim() || undefined,
      notes: createDto.notes?.trim() || undefined,
    };

    if (actor && actor.id) {
      donationData.recordedBy = actor.id;
      donationData.recordedByName = actor.fullName;
      donationData.recordedByRole = actor.role;
    }

    const donation = new this.donationModel(donationData);
    const saved = await donation.save();

    if (actor && actor.id) {
      await this.auditLogsService?.logEvent({
        actor,
        action: AuditActionType.DONATION_RECORDED,
        entityType: AuditEntityType.DONATION,
        entityId: saved._id.toString(),
        entityIdentifier: saved.donationCode,
        description: `Staff recorded blood donation ${saved.donationCode} (${saved.quantity} units of ${saved.donationType}) for donor ${(donor as any).fullName}`,
        afterState: { donationCode: saved.donationCode, donorId: saved.donorId, quantity: saved.quantity, status: saved.status },
      });
    }

    return await saved.populate('donorId');
  }

  /**
   * Authoritative Blood Collection & Phlebotomy workflow (Phase 2).
   *
   * Medical & Integrity Invariants:
   * 1. Donor exists and passes baseline eligibility (age, status, interval, deferrals).
   * 2. Mandatory Screening Gate: Donor must have an approved (SELECTED) pre-donation screening record.
   * 3. Generates unique donationCode and unique bagBarcode.
   * 4. Determines bag volume and collection outcome.
   * 5. Links screening record and transitions screening collectionStatus -> 'COLLECTED'.
   * 6. Downstream physical BloodUnit creation in TESTING status (or REJECTED if leakage/clotting).
   * 7. Enrolls unit in central Laboratory Testing pipeline (starts PENDING).
   * 8. Generates printable bag label metadata with barcode / component specifications.
   * 9. Audit event logged with phlebotomist attribution.
   */
  async recordBloodCollection(
    dto: RecordCollectionDto,
    actor?: any,
  ): Promise<{
    message: string;
    donation: Donation;
    bloodUnit?: BloodUnit;
    screening: any;
    label: {
      bagBarcode: string;
      unitCode: string;
      donationCode: string;
      donorCode: string;
      donorName: string;
      bloodGroup: string;
      componentType: string;
      volumeMl: number;
      bagType: string;
      collectionDate: string;
      expiryDate?: string;
      collectionLocation: string;
      centreName: string;
    };
  }> {
    if (!isValidObjectId(dto.donorId)) {
      throw new BadRequestException({
        message: 'Invalid donor ID format',
        code: 'INVALID_DONOR_REFERENCE',
      });
    }

    const donor = await this.donorModel.findById(dto.donorId).exec();
    if (!donor) {
      throw new NotFoundException({
        message: `Donor with ID '${dto.donorId}' was not found.`,
        code: 'DONOR_NOT_FOUND',
      });
    }

    const now = new Date();
    const collectionDate = dto.donationDate ? new Date(dto.donationDate) : now;
    const resolvedDonationType = dto.donationType || DonationType.WHOLE_BLOOD;

    // 1. Authoritative Eligibility Check
    if (this.donorEligibilityService) {
      await this.donorEligibilityService.validateEligibility(
        donor,
        collectionDate,
        resolvedDonationType,
      );
    }

    // 2. Mandatory Clinical Screening Gate
    let screening: any = null;
    if (dto.screeningId && isValidObjectId(dto.screeningId)) {
      if (this.donorScreeningModel) {
        screening = await this.donorScreeningModel.findById(dto.screeningId).exec();
      }
    } else if (this.donorScreeningModel) {
      const startOfDay = new Date(Date.UTC(collectionDate.getUTCFullYear(), collectionDate.getUTCMonth(), collectionDate.getUTCDate(), 0, 0, 0));
      screening = await this.donorScreeningModel
        .findOne({
          donorId: donor._id,
          decision: DonorScreeningDecision.SELECTED,
          collectionStatus: 'PENDING_COLLECTION',
          createdAt: { $gte: startOfDay },
        })
        .sort({ createdAt: -1 })
        .exec();
    }

    if (!screening || screening.decision !== DonorScreeningDecision.SELECTED) {
      throw new BadRequestException({
        message: `Blood collection blocked: Donor '${donor.fullName}' (${donor.donorCode}) does not have an approved (SELECTED) pre-donation screening record. Complete screening examination before collection.`,
        code: 'SCREENING_APPROVAL_REQUIRED',
      });
    }

    if (screening.collectionStatus === 'COLLECTED') {
      throw new BadRequestException({
        message: `Blood collection blocked: Screening '${screening.screeningCode}' has already been used for collection. Each donation requires a fresh clinical screening.`,
        code: 'SCREENING_ALREADY_USED',
      });
    }

    if (
      screening.vitals &&
      screening.vitals.weightKg < CLINICAL_SCREENING_THRESHOLDS.MIN_WEIGHT_450ML_KG &&
      dto.collectedVolumeMl &&
      dto.collectedVolumeMl > 350
    ) {
      throw new BadRequestException({
        message: `Safety Invariant: Donor weight is ${screening.vitals.weightKg} kg (< 50 kg). Maximum allowable collection volume is 350 mL per NBTC transfusion regulations.`,
        code: 'COLLECTION_VOLUME_EXCEEDS_WEIGHT_LIMIT',
      });
    }

    // 3. Unique Identifiers
    let donationCode = this.generateDonationCode();
    while (await this.donationModel.exists({ donationCode })) {
      donationCode = this.generateDonationCode();
    }

    let bagBarcode = this.generateBagBarcode();
    while (await this.donationModel.exists({ bagBarcode })) {
      bagBarcode = this.generateBagBarcode();
    }

    // 4. Resolve Collection Parameters
    const resolvedBagType = dto.bagType || BagType.SINGLE_350ML;
    const defaultVolume = resolvedBagType.includes('450') ? 450 : 350;
    const collectedVolume = dto.collectedVolumeMl || defaultVolume;

    const isBagProblem =
      dto.bagIntegrity === BagIntegrity.LEAKING ||
      dto.bagIntegrity === BagIntegrity.CLOTTED ||
      dto.bagIntegrity === BagIntegrity.DEFECTIVE;
    const isUnsuccessful =
      dto.collectionOutcome === CollectionOutcome.UNSUCCESSFUL_VENIPUNCTURE ||
      dto.collectionOutcome === CollectionOutcome.DISCARDED_AT_COLLECTION;

    let targetDonationStatus = DonationStatus.COMPLETED;
    let cancellationReason: string | undefined;

    if (isBagProblem || isUnsuccessful) {
      targetDonationStatus = DonationStatus.CANCELLED;
      cancellationReason = isBagProblem
        ? `Bag integrity failure: ${dto.bagIntegrity}`
        : `Abnormal collection outcome: ${dto.collectionOutcome}`;
    }

    // 5. Create Donation Document
    const donation = new this.donationModel({
      donationCode,
      donorId: donor._id,
      donationDate: collectionDate,
      donationType: resolvedDonationType,
      quantity: 1,
      status: targetDonationStatus,
      campaignId: dto.campaignId ? new Types.ObjectId(dto.campaignId) : undefined,
      notes: dto.notes?.trim() || undefined,
      screeningId: screening._id,
      screeningCode: screening.screeningCode,
      bagBarcode,
      bagType: resolvedBagType,
      collectedVolumeMl: collectedVolume,
      venipunctureSite: dto.venipunctureSite || 'RIGHT_ANTECUBITAL',
      collectionOutcome: dto.collectionOutcome || CollectionOutcome.SUCCESSFUL,
      adverseReaction: dto.adverseReaction || AdverseReactionType.NONE,
      adverseReactionNotes: dto.adverseReactionNotes?.trim() || undefined,
      bagIntegrity: dto.bagIntegrity || BagIntegrity.INTACT,
      collectionLocation: dto.collectionLocation || 'Main Blood Centre - Phlebotomy Room',
      phlebotomistId: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : undefined,
      phlebotomistName: actor?.fullName || actor?.name || 'Staff Phlebotomist',
      phlebotomistRole: actor?.role || 'PHLEBOTOMIST',
      collectionStartedAt: new Date(collectionDate.getTime() - 15 * 60 * 1000), // ~15 mins collection time
      collectionEndedAt: collectionDate,
      recordedBy: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : undefined,
      recordedByName: actor?.fullName || actor?.name || 'Staff Phlebotomist',
      recordedByRole: actor?.role || 'PHLEBOTOMIST',
      cancellationReason,
      cancelledAt: targetDonationStatus === DonationStatus.CANCELLED ? new Date() : undefined,
      completedAt: targetDonationStatus === DonationStatus.COMPLETED ? collectionDate : undefined,
    });

    const savedDonation = await donation.save();

    // 6. Update Screening Record
    screening.collectionStatus = 'COLLECTED';
    screening.linkedDonationId = savedDonation._id;
    screening.linkedDonationCode = savedDonation.donationCode;
    await screening.save();

    // 7. Downstream Physical BloodUnit Creation
    let savedUnit: any = null;
    let calculatedExpiry: Date | undefined;

    if (this.bloodUnitModel) {
      let unitCode = this.generateUnitCode();
      while (await this.bloodUnitModel.exists({ unitCode })) {
        unitCode = this.generateUnitCode();
      }

      if (this.expiryRulesService) {
        calculatedExpiry = await this.expiryRulesService.calculateExpiryDate(
          collectionDate,
          BloodUnitComponent.WHOLE_BLOOD,
        );
      } else {
        calculatedExpiry = new Date(collectionDate.getTime() + 35 * 24 * 60 * 60 * 1000);
      }

      const unitStatus =
        isBagProblem || isUnsuccessful
          ? BloodUnitStatus.REJECTED
          : BloodUnitStatus.TESTING;

      const bloodUnit = new this.bloodUnitModel({
        unitCode,
        donationId: savedDonation._id,
        donorId: donor._id,
        campaignId: dto.campaignId ? new Types.ObjectId(dto.campaignId) : undefined,
        bloodGroup: donor.bloodGroup,
        componentType: BloodUnitComponent.WHOLE_BLOOD,
        volume: collectedVolume,
        collectionDate,
        expiryDate: calculatedExpiry,
        status: unitStatus,
        bagBarcode,
        bagType: resolvedBagType,
        bagIntegrity: dto.bagIntegrity || BagIntegrity.INTACT,
        collectionOutcome: dto.collectionOutcome || CollectionOutcome.SUCCESSFUL,
        storageLocation: 'COLLECTION_QUARANTINE_REFRIGERATOR_1',
        createdBy: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : undefined,
        createdByName: actor?.fullName || actor?.name || 'Staff Phlebotomist',
        createdByRole: actor?.role || 'PHLEBOTOMIST',
      });

      savedUnit = await bloodUnit.save();
    }

    // 8. Enroll in Central Laboratory Testing Pipeline
    if (this.bloodTestingModel && savedUnit) {
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const testCode = `TEST-${datePart}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const isRejected = savedUnit.status === BloodUnitStatus.REJECTED;

      const initialTestResults = [
        { testCode: 'HIV', testName: 'HIV 1 & 2 Antibody / Antigen Screen' },
        { testCode: 'HBV', testName: 'Hepatitis B Surface Antigen (HBsAg)' },
        { testCode: 'HCV', testName: 'Hepatitis C Antibody Screen (Anti-HCV)' },
        { testCode: 'SYPHILIS', testName: 'Syphilis Serology (VDRL / RPR / TPHA)' },
        { testCode: 'MALARIA', testName: 'Malaria Antigen / Smear Screen' },
      ].map((def) => ({
        testCode: def.testCode,
        testName: def.testName,
        status: isRejected ? TestResultStatus.FAIL : TestResultStatus.PENDING,
        testedAt: isRejected ? now : undefined,
      }));

      const testingRecord = new this.bloodTestingModel({
        testingCode: testCode,
        bloodUnitId: savedUnit._id,
        donationId: savedDonation._id,
        donorId: donor._id,
        campaignId: dto.campaignId ? new Types.ObjectId(dto.campaignId) : undefined,
        testResults: initialTestResults,
        status: isRejected ? TestingStatus.COMPLETED : TestingStatus.IN_PROGRESS,
        decision: isRejected ? TestingDecision.REJECTED : TestingDecision.PENDING,
        startedAt: now,
        startedBy: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : undefined,
        startedByName: actor?.fullName || actor?.name || 'Staff Phlebotomist',
        startedByRole: actor?.role || 'PHLEBOTOMIST',
        completedAt: isRejected ? now : undefined,
        rejectionReason: isRejected ? cancellationReason : undefined,
        remarks: isRejected
          ? `Discarded at phlebotomy: ${cancellationReason}`
          : 'Enrolled in central laboratory testing pipeline',
      });

      await testingRecord.save();
    }

    // 9. Audit Log
    if (this.auditLogsService && (actor?._id || actor?.id)) {
      this.auditLogsService
        .logEvent({
          actorId: actor._id || actor.id,
          actorName: actor.fullName || actor.name,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: AuditActionType.DONATION_RECORDED,
          entityType: AuditEntityType.DONATION,
          entityId: savedDonation._id.toString(),
          entityIdentifier: savedDonation.donationCode,
          description: `Blood collection recorded (${bagBarcode}, ${collectedVolume}mL ${resolvedBagType}) for donor ${donor.fullName} (${donor.donorCode})`,
          afterState: {
            donationCode: savedDonation.donationCode,
            bagBarcode,
            unitCode: savedUnit?.unitCode,
            status: targetDonationStatus,
          },
        })
        .catch(() => null);
    }

    // 10. Printable Blood Bag Label Metadata
    const printableLabel = {
      bagBarcode,
      unitCode: savedUnit ? savedUnit.unitCode : 'N/A',
      donationCode: savedDonation.donationCode,
      donorCode: donor.donorCode,
      donorName: donor.fullName,
      bloodGroup: donor.bloodGroup,
      componentType: 'WHOLE_BLOOD',
      volumeMl: collectedVolume,
      bagType: resolvedBagType,
      collectionDate: collectionDate.toISOString().slice(0, 10),
      expiryDate: calculatedExpiry ? calculatedExpiry.toISOString().slice(0, 10) : undefined,
      collectionLocation: dto.collectionLocation || 'Main Blood Centre - Phlebotomy Room',
      centreName: 'LifeFlow Standalone Blood Centre',
    };

    return {
      message:
        targetDonationStatus === DonationStatus.COMPLETED
          ? `Blood collection completed successfully. Bag barcode: ${bagBarcode}, Unit: ${savedUnit?.unitCode || 'Enrolled'}.`
          : `Blood collection cancelled due to ${cancellationReason}. Bag: ${bagBarcode}.`,
      donation: savedDonation,
      bloodUnit: savedUnit,
      screening,
      label: printableLabel,
    };
  }

  /**
   * Retrieves paginated donations with search (donationCode, donor details)
   * and filtering by status, blood group, or donation type.
   */
  async findAll(query?: {
    donorId?: string;
    search?: string;
    status?: DonationStatus;
    bloodGroup?: BloodGroup;
    donationType?: DonationType;
    page?: number;
    limit?: number;
  }): Promise<PaginatedDonations> {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query?.donorId) {
      if (!isValidObjectId(query.donorId)) {
        throw new BadRequestException('Invalid donor ID format');
      }
      filter.donorId = new Types.ObjectId(query.donorId);
    }

    if (query?.status) {
      filter.status = query.status;
    }

    if (query?.donationType) {
      filter.donationType = query.donationType;
    }

    // If filtering by donor bloodGroup or searching donor fields, find matching donor IDs first
    let matchingDonorIds: Types.ObjectId[] | null = null;

    if (query?.bloodGroup || query?.search) {
      const donorFilter: Record<string, any> = {};

      if (query?.bloodGroup) {
        donorFilter.bloodGroup = query.bloodGroup;
      }

      if (query?.search && query.search.trim()) {
        const searchRegex = new RegExp(query.search.trim(), 'i');
        donorFilter.$or = [
          { fullName: searchRegex },
          { donorCode: searchRegex },
          { phone: searchRegex },
        ];
      }

      const matchingDonors = await this.donorModel
        .find(donorFilter, { _id: 1 })
        .exec();
      matchingDonorIds = matchingDonors.map((d) => d._id as Types.ObjectId);

      if (query.search && query.search.trim()) {
        // Search could also match donationCode directly
        const searchRegex = new RegExp(query.search.trim(), 'i');
        const searchOr = [
          { donationCode: searchRegex },
          { donorId: { $in: matchingDonorIds } },
        ];
        if (filter.donorId) {
          filter.$and = [{ donorId: filter.donorId }, { $or: searchOr }];
          delete filter.donorId;
        } else {
          filter.$or = searchOr;
        }
      } else {
        if (!filter.donorId) {
          filter.donorId = { $in: matchingDonorIds };
        }
      }
    }

    const [items, total] = await Promise.all([
      this.donationModel
        .find(filter)
        .populate('donorId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.donationModel.countDocuments(filter).exec(),
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
   * Finds a single donation by MongoDB _id or donationCode.
   */
  async findOne(identifier: string): Promise<Donation> {
    let donation: Donation | null = null;

    if (isValidObjectId(identifier)) {
      donation = await this.donationModel
        .findById(identifier)
        .populate('donorId')
        .exec();
    }

    if (!donation) {
      donation = await this.donationModel
        .findOne({ donationCode: identifier.toUpperCase() })
        .populate('donorId')
        .exec();
    }

    if (!donation) {
      throw new NotFoundException(
        `Donation with identifier '${identifier}' was not found`,
      );
    }

    return donation;
  }

  /**
   * Updates donation status enforcing strict state machine transitions.
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateDonationStatusDto,
    actor?: any,
  ): Promise<Donation> {
    const donation = await this.findOne(id);
    const currentStatus = donation.status;
    const targetStatus = updateStatusDto.status;

    if (currentStatus === targetStatus) {
      return donation;
    }

    const allowedNextStatuses =
      ALLOWED_DONATION_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedNextStatuses.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid donation status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions are: [${allowedNextStatuses.join(
          ', ',
        )}]`,
      );
    }

    const updateFields: any = { status: targetStatus };
    if (actor && actor.id) {
      if (targetStatus === DonationStatus.PROCESSING) {
        updateFields.processedBy = actor.id;
        updateFields.processedByName = actor.fullName;
      } else if (targetStatus === DonationStatus.COMPLETED) {
        updateFields.completedBy = actor.id;
        updateFields.completedByName = actor.fullName;
        updateFields.completedAt = new Date();
      } else if (targetStatus === DonationStatus.CANCELLED) {
        updateFields.cancelledBy = actor.id;
        updateFields.cancelledByName = actor.fullName;
        updateFields.cancelledAt = new Date();
      }
    }

    const updated = await this.donationModel
      .findByIdAndUpdate(
        (donation as any)._id,
        { $set: updateFields },
        { new: true },
      )
      .populate('donorId')
      .exec();

    if (!updated) {
      throw new NotFoundException(
        `Donation with identifier '${id}' was not found during update`,
      );
    }

    if (actor && actor.id) {
      await this.auditLogsService?.logEvent({
        actor,
        action: targetStatus === DonationStatus.CANCELLED ? AuditActionType.DONATION_CANCELLED : AuditActionType.DONATION_STATUS_CHANGED,
        entityType: AuditEntityType.DONATION,
        entityId: (updated as any)._id.toString(),
        entityIdentifier: updated.donationCode,
        description: `Staff transitioned donation ${updated.donationCode} from ${currentStatus} to ${targetStatus}`,
        beforeState: { status: currentStatus },
        afterState: { status: targetStatus },
      });
    }

    return updated;
  }
}
