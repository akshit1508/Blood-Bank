import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DonorScreeningService } from './donor-screening.service';
import { DonorScreening } from '../schemas/donor-screening.schema';
import { Donor } from '../schemas/donor.schema';
import { DonorEligibilityService } from './donor-eligibility.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { DonorScreeningDecision } from '../constants/screening.constants';

describe('DonorScreeningService', () => {
  let service: DonorScreeningService;
  let mockDonorScreeningModel: any;
  let mockDonorModel: any;
  let mockDonorEligibilityService: any;
  let mockAuditLogsService: any;

  const validDonorId = new Types.ObjectId().toString();

  const mockActiveDonor = {
    _id: new Types.ObjectId(validDonorId),
    donorCode: 'DNR-1001',
    fullName: 'Ramesh Sharma',
    bloodGroup: 'O_POSITIVE',
    age: 28,
    gender: 'MALE',
    status: 'ACTIVE',
    deferralStatus: null,
    deferredUntil: null,
    save: jest.fn().mockResolvedValue(true),
  };

  const validVitals = {
    weightKg: 65,
    hemoglobinGdl: 14.2,
    bloodPressureSystolic: 120,
    bloodPressureDiastolic: 80,
    pulseBpm: 76,
    temperatureCelsius: 36.8,
    veinAccess: 'GOOD',
    generalAppearance: 'Healthy and alert',
  };

  const clearQuestionnaire = {
    feelingWellToday: true,
    recentIllnessOrFever: false,
    takingMedications: false,
    tattooPiercingLast12Months: false,
    majorSurgeryOrDentalRecent: false,
    alcoholIntakeLast24Hours: false,
    cardiacOrRespiratoryDisease: false,
    historyOfJaundiceOrHepatitis: false,
    malariaTreatmentOrTravelHistory: false,
    pregnantOrLactating: false,
  };

  const validConsent = {
    consentAcknowledged: true,
    donorSignatureConfirmed: true,
  };

  beforeEach(async () => {
    mockDonorModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockActiveDonor, save: jest.fn().mockResolvedValue(true) }),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(true),
      }),
    };

    mockDonorScreeningModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: new Types.ObjectId(),
      screeningCode: 'SCR-20261023-ABCD',
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue({
        ...dto,
        _id: new Types.ObjectId(),
        screeningCode: 'SCR-20261023-ABCD',
        createdAt: new Date(),
      }),
    }));

    (mockDonorScreeningModel as any).find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });

    (mockDonorScreeningModel as any).findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    (mockDonorScreeningModel as any).exists = jest.fn().mockResolvedValue(null);

    mockDonorEligibilityService = {
      validateEligibility: jest.fn().mockResolvedValue({
        isEligible: true,
        issues: [],
      }),
    };

    mockAuditLogsService = {
      logAction: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonorScreeningService,
        {
          provide: getModelToken(DonorScreening.name),
          useValue: mockDonorScreeningModel,
        },
        {
          provide: getModelToken(Donor.name),
          useValue: mockDonorModel,
        },
        {
          provide: DonorEligibilityService,
          useValue: mockDonorEligibilityService,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get<DonorScreeningService>(DonorScreeningService);
  });

  describe('createScreening - Clinical Thresholds & NBTC Rules', () => {
    it('should successfully screen and select a compliant donor', async () => {
      const user = { userId: 'staff-1', name: 'Dr. Anita', role: 'DOCTOR' };
      const result = await service.createScreening(
        {
          donorId: validDonorId,
          vitals: validVitals,
          questionnaire: clearQuestionnaire,
          consent: validConsent,
          decision: DonorScreeningDecision.SELECTED,
        },
        user,
      );

      expect(result).toBeDefined();
      expect(result.screening).toBeDefined();
      expect(result.screening.screeningCode).toBeDefined();
      expect(result.screening.decision).toBe(DonorScreeningDecision.SELECTED);
    });

    it('should throw BadRequestException when Hb is below 12.5 g/dL and decision is SELECTED', async () => {
      const user = { userId: 'staff-1', name: 'Dr. Anita', role: 'DOCTOR' };
      await expect(
        service.createScreening(
          {
            donorId: validDonorId,
            vitals: { ...validVitals, hemoglobinGdl: 11.5 },
            questionnaire: clearQuestionnaire,
            consent: validConsent,
            decision: DonorScreeningDecision.SELECTED,
          },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when weight is below 45 kg and decision is SELECTED', async () => {
      const user = { userId: 'staff-1', name: 'Dr. Anita', role: 'DOCTOR' };
      await expect(
        service.createScreening(
          {
            donorId: validDonorId,
            vitals: { ...validVitals, weightKg: 42 },
            questionnaire: clearQuestionnaire,
            consent: validConsent,
            decision: DonorScreeningDecision.SELECTED,
          },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when donor has jaundice/hepatitis history and decision is SELECTED', async () => {
      const user = { userId: 'staff-1', name: 'Dr. Anita', role: 'DOCTOR' };
      await expect(
        service.createScreening(
          {
            donorId: validDonorId,
            vitals: validVitals,
            questionnaire: { ...clearQuestionnaire, historyOfJaundiceOrHepatitis: true },
            consent: validConsent,
            decision: DonorScreeningDecision.SELECTED,
          },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should persist permanent deferral on donor document when permanently deferred', async () => {
      const user = { userId: 'staff-1', name: 'Dr. Anita', role: 'DOCTOR' };
      const result = await service.createScreening(
        {
          donorId: validDonorId,
          vitals: validVitals,
          questionnaire: { ...clearQuestionnaire, historyOfJaundiceOrHepatitis: true },
          consent: validConsent,
          decision: DonorScreeningDecision.PERMANENTLY_DEFERRED,
          deferralReason: 'History of Viral Hepatitis',
        },
        user,
      );

      expect(result.screening.decision).toBe(DonorScreeningDecision.PERMANENTLY_DEFERRED);
      expect(mockDonorModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            deferralStatus: 'PERMANENT',
            deferralReason: 'History of Viral Hepatitis',
          }),
        }),
        expect.anything(),
      );
    });

    it('should persist temporary deferral on donor document when temporarily deferred', async () => {
      const user = { userId: 'staff-1', name: 'Dr. Anita', role: 'DOCTOR' };
      const deferDate = new Date();
      deferDate.setDate(deferDate.getDate() + 90);

      const result = await service.createScreening(
        {
          donorId: validDonorId,
          vitals: { ...validVitals, hemoglobinGdl: 11.8 },
          questionnaire: clearQuestionnaire,
          consent: validConsent,
          decision: DonorScreeningDecision.TEMPORARILY_DEFERRED,
          deferralReason: 'Sub-threshold hemoglobin: dietary iron advised',
          deferredUntil: deferDate.toISOString(),
        },
        user,
      );

      expect(result.screening.decision).toBe(DonorScreeningDecision.TEMPORARILY_DEFERRED);
      expect(mockDonorModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            deferralStatus: 'TEMPORARY',
            deferralReason: 'Sub-threshold hemoglobin: dietary iron advised',
          }),
        }),
        expect.anything(),
      );
    });

    it('should require consent before allowing SELECTED decision', async () => {
      const user = { userId: 'staff-1', name: 'Dr. Anita', role: 'DOCTOR' };
      await expect(
        service.createScreening(
          {
            donorId: validDonorId,
            vitals: validVitals,
            questionnaire: clearQuestionnaire,
            consent: { ...validConsent, consentAcknowledged: false },
            decision: DonorScreeningDecision.SELECTED,
          },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
