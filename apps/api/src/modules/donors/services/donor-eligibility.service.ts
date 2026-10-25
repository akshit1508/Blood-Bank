import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import { Donor, DonorDocument } from '../schemas/donor.schema';
import { Donation, DonationDocument } from '../../donations/schemas/donation.schema';
import { DonorStatus } from '../constants/donor.constants';
import { DonationStatus, DonationType } from '../../donations/constants/donation.constants';
import {
  MIN_WHOLE_BLOOD_DONOR_AGE,
  MAX_WHOLE_BLOOD_DONOR_AGE,
  getWholeBloodIntervalDays,
  calculateCompletedAge,
  getCalendarDaysDifference,
  calculateNextEligibleDate,
} from '../../../common/constants/eligibility.constants';

export interface DonorEligibilityCheckResult {
  eligible: boolean;
  donorId: string;
  donorCode: string;
  fullName: string;
  gender: string;
  bloodGroup: string;
  status: DonorStatus;
  age?: number;
  lastDonationDate?: string;
  nextEligibleDate?: string;
  daysRemaining?: number;
  daysSinceLastDonation?: number;
}

@Injectable()
export class DonorEligibilityService {
  constructor(
    @InjectModel(Donor.name)
    private readonly donorModel: Model<DonorDocument>,
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
  ) {}

  /**
   * Authoritative validation of donor eligibility across all donation pathways
   * (Standard hospital donation desk, Mobile campaigns, and External camps).
   *
   * Enforces:
   * 1. Donor existence and active status (rejects PENDING_REVIEW, INACTIVE).
   * 2. Non-future donation timestamp (with 2-minute clock skew tolerance).
   * 3. Age criteria: 18 - 65 years based on dateOfBirth.
   * 4. Gender-based whole-blood donation interval (90 days for Male, 120 days for Female/Other).
   * 5. Prevention of duplicate/concurrent donation submissions on the same calendar date.
   */
  async validateEligibility(
    donorOrId: string | DonorDocument | any,
    donationDate: Date | string = new Date(),
    donationType: string = DonationType.WHOLE_BLOOD,
    excludeDonationId?: string,
    options?: { allowPendingReview?: boolean },
  ): Promise<DonorEligibilityCheckResult> {
    // 1. Resolve Donor Document
    let donor: DonorDocument | null = null;
    if (typeof donorOrId === 'string') {
      if (!isValidObjectId(donorOrId)) {
        throw new BadRequestException({
          message: `Invalid donor ID format: '${donorOrId}'`,
          code: 'INVALID_DONOR_REFERENCE',
        });
      }
      donor = await this.donorModel.findById(donorOrId).exec();
    } else if (donorOrId && donorOrId._id) {
      donor = donorOrId;
    }

    if (!donor) {
      throw new NotFoundException({
        message: 'Donor record was not found. Donation can only be recorded for registered donors.',
        code: 'DONOR_NOT_FOUND',
      });
    }

    // 2. Donor Status Checks
    if (donor.status === DonorStatus.PENDING_REVIEW && !options?.allowPendingReview) {
      throw new BadRequestException({
        message: `Donor '${donor.fullName}' (${donor.donorCode}) requires clinical review before donation can be accepted.`,
        code: 'DONOR_PENDING_REVIEW',
      });
    }

    if (donor.status === DonorStatus.INACTIVE) {
      throw new BadRequestException({
        message: `Donor '${donor.fullName}' (${donor.donorCode}) is currently marked INACTIVE and is not eligible to donate.`,
        code: 'DONOR_INACTIVE',
      });
    }

    // 2b. Deferral Registry Check (Temporary / Permanent)
    if ((donor as any).deferralStatus === 'PERMANENT') {
      throw new BadRequestException({
        message: `Donor '${donor.fullName}' (${donor.donorCode}) has a permanent medical deferral (${(donor as any).deferralReason || 'Permanent Contraindication'}). Blood donation is prohibited.`,
        code: 'DONOR_PERMANENTLY_DEFERRED',
        deferralReason: (donor as any).deferralReason,
      });
    }

    if ((donor as any).deferralStatus === 'TEMPORARY' && (donor as any).deferredUntil) {
      const deferredUntilDate = new Date((donor as any).deferredUntil);
      const donationDateTime = new Date(donationDate);
      if (!isNaN(deferredUntilDate.getTime()) && deferredUntilDate > donationDateTime) {
        throw new BadRequestException({
          message: `Donor '${donor.fullName}' (${donor.donorCode}) is temporarily deferred until ${deferredUntilDate.toISOString().slice(0, 10)} (${(donor as any).deferralReason || 'Clinical deferral'}).`,
          code: 'DONOR_TEMPORARILY_DEFERRED',
          deferredUntil: deferredUntilDate.toISOString().slice(0, 10),
          deferralReason: (donor as any).deferralReason,
        });
      }
    }

    // 3. Donation Timestamp & Future Validation
    const donationDateTime = new Date(donationDate);
    if (isNaN(donationDateTime.getTime())) {
      throw new BadRequestException({
        message: 'Invalid donation date provided.',
        code: 'INVALID_DONATION_DATE',
      });
    }

    const now = new Date();
    if (donationDateTime.getTime() > now.getTime() + 120 * 1000) {
      throw new BadRequestException({
        message: 'Donation date cannot be in the future.',
        code: 'FUTURE_DONATION_DATE',
      });
    }

    // 4. Age Eligibility (18 to 65 years)
    let calculatedAge: number | undefined;
    if (donor.dateOfBirth) {
      calculatedAge = calculateCompletedAge(donor.dateOfBirth, donationDateTime);
      if (calculatedAge < MIN_WHOLE_BLOOD_DONOR_AGE) {
        throw new BadRequestException({
          message: `Donor must be at least ${MIN_WHOLE_BLOOD_DONOR_AGE} years of age to donate blood. Current completed age is ${calculatedAge} years.`,
          code: 'DONOR_UNDERAGE',
          age: calculatedAge,
          minAge: MIN_WHOLE_BLOOD_DONOR_AGE,
        });
      }
      if (calculatedAge > MAX_WHOLE_BLOOD_DONOR_AGE) {
        throw new BadRequestException({
          message: `Donor exceeds the maximum permissible age of ${MAX_WHOLE_BLOOD_DONOR_AGE} years for blood donation. Current completed age is ${calculatedAge} years.`,
          code: 'DONOR_OVERAGE',
          age: calculatedAge,
          maxAge: MAX_WHOLE_BLOOD_DONOR_AGE,
        });
      }
    }

    // 5. Gender-Specific Whole-Blood Interval Check
    const resolvedType = donationType || DonationType.WHOLE_BLOOD;
    let lastDonationDateStr: string | undefined;
    let nextEligibleDateStr: string | undefined;
    let daysRemaining: number | undefined;
    let daysSinceLastDonation: number | undefined;

    if (resolvedType === DonationType.WHOLE_BLOOD) {
      const query: Record<string, any> = {
        donorId: donor._id,
        donationType: DonationType.WHOLE_BLOOD,
        status: DonationStatus.COMPLETED,
      };

      if (excludeDonationId && isValidObjectId(excludeDonationId)) {
        query._id = { $ne: new Types.ObjectId(excludeDonationId) };
      }

      const lastCompleted = await this.donationModel
        .findOne(query)
        .sort({ donationDate: -1 })
        .exec();

      if (lastCompleted) {
        const lastDate = new Date(lastCompleted.donationDate);
        const intervalDays = getWholeBloodIntervalDays(donor.gender);
        const daysElapsed = getCalendarDaysDifference(lastDate, donationDateTime);
        daysSinceLastDonation = daysElapsed;

        if (daysElapsed < intervalDays) {
          const nextEligible = calculateNextEligibleDate(lastDate, donor.gender);
          const remaining = intervalDays - daysElapsed;
          throw new BadRequestException({
            message: `Donor is not yet eligible for whole-blood donation. Minimum mandatory interval is ${intervalDays} days (${donor.gender || 'Standard'}), but only ${daysElapsed} day(s) have elapsed.`,
            code: 'DONATION_INTERVAL_NOT_COMPLETED',
            lastDonationDate: lastDate.toISOString().slice(0, 10),
            nextEligibleDate: nextEligible.toISOString().slice(0, 10),
            remainingDays: remaining,
            requiredIntervalDays: intervalDays,
          });
        }

        lastDonationDateStr = lastDate.toISOString().slice(0, 10);
        nextEligibleDateStr = calculateNextEligibleDate(lastDate, donor.gender)
          .toISOString()
          .slice(0, 10);
      }
    }

    // 6. Duplicate / Concurrent Donation Submission Prevention (Same Day)
    const startOfDay = new Date(
      Date.UTC(
        donationDateTime.getUTCFullYear(),
        donationDateTime.getUTCMonth(),
        donationDateTime.getUTCDate(),
        0,
        0,
        0,
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        donationDateTime.getUTCFullYear(),
        donationDateTime.getUTCMonth(),
        donationDateTime.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const duplicateQuery: Record<string, any> = {
      donorId: donor._id,
      donationDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: [DonationStatus.RECORDED, DonationStatus.COMPLETED] },
    };
    if (excludeDonationId && isValidObjectId(excludeDonationId)) {
      duplicateQuery._id = { $ne: new Types.ObjectId(excludeDonationId) };
    }

    const existingSameDay = await this.donationModel.findOne(duplicateQuery).exec();
    if (existingSameDay) {
      throw new BadRequestException({
        message: `Donor '${donor.fullName}' already has a donation recorded on ${donationDateTime.toISOString().slice(0, 10)} (${existingSameDay.donationCode}). Duplicate donation submissions on the same calendar day are prohibited.`,
        code: 'DUPLICATE_DONATION_SAME_DAY',
        existingDonationCode: existingSameDay.donationCode,
      });
    }

    return {
      eligible: true,
      donorId: (donor._id as any).toString(),
      donorCode: donor.donorCode,
      fullName: donor.fullName,
      gender: donor.gender,
      bloodGroup: donor.bloodGroup,
      status: donor.status,
      age: calculatedAge,
      lastDonationDate: lastDonationDateStr,
      nextEligibleDate: nextEligibleDateStr,
      daysRemaining,
      daysSinceLastDonation,
    };
  }
}
