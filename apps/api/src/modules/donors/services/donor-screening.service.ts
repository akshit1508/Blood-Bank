import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import { Donor, DonorDocument } from '../schemas/donor.schema';
import { DonorStatus } from '../constants/donor.constants';
import {
  DonorScreening,
  DonorScreeningDocument,
} from '../schemas/donor-screening.schema';
import {
  DonorScreeningDecision,
  CLINICAL_SCREENING_THRESHOLDS,
} from '../constants/screening.constants';
import { CreateDonorScreeningDto } from '../dto/create-donor-screening.dto';
import { DonorEligibilityService } from './donor-eligibility.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import {
  AuditActionType,
  AuditEntityType,
} from '../../audit-logs/constants/audit-log.constants';

@Injectable()
export class DonorScreeningService {
  constructor(
    @InjectModel(DonorScreening.name)
    private readonly screeningModel: Model<DonorScreeningDocument>,
    @InjectModel(Donor.name)
    private readonly donorModel: Model<DonorDocument>,
    private readonly donorEligibilityService: DonorEligibilityService,
    @Optional()
    private readonly auditLogsService?: AuditLogsService,
  ) {}

  /**
   * Generates a unique server-side screening tracking code.
   * Format: SCR-YYYYMMDD-XXXX (e.g. SCR-20261023-F91A)
   */
  private generateScreeningCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SCR-${datePart}-${randPart}`;
  }

  /**
   * Records clinical pre-donation screening and examination for a registered donor.
   *
   * Business & Medical Rules Enforced (NBTC / DGHS / Drugs & Cosmetics Rules):
   * 1. Donor existence and baseline eligibility verified.
   * 2. Physical Examination criteria evaluated automatically against Indian regulatory limits:
   *    - Weight: min 45 kg
   *    - Hemoglobin: min 12.5 g/dL
   *    - Systolic BP: 100 - 160 mmHg; Diastolic BP: 60 - 100 mmHg
   *    - Pulse: 60 - 100 bpm
   *    - Oral Temp: max 37.5°C
   * 3. Pre-donation health questionnaire evaluated for high-risk / deferral indicators.
   * 4. Automatic deferral assignment if thresholds breached.
   * 5. Deferral registry updated on Donor document (preserving history).
   * 6. Audit trail recorded with staff attribution.
   */
  async createScreening(
    dto: CreateDonorScreeningDto,
    actor?: any,
  ): Promise<{
    message: string;
    screening: DonorScreening;
    donor: any;
    autoEvaluation: {
      passed: boolean;
      reasons: string[];
      suggestedDecision: DonorScreeningDecision;
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

    // Baseline eligibility check (age, active status, donation interval, active deferral)
    await this.donorEligibilityService.validateEligibility(
      donor,
      new Date(),
      undefined,
      undefined,
      { allowPendingReview: true },
    );

    // Automated Clinical Examination Evaluation (Indian NBTC Standards)
    const reasons: string[] = [];
    let autoDecision = DonorScreeningDecision.SELECTED;
    let deferralType: 'TEMPORARY' | 'PERMANENT' | undefined;
    let deferredUntil: Date | undefined;

    // 1. Weight Evaluation
    if (dto.vitals.weightKg < CLINICAL_SCREENING_THRESHOLDS.MIN_WEIGHT_350ML_KG) {
      reasons.push(
        `Weight (${dto.vitals.weightKg} kg) is below regulatory threshold of ${CLINICAL_SCREENING_THRESHOLDS.MIN_WEIGHT_350ML_KG} kg.`,
      );
      autoDecision = DonorScreeningDecision.TEMPORARILY_DEFERRED;
      deferralType = 'TEMPORARY';
    }

    // 2. Hemoglobin Evaluation
    if (dto.vitals.hemoglobinGdl < CLINICAL_SCREENING_THRESHOLDS.MIN_HEMOGLOBIN_GDL) {
      reasons.push(
        `Hemoglobin (${dto.vitals.hemoglobinGdl} g/dL) is below statutory minimum of ${CLINICAL_SCREENING_THRESHOLDS.MIN_HEMOGLOBIN_GDL} g/dL.`,
      );
      autoDecision = DonorScreeningDecision.TEMPORARILY_DEFERRED;
      deferralType = 'TEMPORARY';
      deferredUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days iron recovery
    }

    // 3. Blood Pressure Evaluation
    if (
      dto.vitals.bloodPressureSystolic < CLINICAL_SCREENING_THRESHOLDS.MIN_SYSTOLIC_BP ||
      dto.vitals.bloodPressureSystolic > CLINICAL_SCREENING_THRESHOLDS.MAX_SYSTOLIC_BP_ALLOWABLE ||
      dto.vitals.bloodPressureDiastolic < CLINICAL_SCREENING_THRESHOLDS.MIN_DIASTOLIC_BP ||
      dto.vitals.bloodPressureDiastolic > CLINICAL_SCREENING_THRESHOLDS.MAX_DIASTOLIC_BP_ALLOWABLE
    ) {
      reasons.push(
        `Blood Pressure (${dto.vitals.bloodPressureSystolic}/${dto.vitals.bloodPressureDiastolic} mmHg) is out of safe range (100-160 / 60-100 mmHg).`,
      );
      autoDecision = DonorScreeningDecision.TEMPORARILY_DEFERRED;
      deferralType = 'TEMPORARY';
    }

    // 4. Pulse Evaluation
    if (
      dto.vitals.pulseBpm < CLINICAL_SCREENING_THRESHOLDS.MIN_PULSE_BPM ||
      dto.vitals.pulseBpm > CLINICAL_SCREENING_THRESHOLDS.MAX_PULSE_BPM
    ) {
      reasons.push(
        `Pulse rate (${dto.vitals.pulseBpm} bpm) is out of allowable range (60-100 bpm).`,
      );
      autoDecision = DonorScreeningDecision.TEMPORARILY_DEFERRED;
      deferralType = 'TEMPORARY';
    }

    // 5. Temperature Evaluation
    if (dto.vitals.temperatureCelsius > CLINICAL_SCREENING_THRESHOLDS.MAX_ORAL_TEMP_CELSIUS) {
      reasons.push(
        `Body temperature (${dto.vitals.temperatureCelsius}°C) indicates fever / pyrexia (max 37.5°C).`,
      );
      autoDecision = DonorScreeningDecision.TEMPORARILY_DEFERRED;
      deferralType = 'TEMPORARY';
      deferredUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    // 6. Medical Questionnaire Evaluation
    const q = dto.questionnaire;
    if (q) {
      if (
        q.cardiacOrRespiratoryDisease ||
        q.bleedingDisorderOrEpilepsy ||
        q.historyOfJaundiceOrHepatitis ||
        q.highRiskBehaviorOrSTI
      ) {
        reasons.push('High-risk medical contraindication reported in questionnaire.');
        autoDecision = DonorScreeningDecision.PERMANENTLY_DEFERRED;
        deferralType = 'PERMANENT';
      } else if (
        q.recentIllnessOrFever ||
        q.tattooPiercingLast12Months ||
        q.majorSurgeryOrDentalRecent ||
        q.alcoholIntakeLast24Hours ||
        q.pregnantOrLactating
      ) {
        reasons.push('Temporary clinical risk factor identified in questionnaire.');
        autoDecision = DonorScreeningDecision.TEMPORARILY_DEFERRED;
        deferralType = 'TEMPORARY';
        if (q.alcoholIntakeLast24Hours) {
          deferredUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        } else if (q.tattooPiercingLast12Months) {
          deferredUntil = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
        } else if (q.recentIllnessOrFever) {
          deferredUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
      }
    }

    // Resolve Final Decision
    let finalDecision = dto.decision || autoDecision;
    // Hard Medical Safety Invariant: Cannot override severe vitals failure or permanent contraindication to SELECTED
    if (
      (dto.vitals.weightKg < CLINICAL_SCREENING_THRESHOLDS.MIN_WEIGHT_350ML_KG ||
        dto.vitals.hemoglobinGdl < CLINICAL_SCREENING_THRESHOLDS.MIN_HEMOGLOBIN_GDL ||
        dto.questionnaire?.historyOfJaundiceOrHepatitis ||
        dto.questionnaire?.cardiacOrRespiratoryDisease) &&
      finalDecision === DonorScreeningDecision.SELECTED
    ) {
      throw new BadRequestException({
        message: `Safety Invariant: Donor cannot be SELECTED for collection with sub-threshold Weight, Hemoglobin, or permanent medical contraindications (Hepatitis/Cardiac).`,
        code: 'CLINICAL_THRESHOLD_BREACH',
        weightKg: dto.vitals.weightKg,
        hemoglobinGdl: dto.vitals.hemoglobinGdl,
      });
    }

    if (
      finalDecision === DonorScreeningDecision.SELECTED &&
      dto.consent &&
      dto.consent.consentAcknowledged === false
    ) {
      throw new BadRequestException({
        message: 'Safety Invariant: Donor consent must be acknowledged before selecting donor for collection.',
        code: 'CONSENT_REQUIRED',
      });
    }

    let finalDeferralType = dto.deferralType || deferralType;
    let finalDeferralReason =
      dto.deferralReason ||
      (reasons.length > 0 ? reasons.join('; ') : undefined);
    let finalDeferredUntil = dto.deferredUntil
      ? new Date(dto.deferredUntil)
      : deferredUntil;

    // Generate unique screening code
    let screeningCode = this.generateScreeningCode();
    while (await this.screeningModel.exists({ screeningCode })) {
      screeningCode = this.generateScreeningCode();
    }

    const screening = new this.screeningModel({
      screeningCode,
      donorId: donor._id,
      donorCode: donor.donorCode,
      donorFullName: donor.fullName,
      donorBloodGroup: donor.bloodGroup,
      donorGender: donor.gender,
      campaignId: dto.campaignId ? new Types.ObjectId(dto.campaignId) : undefined,
      vitals: dto.vitals,
      questionnaire: dto.questionnaire || {},
      consent: {
        consentAcknowledged: dto.consent?.consentAcknowledged ?? true,
        donorSignatureConfirmed: dto.consent?.donorSignatureConfirmed ?? true,
        consentTimestamp: new Date(),
      },
      decision: finalDecision,
      deferralType: finalDeferralType,
      deferralReason: finalDeferralReason,
      deferredUntil: finalDeferredUntil,
      decisionRemarks: dto.decisionRemarks,
      collectionStatus:
        finalDecision === DonorScreeningDecision.SELECTED
          ? 'PENDING_COLLECTION'
          : 'CANCELLED',
      screenedBy: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : new Types.ObjectId(),
      screenedByName: actor?.fullName || actor?.name || 'Medical Screening Staff',
      screenedByRole: actor?.role || 'MEDICAL_OFFICER',
      screenedAt: new Date(),
    });

    const savedScreening = await screening.save();

    // Update Donor Document with latest screening and deferral state
    const donorUpdate: any = {
      lastScreeningDate: new Date(),
      lastScreeningDecision: finalDecision,
    };

    if (
      finalDecision === DonorScreeningDecision.TEMPORARILY_DEFERRED ||
      finalDecision === DonorScreeningDecision.PERMANENTLY_DEFERRED
    ) {
      donorUpdate.deferralStatus =
        finalDecision === DonorScreeningDecision.PERMANENTLY_DEFERRED
          ? 'PERMANENT'
          : 'TEMPORARY';
      donorUpdate.deferredUntil = finalDeferredUntil;
      donorUpdate.deferralReason = finalDeferralReason;
      if (finalDecision === DonorScreeningDecision.PERMANENTLY_DEFERRED) {
        donorUpdate.status = DonorStatus.INACTIVE;
      }
    } else if (finalDecision === DonorScreeningDecision.SELECTED) {
      donorUpdate.deferralStatus = 'NONE';
      donorUpdate.deferredUntil = null;
      donorUpdate.deferralReason = null;
      // Auto-activate profile for donation upon passing medical screening
      donorUpdate.status = DonorStatus.ACTIVE;
      if (actor && (actor._id || actor.id)) {
        donorUpdate.verifiedBy = actor._id || actor.id;
        donorUpdate.verifiedByName = actor.fullName || actor.name;
        donorUpdate.verifiedByRole = actor.role;
        donorUpdate.verifiedAt = new Date();
      }
    }

    const updatedDonor = await this.donorModel
      .findByIdAndUpdate(donor._id, { $set: donorUpdate }, { new: true })
      .exec();

    // Audit Logging
    if (this.auditLogsService && (actor?._id || actor?.id)) {
      this.auditLogsService
        .logEvent({
          actorId: actor._id || actor.id,
          actorName: actor.fullName || actor.name,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: AuditActionType.DONOR_STATUS_UPDATED,
          entityType: AuditEntityType.DONOR,
          entityId: donor._id.toString(),
          entityIdentifier: donor.donorCode,
          description: `Donor screening completed (${screeningCode}) with decision ${finalDecision}${finalDeferralReason ? `: ${finalDeferralReason}` : ''}`,
          afterState: {
            screeningCode,
            decision: finalDecision,
            deferralType: finalDeferralType,
            deferredUntil: finalDeferredUntil,
          },
        })
        .catch(() => null);
    }

    return {
      message:
        finalDecision === DonorScreeningDecision.SELECTED
          ? `Donor '${donor.fullName}' successfully screened and selected for blood donation.`
          : `Donor '${donor.fullName}' deferred from blood donation (${finalDeferralReason || 'Clinical reason'}).`,
      screening: savedScreening,
      donor: updatedDonor,
      autoEvaluation: {
        passed: reasons.length === 0,
        reasons,
        suggestedDecision: autoDecision,
      },
    };
  }

  /**
   * Retrieves all screenings for a donor, ordered by date descending.
   */
  async findScreeningsByDonor(donorId: string): Promise<DonorScreening[]> {
    if (!isValidObjectId(donorId)) {
      throw new BadRequestException('Invalid donor ID format');
    }
    return this.screeningModel
      .find({ donorId: new Types.ObjectId(donorId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Retrieves a single screening by ID.
   */
  async findScreeningById(id: string): Promise<DonorScreening> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid screening ID format');
    }
    const screening = await this.screeningModel.findById(id).exec();
    if (!screening) {
      throw new NotFoundException(`Screening record with ID '${id}' was not found.`);
    }
    return screening;
  }

  /**
   * Finds an active SELECTED screening ready for collection today.
   */
  async findActiveScreeningForDonor(donorId: string): Promise<DonorScreeningDocument | null> {
    if (!isValidObjectId(donorId)) {
      throw new BadRequestException('Invalid donor ID format');
    }
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

    return this.screeningModel
      .findOne({
        donorId: new Types.ObjectId(donorId),
        decision: DonorScreeningDecision.SELECTED,
        collectionStatus: 'PENDING_COLLECTION',
        createdAt: { $gte: startOfDay },
      })
      .sort({ createdAt: -1 })
      .exec();
  }
}
