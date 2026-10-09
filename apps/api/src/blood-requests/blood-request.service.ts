import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import {
  BloodRequest,
  BloodRequestDocument,
} from './schemas/blood-request.schema';
import {
  BloodIssue,
  BloodIssueDocument,
} from '../modules/blood-issues/schemas/blood-issue.schema';
import { BloodIssueStatus } from '../modules/blood-issues/constants/blood-issue.constants';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { UpdateBloodRequestStatusDto } from './dto/update-blood-request-status.dto';
import { CompleteBloodRequestDto } from './dto/complete-blood-request.dto';
import {
  ALLOWED_STATUS_TRANSITIONS,
  OPERATIONAL_MILESTONE_STATUSES,
  BloodRequestStatus,
} from './blood-request.constants';
import { InventoryService } from '../modules/inventory/inventory.service';

@Injectable()
export class BloodRequestService {
  constructor(
    @InjectModel(BloodRequest.name)
    private readonly bloodRequestModel: Model<BloodRequestDocument>,
    @InjectModel(BloodIssue.name)
    private readonly bloodIssueModel: Model<BloodIssueDocument>,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Generates a unique, high-entropy human-readable request tracking code.
   * Format: REQ-YYYYMMDD-XXXX (e.g. REQ-20261007-A9F2)
   */
  private generateRequestCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REQ-${datePart}-${randomPart}`;
  }

  /**
   * Creates a new blood request submitted from the public or clinical intake.
   * Enforces initial status: REQUESTED.
   */
  async create(createDto: CreateBloodRequestDto): Promise<BloodRequest> {
    let requestCode = this.generateRequestCode();

    // Ensure uniqueness in the rare event of random collision
    let attempts = 0;
    while (await this.bloodRequestModel.exists({ requestCode })) {
      requestCode = this.generateRequestCode();
      attempts++;
      if (attempts > 5) {
        requestCode = `REQ-${Date.now()}`;
        break;
      }
    }

    const created = new this.bloodRequestModel({
      ...createDto,
      requestCode,
      requiredDate: new Date(createDto.requiredDate),
      status: BloodRequestStatus.REQUESTED,
      statusUpdatedAt: new Date(),
    });

    return await created.save();
  }

  /**
   * Retrieves all blood requests, sorted by creation date descending.
   * Can be filtered by status or bloodGroup.
   */
  async findAll(filters?: {
    status?: BloodRequestStatus;
    bloodGroup?: string;
  }): Promise<BloodRequest[]> {
    const query: Record<string, any> = {};
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.bloodGroup) {
      query.bloodGroup = filters.bloodGroup;
    }
    return await this.bloodRequestModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Finds a single request by MongoDB _id or public requestCode.
   */
  async findOne(identifier: string): Promise<BloodRequest> {
    let request: BloodRequest | null = null;

    if (isValidObjectId(identifier)) {
      request = await this.bloodRequestModel.findById(identifier).exec();
    }

    if (!request) {
      // Try finding by public tracking code (e.g. REQ-20261007-A9F2)
      request = await this.bloodRequestModel
        .findOne({ requestCode: identifier.toUpperCase() })
        .exec();
    }

    if (!request) {
      throw new NotFoundException(
        `Blood request with identifier '${identifier}' was not found`,
      );
    }

    return request;
  }

  /**
   * Updates request status enforcing strict state machine transitions.
   *
   * Security & Integrity Invariants (Task 96317):
   * Operational milestone statuses (RESERVED, ISSUED, COMPLETED) can NEVER be set
   * arbitrarily through this generic status update endpoint.
   * - RESERVED: only reached by reserving physical units (POST /blood-requests/:id/reservations)
   * - ISSUED: only reached by issuing reserved blood (POST /reservations/:id/issue)
   * - COMPLETED: only reached by validating issue records (POST /blood-requests/:id/complete)
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateBloodRequestStatusDto,
  ): Promise<BloodRequest> {
    const request = await this.findOne(id);
    const currentStatus = request.status;
    const targetStatus = updateStatusDto.status;

    if (currentStatus === targetStatus) {
      return request;
    }

    // Invariant: Reject operational milestones from generic status transitions
    if (OPERATIONAL_MILESTONE_STATUSES.includes(targetStatus)) {
      if (targetStatus === BloodRequestStatus.RESERVED) {
        throw new BadRequestException({
          message:
            "Status 'RESERVED' cannot be set directly. Blood units must be explicitly reserved through the reservation operation.",
          code: 'OPERATION_REQUIRES_UNIT_RESERVATION',
        });
      }
      if (targetStatus === BloodRequestStatus.ISSUED) {
        throw new BadRequestException({
          message:
            "Status 'ISSUED' cannot be set directly. Blood must be officially issued against an active reservation.",
          code: 'OPERATION_REQUIRES_BLOOD_ISSUE',
        });
      }
      if (targetStatus === BloodRequestStatus.COMPLETED) {
        throw new BadRequestException({
          message:
            "Status 'COMPLETED' cannot be set directly. The request must be completed through the validated completion operation.",
          code: 'OPERATION_REQUIRES_VALIDATED_COMPLETION',
        });
      }
    }

    const allowedNextStatuses =
      ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedNextStatuses.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions are: [${allowedNextStatuses.join(
          ', ',
        )}]`,
      );
    }

    const updated = await this.bloodRequestModel
      .findByIdAndUpdate(
        (request as any)._id,
        {
          $set: {
            status: targetStatus,
            statusReason: updateStatusDto.statusReason || '',
            statusUpdatedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(
        `Blood request with identifier '${id}' was not found during update`,
      );
    }

    return updated;
  }

  /**
   * Completes an issued blood request following full issue reconciliation.
   *
   * Medical & Invariant Validations (Task 96317):
   * 1. Blood request must exist and currently be in ISSUED status.
   * 2. At least one completed BloodIssue record must exist for this request.
   * 3. Total issued physical units across completed issues must meet the requested quantity.
   * 4. Request transitions ISSUED -> COMPLETED atomically with audit timestamp and remarks.
   * 5. Idempotent: cannot be completed multiple times, and does not deduct inventory a second time.
   */
  async completeRequest(
    id: string,
    completeDto?: CompleteBloodRequestDto,
  ): Promise<BloodRequest> {
    const request = await this.findOne(id);

    if (request.status === BloodRequestStatus.COMPLETED) {
      throw new BadRequestException({
        message: `Blood request '${request.requestCode}' is already COMPLETED.`,
        code: 'REQUEST_ALREADY_COMPLETED',
      });
    }

    if (request.status !== BloodRequestStatus.ISSUED) {
      throw new BadRequestException({
        message: `Blood request '${request.requestCode}' must be in ISSUED status to be completed. Current status is '${request.status}'.`,
        code: 'REQUEST_NOT_IN_ISSUED_STATUS',
      });
    }

    // Verify valid, completed BloodIssue records exist for this request
    const bloodIssues = await this.bloodIssueModel
      .find({
        bloodRequestId: (request as any)._id,
        status: BloodIssueStatus.COMPLETED,
      })
      .exec();

    if (!bloodIssues || bloodIssues.length === 0) {
      throw new BadRequestException({
        message: `Cannot complete request '${request.requestCode}': No official blood issue records exist for this request.`,
        code: 'NO_COMPLETED_BLOOD_ISSUES_FOUND',
      });
    }

    const totalIssuedUnitsCount = bloodIssues.reduce(
      (sum, issue) => sum + (issue.issuedUnits?.length || 0),
      0,
    );

    if (totalIssuedUnitsCount < request.unitsRequested) {
      throw new BadRequestException({
        message: `Cannot complete request '${request.requestCode}': Issued units count (${totalIssuedUnitsCount}) does not meet the requested quantity (${request.unitsRequested}).`,
        code: 'ISSUED_QUANTITY_INSUFFICIENT',
      });
    }

    const completionReason = completeDto?.notes?.trim()
      ? `Fulfillment completed. ${completeDto.notes.trim()}`
      : `Fulfillment completed successfully (${totalIssuedUnitsCount} unit(s) verified issued).`;

    const updated = await this.bloodRequestModel
      .findByIdAndUpdate(
        (request as any)._id,
        {
          $set: {
            status: BloodRequestStatus.COMPLETED,
            statusReason: completionReason,
            statusUpdatedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(
        `Blood request with identifier '${id}' was not found during completion`,
      );
    }

    return updated;
  }

  /**
   * Retrieves matching available inventory units for a specific blood request (Phase 6A).
   *
   * Boundaries & Requirements:
   * 1. Exact match on bloodGroup and componentType.
   * 2. Read-only operation: does NOT reserve, issue, or allocate units.
   * 3. Does NOT alter request status or inventory status.
   * 4. Excludes expired, discarded, testing, rejected, or non-approved units.
   * 5. Sorts matching units by earliest expiry date (FEFO).
   * 6. Computes availableUnits, unitsRequested, and canFulfill flag.
   */
  async getMatches(id: string) {
    const request = await this.findOne(id);

    const matchingUnits = await this.inventoryService.findMatches(
      request.bloodGroup,
      request.componentType,
    );

    const availableUnits = matchingUnits.length;
    const unitsRequested = request.unitsRequested;
    const canFulfill = availableUnits >= unitsRequested;

    return {
      request: {
        id: (request as any)._id ? (request as any)._id.toString() : id,
        requestCode: request.requestCode,
        bloodGroup: request.bloodGroup,
        componentType: request.componentType,
        unitsRequested: request.unitsRequested,
        status: request.status,
      },
      matchingUnits,
      availableUnits,
      unitsRequested,
      canFulfill,
    };
  }
}
