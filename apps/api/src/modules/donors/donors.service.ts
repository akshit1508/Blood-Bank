import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Donor, DonorDocument } from './schemas/donor.schema';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorStatusDto } from './dto/update-donor-status.dto';
import {
  BloodGroup,
  DonorStatus,
  ALLOWED_DONOR_STATUS_TRANSITIONS,
} from './constants/donor.constants';
import {
  calculateCompletedAge,
  MIN_WHOLE_BLOOD_DONOR_AGE,
  MAX_WHOLE_BLOOD_DONOR_AGE,
} from '../../common/constants/eligibility.constants';

@Injectable()
export class DonorsService {
  constructor(
    @InjectModel(Donor.name)
    private readonly donorModel: Model<DonorDocument>,
  ) {}

  /**
   * Generates a unique, server-side human-readable donor code.
   * Format: DON-YYYYMMDD-XXXX (e.g. DON-20261007-A8F3)
   */
  private generateDonorCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `DON-${datePart}-${randomPart}`;
  }

  /**
   * Registers a new donor from the public registration form or staff intake.
   * Checks for duplicate active registrations by normalized phone number.
   */
  async create(createDto: CreateDonorDto): Promise<{ success: boolean; donorCode: string; message: string }> {
    // Authoritative Server-Side Age Validation
    if (createDto.dateOfBirth) {
      const birthDate = new Date(createDto.dateOfBirth);
      if (isNaN(birthDate.getTime())) {
        throw new BadRequestException('Invalid date of birth provided');
      }
      const age = calculateCompletedAge(birthDate);
      if (age < MIN_WHOLE_BLOOD_DONOR_AGE || age > MAX_WHOLE_BLOOD_DONOR_AGE) {
        throw new BadRequestException({
          message: `Donor must be between ${MIN_WHOLE_BLOOD_DONOR_AGE} and ${MAX_WHOLE_BLOOD_DONOR_AGE} years old.`,
          code: 'DONOR_AGE_NOT_ELIGIBLE',
        });
      }
    }

    const normalizedPhone = createDto.phone.trim();

    // Check duplicate active donor by phone number
    const existing = await this.donorModel.findOne({
      phone: normalizedPhone,
    }).exec();

    if (existing) {
      throw new ConflictException(
        'An existing donor registration may already exist for this contact number. Please contact the blood bank.',
      );
    }

    let donorCode = this.generateDonorCode();
    let attempts = 0;
    while (await this.donorModel.exists({ donorCode })) {
      donorCode = this.generateDonorCode();
      attempts++;
      if (attempts > 5) {
        donorCode = `DON-${Date.now()}`;
        break;
      }
    }

    const donor = new this.donorModel({
      ...createDto,
      donorCode,
      phone: normalizedPhone,
      email: createDto.email?.trim().toLowerCase() || undefined,
      dateOfBirth: createDto.dateOfBirth ? new Date(createDto.dateOfBirth) : undefined,
      status: DonorStatus.PENDING_REVIEW,
    });

    await donor.save();

    return {
      success: true,
      donorCode,
      message: 'Your donor registration has been submitted successfully. Our blood bank staff will review your registration.',
    };
  }

  /**
   * Finds all donors for staff management with search and filters.
   */
  async findAll(query?: {
    search?: string;
    bloodGroup?: BloodGroup;
    status?: DonorStatus;
  }): Promise<Donor[]> {
    const filter: Record<string, any> = {};

    if (query?.bloodGroup) {
      filter.bloodGroup = query.bloodGroup;
    }

    if (query?.status) {
      filter.status = query.status;
    }

    if (query?.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { donorCode: searchRegex },
        { phone: searchRegex },
        { city: searchRegex },
      ];
    }

    return await this.donorModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Finds a single donor by MongoDB _id or public donorCode.
   */
  async findOne(identifier: string): Promise<Donor> {
    let donor: Donor | null = null;

    if (isValidObjectId(identifier)) {
      donor = await this.donorModel.findById(identifier).exec();
    }

    if (!donor) {
      donor = await this.donorModel
        .findOne({ donorCode: identifier.toUpperCase() })
        .exec();
    }

    if (!donor) {
      throw new NotFoundException(
        `Donor with identifier '${identifier}' was not found`,
      );
    }

    return donor;
  }

  /**
   * Updates donor status enforcing administrative workflow transitions.
   * Allowed:
   * PENDING_REVIEW -> ACTIVE, INACTIVE
   * ACTIVE -> INACTIVE
   * INACTIVE -> ACTIVE
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateDonorStatusDto,
  ): Promise<Donor> {
    const donor = await this.findOne(id);
    const currentStatus = donor.status;
    const targetStatus = updateStatusDto.status;

    if (currentStatus === targetStatus) {
      return donor;
    }

    const allowedTransitions =
      ALLOWED_DONOR_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid donor status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions are: [${allowedTransitions.join(
          ', ',
        )}]`,
      );
    }

    const updated = await this.donorModel
      .findByIdAndUpdate(
        (donor as any)._id,
        { $set: { status: targetStatus } },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Donor with identifier '${id}' was not found`);
    }

    return updated;
  }
}
