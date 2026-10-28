import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  ReplacementDonation,
  ReplacementDonationDocument,
} from './schemas/replacement-donation.schema';
import {
  ReplacementTrackingStatus,
  ReplacementDonorRelationship,
  ACTIVE_TRACKING_STATUSES,
} from './constants/replacement-donation.constants';
import {
  CreateReplacementTrackingDto,
  AssociateDonorDto,
  LinkDonationDto,
  CancelReplacementTrackingDto,
  UpdateReplacementTrackingNotesDto,
  QueryReplacementDonationsDto,
} from './dto/replacement-donation.dto';
import {
  BloodRequest,
  BloodRequestDocument,
} from '../../blood-requests/schemas/blood-request.schema';
import { Donor, DonorDocument } from '../donors/schemas/donor.schema';
import { DonorsService } from '../donors/donors.service';
import { Donation, DonationDocument } from '../donations/schemas/donation.schema';
import {
  BloodUnit,
  BloodUnitDocument,
} from '../blood-units/schemas/blood-unit.schema';
import { BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import {
  CrossmatchRecord,
  CrossmatchRecordDocument,
} from '../crossmatching/schemas/crossmatch-record.schema';
import {
  BloodIssue,
  BloodIssueDocument,
} from '../blood-issues/schemas/blood-issue.schema';
import {
  BloodIssueInvoice,
  BloodIssueInvoiceDocument,
} from '../billing/schemas/blood-issue-invoice.schema';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AuditActionType,
  AuditEntityType,
} from '../audit-logs/constants/audit-log.constants';

export interface StaffActor {
  id?: string;
  fullName?: string;
  email?: string;
  role?: string;
}

@Injectable()
export class ReplacementDonationsService {
  private readonly logger = new Logger(ReplacementDonationsService.name);

  constructor(
    @InjectModel(ReplacementDonation.name)
    private readonly replacementModel: Model<ReplacementDonationDocument>,
    @InjectModel(BloodRequest.name)
    private readonly bloodRequestModel: Model<BloodRequestDocument>,
    @InjectModel(Donor.name)
    private readonly donorModel: Model<DonorDocument>,
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel: Model<BloodUnitDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(CrossmatchRecord.name)
    private readonly crossmatchModel: Model<CrossmatchRecordDocument>,
    @InjectModel(BloodIssue.name)
    private readonly bloodIssueModel: Model<BloodIssueDocument>,
    @InjectModel(BloodIssueInvoice.name)
    private readonly invoiceModel: Model<BloodIssueInvoiceDocument>,
    private readonly donorsService: DonorsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Generates a unique tracking code: RPL-YYYYMMDD-XXXX
   */
  private generateTrackingCode(): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = randomBytes(2).toString('hex').toUpperCase();
    return `RPL-${dateStr}-${randomHex}`;
  }

  /**
   * Create a new Replacement Tracking record linked to an existing Blood Request.
   */
  async createTrackingCase(
    dto: CreateReplacementTrackingDto,
    actor?: StaffActor,
  ): Promise<ReplacementDonation> {
    if (!isValidObjectId(dto.bloodRequestId)) {
      throw new BadRequestException('Invalid bloodRequestId');
    }

    const bloodRequest = await this.bloodRequestModel.findById(dto.bloodRequestId);
    if (!bloodRequest) {
      throw new NotFoundException(
        `Blood request with ID ${dto.bloodRequestId} not found`,
      );
    }

    let donor: DonorDocument | null = null;

    if (dto.donorId) {
      if (!isValidObjectId(dto.donorId)) {
        throw new BadRequestException('Invalid donorId');
      }
      donor = await this.donorModel.findById(dto.donorId);
      if (!donor) {
        throw new NotFoundException(`Donor with ID ${dto.donorId} not found`);
      }
    } else if (dto.newDonor) {
      // Register new donor through existing DonorsService to ensure duplicate check
      const createdRes = await this.donorsService.create(
        dto.newDonor,
        actor as any,
      );
      donor = await this.donorModel.findOne({ donorCode: createdRes.donorCode });
    } else {
      throw new BadRequestException(
        'Either donorId or newDonor payload must be provided to associate a donor',
      );
    }

    if (!donor) {
      throw new BadRequestException('Could not resolve donor record');
    }

    // Check if this donor is already associated with this blood request and active
    const existingActiveAssociation = await this.replacementModel.findOne({
      bloodRequestId: bloodRequest._id,
      donorId: donor._id,
      status: { $in: ACTIVE_TRACKING_STATUSES },
    });

    if (existingActiveAssociation) {
      throw new ConflictException(
        `Donor ${donor.fullName} (${donor.donorCode}) is already actively associated with request ${bloodRequest.requestCode} under tracking ${existingActiveAssociation.trackingCode}`,
      );
    }

    // Determine initial status based on donor eligibility
    let initialStatus = ReplacementTrackingStatus.DONOR_ASSOCIATED;
    let initialDesc = `Donor ${donor.fullName} (${donor.donorCode}) associated with blood request ${bloodRequest.requestCode}`;

    if (donor.deferralStatus && donor.deferralStatus !== 'NONE') {
      initialStatus = ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED;
      initialDesc = `Associated donor ${donor.fullName} is currently deferred (${donor.deferralStatus}). Flagged for replacement review.`;
    }

    const trackingCode = this.generateTrackingCode();

    const timelineEvent = {
      event: 'CASE_CREATED',
      status: initialStatus,
      description: initialDesc,
      actorId: actor?.id || undefined,
      actorName: actor?.fullName || 'Staff',
      actorRole: actor?.role || 'STAFF',
      timestamp: new Date(),
    };

    const newRecord = new this.replacementModel({
      trackingCode,
      bloodRequestId: bloodRequest._id,
      requestCode: bloodRequest.requestCode,
      patientName: bloodRequest.patient?.name || 'Unknown Patient',
      patientBloodGroup: bloodRequest.bloodGroup,
      patientPhone: bloodRequest.patient?.phone || bloodRequest.contactPerson?.phone,
      donorId: donor._id,
      donorCode: donor.donorCode,
      donorName: donor.fullName,
      donorBloodGroup: donor.bloodGroup,
      donorPhone: donor.phone,
      relationshipToPatient:
        dto.relationshipToPatient || ReplacementDonorRelationship.FAMILY,
      status: initialStatus,
      notes: dto.notes || undefined,
      timeline: [timelineEvent],
      createdById: actor?.id && isValidObjectId(actor.id) ? new Types.ObjectId(actor.id) : undefined,
      createdByName: actor?.fullName || 'Staff',
      createdByRole: actor?.role || 'STAFF',
    });

    const saved = await newRecord.save();

    // Central Audit Logging
    await this.auditLogsService.logEvent({
      action: AuditActionType.REPLACEMENT_TRACKING_CREATED as any,
      entityType: AuditEntityType.REPLACEMENT_TRACKING as any,
      entityId: saved._id.toString(),
      entityIdentifier: saved.trackingCode,
      description: `Created replacement tracking case ${saved.trackingCode} for request ${bloodRequest.requestCode} with donor ${donor.donorCode}`,
      actor: actor
        ? {
            id: actor.id || '',
            fullName: actor.fullName || 'Staff',
            email: actor.email || '',
            role: actor.role || 'STAFF',
          }
        : undefined,
      afterState: {
        trackingCode: saved.trackingCode,
        requestCode: saved.requestCode,
        donorCode: saved.donorCode,
        status: saved.status,
      },
    });

    return saved;
  }

  /**
   * Associate or update the donor on an existing tracking record.
   */
  async associateDonor(
    id: string,
    dto: AssociateDonorDto,
    actor?: StaffActor,
  ): Promise<ReplacementDonation> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid tracking ID');
    }
    const tracking = await this.replacementModel.findById(id);
    if (!tracking) {
      throw new NotFoundException(`Replacement tracking record ${id} not found`);
    }

    if (tracking.status === ReplacementTrackingStatus.CANCELLED) {
      throw new BadRequestException('Cannot modify a cancelled tracking record');
    }

    if (!isValidObjectId(dto.donorId)) {
      throw new BadRequestException('Invalid donorId');
    }

    const donor = await this.donorModel.findById(dto.donorId);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${dto.donorId} not found`);
    }

    const prevDonorCode = tracking.donorCode;
    tracking.donorId = donor._id as Types.ObjectId;
    tracking.donorCode = donor.donorCode;
    tracking.donorName = donor.fullName;
    tracking.donorBloodGroup = donor.bloodGroup;
    tracking.donorPhone = donor.phone;

    if (dto.relationshipToPatient) {
      tracking.relationshipToPatient = dto.relationshipToPatient;
    }
    if (dto.notes) {
      tracking.notes = dto.notes;
    }

    let status = tracking.status;
    let desc = `Donor updated from ${prevDonorCode} to ${donor.fullName} (${donor.donorCode})`;

    if (donor.deferralStatus && donor.deferralStatus !== 'NONE') {
      status = ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED;
      desc += ` - Donor is currently deferred (${donor.deferralStatus})`;
    }
    tracking.status = status;

    tracking.timeline.push({
      event: 'DONOR_ASSOCIATED',
      status,
      description: desc,
      actorId: actor?.id || undefined,
      actorName: actor?.fullName || 'Staff',
      actorRole: actor?.role || 'STAFF',
      timestamp: new Date(),
    });

    tracking.updatedById = actor?.id && isValidObjectId(actor.id) ? new Types.ObjectId(actor.id) : undefined;
    tracking.updatedByName = actor?.fullName || 'Staff';
    tracking.updatedByRole = actor?.role || 'STAFF';

    const saved = await tracking.save();

    await this.auditLogsService.logEvent({
      action: AuditActionType.REPLACEMENT_DONOR_ASSOCIATED as any,
      entityType: AuditEntityType.REPLACEMENT_TRACKING as any,
      entityId: saved._id.toString(),
      entityIdentifier: saved.trackingCode,
      description: desc,
      actor: actor
        ? {
            id: actor.id || '',
            fullName: actor.fullName || 'Staff',
            email: actor.email || '',
            role: actor.role || 'STAFF',
          }
        : undefined,
    });

    return saved;
  }

  /**
   * Link an existing physical Donation record to this replacement tracking case.
   */
  async linkDonation(
    id: string,
    dto: LinkDonationDto,
    actor?: StaffActor,
  ): Promise<ReplacementDonation> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid tracking ID');
    }
    const tracking = await this.replacementModel.findById(id);
    if (!tracking) {
      throw new NotFoundException(`Replacement tracking record ${id} not found`);
    }

    if (tracking.status === ReplacementTrackingStatus.CANCELLED) {
      throw new BadRequestException('Cannot link donation to a cancelled tracking case');
    }

    if (!isValidObjectId(dto.donationId)) {
      throw new BadRequestException('Invalid donationId');
    }

    const donation = await this.donationModel.findById(dto.donationId);
    if (!donation) {
      throw new NotFoundException(`Donation ${dto.donationId} not found`);
    }

    // Verify donation belongs to the associated donor
    const donationDonorId = (donation.donorId as any)?._id || donation.donorId;
    if (donationDonorId.toString() !== tracking.donorId.toString()) {
      throw new BadRequestException(
        `Donation ${donation.donationCode} belongs to a different donor, not associated donor ${tracking.donorCode}`,
      );
    }

    tracking.donationId = donation._id as Types.ObjectId;
    tracking.donationCode = donation.donationCode;
    if (dto.notes) {
      tracking.notes = dto.notes;
    }

    // Derive tracking lifecycle status from linked donation and blood unit
    let derivedStatus = ReplacementTrackingStatus.DONATION_IN_PROGRESS;
    let description = `Linked donation ${donation.donationCode} (status: ${donation.status})`;

    if (donation.status === 'CANCELLED') {
      derivedStatus = ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED;
      description = `Linked donation ${donation.donationCode} was cancelled: ${donation.cancellationReason || 'No reason provided'}`;
    } else if (donation.status === 'COMPLETED') {
      // Find associated blood unit
      const bloodUnit = await this.bloodUnitModel.findOne({
        donationId: donation._id,
      });

      if (bloodUnit) {
        tracking.bloodUnitId = bloodUnit._id as Types.ObjectId;
        tracking.unitCode = bloodUnit.unitCode;

        if (bloodUnit.status === BloodUnitStatus.APPROVED) {
          const inventoryItem = await this.inventoryModel.findOne({
            bloodUnitId: bloodUnit._id,
            status: {
              $in: [
                InventoryStatus.AVAILABLE,
                InventoryStatus.RESERVED,
                InventoryStatus.ISSUED,
              ],
            },
          });
          if (inventoryItem) {
            derivedStatus = ReplacementTrackingStatus.RELEASED_TO_INVENTORY;
            description = `Donation ${donation.donationCode} completed; Unit ${bloodUnit.unitCode} passed testing and released to inventory.`;
          } else {
            derivedStatus = ReplacementTrackingStatus.TESTING_PENDING;
            description = `Donation ${donation.donationCode} completed; Unit ${bloodUnit.unitCode} approved in testing, awaiting formal supervisor release authorization to inventory.`;
          }
        } else if (bloodUnit.status === BloodUnitStatus.REJECTED) {
          derivedStatus = ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED;
          description = `Donation ${donation.donationCode} completed; Unit ${bloodUnit.unitCode} was rejected during testing.`;
        } else {
          // Status is TESTING or QUARANTINED
          derivedStatus = ReplacementTrackingStatus.TESTING_PENDING;
          description = `Donation ${donation.donationCode} completed; Unit ${bloodUnit.unitCode} pending laboratory testing (${bloodUnit.status}).`;
        }
      } else {
        derivedStatus = ReplacementTrackingStatus.DONATION_COLLECTED;
        description = `Donation ${donation.donationCode} collected, awaiting laboratory intake.`;
      }
    } else {
      derivedStatus = ReplacementTrackingStatus.DONATION_IN_PROGRESS;
      description = `Donation ${donation.donationCode} is currently in progress (${donation.status}).`;
    }

    tracking.status = derivedStatus;
    tracking.timeline.push({
      event: 'DONATION_LINKED',
      status: derivedStatus,
      description,
      actorId: actor?.id || undefined,
      actorName: actor?.fullName || 'Staff',
      actorRole: actor?.role || 'STAFF',
      timestamp: new Date(),
    });

    tracking.updatedById = actor?.id && isValidObjectId(actor.id) ? new Types.ObjectId(actor.id) : undefined;
    tracking.updatedByName = actor?.fullName || 'Staff';
    tracking.updatedByRole = actor?.role || 'STAFF';

    const saved = await tracking.save();

    await this.auditLogsService.logEvent({
      action: AuditActionType.REPLACEMENT_DONATION_LINKED as any,
      entityType: AuditEntityType.REPLACEMENT_TRACKING as any,
      entityId: saved._id.toString(),
      entityIdentifier: saved.trackingCode,
      description,
      actor: actor
        ? {
            id: actor.id || '',
            fullName: actor.fullName || 'Staff',
            email: actor.email || '',
            role: actor.role || 'STAFF',
          }
        : undefined,
    });

    return saved;
  }

  /**
   * Refreshes dynamic status from underlying donation and blood unit records without altering them.
   */
  async syncStatus(id: string, actor?: StaffActor): Promise<ReplacementDonation> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid tracking ID');
    }
    const tracking = await this.replacementModel.findById(id);
    if (!tracking) {
      throw new NotFoundException(`Replacement tracking record ${id} not found`);
    }

    if (tracking.status === ReplacementTrackingStatus.CANCELLED) {
      return tracking;
    }

    const previousStatus = tracking.status;
    let newStatus = tracking.status;
    let desc = '';

    // Synchronize latest donor details and check for recent deferrals
    const donor = await this.donorModel.findById(tracking.donorId);
    if (donor) {
      tracking.donorName = donor.fullName;
      tracking.donorBloodGroup = donor.bloodGroup;
      tracking.donorPhone = donor.phone;

      if (donor.deferralStatus && donor.deferralStatus !== 'NONE') {
        if (tracking.status !== ReplacementTrackingStatus.RELEASED_TO_INVENTORY) {
          newStatus = ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED;
          desc = `Synced: Associated donor ${donor.fullName} is currently deferred (${donor.deferralStatus})`;
        }
      }
    }

    // Synchronize latest patient details from BloodRequest
    const bloodRequest = await this.bloodRequestModel.findById(tracking.bloodRequestId);
    if (bloodRequest) {
      tracking.patientName = bloodRequest.patient?.name || tracking.patientName;
      tracking.patientBloodGroup = bloodRequest.bloodGroup || tracking.patientBloodGroup;
      tracking.patientPhone = bloodRequest.patient?.phone || tracking.patientPhone;
    }

    // Synchronize patient crossmatch record
    const crossmatch = await this.crossmatchModel
      .findOne({ bloodRequestId: tracking.bloodRequestId })
      .sort({ createdAt: -1 })
      .exec();

    if (crossmatch) {
      tracking.crossmatchId = crossmatch._id as Types.ObjectId;
      tracking.crossmatchStatus = crossmatch.status;
    }

    // Synchronize patient blood issue record (1-to-1 matching for multi-donor cases)
    if (!tracking.issuedBloodUnitId) {
      const bloodIssues = await this.bloodIssueModel
        .find({ bloodRequestId: tracking.bloodRequestId })
        .sort({ createdAt: 1 })
        .exec();

      if (bloodIssues.length > 0) {
        const allIssuedUnits: Array<{
          bloodIssueId: Types.ObjectId;
          issueCode: string;
          bloodUnitId: Types.ObjectId;
          unitCode: string;
        }> = [];

        for (const issue of bloodIssues) {
          for (const u of issue.issuedUnits || []) {
            allIssuedUnits.push({
              bloodIssueId: issue._id as Types.ObjectId,
              issueCode: issue.issueCode,
              bloodUnitId: u.bloodUnitId as Types.ObjectId,
              unitCode: u.unitCode,
            });
          }
        }

        const allReplacements = await this.replacementModel
          .find({
            bloodRequestId: tracking.bloodRequestId,
            status: { $ne: ReplacementTrackingStatus.CANCELLED },
          })
          .sort({ createdAt: 1 })
          .exec();

        const claimedUnitIds = new Set<string>();
        for (const rep of allReplacements) {
          if (
            rep._id &&
            tracking._id &&
            rep._id.toString() !== tracking._id.toString() &&
            rep.issuedBloodUnitId
          ) {
            claimedUnitIds.add(rep.issuedBloodUnitId.toString());
          }
        }

        const availableUnit = allIssuedUnits.find(
          (u) => !claimedUnitIds.has(u.bloodUnitId.toString()),
        );

        if (availableUnit) {
          tracking.bloodIssueId = availableUnit.bloodIssueId;
          tracking.issueCode = availableUnit.issueCode;
          tracking.issuedBloodUnitId = availableUnit.bloodUnitId;
          tracking.issuedUnitCode = availableUnit.unitCode;
        }
      }
    } else {
      const linkedIssue = await this.bloodIssueModel.findById(tracking.bloodIssueId);
      if (linkedIssue) {
        tracking.issueCode = linkedIssue.issueCode;
      }
    }

    // Synchronize patient billing / invoice record
    const invoice = await this.invoiceModel
      .findOne({ bloodRequestId: tracking.bloodRequestId })
      .sort({ createdAt: -1 })
      .exec();

    if (invoice) {
      tracking.invoiceId = invoice._id as Types.ObjectId;
      tracking.invoiceNumber = invoice.invoiceNumber;
      tracking.paymentStatus = invoice.status;
      tracking.invoiceTotalAmount = invoice.subtotal || 0;
      tracking.invoiceWaiverAmount = invoice.waiverAmount || 0;
      tracking.invoicePaidAmount = invoice.collectedAmount || 0;
      tracking.invoiceBalanceDue = invoice.outstandingAmount || 0;
    }

    if (!tracking.donationId) {
      if (newStatus !== previousStatus) {
        tracking.status = newStatus;
        tracking.timeline.push({
          event: 'STATUS_SYNCED',
          status: newStatus,
          description: desc,
          actorId: actor?.id || undefined,
          actorName: actor?.fullName || 'System Sync',
          actorRole: actor?.role || 'SYSTEM',
          timestamp: new Date(),
        });
        return await tracking.save();
      }
      return await tracking.save();
    }

    const donation = await this.donationModel.findById(tracking.donationId);
    if (!donation) {
      return tracking;
    }

    if (donation.status === 'CANCELLED') {
      newStatus = ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED;
      desc = `Synced: Donation ${donation.donationCode} was cancelled`;
    } else if (donation.status === 'COMPLETED') {
      const bloodUnit = await this.bloodUnitModel.findOne({
        donationId: donation._id,
      });

      if (bloodUnit) {
        tracking.bloodUnitId = bloodUnit._id as Types.ObjectId;
        tracking.unitCode = bloodUnit.unitCode;

        if (bloodUnit.status === BloodUnitStatus.APPROVED) {
          const inventoryItem = await this.inventoryModel.findOne({
            bloodUnitId: bloodUnit._id,
            status: {
              $in: [
                InventoryStatus.AVAILABLE,
                InventoryStatus.RESERVED,
                InventoryStatus.ISSUED,
              ],
            },
          });
          if (inventoryItem) {
            newStatus = ReplacementTrackingStatus.RELEASED_TO_INVENTORY;
            desc = `Synced: Unit ${bloodUnit.unitCode} passed laboratory testing and is released to inventory.`;
          } else {
            newStatus = ReplacementTrackingStatus.TESTING_PENDING;
            desc = `Synced: Unit ${bloodUnit.unitCode} approved in testing, awaiting formal supervisor release authorization to inventory.`;
          }
        } else if (bloodUnit.status === BloodUnitStatus.REJECTED) {
          newStatus = ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED;
          desc = `Synced: Unit ${bloodUnit.unitCode} was rejected during testing.`;
        } else {
          newStatus = ReplacementTrackingStatus.TESTING_PENDING;
          desc = `Synced: Unit ${bloodUnit.unitCode} laboratory testing in progress (${bloodUnit.status}).`;
        }
      } else {
        newStatus = ReplacementTrackingStatus.DONATION_COLLECTED;
        desc = `Synced: Donation ${donation.donationCode} collected, awaiting laboratory intake.`;
      }
    }

    if (newStatus !== previousStatus) {
      tracking.status = newStatus;
      tracking.timeline.push({
        event: 'STATUS_SYNCED',
        status: newStatus,
        description: desc,
        actorId: actor?.id || undefined,
        actorName: actor?.fullName || 'System Sync',
        actorRole: actor?.role || 'SYSTEM',
        timestamp: new Date(),
      });
      return await tracking.save();
    }

    return tracking;
  }

  /**
   * Cancel replacement tracking case.
   */
  async cancel(
    id: string,
    dto: CancelReplacementTrackingDto,
    actor?: StaffActor,
  ): Promise<ReplacementDonation> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid tracking ID');
    }
    const tracking = await this.replacementModel.findById(id);
    if (!tracking) {
      throw new NotFoundException(`Replacement tracking record ${id} not found`);
    }

    if (tracking.status === ReplacementTrackingStatus.CANCELLED) {
      return tracking;
    }

    tracking.status = ReplacementTrackingStatus.CANCELLED;
    tracking.cancellationReason = dto.cancellationReason;

    tracking.timeline.push({
      event: 'CASE_CANCELLED',
      status: ReplacementTrackingStatus.CANCELLED,
      description: `Case cancelled: ${dto.cancellationReason}`,
      actorId: actor?.id || undefined,
      actorName: actor?.fullName || 'Staff',
      actorRole: actor?.role || 'STAFF',
      timestamp: new Date(),
    });

    tracking.updatedById = actor?.id && isValidObjectId(actor.id) ? new Types.ObjectId(actor.id) : undefined;
    tracking.updatedByName = actor?.fullName || 'Staff';
    tracking.updatedByRole = actor?.role || 'STAFF';

    const saved = await tracking.save();

    await this.auditLogsService.logEvent({
      action: AuditActionType.REPLACEMENT_CANCELLED as any,
      entityType: AuditEntityType.REPLACEMENT_TRACKING as any,
      entityId: saved._id.toString(),
      entityIdentifier: saved.trackingCode,
      description: `Cancelled replacement tracking ${saved.trackingCode}: ${dto.cancellationReason}`,
      actor: actor
        ? {
            id: actor.id || '',
            fullName: actor.fullName || 'Staff',
            email: actor.email || '',
            role: actor.role || 'STAFF',
          }
        : undefined,
    });

    return saved;
  }

  /**
   * Update internal tracking notes.
   */
  async updateNotes(
    id: string,
    dto: UpdateReplacementTrackingNotesDto,
    actor?: StaffActor,
  ): Promise<ReplacementDonation> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid tracking ID');
    }
    const tracking = await this.replacementModel.findById(id);
    if (!tracking) {
      throw new NotFoundException(`Replacement tracking record ${id} not found`);
    }

    tracking.notes = dto.notes;
    tracking.updatedById = actor?.id && isValidObjectId(actor.id) ? new Types.ObjectId(actor.id) : undefined;
    tracking.updatedByName = actor?.fullName || 'Staff';
    tracking.updatedByRole = actor?.role || 'STAFF';

    return await tracking.save();
  }

  /**
   * Query paginated replacement donation cases.
   */
  async findAll(query: QueryReplacementDonationsDto): Promise<{
    items: ReplacementDonation[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const filter: any = {};

    if (query.bloodRequestId && isValidObjectId(query.bloodRequestId)) {
      filter.bloodRequestId = new Types.ObjectId(query.bloodRequestId);
    }
    if (query.donorId && isValidObjectId(query.donorId)) {
      filter.donorId = new Types.ObjectId(query.donorId);
    }
    if (query.status) {
      filter.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { trackingCode: searchRegex },
        { requestCode: searchRegex },
        { patientName: searchRegex },
        { donorName: searchRegex },
        { donorCode: searchRegex },
        { donationCode: searchRegex },
        { unitCode: searchRegex },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.replacementModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.replacementModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single tracking record by ID.
   */
  async findOne(id: string): Promise<ReplacementDonation> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid tracking ID');
    }
    const tracking = await this.replacementModel.findById(id);
    if (!tracking) {
      throw new NotFoundException(`Replacement tracking record ${id} not found`);
    }

    // Refresh display fields and fulfillment linkages from source records to prevent stale data
    const [donor, bloodRequest, crossmatch, bloodIssue, invoice] = await Promise.all([
      this.donorModel.findById(tracking.donorId),
      this.bloodRequestModel.findById(tracking.bloodRequestId),
      this.crossmatchModel
        .findOne({ bloodRequestId: tracking.bloodRequestId })
        .sort({ createdAt: -1 })
        .exec(),
      this.bloodIssueModel
        .findOne({ bloodRequestId: tracking.bloodRequestId })
        .sort({ createdAt: -1 })
        .exec(),
      this.invoiceModel
        .findOne({ bloodRequestId: tracking.bloodRequestId })
        .sort({ createdAt: -1 })
        .exec(),
    ]);

    if (donor) {
      tracking.donorName = donor.fullName;
      tracking.donorBloodGroup = donor.bloodGroup;
      tracking.donorPhone = donor.phone;
    }
    if (bloodRequest) {
      tracking.patientName = bloodRequest.patient?.name || tracking.patientName;
      tracking.patientBloodGroup = bloodRequest.bloodGroup || tracking.patientBloodGroup;
      tracking.patientPhone = bloodRequest.patient?.phone || tracking.patientPhone;
    }
    if (crossmatch) {
      tracking.crossmatchId = crossmatch._id as Types.ObjectId;
      tracking.crossmatchStatus = crossmatch.status;
    }
    if (bloodIssue) {
      tracking.bloodIssueId = bloodIssue._id as Types.ObjectId;
      tracking.issueCode = bloodIssue.issueCode;
      if (bloodIssue.issuedUnits && bloodIssue.issuedUnits.length > 0) {
        tracking.issuedBloodUnitId = bloodIssue.issuedUnits[0].bloodUnitId as Types.ObjectId;
        tracking.issuedUnitCode = bloodIssue.issuedUnits[0].unitCode;
      }
    }
    if (invoice) {
      tracking.invoiceId = invoice._id as Types.ObjectId;
      tracking.invoiceNumber = invoice.invoiceNumber;
      tracking.paymentStatus = invoice.status;
      tracking.invoiceTotalAmount = invoice.subtotal || 0;
      tracking.invoiceWaiverAmount = invoice.waiverAmount || 0;
      tracking.invoicePaidAmount = invoice.collectedAmount || 0;
      tracking.invoiceBalanceDue = invoice.outstandingAmount || 0;
    }

    return tracking;
  }

  /**
   * Retrieves the comprehensive end-to-end traced workflow graph
   * separating Relative Donation vs Patient Issue vs Billing.
   */
  async getWorkflowTrace(id: string) {
    const tracking = await this.findOne(id);

    const [bloodRequest, donor, donation, bloodUnit, inventory, crossmatch, bloodIssue, invoice] =
      await Promise.all([
        this.bloodRequestModel.findById(tracking.bloodRequestId),
        this.donorModel.findById(tracking.donorId),
        tracking.donationId ? this.donationModel.findById(tracking.donationId) : null,
        tracking.bloodUnitId ? this.bloodUnitModel.findById(tracking.bloodUnitId) : null,
        tracking.bloodUnitId
          ? this.inventoryModel.findOne({ bloodUnitId: tracking.bloodUnitId })
          : null,
        this.crossmatchModel
          .findOne({ bloodRequestId: tracking.bloodRequestId })
          .sort({ createdAt: -1 })
          .exec(),
        this.bloodIssueModel
          .findOne({ bloodRequestId: tracking.bloodRequestId })
          .sort({ createdAt: -1 })
          .exec(),
        this.invoiceModel
          .findOne({ bloodRequestId: tracking.bloodRequestId })
          .sort({ createdAt: -1 })
          .exec(),
      ]);

    return {
      trackingCode: tracking.trackingCode,
      createdAt: tracking.createdAt,
      status: tracking.status,
      // 1. Relative's Donation
      relativeDonation: {
        donorId: tracking.donorId,
        donorCode: tracking.donorCode,
        donorName: tracking.donorName,
        donorBloodGroup: tracking.donorBloodGroup,
        relationshipToPatient: tracking.relationshipToPatient,
        deferralStatus: donor?.deferralStatus || 'NONE',
        donationId: tracking.donationId,
        donationCode: tracking.donationCode,
        donationStatus: donation?.status || 'NOT_DONATED',
        bloodUnitId: tracking.bloodUnitId,
        unitCode: tracking.unitCode,
        unitStatus: bloodUnit?.status || 'N/A',
        isReleasedToInventory:
          bloodUnit?.status === BloodUnitStatus.APPROVED &&
          inventory?.status === InventoryStatus.AVAILABLE,
      },
      // 2. Patient & Request
      patientRequest: {
        bloodRequestId: tracking.bloodRequestId,
        requestCode: tracking.requestCode,
        patientName: tracking.patientName,
        patientBloodGroup: tracking.patientBloodGroup,
        requestedComponent: (bloodRequest as any)?.componentType || 'WHOLE_BLOOD',
        unitsRequested: bloodRequest?.unitsRequested || 1,
        requestStatus: bloodRequest?.status || 'UNKNOWN',
      },
      // 3. Clinical Crossmatching
      crossmatching: {
        crossmatchId: crossmatch?._id || null,
        crossmatchCode: crossmatch?.crossmatchCode || null,
        status: crossmatch?.status || 'NOT_STARTED',
        compatibilityResult: crossmatch?.laboratoryTest?.crossmatchResult || 'PENDING',
        selectedInventoryUnit: crossmatch?.selectedUnit?.unitCode || null,
        selectedUnitBloodGroup: crossmatch?.selectedUnit?.donorBloodGroup || null,
        isAuthorized:
          crossmatch?.status === 'RESERVED' ||
          crossmatch?.status === 'AUTHORIZED_COMPATIBLE' ||
          crossmatch?.status === 'ISSUED',
      },
      // 4. Patient Blood Issue
      bloodIssue: {
        bloodIssueId: bloodIssue?._id || null,
        issueCode: bloodIssue?.issueCode || null,
        status: bloodIssue?.status || 'NOT_ISSUED',
        issuedAt: bloodIssue?.issuedAt || null,
        issuedUnits: bloodIssue?.issuedUnits || [],
      },
      // 5. Applicable Charges / Payment
      payment: {
        invoiceId: invoice?._id || null,
        invoiceNumber: invoice?.invoiceNumber || null,
        status: invoice?.status || 'NOT_INVOICED',
        subtotal: invoice?.subtotal || 0,
        waiverTotal: invoice?.waiverAmount || 0,
        paidAmount: invoice?.collectedAmount || 0,
        balanceDue: invoice?.outstandingAmount || 0,
      },
      separationNotice:
        'CLINICAL SEPARATION: The relative donation is independently collected, tested, and released to inventory. Patient blood issue is strictly fulfilled from compatible inventory after verified crossmatching and supervisor authorization.',
      timeline: tracking.timeline,
    };
  }

  /**
   * Find all replacement tracking records for a specific Blood Request.
   */
  async findByBloodRequestId(
    bloodRequestId: string,
  ): Promise<ReplacementDonation[]> {
    if (!isValidObjectId(bloodRequestId)) {
      throw new BadRequestException('Invalid bloodRequestId');
    }
    return await this.replacementModel
      .find({ bloodRequestId: new Types.ObjectId(bloodRequestId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get database-backed metrics for the Replacement Donations dashboard.
   */
  async getDashboardMetrics(): Promise<{
    totalCases: number;
    activeCases: number;
    associatedDonors: number;
    donationsInProgress: number;
    donationsCollected: number;
    releasedDonations: number;
    deferredOrRejected: number;
    cancelledCases: number;
  }> {
    const [
      totalCases,
      activeCases,
      distinctDonors,
      donationsInProgress,
      donationsCollected,
      releasedDonations,
      deferredOrRejected,
      cancelledCases,
    ] = await Promise.all([
      this.replacementModel.countDocuments().exec(),
      this.replacementModel
        .countDocuments({ status: { $in: ACTIVE_TRACKING_STATUSES } })
        .exec(),
      this.replacementModel.distinct('donorId').exec(),
      this.replacementModel
        .countDocuments({
          status: {
            $in: [
              ReplacementTrackingStatus.DONATION_IN_PROGRESS,
              ReplacementTrackingStatus.DONATION_SCHEDULED,
            ],
          },
        })
        .exec(),
      this.replacementModel
        .countDocuments({
          status: {
            $in: [
              ReplacementTrackingStatus.DONATION_COLLECTED,
              ReplacementTrackingStatus.TESTING_PENDING,
            ],
          },
        })
        .exec(),
      this.replacementModel
        .countDocuments({
          status: ReplacementTrackingStatus.RELEASED_TO_INVENTORY,
        })
        .exec(),
      this.replacementModel
        .countDocuments({
          status: ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED,
        })
        .exec(),
      this.replacementModel
        .countDocuments({ status: ReplacementTrackingStatus.CANCELLED })
        .exec(),
    ]);

    return {
      totalCases,
      activeCases,
      associatedDonors: distinctDonors.length,
      donationsInProgress,
      donationsCollected,
      releasedDonations,
      deferredOrRejected,
      cancelledCases,
    };
  }
}
