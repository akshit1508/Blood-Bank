import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DonorEligibilityService } from './donor-eligibility.service';
import { Donor } from '../schemas/donor.schema';
import { Donation } from '../../donations/schemas/donation.schema';
import { DonorStatus, Gender, BloodGroup } from '../constants/donor.constants';
import { DonationStatus, DonationType } from '../../donations/constants/donation.constants';

describe('DonorEligibilityService', () => {
  let service: DonorEligibilityService;
  let mockDonorModel: any;
  let mockDonationModel: any;

  const validDonorId = new Types.ObjectId().toString();

  const mockActiveDonor = {
    _id: new Types.ObjectId(validDonorId),
    donorCode: 'DNR-TEST-001',
    fullName: 'Rahul Sharma',
    gender: Gender.MALE,
    bloodGroup: BloodGroup.O_POSITIVE,
    status: DonorStatus.ACTIVE,
    dateOfBirth: new Date('1995-05-15'), // ~31 years old
  };

  beforeEach(async () => {
    mockDonorModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockActiveDonor),
      }),
    };

    mockDonationModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
        exec: jest.fn().mockResolvedValue(null),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonorEligibilityService,
        { provide: getModelToken(Donor.name), useValue: mockDonorModel },
        { provide: getModelToken(Donation.name), useValue: mockDonationModel },
      ],
    }).compile();

    service = module.get<DonorEligibilityService>(DonorEligibilityService);
  });

  describe('Donor Status & Existence Gate', () => {
    it('should throw NotFoundException if donor does not exist', async () => {
      mockDonorModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.validateEligibility(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject donor with PENDING_REVIEW status', async () => {
      const pendingDonor = { ...mockActiveDonor, status: DonorStatus.PENDING_REVIEW };
      await expect(
        service.validateEligibility(pendingDonor),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject donor with INACTIVE status', async () => {
      const inactiveDonor = { ...mockActiveDonor, status: DonorStatus.INACTIVE };
      await expect(
        service.validateEligibility(inactiveDonor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Age Eligibility Validation (18-65 years)', () => {
    it('should reject donor under 18 years of age', async () => {
      // 16 years old
      const underageDonor = {
        ...mockActiveDonor,
        dateOfBirth: new Date('2010-01-01'),
      };

      await expect(
        service.validateEligibility(underageDonor, new Date('2026-05-01')),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject donor over 65 years of age', async () => {
      // 67 years old
      const overageDonor = {
        ...mockActiveDonor,
        dateOfBirth: new Date('1958-01-01'),
      };

      await expect(
        service.validateEligibility(overageDonor, new Date('2026-05-01')),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve donor between 18 and 65 years old', async () => {
      const eligibleDonor = {
        ...mockActiveDonor,
        dateOfBirth: new Date('1990-01-01'),
      };

      const result = await service.validateEligibility(eligibleDonor, new Date('2026-05-01'));
      expect(result.eligible).toBe(true);
      expect(result.age).toBe(36);
    });
  });

  describe('Gender-Based Whole-Blood Interval Enforcement', () => {
    it('should reject male whole-blood donation if fewer than 90 days have elapsed', async () => {
      const maleDonor = { ...mockActiveDonor, gender: Gender.MALE };
      const lastDonationDate = new Date('2026-01-01');
      const attemptedDate = new Date('2026-03-31'); // 89 days later

      mockDonationModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            donationDate: lastDonationDate,
            donationType: DonationType.WHOLE_BLOOD,
            status: DonationStatus.COMPLETED,
          }),
        }),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.validateEligibility(maleDonor, attemptedDate, DonationType.WHOLE_BLOOD),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow male whole-blood donation after 90 days have elapsed', async () => {
      const maleDonor = { ...mockActiveDonor, gender: Gender.MALE };
      const lastDonationDate = new Date('2026-01-01');
      const attemptedDate = new Date('2026-04-02'); // 91 days later

      mockDonationModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            donationDate: lastDonationDate,
            donationType: DonationType.WHOLE_BLOOD,
            status: DonationStatus.COMPLETED,
          }),
        }),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.validateEligibility(
        maleDonor,
        attemptedDate,
        DonationType.WHOLE_BLOOD,
      );
      expect(result.eligible).toBe(true);
      expect(result.daysSinceLastDonation).toBeGreaterThanOrEqual(90);
    });

    it('should reject female whole-blood donation if fewer than 120 days have elapsed', async () => {
      const femaleDonor = { ...mockActiveDonor, gender: Gender.FEMALE };
      const lastDonationDate = new Date('2026-01-01');
      const attemptedDate = new Date('2026-04-20'); // 109 days later (< 120)

      mockDonationModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            donationDate: lastDonationDate,
            donationType: DonationType.WHOLE_BLOOD,
            status: DonationStatus.COMPLETED,
          }),
        }),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.validateEligibility(femaleDonor, attemptedDate, DonationType.WHOLE_BLOOD),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Duplicate Same-Day Submission & Future Timestamp Rejection', () => {
    it('should reject donation timestamp set in the future', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 mins in future
      await expect(
        service.validateEligibility(mockActiveDonor, futureDate),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate donation submission for the same donor on the same day', async () => {
      const donationDate = new Date('2026-05-10T10:00:00Z');

      // Mock existing same-day donation
      mockDonationModel.findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
        exec: jest.fn().mockResolvedValue(null),
      }).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          donationCode: 'DONATION-20260510-ABCD',
          status: DonationStatus.COMPLETED,
        }),
      });

      await expect(
        service.validateEligibility(mockActiveDonor, donationDate),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
