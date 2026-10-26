import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { DonorsService } from '../donors/donors.service';
import { DonorScreeningService } from '../donors/services/donor-screening.service';
import { DonorEligibilityService } from '../donors/services/donor-eligibility.service';
import { DonationsService } from '../donations/donations.service';
import { TestingService } from './testing.service';
import { BloodUnitsService } from '../blood-units/blood-units.service';
import { ExpiryRulesService } from '../inventory/services/expiry-rules.service';
import { BloodGroup, DonorStatus, Gender } from '../donors/constants/donor.constants';
import {
  DonorScreeningDecision,
  BagType,
  CollectionOutcome,
  AdverseReactionType,
  BagIntegrity,
} from '../donors/constants/screening.constants';
import { DonationStatus } from '../donations/constants/donation.constants';
import { BloodUnitStatus, BloodUnitComponent } from '../blood-units/constants/blood-unit.constants';
import { TestingStatus, TestingDecision, TestResultStatus, TestMethod } from './constants/testing.constants';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import { AdminRole } from '../auth/schemas/admin-user.schema';

describe('End-to-End Donor-to-Inventory Lifecycle Workflow Suite', () => {
  let donorsService: DonorsService;
  let screeningService: DonorScreeningService;
  let eligibilityService: DonorEligibilityService;
  let donationsService: DonationsService;
  let testingService: TestingService;
  let bloodUnitsService: BloodUnitsService;

  // In-memory model stores for mock data
  let donorsStore: any[] = [];
  let screeningsStore: any[] = [];
  let donationsStore: any[] = [];
  let bloodUnitsStore: any[] = [];
  let bloodTestingsStore: any[] = [];
  let inventoryStore: any[] = [];

  const mockSupervisor = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    email: 'supervisor@bloodbank.org',
    fullName: 'Dr. Sarah Connor, Medical Director',
    role: AdminRole.SUPER_ADMIN,
  };

  const mockTechnician = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    email: 'tech@bloodbank.org',
    fullName: 'Senior Technologist John',
    role: AdminRole.LAB_TECHNICIAN,
  };

  beforeEach(async () => {
    donorsStore = [];
    screeningsStore = [];
    donationsStore = [];
    bloodUnitsStore = [];
    bloodTestingsStore = [];
    inventoryStore = [];

    // Helper to create Mongoose-like doc
    const createDoc = (data: any, store: any[]) => {
      const doc: any = {
        _id: data._id || new Types.ObjectId(),
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
        ...data,
        populate: jest.fn().mockImplementation(async function () {
          return this;
        }),
        save: jest.fn().mockImplementation(async function () {
          const idx = store.findIndex((item) => item._id.toString() === this._id.toString());
          if (idx >= 0) {
            store[idx] = { ...this };
          } else {
            store.push(this);
          }
          return this;
        }),
      };
      store.push(doc);
      return doc;
    };

    // Mock Donor Model
    const mockDonorModel: any = jest.fn().mockImplementation((dto) => createDoc(dto, donorsStore));
    mockDonorModel.find = jest.fn().mockImplementation((query?: any) => ({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        let results = [...donorsStore];
        if (query?.status) results = results.filter((d) => d.status === query.status);
        if (query?.bloodGroup) results = results.filter((d) => d.bloodGroup === query.bloodGroup);
        return results;
      }),
    }));
    mockDonorModel.findById = jest.fn().mockImplementation((id: any) => ({
      exec: jest.fn().mockImplementation(async () => {
        return donorsStore.find((d) => d._id.toString() === id.toString()) || null;
      }),
    }));
    mockDonorModel.findOne = jest.fn().mockImplementation((query: any) => ({
      exec: jest.fn().mockImplementation(async () => {
        return donorsStore.find((d) => {
          if (query.phone && d.phone !== query.phone) return false;
          if (query.donorCode && d.donorCode !== query.donorCode) return false;
          return true;
        }) || null;
      }),
    }));
    mockDonorModel.findByIdAndUpdate = jest.fn().mockImplementation((id: any, update: any) => ({
      exec: jest.fn().mockImplementation(async () => {
        const item = donorsStore.find((d) => d._id.toString() === id.toString());
        if (!item) return null;
        Object.assign(item, update.$set || update);
        return item;
      }),
    }));
    mockDonorModel.exists = jest.fn().mockImplementation(async (query: any) => {
      return donorsStore.some((d) => d.donorCode === query.donorCode);
    });
    mockDonorModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(donorsStore.length),
    });

    // Mock Screening Model
    const mockScreeningModel: any = jest.fn().mockImplementation((dto) => createDoc(dto, screeningsStore));
    mockScreeningModel.find = jest.fn().mockImplementation((query?: any) => ({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        let results = [...screeningsStore];
        if (query?.donorId) results = results.filter((s) => s.donorId.toString() === query.donorId.toString());
        return results;
      }),
    }));
    mockScreeningModel.findOne = jest.fn().mockImplementation((query: any) => ({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        return screeningsStore.find((s) => {
          if (query.donorId && s.donorId.toString() !== query.donorId.toString()) return false;
          if (query.decision && s.decision !== query.decision) return false;
          if (query.collectionStatus && s.collectionStatus !== query.collectionStatus) return false;
          return true;
        }) || null;
      }),
    }));
    mockScreeningModel.findById = jest.fn().mockImplementation((id: any) => ({
      exec: jest.fn().mockImplementation(async () => {
        return screeningsStore.find((s) => s._id.toString() === id.toString()) || null;
      }),
    }));
    mockScreeningModel.exists = jest.fn().mockImplementation(async (query: any) => {
      return screeningsStore.some((s) => s.screeningCode === query.screeningCode);
    });

    // Mock Donation Model
    const mockDonationModel: any = jest.fn().mockImplementation((dto) => createDoc(dto, donationsStore));
    mockDonationModel.find = jest.fn().mockImplementation((query?: any) => ({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        let results = [...donationsStore];
        if (query?.donorId) results = results.filter((d) => d.donorId.toString() === query.donorId.toString());
        return results;
      }),
    }));
    mockDonationModel.findOne = jest.fn().mockImplementation((query: any) => ({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        return donationsStore.find((d) => {
          if (query.donorId && d.donorId.toString() !== query.donorId.toString()) return false;
          if (query.status && d.status !== query.status) return false;
          return true;
        }) || null;
      }),
    }));
    mockDonationModel.findById = jest.fn().mockImplementation((id: any) => ({
      exec: jest.fn().mockImplementation(async () => {
        return donationsStore.find((d) => d._id.toString() === id.toString()) || null;
      }),
    }));
    mockDonationModel.exists = jest.fn().mockImplementation(async (query: any) => {
      return donationsStore.some((d) => d.donationCode === query.donationCode || d.bagBarcode === query.bagBarcode);
    });

    // Mock BloodUnit Model
    const mockBloodUnitModel: any = jest.fn().mockImplementation((dto) => createDoc(dto, bloodUnitsStore));
    mockBloodUnitModel.findById = jest.fn().mockImplementation((id: any) => ({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        return bloodUnitsStore.find((u) => u._id.toString() === id.toString()) || null;
      }),
    }));
    mockBloodUnitModel.findByIdAndUpdate = jest.fn().mockImplementation((id: any, update: any) => ({
      exec: jest.fn().mockImplementation(async () => {
        const item = bloodUnitsStore.find((u) => u._id.toString() === id.toString());
        if (!item) return null;
        Object.assign(item, update.$set || update);
        return item;
      }),
    }));
    mockBloodUnitModel.exists = jest.fn().mockImplementation(async (query: any) => {
      return bloodUnitsStore.some((u) => u.unitCode === query.unitCode);
    });

    // Mock BloodTesting Model
    const mockBloodTestingModel: any = jest.fn().mockImplementation((dto) => createDoc(dto, bloodTestingsStore));
    mockBloodTestingModel.findById = jest.fn().mockImplementation((id: any) => ({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        return bloodTestingsStore.find((t) => t._id.toString() === id.toString()) || null;
      }),
    }));
    mockBloodTestingModel.findOne = jest.fn().mockImplementation((query: any) => ({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(async () => {
        return bloodTestingsStore.find((t) => {
          if (query.bloodUnitId && t.bloodUnitId.toString() !== query.bloodUnitId.toString()) return false;
          return true;
        }) || null;
      }),
    }));
    mockBloodTestingModel.exists = jest.fn().mockImplementation(async (query: any) => {
      return bloodTestingsStore.some((t) => t.testingCode === query.testingCode);
    });

    // Mock Inventory Model
    const mockInventoryModel: any = jest.fn().mockImplementation((dto) => createDoc(dto, inventoryStore));
    mockInventoryModel.create = jest.fn().mockImplementation(async (dto) => createDoc(dto, inventoryStore));
    mockInventoryModel.findOne = jest.fn().mockImplementation((query: any) => ({
      exec: jest.fn().mockImplementation(async () => {
        return inventoryStore.find((i) => i.bloodUnitId.toString() === query.bloodUnitId.toString()) || null;
      }),
    }));
    mockInventoryModel.updateMany = jest.fn().mockImplementation((query: any, update: any) => ({
      exec: jest.fn().mockImplementation(async () => {
        const matches = inventoryStore.filter((i) => i.bloodUnitId.toString() === query.bloodUnitId.toString());
        matches.forEach((i) => Object.assign(i, update.$set || update));
        return { modifiedCount: matches.length };
      }),
    }));

    // Mock Expiry Rules Model
    const mockExpiryRuleModel: any = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };

    // Services
    eligibilityService = new DonorEligibilityService(mockDonorModel, mockDonationModel);
    screeningService = new DonorScreeningService(mockScreeningModel, mockDonorModel, eligibilityService);
    donorsService = new DonorsService(mockDonorModel, mockScreeningModel);
    const expiryRules = new ExpiryRulesService(mockExpiryRuleModel, mockBloodUnitModel);

    donationsService = new DonationsService(
      mockDonationModel,
      mockDonorModel,
      mockScreeningModel,
      mockBloodUnitModel,
      mockBloodTestingModel,
      undefined,
      eligibilityService,
      expiryRules,
    );

    testingService = new TestingService(
      mockBloodTestingModel,
      mockBloodUnitModel,
      mockInventoryModel,
      undefined,
    );

    bloodUnitsService = new BloodUnitsService(
      mockBloodUnitModel,
      mockDonationModel,
      mockDonorModel,
      mockInventoryModel,
      undefined,
      expiryRules,
    );
  });

  it('executes full donor registration -> screening -> collection -> testing -> release -> inventory workflow', async () => {
    // 1. Public Donor Self-Registration
    const registered = await donorsService.create({
      fullName: 'Vikramaditya Roy',
      dateOfBirth: '1995-07-20',
      gender: Gender.MALE,
      bloodGroup: BloodGroup.O_POSITIVE,
      phone: '9819922334',
      email: 'vikram.roy@transfusion.org',
      address: '74 Park View Avenue, Mumbai',
    });

    expect(registered.success).toBe(true);
    expect(registered.donorCode).toMatch(/^DON-\d{8}-[A-Z0-9]{4}$/);

    const donorInDb = donorsStore[0];
    expect(donorInDb.status).toBe(DonorStatus.PENDING_REVIEW);

    // 2. Collection without completed screening MUST be rejected
    await expect(
      donationsService.recordBloodCollection({
        donorId: donorInDb._id.toString(),
        bagType: BagType.TRIPLE_450ML,
        collectedVolumeMl: 450,
      }),
    ).rejects.toThrow(BadRequestException);

    // 3. Complete Pre-Donation Clinical Screening & Medical Examination (SELECTED)
    const screeningResult = await screeningService.createScreening(
      {
        donorId: donorInDb._id.toString(),
        vitals: {
          weightKg: 68,
          hemoglobinGdl: 14.5,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          pulseBpm: 72,
          temperatureCelsius: 36.6,
        },
        questionnaire: {
          feelingWellToday: true,
          recentIllnessOrFever: false,
        },
        consent: {
          consentAcknowledged: true,
          donorSignatureConfirmed: true,
        },
        decision: DonorScreeningDecision.SELECTED,
      },
      mockTechnician,
    );

    const screening = screeningResult.screening;
    expect(screening.decision).toBe(DonorScreeningDecision.SELECTED);
    expect(screening.screeningCode).toMatch(/^SCR-\d{8}-[A-Z0-9]{4}$/);

    // Profile auto-activated upon passing medical examination
    expect(donorInDb.status).toBe(DonorStatus.ACTIVE);

    // 4. Record Blood Collection (Phlebotomy)
    const collectionResult = await donationsService.recordBloodCollection(
      {
        donorId: donorInDb._id.toString(),
        screeningId: (screening as any)._id.toString(),
        bagType: BagType.TRIPLE_450ML,
        collectedVolumeMl: 450,
        collectionOutcome: CollectionOutcome.SUCCESSFUL,
        adverseReaction: AdverseReactionType.NONE,
        bagIntegrity: BagIntegrity.INTACT,
      },
      mockTechnician,
    );

    expect(collectionResult.donation.status).toBe(DonationStatus.COMPLETED);
    expect(collectionResult.label.bagBarcode).toMatch(/^BAG-\d{8}-[A-Z0-9]{4}$/);
    expect(collectionResult.bloodUnit).toBeDefined();

    const createdBloodUnit = bloodUnitsStore[0];
    expect(createdBloodUnit.status).toBe(BloodUnitStatus.TESTING);
    expect(createdBloodUnit.unitCode).toMatch(/^UNIT-\d{8}-[A-Z0-9]{4}$/);

    // 5. Unit automatically enrolled in central BloodTesting with 5 required TTI tests
    const testingRecord = bloodTestingsStore[0];
    expect(testingRecord).toBeDefined();
    expect(testingRecord.bloodUnitId.toString()).toBe(createdBloodUnit._id.toString());
    expect(testingRecord.status).toBe(TestingStatus.IN_PROGRESS);
    expect(testingRecord.testResults.length).toBe(5);
    expect(testingRecord.testResults.every((t: any) => t.status === TestResultStatus.PENDING)).toBe(true);

    // 6. Unit CANNOT be released while tests are pending
    await expect(
      testingService.authorizeTestingRelease(testingRecord._id.toString(), {}, mockSupervisor),
    ).rejects.toThrow(BadRequestException);

    // 7. Laboratory records ABO/Rh confirmatory grouping
    await testingService.recordBloodGrouping(
      testingRecord._id.toString(),
      {
        aboGroup: 'O',
        rhFactor: 'POSITIVE',
        confirmedBloodGroup: 'O+',
        groupingMethod: 'GEL_CARD',
        cellGroupingAntiD: '4+',
      },
      mockTechnician,
    );

    // 8. Laboratory updates all 5 TTI tests to PASS
    for (const test of testingRecord.testResults) {
      await testingService.updateTestResult(
        testingRecord._id.toString(),
        test.testCode,
        {
          status: TestResultStatus.PASS,
          result: 'NON_REACTIVE',
          method: TestMethod.ELISA,
          kitLotNumber: 'LOT-2026-X1',
        },
        mockTechnician,
      );
    }

    // 9. Technician completes and finalizes testing
    const completedTesting = await testingService.completeTesting(
      testingRecord._id.toString(),
      {
        remarks: 'All 5 TTI assays non-reactive in duplicate',
      },
      mockTechnician,
    );

    expect(completedTesting.status).toBe(TestingStatus.COMPLETED);
    expect(completedTesting.decision).toBe(TestingDecision.APPROVED);

    // Unit still not in available inventory until supervisor authorization gate
    expect(inventoryStore.length).toBe(0);

    // 10. Medical Supervisor authorizes clinical release to Available Inventory
    const authorizedTesting = await testingService.authorizeTestingRelease(
      testingRecord._id.toString(),
      {
        authorizationRemarks: 'Clinically cleared by Medical Director for routine dispensing',
      },
      mockSupervisor,
    );

    expect(authorizedTesting.authorizedByName).toBe(mockSupervisor.fullName);
    expect(createdBloodUnit.status).toBe(BloodUnitStatus.APPROVED);

    // 11. Blood Unit is now present and AVAILABLE in Central Inventory!
    expect(inventoryStore.length).toBe(1);
    expect(inventoryStore[0].status).toBe(InventoryStatus.AVAILABLE);
    expect(inventoryStore[0].bloodUnitId.toString()).toBe(createdBloodUnit._id.toString());

    // 12. Repeated authorization is rejected without duplicate inventory
    await expect(
      testingService.authorizeTestingRelease(testingRecord._id.toString(), {}, mockSupervisor),
    ).rejects.toThrow(BadRequestException);
    expect(inventoryStore.length).toBe(1);

    // 13. Component Preparation: Separate approved Whole Blood into child components
    const separationResult = await bloodUnitsService.prepareComponents(
      createdBloodUnit._id.toString(),
      {
        components: [
          { componentType: BloodUnitComponent.PRBC, volume: 250, storageLocation: 'Refrigerator 1' },
          { componentType: BloodUnitComponent.FFP, volume: 150, storageLocation: 'Freezer 1' },
          { componentType: BloodUnitComponent.PLATELETS, volume: 50, storageLocation: 'Agitator 1' },
        ],
        notes: 'Routine component separation within 8 hours',
      },
      mockTechnician,
    );

    expect(separationResult.childUnits.length).toBe(3);
    expect(createdBloodUnit.status).toBe(BloodUnitStatus.PROCESSED_INTO_COMPONENTS);
    // Parent unit decommissioned from inventory, child components available
    expect(inventoryStore.some((i) => i.bloodUnitId.toString() === createdBloodUnit._id.toString() && i.status === InventoryStatus.DISCARDED)).toBe(true);
    expect(inventoryStore.filter((i) => i.status === InventoryStatus.AVAILABLE).length).toBe(3);
  });
});
