import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UnitIssueValidationService, isBloodGroupCompatible } from './unit-issue-validation.service';
import { Inventory } from '../schemas/inventory.schema';
import { BloodUnit } from '../../blood-units/schemas/blood-unit.schema';
import { BloodTesting } from '../../testing/schemas/blood-testing.schema';
import { InventoryStatus } from '../constants/inventory.constants';
import { BloodUnitStatus, BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';
import { TestingDecision, TestingStatus } from '../../testing/constants/testing.constants';

describe('UnitIssueValidationService', () => {
  let service: UnitIssueValidationService;
  let mockInventoryModel: any;
  let mockBloodUnitModel: any;
  let mockBloodTestingModel: any;

  const validInventoryId = new Types.ObjectId().toString();
  const validBloodUnitId = new Types.ObjectId().toString();

  const mockApprovedBloodUnit = {
    _id: new Types.ObjectId(validBloodUnitId),
    unitCode: 'UNIT-20261023-A1B2',
    status: BloodUnitStatus.APPROVED,
    bloodGroup: 'O+',
    componentType: BloodUnitComponent.WHOLE_BLOOD,
    collectionDate: new Date('2026-10-01'),
    expiryDate: new Date('2026-11-05'), // Valid future expiry
  };

  const mockAvailableInventory = {
    _id: new Types.ObjectId(validInventoryId),
    bloodUnitId: mockApprovedBloodUnit,
    status: InventoryStatus.AVAILABLE,
  };

  const mockApprovedTesting = {
    bloodUnitId: mockApprovedBloodUnit._id,
    status: TestingStatus.COMPLETED,
    decision: TestingDecision.APPROVED,
  };

  beforeEach(async () => {
    mockInventoryModel = {
      findById: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockAvailableInventory),
        }),
      }),
    };

    mockBloodUnitModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockApprovedBloodUnit),
      }),
    };

    mockBloodTestingModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockApprovedTesting),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitIssueValidationService,
        { provide: getModelToken(Inventory.name), useValue: mockInventoryModel },
        { provide: getModelToken(BloodUnit.name), useValue: mockBloodUnitModel },
        { provide: getModelToken(BloodTesting.name), useValue: mockBloodTestingModel },
      ],
    }).compile();

    service = module.get<UnitIssueValidationService>(UnitIssueValidationService);
  });

  describe('Inventory Status Safeguards', () => {
    it('should reject reservation if inventory unit is already RESERVED', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockAvailableInventory,
            status: InventoryStatus.RESERVED,
          }),
        }),
      });

      await expect(
        service.validateUnitForAllocation({
          inventoryId: validInventoryId,
          isReservation: true,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject reservation if inventory unit is already ISSUED', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockAvailableInventory,
            status: InventoryStatus.ISSUED,
          }),
        }),
      });

      await expect(
        service.validateUnitForAllocation({
          inventoryId: validInventoryId,
          isReservation: true,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject direct issuance of AVAILABLE inventory unit (must reserve first)', async () => {
      await expect(
        service.validateUnitForAllocation({
          inventoryId: validInventoryId,
          isIssue: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Blood Unit Testing & Release Safeguards', () => {
    it('should reject unit if physical blood unit is in TESTING status', async () => {
      const testingUnit = {
        ...mockApprovedBloodUnit,
        status: BloodUnitStatus.TESTING,
      };
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockAvailableInventory,
            bloodUnitId: testingUnit,
          }),
        }),
      });

      await expect(
        service.validateUnitForAllocation({
          inventoryId: validInventoryId,
          isReservation: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unit if laboratory testing record is not COMPLETED/APPROVED', async () => {
      mockBloodTestingModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockApprovedTesting,
          status: TestingStatus.IN_PROGRESS,
          decision: TestingDecision.PENDING,
        }),
      });

      await expect(
        service.validateUnitForAllocation({
          inventoryId: validInventoryId,
          isReservation: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Expiration Enforcement', () => {
    it('should strictly reject expired blood units at point of reservation', async () => {
      const expiredUnit = {
        ...mockApprovedBloodUnit,
        expiryDate: new Date('2020-01-01'), // Expired in the past
      };
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockAvailableInventory,
            bloodUnitId: expiredUnit,
          }),
        }),
      });

      await expect(
        service.validateUnitForAllocation({
          inventoryId: validInventoryId,
          isReservation: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Blood Group & Component Matching', () => {
    it('should reject blood group mismatch on exact match requirement', async () => {
      await expect(
        service.validateUnitForAllocation({
          inventoryId: validInventoryId,
          expectedBloodGroup: 'B+',
          expectedComponentType: BloodUnitComponent.WHOLE_BLOOD,
          isReservation: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject component type mismatch', async () => {
      await expect(
        service.validateUnitForAllocation({
          inventoryId: validInventoryId,
          expectedBloodGroup: 'O+',
          expectedComponentType: BloodUnitComponent.PRBC,
          isReservation: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow valid, approved, unexpired unit matching group and component', async () => {
      const result = await service.validateUnitForAllocation({
        inventoryId: validInventoryId,
        expectedBloodGroup: 'O+',
        expectedComponentType: BloodUnitComponent.WHOLE_BLOOD,
        isReservation: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.bloodUnit.unitCode).toBe(mockApprovedBloodUnit.unitCode);
    });
  });

  describe('Transfusion Compatibility Logic (NBTC / DGHS Guidelines)', () => {
    it('should allow O- PRBC to be transfused to any blood group (Universal Red Cell Donor)', () => {
      expect(isBloodGroupCompatible('O-', 'AB+', 'PRBC')).toBe(true);
      expect(isBloodGroupCompatible('O-', 'A-', 'PRBC')).toBe(true);
      expect(isBloodGroupCompatible('O-', 'B+', 'PRBC')).toBe(true);
    });

    it('should reject incompatible red cell transfusions', () => {
      expect(isBloodGroupCompatible('A+', 'B+', 'PRBC')).toBe(false);
      expect(isBloodGroupCompatible('B+', 'A+', 'PRBC')).toBe(false);
      expect(isBloodGroupCompatible('AB+', 'O+', 'PRBC')).toBe(false);
    });

    it('should require exact match for WHOLE_BLOOD', () => {
      expect(isBloodGroupCompatible('O-', 'A+', 'WHOLE_BLOOD')).toBe(false);
      expect(isBloodGroupCompatible('A+', 'A+', 'WHOLE_BLOOD')).toBe(true);
    });

    it('should allow AB plasma (FFP) to all groups (Universal Plasma Donor)', () => {
      expect(isBloodGroupCompatible('AB+', 'O-', 'FFP')).toBe(true);
      expect(isBloodGroupCompatible('AB-', 'A+', 'PLATELETS')).toBe(true);
    });
  });
});
