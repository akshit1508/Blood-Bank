import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
  ) {}

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
  async create(createDto: CreateDonationDto): Promise<Donation> {
    if (!isValidObjectId(createDto.donorId)) {
      throw new BadRequestException('Invalid donor ID format');
    }

    const donor = await this.donorModel.findById(createDto.donorId).exec();
    if (!donor) {
      throw new NotFoundException(
        `Donor with ID '${createDto.donorId}' was not found. Donation can only be recorded for existing registered donors.`,
      );
    }

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

    const donation = new this.donationModel({
      donationCode,
      donorId: new Types.ObjectId(createDto.donorId),
      donationDate: new Date(createDto.donationDate),
      donationType: createDto.donationType || DonationType.WHOLE_BLOOD,
      quantity: createDto.quantity,
      status: DonationStatus.RECORDED,
      notes: createDto.notes?.trim() || undefined,
    });

    const saved = await donation.save();
    return await saved.populate('donorId');
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

    const updated = await this.donationModel
      .findByIdAndUpdate(
        (donation as any)._id,
        { $set: { status: targetStatus } },
        { new: true },
      )
      .populate('donorId')
      .exec();

    if (!updated) {
      throw new NotFoundException(
        `Donation with identifier '${id}' was not found during update`,
      );
    }

    return updated;
  }
}
