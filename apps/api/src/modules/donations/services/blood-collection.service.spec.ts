import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DonationsService } from '../donations.service';
import { Donation } from '../schemas/donation.schema';
import { Donor } from '../../donors/schemas/donor.schema';
import { DonorScreening } from '../../donors/schemas/donor-screening.schema';
import { BloodUnit } from '../../blood-units/schemas/blood-unit.schema';
import { BloodTesting } from '../../testing/schemas/blood-testing.schema';
import { ExpiryRulesService } from '../../inventory/services/expiry-rules.service';
import { DonorEligibilityService } from '../../donors/services/donor-eligibility.service';
import { DonationType, DonationStatus } from '../constants/donation.constants';
import { BloodUnitStatus } from '../../blood-units/constants/blood-unit.constants';
import { TestingStatus } from '../../testing/constants/testing.constants';
import { BagType, CollectionOutcome, BagIntegrity } from '../../donors/constants/screening.constants';

describe('DonationsService - Blood Collection (Phlebotomy)', () => {
  let service: DonationsService;
  let mockDonationModel: any;
  let mockDonorModel: any;
  let mockDonorScreeningModel: any;
  let mockBloodUnitModel: any;
  let mockBloodTestingModel: any;
  let mockExpiryRulesService: any;
  let mockDonorEligibilityService: any;

  const validDonorId = new Types.ObjectId().toString();
  const validScreeningId = new Types.ObjectId().toString();

  const mockDonor = {
    _id: new Types.ObjectId(validDonorId),
    donorCode: 'DNR-1001',
    fullName: 'Rajesh Kumar',
    bloodGroup: 'B_POSITIVE',
    age: 30,
    gender: 'MALE',
    status: 'ACTIVE',
  };

  const mockApprovedScreening = {
    _id: new Types.ObjectId(validScreeningId),
    donorId: new Types.ObjectId(validDonorId),
    screeningCode: 'SCR-20261023-0001',
    decision: 'SELECTED',
    collectionStatus: 'PENDING_COLLECTION',
    createdAt: new Date(),
    vitals: {
      weightKg: 65,
      hemoglobinGdl: 14.0,
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      pulseBpm: 72,
    },
    save: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    mockDonorModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDonor),
      }),
    };

    mockDonorScreeningModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockApprovedScreening, save: jest.fn().mockResolvedValue(true) }),
      }),
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockApprovedScreening, save: jest.fn().mockResolvedValue(true) }),
        }),
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(true),
    };

    mockDonationModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: new Types.ObjectId(),
      donationCode: 'DON-20261023-0001',
      save: jest.fn().mockResolvedValue({
        ...dto,
        _id: new Types.ObjectId(),
        donationCode: 'DON-20261023-0001',
      }),
    }));

    (mockDonationModel as any).countDocuments = jest.fn().mockResolvedValue(0);
    (mockDonationModel as any).exists = jest.fn().mockResolvedValue(null);
    (mockDonationModel as any).find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    mockBloodUnitModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: new Types.ObjectId(),
      unitCode: 'BU-20261023-0001',
      save: jest.fn().mockResolvedValue({
        ...dto,
        _id: new Types.ObjectId(),
        unitCode: 'BU-20261023-0001',
      }),
    }));
    (mockBloodUnitModel as any).countDocuments = jest.fn().mockResolvedValue(0);
    (mockBloodUnitModel as any).exists = jest.fn().mockResolvedValue(null);

    mockBloodTestingModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: new Types.ObjectId(),
      testCode: 'TEST-20261023-0001',
      save: jest.fn().mockResolvedValue({
        ...dto,
        _id: new Types.ObjectId(),
        testCode: 'TEST-20261023-0001',
      }),
    }));
    (mockBloodTestingModel as any).exists = jest.fn().mockResolvedValue(null);

    mockExpiryRulesService = {
      calculateExpiryDate: jest.fn().mockReturnValue(new Date('2026-11-27')),
    };

    mockDonorEligibilityService = {
      validateEligibility: jest.fn().mockResolvedValue({ isEligible: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        {
          provide: getModelToken(Donation.name),
          useValue: mockDonationModel,
        },
        {
          provide: getModelToken(Donor.name),
          useValue: mockDonorModel,
        },
        {
          provide: getModelToken(DonorScreening.name),
          useValue: mockDonorScreeningModel,
        },
        {
          provide: getModelToken(BloodUnit.name),
          useValue: mockBloodUnitModel,
        },
        {
          provide: getModelToken(BloodTesting.name),
          useValue: mockBloodTestingModel,
        },
        {
          provide: ExpiryRulesService,
          useValue: mockExpiryRulesService,
        },
        {
          provide: DonorEligibilityService,
          useValue: mockDonorEligibilityService,
        },
      ],
    }).compile();

    service = module.get<DonationsService>(DonationsService);
  });

  describe('recordBloodCollection', () => {
    const user = { userId: 'staff-1', name: 'Phleb Ramesh', role: 'STAFF' };

    it('should successfully record blood collection and queue unit for TESTING', async () => {
      const result = await service.recordBloodCollection(
        {
          donorId: validDonorId,
          screeningId: validScreeningId,
          bagType: BagType.TRIPLE_450ML,
          collectedVolumeMl: 450,
          venipunctureSite: 'LEFT_ANTECUBITAL_FOSSA',
          collectionOutcome: CollectionOutcome.SUCCESSFUL,
          bagIntegrity: BagIntegrity.INTACT,
        },
        user,
      );

      expect(result).toBeDefined();
      expect(result.donation).toBeDefined();
      expect(result.bloodUnit).toBeDefined();
      expect(result.label).toBeDefined();
      expect(result.label.bagBarcode).toMatch(/^BAG-\d{8}-[A-Z0-9]{4}$/);
      expect(result.bloodUnit?.status).toBe(BloodUnitStatus.TESTING);
      expect(mockBloodTestingModel).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TestingStatus.IN_PROGRESS,
        }),
      );
    });

    it('should throw BadRequestException if donor has no active screening', async () => {
      mockDonorScreeningModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockDonorScreeningModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.recordBloodCollection(
          {
            donorId: validDonorId,
            bagType: BagType.TRIPLE_450ML,
            collectedVolumeMl: 450,
          },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if screening is deferred (not SELECTED)', async () => {
      mockDonorScreeningModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockApprovedScreening,
          decision: 'TEMPORARILY_DEFERRED',
        }),
      });

      await expect(
        service.recordBloodCollection(
          {
            donorId: validDonorId,
            screeningId: validScreeningId,
            bagType: BagType.TRIPLE_450ML,
            collectedVolumeMl: 450,
          },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if screening was already used for collection', async () => {
      mockDonorScreeningModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockApprovedScreening,
          collectionStatus: 'COLLECTED',
        }),
      });

      await expect(
        service.recordBloodCollection(
          {
            donorId: validDonorId,
            screeningId: validScreeningId,
            bagType: BagType.TRIPLE_450ML,
            collectedVolumeMl: 450,
          },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if donor weight is < 50 kg and volume > 350 mL', async () => {
      mockDonorScreeningModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockApprovedScreening,
          vitals: {
            ...mockApprovedScreening.vitals,
            weightKg: 47,
          },
        }),
      });

      await expect(
        service.recordBloodCollection(
          {
            donorId: validDonorId,
            screeningId: validScreeningId,
            bagType: BagType.TRIPLE_450ML,
            collectedVolumeMl: 450,
          },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark unit as REJECTED and cancel donation if bag integrity defect is found', async () => {
      const result = await service.recordBloodCollection(
        {
          donorId: validDonorId,
          screeningId: validScreeningId,
          bagType: BagType.TRIPLE_450ML,
          collectedVolumeMl: 450,
          bagIntegrity: BagIntegrity.LEAKING,
        },
        user,
      );

      expect(result.bloodUnit?.status).toBe(BloodUnitStatus.REJECTED);
      expect(result.donation.status).toBe(DonationStatus.CANCELLED);
    });
  });
});
