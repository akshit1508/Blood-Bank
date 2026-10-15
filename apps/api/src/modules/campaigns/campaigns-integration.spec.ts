import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { CampaignsService } from './services/campaigns.service';
import { Campaign } from './schemas/campaign.schema';
import { CampaignBudgetRevision } from './schemas/campaign-budget-revision.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { Donation } from '../donations/schemas/donation.schema';
import { CampaignStatus } from './constants/campaign.constants';
import { ExpenseStatus, ExpenseCategory } from '../expenses/constants/expense.constants';
import { DonationStatus } from '../donations/constants/donation.constants';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminRole } from '../auth/schemas/admin-user.schema';

describe('Phase 7 — Campaigns & Budget Management Integration Suite', () => {
  let campaignsService: CampaignsService;

  let campaignStore: any[] = [];
  let revisionStore: any[] = [];
  let expenseStore: any[] = [];
  let donationStore: any[] = [];

  const mockSuperAdmin = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    email: 'superadmin@bloodbank.org',
    role: 'SUPER_ADMIN',
    fullName: 'Chief Super Admin',
  };

  const mockAdmin = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    email: 'opsadmin@bloodbank.org',
    role: 'ADMIN',
    fullName: 'Operations Officer',
  };

  beforeEach(async () => {
    campaignStore = [];
    revisionStore = [];
    expenseStore = [];
    donationStore = [];

    // --- Mock Campaign Model ---
    const mockCampaignModel: any = jest.fn().mockImplementation((doc) => {
      const instance = {
        _id: doc._id || new Types.ObjectId(),
        budgetVersion: 1,
        budgetRevisionCount: 0,
        status: CampaignStatus.PLANNED,
        ...doc,
        save: jest.fn().mockImplementation(async function () {
          const idx = campaignStore.findIndex((c) => c._id.toString() === this._id.toString());
          if (idx >= 0) {
            campaignStore[idx] = { ...this };
          } else {
            campaignStore.push({ ...this });
          }
          return this;
        }),
      };
      return instance;
    });

    mockCampaignModel.find = jest.fn().mockImplementation((filter: any = {}) => ({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        let results = [...campaignStore];
        if (filter.status) {
          results = results.filter((c) => c.status === filter.status);
        }
        if (filter.city) {
          results = results.filter((c) => c.city === filter.city);
        }
        return results;
      }),
    }));

    mockCampaignModel.countDocuments = jest.fn().mockImplementation(async (filter: any = {}) => {
      let results = [...campaignStore];
      if (filter.status) results = results.filter((c) => c.status === filter.status);
      if (filter.city) results = results.filter((c) => c.city === filter.city);
      return results.length;
    });

    mockCampaignModel.findById = jest.fn().mockImplementation((id: any) => {
      const getDoc = () => {
        const item = campaignStore.find((c) => c._id.toString() === id.toString());
        if (!item) return null;
        return {
          ...item,
          save: jest.fn().mockImplementation(async function () {
            const idx = campaignStore.findIndex((c) => c._id.toString() === this._id.toString());
            if (idx >= 0) campaignStore[idx] = { ...this };
            return this;
          }),
        };
      };
      return {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockImplementation(async () => getDoc()),
        then: (resolve: any, reject: any) => Promise.resolve(getDoc()).then(resolve, reject),
      };
    });

    mockCampaignModel.findOne = jest.fn().mockImplementation((filter: any) => ({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        if (filter.campaignCode) {
          return campaignStore.find((c) => c.campaignCode === filter.campaignCode) || null;
        }
        return null;
      }),
      then: (resolve: any, reject: any) => {
        const found = filter.campaignCode ? campaignStore.find((c) => c.campaignCode === filter.campaignCode) || null : null;
        return Promise.resolve(found).then(resolve, reject);
      },
    }));

    mockCampaignModel.findOneAndUpdate = jest.fn().mockImplementation((filter: any, update: any, options: any) => {
      const getDoc = () => {
        const idx = campaignStore.findIndex(
          (c) => c._id.toString() === filter._id.toString() && c.budgetVersion === filter.budgetVersion
        );
        if (idx === -1) return null;

        const current = campaignStore[idx];
        const updated = {
          ...current,
          ...(update.$set || {}),
          budgetVersion: current.budgetVersion + 1,
          budgetRevisionCount: (current.budgetRevisionCount || 0) + 1,
        };
        campaignStore[idx] = updated;
        return updated;
      };
      return {
        exec: jest.fn().mockImplementation(async () => getDoc()),
        then: (resolve: any, reject: any) => Promise.resolve(getDoc()).then(resolve, reject),
      };
    });

    // --- Mock Revision Model ---
    const mockRevisionModel: any = jest.fn().mockImplementation((doc) => {
      const instance = {
        _id: doc._id || new Types.ObjectId(),
        createdAt: new Date(),
        ...doc,
        save: jest.fn().mockImplementation(async function () {
          revisionStore.push({ ...this });
          return this;
        }),
      };
      return instance;
    });

    mockRevisionModel.find = jest.fn().mockImplementation((filter: any = {}) => ({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        let results = [...revisionStore];
        if (filter.campaignId) {
          results = results.filter((r) => r.campaignId.toString() === filter.campaignId.toString());
        }
        return results;
      }),
    }));

    // --- Mock Expense Model ---
    const mockExpenseModel: any = {
      findById: jest.fn().mockImplementation((id: any) => {
        const getDoc = () => {
          const item = expenseStore.find((e) => e._id.toString() === id.toString());
          if (!item) return null;
          return {
            auditHistory: [],
            ...item,
            save: jest.fn().mockImplementation(async function () {
              const idx = expenseStore.findIndex((e) => e._id.toString() === this._id.toString());
              if (idx >= 0) expenseStore[idx] = { ...this };
              return this;
            }),
          };
        };
        return {
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockImplementation(async () => getDoc()),
          then: (resolve: any, reject: any) => Promise.resolve(getDoc()).then(resolve, reject),
        };
      }),
      find: jest.fn().mockImplementation((filter: any = {}) => ({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockImplementation(async () => {
          let results = [...expenseStore];
          if (filter.campaignId) {
            results = results.filter((e) => e.campaignId?.toString() === filter.campaignId.toString());
          }
          if (filter.status) {
            results = results.filter((e) => e.status === filter.status);
          }
          return results;
        }),
      })),
    };

    // --- Mock Donation Model ---
    const mockDonationModel: any = {
      countDocuments: jest.fn().mockImplementation(async (filter: any = {}) => {
        let results = [...donationStore];
        if (filter.campaignId) {
          results = results.filter((d) => d.campaignId?.toString() === filter.campaignId.toString());
        }
        if (filter.status) {
          results = results.filter((d) => d.status === filter.status);
        }
        return results.length;
      }),
      aggregate: jest.fn().mockImplementation(async (pipeline: any[]) => {
        const match = pipeline[0]?.$match || {};
        let filtered = [...donationStore];
        if (match.campaignId) {
          filtered = filtered.filter((d) => d.campaignId?.toString() === match.campaignId.toString());
        }
        if (match.status) {
          filtered = filtered.filter((d) => d.status === match.status);
        }
        const totalUnits = filtered.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
        return [{ _id: null, totalUnits }];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: getModelToken(Campaign.name), useValue: mockCampaignModel },
        { provide: getModelToken(CampaignBudgetRevision.name), useValue: mockRevisionModel },
        { provide: getModelToken(Expense.name), useValue: mockExpenseModel },
        { provide: getModelToken(Donation.name), useValue: mockDonationModel },
      ],
    }).compile();

    campaignsService = module.get<CampaignsService>(CampaignsService);
  });

  describe('Campaign Creation & Code Generation', () => {
    it('creates a campaign with integer-paise budget and auto-generated CAMP-YYYYMM-XXXX code', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'City Pride Mega Donation Drive',
          venue: 'Town Hall Auditorium',
          city: 'Mumbai',
          startDate: new Date('2026-11-01').toISOString(),
          endDate: new Date('2026-11-03').toISOString(),
          targetDonations: 300,
          initialBudget: 75000, // 75,000 INR = 7,500,000 paise
        },
        mockSuperAdmin,
      );

      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('City Pride Mega Donation Drive');
      expect(campaign.campaignCode).toMatch(/^CAMP-\d{6}-[A-Z0-9]{4}$/);
      expect(campaign.initialBudgetPaise).toBe(7500000);
      expect(campaign.approvedBudgetPaise).toBe(7500000);
      expect(campaign.approvedBudget).toBe(75000);
      expect(campaign.budgetVersion).toBe(1);
      expect(campaign.budgetRevisionCount).toBe(1);
      expect(campaign.status).toBe(CampaignStatus.PLANNED);
    });

    it('creates a campaign with initial budget revision record logged', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Campus Blood Drive',
          venue: 'Sports Complex',
          city: 'Delhi',
          startDate: new Date('2026-12-01').toISOString(),
          endDate: new Date('2026-12-01').toISOString(),
          targetDonations: 100,
          initialBudget: 25000,
        },
        mockSuperAdmin,
      );

      const revisions = await campaignsService.getCampaignBudgetRevisions(campaign._id.toString());
      expect(revisions.length).toBe(1);
      expect(revisions[0].revisionNumber).toBe(1);
      expect(revisions[0].previousBudgetPaise).toBe(0);
      expect(revisions[0].newBudgetPaise).toBe(2500000);
      expect(revisions[0].deltaPaise).toBe(2500000);
      expect(revisions[0].actorEmail).toBe(mockSuperAdmin.email);
      expect(revisions[0].actorName).toBe(mockSuperAdmin.fullName);
    });
  });

  describe('Budget Revision & Concurrency Control', () => {
    it('successfully revises budget with delta calculation and audit record', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Winter Blood Drive',
          venue: 'Community Hall',
          city: 'Pune',
          startDate: new Date('2026-11-10').toISOString(),
          endDate: new Date('2026-11-10').toISOString(),
          targetDonations: 150,
          initialBudget: 50000, // 5,000,000 paise
        },
        mockSuperAdmin,
      );

      // Revise budget to 65,000 INR (+15,000 INR)
      const { campaign: revisedCampaign, revision } = await campaignsService.reviseCampaignBudget(
        campaign._id.toString(),
        {
          newBudget: 65000,
          reason: 'Expected 50% higher donor turnout due to media coverage',
          budgetVersion: 1,
        },
        mockSuperAdmin,
      );

      expect(revisedCampaign.approvedBudgetPaise).toBe(6500000);
      expect(revisedCampaign.approvedBudget).toBe(65000);
      expect(revisedCampaign.budgetVersion).toBe(2);
      expect(revisedCampaign.budgetRevisionCount).toBe(2);

      expect(revision.previousBudgetPaise).toBe(5000000);
      expect(revision.newBudgetPaise).toBe(6500000);
      expect(revision.deltaPaise).toBe(1500000);
      expect(revision.delta).toBe(15000);
      expect(revision.reason).toBe('Expected 50% higher donor turnout due to media coverage');
    });

    it('rejects revision with ConflictException on budgetVersion mismatch (optimistic lock collision)', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Metro Drive',
          venue: 'Metro Plaza',
          city: 'Bangalore',
          startDate: new Date('2026-11-15').toISOString(),
          endDate: new Date('2026-11-15').toISOString(),
          targetDonations: 200,
          initialBudget: 40000,
        },
        mockSuperAdmin,
      );

      // Attempt revision with stale budgetVersion = 99
      await expect(
        campaignsService.reviseCampaignBudget(
          campaign._id.toString(),
          {
            newBudget: 50000,
            reason: 'Concurrent revision test',
            budgetVersion: 99,
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects budget revision with blank or empty reason', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Clinic Drive',
          venue: 'Clinic Grounds',
          city: 'Chennai',
          startDate: new Date('2026-11-20').toISOString(),
          endDate: new Date('2026-11-20').toISOString(),
          targetDonations: 80,
          initialBudget: 30000,
        },
        mockSuperAdmin,
      );

      await expect(
        campaignsService.reviseCampaignBudget(
          campaign._id.toString(),
          {
            newBudget: 35000,
            reason: '   ',
            budgetVersion: 1,
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Expense Linking & Duplicate Prevention', () => {
    it('links an approved expense to a campaign and prevents duplicate linking', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Corporate Blood Drive',
          venue: 'Cafeteria',
          city: 'Hyderabad',
          startDate: new Date('2026-11-25').toISOString(),
          endDate: new Date('2026-11-25').toISOString(),
          targetDonations: 250,
          initialBudget: 100000,
        },
        mockSuperAdmin,
      );

      const expenseId = new Types.ObjectId();
      const mockExp = {
        _id: expenseId,
        voucherNumber: 'EXP-2026-0001',
        title: 'Refreshments for Donors',
        category: ExpenseCategory.STAFF_CAMP_MEALS,
        amountPaise: 800000, // 8,000 INR
        amount: 8000,
        paidAmountPaise: 800000,
        status: ExpenseStatus.APPROVED,
        auditTrail: [],
        save: jest.fn().mockImplementation(async function () {
          const idx = expenseStore.findIndex((e) => e._id.toString() === this._id.toString());
          if (idx >= 0) expenseStore[idx] = { ...this };
          return this;
        }),
      };
      expenseStore.push(mockExp);

      // Link expense
      const linked = await campaignsService.linkExpenseToCampaign(
        campaign._id.toString(),
        expenseId.toString(),
        mockAdmin,
      );

      expect(linked.campaignId?.toString()).toBe(campaign._id.toString());
      expect(linked.campaignCode).toBe(campaign.campaignCode);

      // Attempt linking the same expense again -> throws ConflictException
      await expect(
        campaignsService.linkExpenseToCampaign(
          campaign._id.toString(),
          expenseId.toString(),
          mockAdmin,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('unlinks an expense from a campaign cleanly', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Community Drive',
          venue: 'Park Pavilion',
          city: 'Mumbai',
          startDate: new Date('2026-11-28').toISOString(),
          endDate: new Date('2026-11-28').toISOString(),
          targetDonations: 120,
          initialBudget: 50000,
        },
        mockSuperAdmin,
      );

      const expenseId = new Types.ObjectId();
      const mockExp = {
        _id: expenseId,
        voucherNumber: 'EXP-2026-0002',
        title: 'Canopy & Tent Rental',
        category: ExpenseCategory.LOGISTICS_TRANSPORT,
        amountPaise: 1200000, // 12,000 INR
        amount: 12000,
        paidAmountPaise: 1200000,
        status: ExpenseStatus.APPROVED,
        campaignId: campaign._id,
        campaignCode: campaign.campaignCode,
        auditTrail: [],
        save: jest.fn().mockImplementation(async function () {
          const idx = expenseStore.findIndex((e) => e._id.toString() === this._id.toString());
          if (idx >= 0) expenseStore[idx] = { ...this };
          return this;
        }),
      };
      expenseStore.push(mockExp);

      const unlinked = await campaignsService.unlinkExpenseFromCampaign(
        campaign._id.toString(),
        expenseId.toString(),
        mockAdmin,
      );

      expect(unlinked.campaignId).toBeUndefined();
      expect(unlinked.campaignCode).toBeUndefined();
    });
  });

  describe('Authoritative Financial Reporting & ROI Calculations', () => {
    it('accurately computes financials with only APPROVED expenses counting toward actual expenditure', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Grand Mega Drive',
          venue: 'Exhibition Ground',
          city: 'Mumbai',
          startDate: new Date('2026-12-05').toISOString(),
          endDate: new Date('2026-12-05').toISOString(),
          targetDonations: 400,
          initialBudget: 100000, // 100,000 INR = 10,000,000 paise
        },
        mockSuperAdmin,
      );

      // Add 1 APPROVED expense (30,000 INR, fully paid)
      expenseStore.push({
        _id: new Types.ObjectId(),
        voucherNumber: 'EXP-001',
        title: 'Medical Kits and Sanitizers',
        category: ExpenseCategory.MEDICAL_SUPPLIES,
        amountPaise: 3000000,
        amount: 30000,
        paidAmountPaise: 3000000,
        status: ExpenseStatus.APPROVED,
        campaignId: campaign._id,
      });

      // Add 1 APPROVED expense (20,000 INR, partially paid 10,000 INR)
      expenseStore.push({
        _id: new Types.ObjectId(),
        voucherNumber: 'EXP-002',
        title: 'Transport Van Fuel',
        category: ExpenseCategory.LOGISTICS_TRANSPORT,
        amountPaise: 2000000,
        amount: 20000,
        paidAmountPaise: 1000000, // only 10,000 paid
        status: ExpenseStatus.APPROVED,
        campaignId: campaign._id,
      });

      // Add 1 DRAFT expense (15,000 INR) -> MUST NOT COUNT in expenditure!
      expenseStore.push({
        _id: new Types.ObjectId(),
        voucherNumber: 'EXP-003',
        title: 'Proposed Refreshment Vendor',
        category: ExpenseCategory.STAFF_CAMP_MEALS,
        amountPaise: 1500000,
        amount: 15000,
        paidAmountPaise: 0,
        status: ExpenseStatus.DRAFT,
        campaignId: campaign._id,
      });

      // Add 1 REJECTED expense (10,000 INR) -> MUST NOT COUNT in expenditure!
      expenseStore.push({
        _id: new Types.ObjectId(),
        voucherNumber: 'EXP-004',
        title: 'Overpriced Banners',
        category: ExpenseCategory.OTHER,
        amountPaise: 1000000,
        amount: 10000,
        paidAmountPaise: 0,
        status: ExpenseStatus.REJECTED,
        campaignId: campaign._id,
      });

      // Add 50 completed donation units
      for (let i = 0; i < 50; i++) {
        donationStore.push({
          _id: new Types.ObjectId(),
          donationCode: `DON-${i}`,
          campaignId: campaign._id,
          status: DonationStatus.COMPLETED,
          quantity: 1,
        });
      }

      // Add 10 non-completed donations (CANCELLED) -> MUST NOT COUNT in ROI!
      for (let i = 0; i < 10; i++) {
        donationStore.push({
          _id: new Types.ObjectId(),
          donationCode: `DON-CAN-${i}`,
          campaignId: campaign._id,
          status: DonationStatus.CANCELLED,
          quantity: 1,
        });
      }

      const fin = await campaignsService.getCampaignFinancials(campaign._id.toString());

      // Budget = 100,000 INR
      expect(fin.budgetMetrics.approvedBudgetPaise).toBe(10000000);
      expect(fin.budgetMetrics.approvedBudget).toBe(100000);

      // Approved expenditure = 30,000 + 20,000 = 50,000 INR (Draft and Rejected excluded)
      expect(fin.budgetMetrics.actualExpenditurePaise).toBe(5000000);
      expect(fin.budgetMetrics.actualExpenditure).toBe(50000);

      // Cash disbursed = 30,000 + 10,000 = 40,000 INR
      expect(fin.budgetMetrics.cashDisbursedPaise).toBe(4000000);
      expect(fin.budgetMetrics.cashDisbursed).toBe(40000);

      // Remaining budget = 100,000 - 50,000 = 50,000 INR
      expect(fin.budgetMetrics.remainingBudgetPaise).toBe(5000000);
      expect(fin.budgetMetrics.remainingBudget).toBe(50000);

      // Utilization = 50,000 / 100,000 = 50.0%
      expect(fin.budgetMetrics.utilizationPercentage).toBe(50.0);
      expect(fin.budgetMetrics.isOverBudget).toBe(false);
      expect(fin.budgetMetrics.overspendingPaise).toBe(0);

      // Completed donations = 50 units
      expect(fin.collectionMetrics.completedDonations).toBe(50);
      expect(fin.collectionMetrics.totalDonationsRecorded).toBe(60);

      // Cost per completed donation = 50,000 INR / 50 = 1,000 INR (100,000 paise)
      expect(fin.collectionMetrics.costPerCompletedDonationPaise).toBe(100000);
      expect(fin.collectionMetrics.costPerCompletedDonation).toBe(1000);

      // Category breakdown checks
      expect(fin.categoryBreakdown.length).toBe(2);
      const medCat = fin.categoryBreakdown.find((c: any) => c.category === ExpenseCategory.MEDICAL_SUPPLIES);
      expect(medCat?.amountPaise).toBe(3000000);
      const logCat = fin.categoryBreakdown.find((c: any) => c.category === ExpenseCategory.LOGISTICS_TRANSPORT);
      expect(logCat?.amountPaise).toBe(2000000);
    });

    it('handles zero completed donations safely without division-by-zero, returning null cost per donation', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Zero Donations Pilot',
          venue: 'Pilot Facility',
          city: 'Mumbai',
          startDate: new Date('2026-12-10').toISOString(),
          endDate: new Date('2026-12-10').toISOString(),
          targetDonations: 50,
          initialBudget: 20000,
        },
        mockSuperAdmin,
      );

      // Add 1 approved expense of 5,000 INR
      expenseStore.push({
        _id: new Types.ObjectId(),
        voucherNumber: 'EXP-PILOT-01',
        title: 'Promotion Pamphlets',
        category: ExpenseCategory.OTHER,
        amountPaise: 500000,
        amount: 5000,
        paidAmountPaise: 500000,
        status: ExpenseStatus.APPROVED,
        campaignId: campaign._id,
      });

      // No donations recorded
      const fin = await campaignsService.getCampaignFinancials(campaign._id.toString());

      expect(fin.collectionMetrics.completedDonations).toBe(0);
      expect(fin.collectionMetrics.costPerCompletedDonationPaise).toBeNull();
      expect(fin.collectionMetrics.costPerCompletedDonation).toBeNull();
    });

    it('correctly flags over-budget status and calculates overspending paise', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Tight Budget Drive',
          venue: 'Community Center',
          city: 'Nagpur',
          startDate: new Date('2026-12-15').toISOString(),
          endDate: new Date('2026-12-15').toISOString(),
          targetDonations: 60,
          initialBudget: 10000, // 10,000 INR
        },
        mockSuperAdmin,
      );

      // Add expense of 14,000 INR
      expenseStore.push({
        _id: new Types.ObjectId(),
        voucherNumber: 'EXP-OVER-01',
        title: 'Extra Transport & Generators',
        category: ExpenseCategory.LOGISTICS_TRANSPORT,
        amountPaise: 1400000,
        amount: 14000,
        paidAmountPaise: 1400000,
        status: ExpenseStatus.APPROVED,
        campaignId: campaign._id,
      });

      const fin = await campaignsService.getCampaignFinancials(campaign._id.toString());

      expect(fin.budgetMetrics.isOverBudget).toBe(true);
      expect(fin.budgetMetrics.overspendingPaise).toBe(400000); // 4,000 INR over
      expect(fin.budgetMetrics.overspending).toBe(4000);
      expect(fin.budgetMetrics.remainingBudgetPaise).toBe(-400000);
      expect(fin.budgetMetrics.utilizationPercentage).toBe(140.0);
    });
  });

  describe('Campaign Lifecycle Status Transitions', () => {
    it('allows valid transitions: PLANNED -> ACTIVE -> COMPLETED', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Lifecycle Drive',
          venue: 'Clubhouse',
          city: 'Thane',
          startDate: new Date('2026-12-20').toISOString(),
          endDate: new Date('2026-12-21').toISOString(),
          targetDonations: 100,
          initialBudget: 30000,
        },
        mockSuperAdmin,
      );

      // Transition to ACTIVE
      const active = await campaignsService.updateCampaign(
        campaign._id.toString(),
        { status: CampaignStatus.ACTIVE },
      );
      expect(active.status).toBe(CampaignStatus.ACTIVE);

      // Transition to COMPLETED
      const completed = await campaignsService.updateCampaign(
        campaign._id.toString(),
        { status: CampaignStatus.COMPLETED },
      );
      expect(completed.status).toBe(CampaignStatus.COMPLETED);
    });

    it('rejects invalid transition: COMPLETED -> ACTIVE', async () => {
      const campaign = await campaignsService.createCampaign(
        {
          name: 'Completed Drive',
          venue: 'Clubhouse',
          city: 'Thane',
          startDate: new Date('2026-12-20').toISOString(),
          endDate: new Date('2026-12-21').toISOString(),
          targetDonations: 100,
          initialBudget: 30000,
        },
        mockSuperAdmin,
      );

      // Force to COMPLETED
      await campaignsService.updateCampaign(
        campaign._id.toString(),
        { status: CampaignStatus.ACTIVE },
      );
      await campaignsService.updateCampaign(
        campaign._id.toString(),
        { status: CampaignStatus.COMPLETED },
      );

      // Attempt invalid transition back to ACTIVE
      await expect(
        campaignsService.updateCampaign(
          campaign._id.toString(),
          { status: CampaignStatus.ACTIVE },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Campaigns RBAC Security & Role Boundaries', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new RolesGuard(reflector);
    });

    function createMockContext(userRole: AdminRole | null, allowedRoles: AdminRole[] | null): any {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        if (key === 'roles') return allowedRoles;
        if (key === 'isPublic') return false;
        return null;
      });

      return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: userRole ? { role: userRole, userId: 'test-admin-123' } : null,
          }),
        }),
      };
    }

    it('SUPER_ADMIN is granted access to budget revision and financial analytics endpoints', () => {
      const superAdminOnly = [AdminRole.SUPER_ADMIN];
      const context = createMockContext(AdminRole.SUPER_ADMIN, superAdminOnly);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('ADMIN is denied access to budget revision and financial analytics endpoints (403 Forbidden)', () => {
      const superAdminOnly = [AdminRole.SUPER_ADMIN];
      const context = createMockContext(AdminRole.ADMIN, superAdminOnly);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('LAB_TECHNICIAN is denied access to budget revision and financial analytics endpoints (403 Forbidden)', () => {
      const superAdminOnly = [AdminRole.SUPER_ADMIN];
      const context = createMockContext(AdminRole.LAB_TECHNICIAN, superAdminOnly);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('Both SUPER_ADMIN and ADMIN are granted access to campaign scheduling and operational endpoints', () => {
      const operationalRoles = [AdminRole.SUPER_ADMIN, AdminRole.ADMIN];
      const adminCtx = createMockContext(AdminRole.ADMIN, operationalRoles);
      const superAdminCtx = createMockContext(AdminRole.SUPER_ADMIN, operationalRoles);

      expect(guard.canActivate(adminCtx)).toBe(true);
      expect(guard.canActivate(superAdminCtx)).toBe(true);
    });

    it('LAB_TECHNICIAN is denied access to campaign scheduling and operations (403 Forbidden)', () => {
      const operationalRoles = [AdminRole.SUPER_ADMIN, AdminRole.ADMIN];
      const labCtx = createMockContext(AdminRole.LAB_TECHNICIAN, operationalRoles);
      expect(() => guard.canActivate(labCtx)).toThrow(ForbiddenException);
    });
  });
});
