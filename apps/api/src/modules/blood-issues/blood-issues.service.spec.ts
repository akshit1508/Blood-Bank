import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BloodIssuesService } from './blood-issues.service';
import { BloodIssue } from './schemas/blood-issue.schema';
import { BloodIssueStatus } from './constants/blood-issue.constants';
import { Reservation } from '../reservations/schemas/reservation.schema';
import { ReservationStatus } from '../reservations/constants/reservation.constants';
import { BloodRequest } from '../../blood-requests/schemas/blood-request.schema';
import { BloodRequestStatus } from '../../blood-requests/blood-request.constants';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { InventoryHistory } from '../inventory/schemas/inventory-history.schema';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import { BloodUnit } from '../blood-units/schemas/blood-unit.schema';
import { BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';

describe('BloodIssuesService', () => {
  let service: BloodIssuesService;
  let bloodIssueModel: any;
  let reservationModel: any;
  let bloodRequestModel: any;
  let inventoryModel: any;
  let inventoryHistoryModel: any;
  let bloodUnitModel: any;
  let connection: any;

  const validRequestId = new Types.ObjectId();
  const validReservationId = new Types.ObjectId();
  const validInventoryId = new Types.ObjectId();
  const validBloodUnitId = new Types.ObjectId();
  const validIssueId = new Types.ObjectId();

  const mockBloodRequest = {
    _id: validRequestId,
    requestCode: 'REQ-20261008-001',
    bloodGroup: 'A+',
    componentType: 'WHOLE_BLOOD',
    unitsRequested: 1,
    status: BloodRequestStatus.RESERVED,
  };

  const mockPhysicalUnit = {
    _id: validBloodUnitId,
    unitCode: 'UNIT-20261008-001',
    bloodGroup: 'A+',
    componentType: 'WHOLE_BLOOD',
    volume: 450,
    status: BloodUnitStatus.APPROVED,
    expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days in future
  };

  const mockInventory = {
    _id: validInventoryId,
    bloodUnitId: mockPhysicalUnit,
    status: InventoryStatus.RESERVED,
  };

  const mockReservation = {
    _id: validReservationId,
    reservationCode: 'RES-20261008-001',
    bloodRequestId: validRequestId,
    requestCode: 'REQ-20261008-001',
    inventoryIds: [validInventoryId],
    bloodUnitIds: [validBloodUnitId],
    status: ReservationStatus.ACTIVE,
    reservedUnits: [
      {
        inventoryId: validInventoryId,
        bloodUnitId: validBloodUnitId,
        unitCode: 'UNIT-20261008-001',
        bloodGroup: 'A+',
        componentType: 'WHOLE_BLOOD',
        status: 'RESERVED',
      },
    ],
  };

  const mockIssueRecord = {
    _id: validIssueId,
    issueCode: 'ISS-20261008-001',
    bloodRequestId: validRequestId,
    requestCode: 'REQ-20261008-001',
    reservationId: validReservationId,
    reservationCode: 'RES-20261008-001',
    inventoryIds: [validInventoryId],
    bloodUnitIds: [validBloodUnitId],
    issuedUnits: [
      {
        inventoryId: validInventoryId,
        bloodUnitId: validBloodUnitId,
        unitCode: 'UNIT-20261008-001',
        bloodGroup: 'A+',
        componentType: 'WHOLE_BLOOD',
        volume: 450,
        status: 'ISSUED',
      },
    ],
    status: BloodIssueStatus.COMPLETED,
    issuedAt: new Date(),
    issuedBy: 'Staff Lab Nurse',
    remarks: 'Urgent emergency release',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    bloodIssueModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([mockIssueRecord]) }),
      }),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockImplementation((docs) => Promise.resolve(docs.map((d: any) => ({ ...d, _id: validIssueId })))),
    };

    reservationModel = {
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockReservation) }),
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockReservation) }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ ...mockReservation, status: ReservationStatus.COMPLETED }),
    };

    bloodRequestModel = {
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockBloodRequest) }),
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockBloodRequest) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue({ ...mockBloodRequest, status: BloodRequestStatus.ISSUED }),
    };

    inventoryModel = {
      findById: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockInventory) }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ ...mockInventory, status: InventoryStatus.ISSUED }),
    };

    inventoryHistoryModel = {
      create: jest.fn().mockResolvedValue([]),
    };

    bloodUnitModel = {
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPhysicalUnit) }),
    };

    connection = {
      startSession: jest.fn().mockResolvedValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloodIssuesService,
        { provide: getModelToken(BloodIssue.name), useValue: bloodIssueModel },
        { provide: getModelToken(Reservation.name), useValue: reservationModel },
        { provide: getModelToken(BloodRequest.name), useValue: bloodRequestModel },
        { provide: getModelToken(Inventory.name), useValue: inventoryModel },
        { provide: getModelToken(InventoryHistory.name), useValue: inventoryHistoryModel },
        { provide: getModelToken(BloodUnit.name), useValue: bloodUnitModel },
        { provide: getConnectionToken(), useValue: connection },
      ],
    }).compile();

    service = module.get<BloodIssuesService>(BloodIssuesService);
  });

  describe('issueReservation', () => {
    it('TEST 1: successfully issues reserved blood units against an ACTIVE reservation and RESERVED request', async () => {
      const result = await service.issueReservation(validReservationId.toString(), {
        remarks: 'Emergency release to OT 2',
        issuedBy: 'Nurse Alice',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(BloodIssueStatus.COMPLETED);
      expect(result.requestCode).toBe('REQ-20261008-001');
      expect(result.reservationCode).toBe('RES-20261008-001');
      expect(result.issuedUnits.length).toBe(1);
      expect(result.issuedUnits[0].unitCode).toBe('UNIT-20261008-001');
      expect(result.remarks).toBe('Emergency release to OT 2');
      expect(result.issuedBy).toBe('Nurse Alice');

      // Check reservation status updated to COMPLETED
      expect(reservationModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: validReservationId, status: ReservationStatus.ACTIVE },
        { $set: { status: ReservationStatus.COMPLETED } },
        expect.any(Object),
      );

      // Check inventory status updated to ISSUED
      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: validInventoryId, status: InventoryStatus.RESERVED },
        { $set: { status: InventoryStatus.ISSUED } },
        expect.any(Object),
      );

      // Check request status updated to ISSUED
      expect(bloodRequestModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validRequestId,
        expect.objectContaining({
          $set: expect.objectContaining({ status: BloodRequestStatus.ISSUED }),
        }),
        expect.any(Object),
      );

      // Check inventory history logged
      expect(inventoryHistoryModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            inventoryId: validInventoryId,
            fromStatus: InventoryStatus.RESERVED,
            toStatus: InventoryStatus.ISSUED,
          }),
        ]),
        expect.any(Object),
      );
    });

    it('TEST 2: throws NotFoundException if reservation does not exist', async () => {
      reservationModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      reservationModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        service.issueReservation(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('TEST 3: throws ConflictException if reservation is already COMPLETED', async () => {
      reservationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockReservation,
          status: ReservationStatus.COMPLETED,
        }),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(ConflictException);
    });

    it('TEST 4: throws BadRequestException if reservation is CANCELLED', async () => {
      reservationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockReservation,
          status: ReservationStatus.CANCELLED,
        }),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 5: throws BadRequestException if reservation is EXPIRED', async () => {
      reservationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockReservation,
          status: ReservationStatus.EXPIRED,
        }),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 6: throws ConflictException if an issue record already exists for this reservation', async () => {
      bloodIssueModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockIssueRecord),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(ConflictException);
    });

    it('TEST 7: throws NotFoundException if associated blood request does not exist', async () => {
      bloodRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('TEST 8: throws BadRequestException if blood request is not in RESERVED status', async () => {
      bloodRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockBloodRequest,
          status: BloodRequestStatus.APPROVED,
        }),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 9: throws NotFoundException if an inventory unit is missing', async () => {
      inventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('TEST 10: throws BadRequestException if inventory unit is in AVAILABLE status (prevent direct issue without reservation)', async () => {
      inventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockInventory,
            status: InventoryStatus.AVAILABLE,
          }),
        }),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 11: throws ConflictException if inventory unit is in ISSUED status', async () => {
      inventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockInventory,
            status: InventoryStatus.ISSUED,
          }),
        }),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(ConflictException);
    });

    it('TEST 12: throws BadRequestException if inventory unit is EXPIRED or DISCARDED', async () => {
      inventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockInventory,
            status: InventoryStatus.EXPIRED,
          }),
        }),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 13: throws BadRequestException if physical blood unit is not APPROVED', async () => {
      inventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockInventory,
            bloodUnitId: {
              ...mockPhysicalUnit,
              status: BloodUnitStatus.TESTING,
            },
          }),
        }),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 14: throws BadRequestException if physical blood unit has passed expiry date', async () => {
      inventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockInventory,
            bloodUnitId: {
              ...mockPhysicalUnit,
              expiryDate: new Date(Date.now() - 10000), // in the past
            },
          }),
        }),
      });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 15: preserves physical blood unit status as APPROVED (not discarded or modified)', async () => {
      await service.issueReservation(validReservationId.toString());

      expect(bloodUnitModel.findByIdAndUpdate).toBeUndefined();
    });

    it('TEST 16: handles duplicate key error during creation gracefully as ConflictException', async () => {
      bloodIssueModel.create.mockRejectedValue({ code: 11000 });

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(ConflictException);
    });

    it('TEST 17: throws ConflictException if atomic update on reservation returns null (concurrency race)', async () => {
      reservationModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(ConflictException);
    });

    it('TEST 18: throws ConflictException if atomic update on inventory returns null (concurrency race)', async () => {
      inventoryModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.issueReservation(validReservationId.toString()),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('TEST 19: returns all blood issues', async () => {
      const result = await service.findAll();
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].issueCode).toBe('ISS-20261008-001');
    });

    it('TEST 20: filters blood issues by bloodRequestId and codes', async () => {
      await service.findAll({
        bloodRequestId: validRequestId.toString(),
        requestCode: 'REQ-20261008-001',
        reservationCode: 'RES-20261008-001',
        issueCode: 'ISS-20261008-001',
      });

      expect(bloodIssueModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          bloodRequestId: validRequestId,
          requestCode: 'REQ-20261008-001',
          reservationCode: 'RES-20261008-001',
          issueCode: 'ISS-20261008-001',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('TEST 21: returns single blood issue by ObjectId or issueCode', async () => {
      bloodIssueModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockIssueRecord),
      });

      const result = await service.findOne(validIssueId.toString());
      expect(result).toBeDefined();
      expect(result.issueCode).toBe('ISS-20261008-001');
    });

    it('TEST 22: throws NotFoundException if not found', async () => {
      bloodIssueModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      bloodIssueModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.findOne(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByRequestId', () => {
    it('TEST 23: returns all blood issues for a blood request', async () => {
      bloodIssueModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([mockIssueRecord]),
        }),
      });

      const result = await service.findByRequestId(validRequestId.toString());
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].requestCode).toBe('REQ-20261008-001');
    });

    it('TEST 24: throws NotFoundException if blood request does not exist', async () => {
      bloodRequestModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.findByRequestId('NON_EXISTENT_REQ'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
