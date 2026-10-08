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
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { UpdateBloodRequestStatusDto } from './dto/update-blood-request-status.dto';
import {
  ALLOWED_STATUS_TRANSITIONS,
  BloodRequestStatus,
} from './blood-request.constants';
import { InventoryService } from '../modules/inventory/inventory.service';

@Injectable()
export class BloodRequestService {
  constructor(
    @InjectModel(BloodRequest.name)
    private readonly bloodRequestModel: Model<BloodRequestDocument>,
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
