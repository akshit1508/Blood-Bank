import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CampaignsService } from './campaigns.service';
import { Campaign } from '../schemas/campaign.schema';
import { CampaignBudgetRevision } from '../schemas/campaign-budget-revision.schema';
import { Expense } from '../../expenses/schemas/expense.schema';
import { Donation } from '../../donations/schemas/donation.schema';
import { BloodUnit } from '../../blood-units/schemas/blood-unit.schema';
import { BloodTesting } from '../../testing/schemas/blood-testing.schema';
import { Inventory } from '../../inventory/schemas/inventory.schema';
import { Donor } from '../../donors/schemas/donor.schema';
import { BloodUnitStatus, BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';
import { TestingDecision, TestingStatus, TestResultStatus } from '../../testing/constants/testing.constants';
import { DonorEligibilityService } from '../../donors/services/donor-eligibility.service';
import { ExpiryRulesService } from '../../inventory/services/expiry-rules.service';

describe('CampaignsService - Phase 1 Safety & Release Safeguards', () => {
  let service: CampaignsService;
  let mockCampaignModel: any;
  let mockBloodUnitModel: any;
  let mockBloodTestingModel: any;
  let mockDonationModel: any;
  let mockDonorModel: any;
  let mockInventoryModel: any;
  let mockDonorEligibilityService: any;
  let mockExpiryRulesService: any;

  const validCampaignId = new Types.ObjectId().toString();
  const validDonorId = new Types.ObjectId().toString();

  const mockCampaign = {
    _id: new Types.ObjectId(validCampaignId),
    campaignCode: 'CAMP-202610-A1B2',
    name: 'Red Cross Mobile Blood Drive',
  };

  const mockDonor = {
    _id: new Types.ObjectId(validDonorId),
    donorCode: 'DNR-TEST-01',
    fullName: 'Anil Kumar',
    bloodGroup: 'B+',
    gender: 'MALE',
    phone: '+91 9876543210',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    mockCampaignModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCampaign),
      }),
    };

    function MockDonation(dto: any) {
      this._id = new Types.ObjectId();
      this.donationCode = dto.donationCode;
      this.save = jest.fn().mockResolvedValue(this);
    }
    mockDonationModel = MockDonation;

    function MockBloodUnit(dto: any) {
      this._id = new Types.ObjectId();
      this.unitCode = dto.unitCode;
      this.status = dto.status;
      this.expiryDate = dto.expiryDate;
      this.componentType = dto.componentType;
      this.bloodGroup = dto.bloodGroup;
      this.save = jest.fn().mockResolvedValue(this);
    }
    MockBloodUnit.findById = jest.fn();
    mockBloodUnitModel = MockBloodUnit;

    function MockBloodTesting(dto: any) {
      this._id = new Types.ObjectId();
      this.testingCode = dto.testingCode;
      this.status = dto.status;
      this.decision = dto.decision;
      this.testResults = dto.testResults;
      this.save = jest.fn().mockResolvedValue(this);
    }
    MockBloodTesting.findOne = jest.fn();
    mockBloodTestingModel = MockBloodTesting;

    mockDonorModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDonor),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDonor),
      }),
    };

    mockInventoryModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn().mockResolvedValue({}),
      countDocuments: jest.fn().mockResolvedValue(1),
    };

    mockDonorEligibilityService = {
      validateEligibility: jest.fn().mockResolvedValue({ eligible: true }),
    };

    mockExpiryRulesService = {
      calculateExpiryDate: jest.fn().mockImplementation((date: Date, comp: string) => {
        const days = comp === 'PLATELETS' ? 5 : comp === 'FFP' ? 365 : comp === 'PRBC' ? 42 : 35;
        return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: getModelToken(Campaign.name), useValue: mockCampaignModel },
        { provide: getModelToken(CampaignBudgetRevision.name), useValue: {} },
        { provide: getModelToken(Expense.name), useValue: {} },
        { provide: getModelToken(Donation.name), useValue: mockDonationModel },
        { provide: getModelToken(BloodUnit.name), useValue: mockBloodUnitModel },
        { provide: getModelToken(BloodTesting.name), useValue: mockBloodTestingModel },
        { provide: getModelToken(Inventory.name), useValue: mockInventoryModel },
        { provide: getModelToken(Donor.name), useValue: mockDonorModel },
        { provide: DonorEligibilityService, useValue: mockDonorEligibilityService },
        { provide: ExpiryRulesService, useValue: mockExpiryRulesService },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  describe('Testing & Release Invariants on Campaign Donations', () => {
    it('must enforce that recording campaign donation enters physical unit status TESTING even if immediateScreeningDecision is APPROVED', async () => {
      const result = await service.recordCampaignDonation(validCampaignId, {
        donorId: validDonorId,
        donationDate: '2026-10-23T10:00:00Z',
        componentType: 'WHOLE_BLOOD',
        immediateScreeningDecision: 'APPROVED', // Camp staff tried to approve immediately
      });

      // INVARIANT: Cannot bypass laboratory testing
      expect(result.unit.status).toBe(BloodUnitStatus.TESTING);
      expect(result.unit.status).not.toBe(BloodUnitStatus.APPROVED);

      // INVARIANT: All 5 mandatory infectious disease tests must remain PENDING
      expect(result.testing.status).toBe(TestingStatus.IN_PROGRESS);
      expect(result.testing.decision).toBe(TestingDecision.PENDING);
      const pendingTests = result.testing.testResults.filter(
        (t: any) => t.status === TestResultStatus.PENDING,
      );
      expect(pendingTests.length).toBe(5);
    });

    it('should delegate donor eligibility check to authoritative DonorEligibilityService', async () => {
      await service.recordCampaignDonation(validCampaignId, {
        donorId: validDonorId,
        donationDate: '2026-10-23T10:00:00Z',
      });

      expect(mockDonorEligibilityService.validateEligibility).toHaveBeenCalled();
    });

    it('should use ExpiryRulesService for component-specific shelf life instead of flat 35 days', async () => {
      const donationDate = new Date('2026-10-20T10:00:00Z');

      // Test Platelets (5 days)
      const plateletResult = await service.recordCampaignDonation(validCampaignId, {
        donorId: validDonorId,
        donationDate: donationDate.toISOString(),
        componentType: 'PLATELETS',
      });

      const plateletExpiry = new Date(plateletResult.unit.expiryDate!);
      const plateletDiffDays = Math.round(
        (plateletExpiry.getTime() - donationDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(plateletDiffDays).toBe(5);

      // Test PRBC (42 days)
      const prbcResult = await service.recordCampaignDonation(validCampaignId, {
        donorId: validDonorId,
        donationDate: donationDate.toISOString(),
        componentType: 'PRBC',
      });

      const prbcExpiry = new Date(prbcResult.unit.expiryDate!);
      const prbcDiffDays = Math.round(
        (prbcExpiry.getTime() - donationDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(prbcDiffDays).toBe(42);
    });

    it('should block unauthorized testing approval if required screening tests are still pending', async () => {
      const mockUnit = {
        _id: new Types.ObjectId(),
        unitCode: 'UNIT-20261023-B3C4',
        status: BloodUnitStatus.TESTING,
        save: jest.fn().mockResolvedValue(true),
      };

      mockBloodUnitModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUnit),
      });

      // Mock testing record with pending tests
      mockBloodTestingModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          testResults: [
            { testCode: 'HIV', status: TestResultStatus.PENDING },
            { testCode: 'HBV', status: TestResultStatus.PASS },
          ],
        }),
      });

      await expect(
        service.updateCampaignUnitTestingDecision(validCampaignId, mockUnit._id.toString(), {
          decision: 'APPROVED',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
