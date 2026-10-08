import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { Inventory } from './schemas/inventory.schema';
import { InventoryHistory } from './schemas/inventory-history.schema';
import { BloodUnit } from '../blood-units/schemas/blood-unit.schema';
import { BloodTesting } from '../testing/schemas/blood-testing.schema';
import { InventoryStatus } from './constants/inventory.constants';
import {
  BloodUnitStatus,
  BloodUnitComponent,
} from '../blood-units/constants/blood-unit.constants';
import {
  TestingStatus,
  TestingDecision,
} from '../testing/constants/testing.constants';
import { BloodGroup } from '../donors/constants/donor.constants';

describe('InventoryService (Phase 5A & 5B)', () => {
  let service: InventoryService;
  let mockInventoryModel: any;
  let mockInventoryHistoryModel: any;
  let mockBloodUnitModel: any;
  let mockBloodTestingModel: any;

  const validUnitId = new Types.ObjectId().toString();
  const validDonationId = new Types.ObjectId().toString();
  const validDonorId = new Types.ObjectId().toString();

  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days in future
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days in past
  const expiringSoonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days in future

  const sampleApprovedUnit = {
    _id: new Types.ObjectId(validUnitId),
    unitCode: 'UNIT-20261008-0001',
    donationId: {
      _id: new Types.ObjectId(validDonationId),
      donationCode: 'DONATION-20261008-0001',
      donationDate: new Date('2026-10-08T00:00:00.000Z'),
      donationType: 'WHOLE_BLOOD',
      status: 'COMPLETED',
    },
    donorId: {
      _id: new Types.ObjectId(validDonorId),
      donorCode: 'DON-20261008-0001',
      fullName: 'John Doe',
      bloodGroup: BloodGroup.O_POSITIVE,
      gender: 'MALE',
      status: 'ACTIVE',
    },
    bloodGroup: BloodGroup.O_POSITIVE,
    componentType: BloodUnitComponent.WHOLE_BLOOD,
    collectionDate: new Date('2026-10-08T00:00:00.000Z'),
    expiryDate: futureDate,
    volume: 450,
    storageLocation: 'Shelf A-1',
    status: BloodUnitStatus.APPROVED,
  };

  const sampleApprovedTesting = {
    _id: new Types.ObjectId(),
    testingCode: 'TEST-20261008-0001',
    bloodUnitId: new Types.ObjectId(validUnitId),
    status: TestingStatus.COMPLETED,
    decision: TestingDecision.APPROVED,
    completedAt: new Date('2026-10-08T01:00:00.000Z'),
  };

  beforeEach(async () => {
    mockInventoryModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
    };

    mockInventoryHistoryModel = {
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({ _id: new Types.ObjectId(), ...data }),
      ),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    mockBloodUnitModel = {
      findById: jest.fn(),
      find: jest.fn(),
    };

    mockBloodTestingModel = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getModelToken(Inventory.name),
          useValue: mockInventoryModel,
        },
        {
          provide: getModelToken(InventoryHistory.name),
          useValue: mockInventoryHistoryModel,
        },
        {
          provide: getModelToken(BloodUnit.name),
          useValue: mockBloodUnitModel,
        },
        {
          provide: getModelToken(BloodTesting.name),
          useValue: mockBloodTestingModel,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('createFromBloodUnit (Phase 5A & 5B)', () => {
    it('1. APPROVED Blood Unit enters Inventory with status AVAILABLE and records initial history', async () => {
      mockInventoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockBloodUnitModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sampleApprovedUnit),
        }),
      });

      mockBloodTestingModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(sampleApprovedTesting),
      });

      const createdInventoryDoc = {
        _id: new Types.ObjectId(),
        bloodUnitId: sampleApprovedUnit._id,
        status: InventoryStatus.AVAILABLE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockInventoryModel.create.mockResolvedValue(createdInventoryDoc);

      const result = await service.createFromBloodUnit(validUnitId);

      expect(result).toBeDefined();
      expect(result.status).toBe(InventoryStatus.AVAILABLE);
      expect(result.bloodUnit.unitCode).toBe('UNIT-20261008-0001');
      expect(result.bloodUnit.bloodGroup).toBe(BloodGroup.O_POSITIVE);
      expect(result.testing!.decision).toBe('APPROVED');

      // Verifies initial history creation
      expect(mockInventoryHistoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryId: createdInventoryDoc._id,
          toStatus: InventoryStatus.AVAILABLE,
          fromStatus: null,
        }),
      );
    });

    it('2. Duplicate Inventory creation is blocked with INVENTORY_RECORD_ALREADY_EXISTS', async () => {
      mockInventoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          bloodUnitId: new Types.ObjectId(validUnitId),
          status: InventoryStatus.AVAILABLE,
        }),
      });

      await expect(service.createFromBloodUnit(validUnitId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('3. Blood Unit not APPROVED cannot enter inventory', async () => {
      mockInventoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockBloodUnitModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...sampleApprovedUnit,
            status: BloodUnitStatus.TESTING,
          }),
        }),
      });

      await expect(service.createFromBloodUnit(validUnitId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('evaluateExpiry (Phase 5B Expiry Management)', () => {
    it('4. Transitions AVAILABLE unit past expiryDate to EXPIRED and writes history', async () => {
      const invId = new Types.ObjectId();
      const expiredInvItem = {
        _id: invId,
        status: InventoryStatus.AVAILABLE,
        bloodUnitId: {
          _id: sampleApprovedUnit._id,
          unitCode: 'UNIT-EXPIRED-001',
          expiryDate: pastDate,
        },
      };

      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([expiredInvItem]),
        }),
      });

      mockInventoryModel.findOneAndUpdate.mockResolvedValue({
        ...expiredInvItem,
        status: InventoryStatus.EXPIRED,
      });

      const res = await service.evaluateExpiry();

      expect(res.evaluatedCount).toBe(1);
      expect(res.expiredCount).toBe(1);
      expect(mockInventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: invId, status: InventoryStatus.AVAILABLE },
        { $set: { status: InventoryStatus.EXPIRED } },
        { new: true },
      );
      expect(mockInventoryHistoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryId: invId,
          fromStatus: InventoryStatus.AVAILABLE,
          toStatus: InventoryStatus.EXPIRED,
        }),
      );
    });

    it('5. Units with future expiryDate or null expiryDate do not expire', async () => {
      const futureInvItem = {
        _id: new Types.ObjectId(),
        status: InventoryStatus.AVAILABLE,
        bloodUnitId: {
          _id: sampleApprovedUnit._id,
          unitCode: 'UNIT-FUTURE-001',
          expiryDate: futureDate,
        },
      };

      const noExpiryInvItem = {
        _id: new Types.ObjectId(),
        status: InventoryStatus.AVAILABLE,
        bloodUnitId: {
          _id: sampleApprovedUnit._id,
          unitCode: 'UNIT-NOEXPIRY-001',
          expiryDate: null,
        },
      };

      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([futureInvItem, noExpiryInvItem]),
        }),
      });

      const res = await service.evaluateExpiry();

      expect(res.evaluatedCount).toBe(2);
      expect(res.expiredCount).toBe(0);
      expect(mockInventoryModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('discardItem (Phase 5B Discard Workflow)', () => {
    const invId = new Types.ObjectId().toString();

    it('6. Requires non-empty discard reason', async () => {
      await expect(
        service.discardItem(invId, { reason: '   ' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. Discards AVAILABLE item, records reason, discardedAt, and history entry', async () => {
      const existingInv = {
        _id: new Types.ObjectId(invId),
        status: InventoryStatus.AVAILABLE,
      };

      mockInventoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingInv),
      });

      const updatedInv = {
        _id: new Types.ObjectId(invId),
        status: InventoryStatus.DISCARDED,
        discardReason: 'Hemolysis observed during visual check',
        discardedAt: new Date(),
        bloodUnitId: sampleApprovedUnit,
      };

      mockInventoryModel.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedInv),
        }),
      });

      mockBloodTestingModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(sampleApprovedTesting),
          }),
        }),
      });

      const res = await service.discardItem(invId, {
        reason: 'Hemolysis observed during visual check',
      });

      expect(res.status).toBe(InventoryStatus.DISCARDED);
      expect(res.discardReason).toBe('Hemolysis observed during visual check');
      expect(res.discardedAt).toBeDefined();
      expect(mockInventoryHistoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryId: new Types.ObjectId(invId),
          fromStatus: InventoryStatus.AVAILABLE,
          toStatus: InventoryStatus.DISCARDED,
          reason: 'Hemolysis observed during visual check',
        }),
      );
    });

    it('8. Discards EXPIRED item with explicit reason', async () => {
      const existingInv = {
        _id: new Types.ObjectId(invId),
        status: InventoryStatus.EXPIRED,
      };

      mockInventoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingInv),
      });

      const updatedInv = {
        _id: new Types.ObjectId(invId),
        status: InventoryStatus.DISCARDED,
        discardReason: 'Routine disposal of expired unit',
        discardedAt: new Date(),
        bloodUnitId: sampleApprovedUnit,
      };

      mockInventoryModel.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedInv),
        }),
      });

      mockBloodTestingModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(sampleApprovedTesting),
          }),
        }),
      });

      const res = await service.discardItem(invId, {
        reason: 'Routine disposal of expired unit',
      });

      expect(res.status).toBe(InventoryStatus.DISCARDED);
      expect(mockInventoryHistoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fromStatus: InventoryStatus.EXPIRED,
          toStatus: InventoryStatus.DISCARDED,
        }),
      );
    });

    it('9. Cannot discard an already DISCARDED item (blocks duplicate discard)', async () => {
      const alreadyDiscarded = {
        _id: new Types.ObjectId(invId),
        status: InventoryStatus.DISCARDED,
        discardReason: 'Already discarded',
      };

      mockInventoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(alreadyDiscarded),
      });

      await expect(
        service.discardItem(invId, { reason: 'Another attempt' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSummary (Phase 5B Expiry-aware metrics)', () => {
    it('10. Calculates available, expiringSoon, expired, and discarded counts accurately', async () => {
      const items = [
        // Available (expires in 30 days)
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            expiryDate: futureDate,
          },
        },
        // Expiring soon (expires in 3 days)
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            expiryDate: expiringSoonDate,
          },
        },
        // Stored EXPIRED status
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.EXPIRED,
          bloodUnitId: {
            bloodGroup: BloodGroup.B_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            expiryDate: pastDate,
          },
        },
        // AVAILABLE in DB but past expiryDate (evaluated as expired)
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            bloodGroup: BloodGroup.AB_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            expiryDate: pastDate,
          },
        },
        // Discarded
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.DISCARDED,
          bloodUnitId: {
            bloodGroup: BloodGroup.O_NEGATIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            expiryDate: futureDate,
          },
        },
      ];

      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(items),
          }),
        }),
      });

      const summary = await service.getSummary();

      expect(summary.totalAvailable).toBe(2); // 1 future + 1 expiring soon
      expect(summary.expiringSoon).toBe(1); // 1 within 7 days
      expect(summary.expired).toBe(2); // 1 stored EXPIRED + 1 past expiryDate
      expect(summary.discarded).toBe(1); // 1 DISCARDED
      expect(summary.byBloodGroup[BloodGroup.O_POSITIVE]).toBe(1);
      expect(summary.byBloodGroup[BloodGroup.A_POSITIVE]).toBe(1);
      // Expired and discarded are NOT counted in available blood groups
      expect(summary.byBloodGroup[BloodGroup.B_POSITIVE]).toBe(0);
      expect(summary.byBloodGroup[BloodGroup.AB_POSITIVE]).toBe(0);
      expect(summary.byBloodGroup[BloodGroup.O_NEGATIVE]).toBe(0);
    });
  });

  describe('getPublicAvailability (Phase 5C Public Availability)', () => {
    it('11. Counts only valid AVAILABLE units, groups by bloodGroup & componentType, and excludes expired/testing/rejected/discarded', async () => {
      const mockItems = [
        // Valid Available A+ WHOLE_BLOOD
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            status: BloodUnitStatus.APPROVED,
            expiryDate: futureDate,
          },
        },
        // Valid Available A+ PRBC
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            status: BloodUnitStatus.APPROVED,
            expiryDate: futureDate,
          },
        },
        // Valid Available O+ WHOLE_BLOOD
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            status: BloodUnitStatus.APPROVED,
            expiryDate: futureDate,
          },
        },
        // Excluded: Past expiryDate (physically expired even though status is AVAILABLE)
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            status: BloodUnitStatus.APPROVED,
            expiryDate: pastDate,
          },
        },
        // Excluded: BloodUnit status is TESTING
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            bloodGroup: BloodGroup.B_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            status: BloodUnitStatus.TESTING,
            expiryDate: futureDate,
          },
        },
        // Excluded: BloodUnit status is REJECTED
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            bloodGroup: BloodGroup.AB_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            status: BloodUnitStatus.REJECTED,
            expiryDate: futureDate,
          },
        },
      ];

      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockItems),
          }),
        }),
      });

      const res = await service.getPublicAvailability();

      expect(res).toBeDefined();
      expect(res.totalAvailableUnits).toBe(3); // 2 A+ (1 Whole Blood, 1 PRBC) + 1 O+ Whole Blood
      expect(res.lastUpdated).toBeDefined();
      expect(res.groups.length).toBe(8); // All 8 blood groups represented

      // A+ verification
      const aPosGroup = res.groups.find((g) => g.bloodGroup === BloodGroup.A_POSITIVE);
      expect(aPosGroup).toBeDefined();
      expect(aPosGroup!.totalUnits).toBe(2);
      expect(aPosGroup!.availability).toBe('AVAILABLE');
      const aPosWholeBlood = aPosGroup!.components.find(
        (c) => c.componentType === BloodUnitComponent.WHOLE_BLOOD,
      );
      expect(aPosWholeBlood!.availableUnits).toBe(1);
      expect(aPosWholeBlood!.availability).toBe('AVAILABLE');
      const aPosPrbc = aPosGroup!.components.find(
        (c) => c.componentType === BloodUnitComponent.PRBC,
      );
      expect(aPosPrbc!.availableUnits).toBe(1);
      expect(aPosPrbc!.availability).toBe('AVAILABLE');
      const aPosFfp = aPosGroup!.components.find(
        (c) => c.componentType === BloodUnitComponent.FFP,
      );
      expect(aPosFfp!.availableUnits).toBe(0);
      expect(aPosFfp!.availability).toBe('NOT_AVAILABLE');

      // O+ verification (1 whole blood, prbc was expired so 0)
      const oPosGroup = res.groups.find((g) => g.bloodGroup === BloodGroup.O_POSITIVE);
      expect(oPosGroup!.totalUnits).toBe(1);
      const oPosPrbc = oPosGroup!.components.find(
        (c) => c.componentType === BloodUnitComponent.PRBC,
      );
      expect(oPosPrbc!.availableUnits).toBe(0);

      // B+ verification (testing excluded so 0 units)
      const bPosGroup = res.groups.find((g) => g.bloodGroup === BloodGroup.B_POSITIVE);
      expect(bPosGroup!.totalUnits).toBe(0);
      expect(bPosGroup!.availability).toBe('NOT_AVAILABLE');

      // Zero-availability blood groups verification (e.g. AB-, O-)
      const oNegGroup = res.groups.find((g) => g.bloodGroup === BloodGroup.O_NEGATIVE);
      expect(oNegGroup!.totalUnits).toBe(0);
      expect(oNegGroup!.availability).toBe('NOT_AVAILABLE');
    });

    it('12. Enforces strict privacy boundaries (NO donor, donation, testing, storageLocation, or internal IDs)', async () => {
      const mockItems = [
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            _id: new Types.ObjectId(),
            unitCode: 'UNIT-SECRET-1234',
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            status: BloodUnitStatus.APPROVED,
            expiryDate: futureDate,
            storageLocation: 'Vault 4, Shelf 2',
          },
        },
      ];

      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockItems),
          }),
        }),
      });

      const res = await service.getPublicAvailability();

      // Serialize to inspect all keys recursively
      const serialized = JSON.stringify(res);

      expect(serialized).not.toContain('donor');
      expect(serialized).not.toContain('donation');
      expect(serialized).not.toContain('testing');
      expect(serialized).not.toContain('UNIT-SECRET-1234');
      expect(serialized).not.toContain('Vault 4');
      expect(serialized).not.toContain('storageLocation');
      expect(serialized).not.toContain('_id');
    });
  });

  describe('findMatches (Phase 6A Matching)', () => {
    it('returns matching available and approved units sorted by expiry date ascending', async () => {
      const earlierDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const laterDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);

      const mockItems = [
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            _id: new Types.ObjectId(),
            unitCode: 'UNIT-LATER',
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            status: BloodUnitStatus.APPROVED,
            expiryDate: laterDate,
            storageLocation: 'Fridge B',
          },
        },
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            _id: new Types.ObjectId(),
            unitCode: 'UNIT-EARLIER',
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            status: BloodUnitStatus.APPROVED,
            expiryDate: earlierDate,
            storageLocation: 'Fridge A',
          },
        },
      ];

      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockItems),
          }),
        }),
      });

      const matches = await service.findMatches('A+', 'PRBC');

      expect(matches).toHaveLength(2);
      expect(matches[0].unitCode).toBe('UNIT-EARLIER');
      expect(matches[1].unitCode).toBe('UNIT-LATER');
      expect(matches[0].bloodGroup).toBe('A+');
      expect(matches[0].componentType).toBe('PRBC');
    });

    it('excludes units with different blood group or component type', async () => {
      const mockItems = [
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            _id: new Types.ObjectId(),
            unitCode: 'UNIT-B-POS',
            bloodGroup: BloodGroup.B_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            status: BloodUnitStatus.APPROVED,
            expiryDate: futureDate,
          },
        },
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            _id: new Types.ObjectId(),
            unitCode: 'UNIT-A-FFP',
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.FFP,
            status: BloodUnitStatus.APPROVED,
            expiryDate: futureDate,
          },
        },
      ];

      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockItems),
          }),
        }),
      });

      const matches = await service.findMatches('A+', 'PRBC');
      expect(matches).toHaveLength(0);
    });

    it('excludes units with status !== APPROVED (e.g. TESTING or REJECTED)', async () => {
      const mockItems = [
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            _id: new Types.ObjectId(),
            unitCode: 'UNIT-TESTING',
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            status: BloodUnitStatus.TESTING,
            expiryDate: futureDate,
          },
        },
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            _id: new Types.ObjectId(),
            unitCode: 'UNIT-REJECTED',
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            status: BloodUnitStatus.REJECTED,
            expiryDate: futureDate,
          },
        },
      ];

      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockItems),
          }),
        }),
      });

      const matches = await service.findMatches('O+', 'WHOLE_BLOOD');
      expect(matches).toHaveLength(0);
    });

    it('excludes units whose expiryDate is in the past', async () => {
      const mockItems = [
        {
          _id: new Types.ObjectId(),
          status: InventoryStatus.AVAILABLE,
          bloodUnitId: {
            _id: new Types.ObjectId(),
            unitCode: 'UNIT-EXPIRED-PAST',
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.WHOLE_BLOOD,
            status: BloodUnitStatus.APPROVED,
            expiryDate: pastDate,
          },
        },
      ];

      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockItems),
          }),
        }),
      });

      const matches = await service.findMatches('O+', 'WHOLE_BLOOD');
      expect(matches).toHaveLength(0);
    });

    it('TEST 4: naturally excludes RESERVED units (queries AVAILABLE only)', async () => {
      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.findMatches('A+', 'WHOLE_BLOOD');

      expect(mockInventoryModel.find).toHaveBeenCalledWith({
        status: InventoryStatus.AVAILABLE,
      });
    });
  });

  describe('TEST 5 & 25: Public availability excludes RESERVED inventory', () => {
    it('queries exclusively AVAILABLE inventory and excludes RESERVED units from counts', async () => {
      mockInventoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const res = await service.getPublicAvailability();

      expect(mockInventoryModel.find).toHaveBeenCalledWith({
        status: InventoryStatus.AVAILABLE,
      });
      expect(res.totalAvailableUnits).toBe(0);
    });
  });
});

