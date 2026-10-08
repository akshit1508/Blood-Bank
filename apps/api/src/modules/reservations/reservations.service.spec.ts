import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { Reservation } from './schemas/reservation.schema';
import { BloodRequest } from '../../blood-requests/schemas/blood-request.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { InventoryHistory } from '../inventory/schemas/inventory-history.schema';
import { BloodUnit } from '../blood-units/schemas/blood-unit.schema';
import { ReservationStatus } from './constants/reservation.constants';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import { BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';
import { BloodRequestStatus } from '../../blood-requests/blood-request.constants';

describe('ReservationsService (Phase 6B)', () => {
  let service: ReservationsService;
  let mockReservationModel: any;
  let mockBloodRequestModel: any;
  let mockInventoryModel: any;
  let mockInventoryHistoryModel: any;
  let mockBloodUnitModel: any;
  let mockConnection: any;

  const validRequestId = new Types.ObjectId().toString();
  const validInvId1 = new Types.ObjectId().toString();
  const validInvId2 = new Types.ObjectId().toString();
  const validUnitId1 = new Types.ObjectId().toString();
  const validUnitId2 = new Types.ObjectId().toString();

  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  const sampleApprovedRequest = {
    _id: new Types.ObjectId(validRequestId),
    requestCode: 'REQ-20261008-0001',
    bloodGroup: 'A+',
    componentType: 'WHOLE_BLOOD',
    unitsRequested: 1,
    status: BloodRequestStatus.APPROVED,
  };

  const sampleUnit1 = {
    _id: new Types.ObjectId(validUnitId1),
    unitCode: 'UNIT-001',
    bloodGroup: 'A+',
    componentType: 'WHOLE_BLOOD',
    status: BloodUnitStatus.APPROVED,
    expiryDate: futureDate,
    storageLocation: 'Fridge 1',
  };

  const sampleInventory1 = {
    _id: new Types.ObjectId(validInvId1),
    bloodUnitId: sampleUnit1,
    status: InventoryStatus.AVAILABLE,
  };

  beforeEach(async () => {
    mockReservationModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
        exec: jest.fn().mockResolvedValue([]),
      }),
      findById: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      create: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
    };

    mockBloodRequestModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(sampleApprovedRequest),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(sampleApprovedRequest),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...sampleApprovedRequest, status: BloodRequestStatus.RESERVED }),
      }),
    };

    mockInventoryModel = {
      findById: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sampleInventory1),
        }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...sampleInventory1,
          status: InventoryStatus.RESERVED,
        }),
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(sampleInventory1),
    };

    mockInventoryHistoryModel = {
      create: jest.fn().mockResolvedValue({}),
    };

    mockBloodUnitModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(sampleUnit1),
      }),
    };

    mockConnection = {
      startSession: jest.fn().mockRejectedValue(new Error('No replica set in mock')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getModelToken(Reservation.name),
          useValue: mockReservationModel,
        },
        {
          provide: getModelToken(BloodRequest.name),
          useValue: mockBloodRequestModel,
        },
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
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('TEST 1 & 2 & 3: Successful single unit reservation', () => {
    it('reserves one available unit, changes inventory to RESERVED, and request to RESERVED', async () => {
      const mockCreatedReservation = {
        reservationCode: 'RES-20261008-TEST',
        bloodRequestId: new Types.ObjectId(validRequestId),
        requestCode: 'REQ-20261008-0001',
        inventoryIds: [new Types.ObjectId(validInvId1)],
        bloodUnitIds: [new Types.ObjectId(validUnitId1)],
        reservedUnits: [
          {
            inventoryId: new Types.ObjectId(validInvId1),
            bloodUnitId: new Types.ObjectId(validUnitId1),
            unitCode: 'UNIT-001',
            bloodGroup: 'A+',
            componentType: 'WHOLE_BLOOD',
            status: 'RESERVED',
          },
        ],
        status: ReservationStatus.ACTIVE,
        reservedAt: new Date(),
        expiresAt: null,
      };

      mockReservationModel.create.mockResolvedValue([mockCreatedReservation]);

      const result = await service.createReservation(validRequestId, {
        inventoryIds: [validInvId1],
      });

      expect(result).toBeDefined();
      expect(result.reservationCode).toBe('RES-20261008-TEST');
      expect(result.status).toBe(ReservationStatus.ACTIVE);
      expect(result.reservedUnits).toHaveLength(1);
      expect(mockInventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(validInvId1), status: InventoryStatus.AVAILABLE },
        { $set: { status: InventoryStatus.RESERVED } },
        expect.anything(),
      );
      expect(mockBloodRequestModel.findByIdAndUpdate).toHaveBeenCalledWith(
        sampleApprovedRequest._id,
        expect.objectContaining({
          $set: expect.objectContaining({ status: BloodRequestStatus.RESERVED }),
        }),
        expect.anything(),
      );
      expect(mockInventoryHistoryModel.create).toHaveBeenCalled();
    });
  });

  describe('TEST 6 & 7: Cannot reserve expired or discarded inventory', () => {
    it('TEST 6: rejects reserving expired inventory item', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...sampleInventory1,
            status: InventoryStatus.EXPIRED,
          }),
        }),
      });

      await expect(
        service.createReservation(validRequestId, { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 6 (physical): rejects reserving blood unit whose physical expiry date has passed', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...sampleInventory1,
            bloodUnitId: { ...sampleUnit1, expiryDate: pastDate },
          }),
        }),
      });

      await expect(
        service.createReservation(validRequestId, { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 7: rejects reserving discarded inventory item', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...sampleInventory1,
            status: InventoryStatus.DISCARDED,
          }),
        }),
      });

      await expect(
        service.createReservation(validRequestId, { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('TEST 8 & 9: Cannot reserve TESTING or REJECTED units', () => {
    it('TEST 8: rejects blood unit under TESTING', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...sampleInventory1,
            bloodUnitId: { ...sampleUnit1, status: BloodUnitStatus.TESTING },
          }),
        }),
      });

      await expect(
        service.createReservation(validRequestId, { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 9: rejects blood unit that is REJECTED', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...sampleInventory1,
            bloodUnitId: { ...sampleUnit1, status: BloodUnitStatus.REJECTED },
          }),
        }),
      });

      await expect(
        service.createReservation(validRequestId, { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('TEST 10 & 11: Blood group and component type match', () => {
    it('TEST 10: rejects mismatched blood group', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...sampleInventory1,
            bloodUnitId: { ...sampleUnit1, bloodGroup: 'B+' },
          }),
        }),
      });

      await expect(
        service.createReservation(validRequestId, { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 11: rejects mismatched component type', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...sampleInventory1,
            bloodUnitId: { ...sampleUnit1, componentType: 'PRBC' },
          }),
        }),
      });

      await expect(
        service.createReservation(validRequestId, { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('TEST 12: Cannot reserve already RESERVED unit', () => {
    it('throws ConflictException if unit is already in RESERVED status', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...sampleInventory1,
            status: InventoryStatus.RESERVED,
          }),
        }),
      });

      await expect(
        service.createReservation(validRequestId, { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('TEST 13 & 14: Unknown request and inventory IDs', () => {
    it('TEST 13: throws NotFoundException if blood request not found', async () => {
      mockBloodRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockBloodRequestModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createReservation('REQ-NON-EXISTENT', { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('TEST 14: throws NotFoundException if inventory ID not found', async () => {
      mockInventoryModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.createReservation(validRequestId, { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('TEST 15, 16, 17: Multi-unit quantity rules', () => {
    it('TEST 15: request requires 2 units, reserving 1 leaves request status APPROVED (partial reservation)', async () => {
      const multiUnitRequest = {
        ...sampleApprovedRequest,
        unitsRequested: 2,
      };

      mockBloodRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(multiUnitRequest),
      });

      const mockCreatedReservation = {
        reservationCode: 'RES-PARTIAL',
        bloodRequestId: multiUnitRequest._id,
        requestCode: multiUnitRequest.requestCode,
        inventoryIds: [new Types.ObjectId(validInvId1)],
        bloodUnitIds: [new Types.ObjectId(validUnitId1)],
        reservedUnits: [
          {
            inventoryId: new Types.ObjectId(validInvId1),
            bloodUnitId: new Types.ObjectId(validUnitId1),
            unitCode: 'UNIT-001',
            bloodGroup: 'A+',
            componentType: 'WHOLE_BLOOD',
            status: 'RESERVED',
          },
        ],
        status: ReservationStatus.ACTIVE,
        reservedAt: new Date(),
      };
      mockReservationModel.create.mockResolvedValue([mockCreatedReservation]);

      await service.createReservation(validRequestId, {
        inventoryIds: [validInvId1],
      });

      // BloodRequest should NOT be updated to RESERVED yet
      expect(mockBloodRequestModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('TEST 16: request requires 2 units, reserving 2 succeeds and transitions request to RESERVED', async () => {
      const multiUnitRequest = {
        ...sampleApprovedRequest,
        unitsRequested: 2,
      };

      mockBloodRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(multiUnitRequest),
      });

      const sampleInventory2 = {
        _id: new Types.ObjectId(validInvId2),
        bloodUnitId: { ...sampleUnit1, _id: new Types.ObjectId(validUnitId2), unitCode: 'UNIT-002' },
        status: InventoryStatus.AVAILABLE,
      };

      mockInventoryModel.findById
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(sampleInventory1),
          }),
        })
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(sampleInventory2),
          }),
        });

      mockReservationModel.create.mockResolvedValue([
        {
          reservationCode: 'RES-FULL',
          bloodRequestId: multiUnitRequest._id,
          requestCode: multiUnitRequest.requestCode,
          inventoryIds: [new Types.ObjectId(validInvId1), new Types.ObjectId(validInvId2)],
          bloodUnitIds: [new Types.ObjectId(validUnitId1), new Types.ObjectId(validUnitId2)],
          reservedUnits: [
            {
              inventoryId: new Types.ObjectId(validInvId1),
              bloodUnitId: new Types.ObjectId(validUnitId1),
              unitCode: 'UNIT-001',
              bloodGroup: 'A+',
              componentType: 'WHOLE_BLOOD',
              status: 'RESERVED',
            },
            {
              inventoryId: new Types.ObjectId(validInvId2),
              bloodUnitId: new Types.ObjectId(validUnitId2),
              unitCode: 'UNIT-002',
              bloodGroup: 'A+',
              componentType: 'WHOLE_BLOOD',
              status: 'RESERVED',
            },
          ],
          status: ReservationStatus.ACTIVE,
          reservedAt: new Date(),
        },
      ]);

      const res = await service.createReservation(validRequestId, {
        inventoryIds: [validInvId1, validInvId2],
      });

      expect(res.reservedUnits).toHaveLength(2);
      expect(mockBloodRequestModel.findByIdAndUpdate).toHaveBeenCalledWith(
        multiUnitRequest._id,
        expect.objectContaining({
          $set: expect.objectContaining({ status: BloodRequestStatus.RESERVED }),
        }),
        expect.anything(),
      );
    });

    it('TEST 17: request requires 2 units, selecting 3 units is rejected', async () => {
      const multiUnitRequest = {
        ...sampleApprovedRequest,
        unitsRequested: 2,
      };

      mockBloodRequestModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(multiUnitRequest),
      });

      const id3 = new Types.ObjectId().toString();

      await expect(
        service.createReservation(validRequestId, {
          inventoryIds: [validInvId1, validInvId2, id3],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('TEST 18, 19, 20: Reservation cancellation', () => {
    it('TEST 18 & 19: cancellation changes inventory RESERVED -> AVAILABLE and creates audit history', async () => {
      const mockActiveReservation = {
        _id: new Types.ObjectId(),
        reservationCode: 'RES-ACTIVE-01',
        bloodRequestId: new Types.ObjectId(validRequestId),
        requestCode: 'REQ-20261008-0001',
        inventoryIds: [new Types.ObjectId(validInvId1)],
        status: ReservationStatus.ACTIVE,
        reservedUnits: [
          {
            inventoryId: new Types.ObjectId(validInvId1),
            bloodUnitId: new Types.ObjectId(validUnitId1),
            unitCode: 'UNIT-001',
            bloodGroup: 'A+',
            componentType: 'WHOLE_BLOOD',
            status: 'RESERVED',
          },
        ],
      };

      mockReservationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockActiveReservation),
      });

      mockReservationModel.findByIdAndUpdate.mockResolvedValue({
        ...mockActiveReservation,
        status: ReservationStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: 'Doctor changed prescription',
      });

      mockBloodRequestModel.findById.mockReturnValue({
        session: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(validRequestId),
            status: BloodRequestStatus.RESERVED,
            unitsRequested: 1,
          }),
        }),
      });

      mockReservationModel.find.mockReturnValue({
        session: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const res = await service.cancelReservation(mockActiveReservation._id.toString(), {
        reason: 'Doctor changed prescription',
      });

      expect(res.status).toBe(ReservationStatus.CANCELLED);
      expect(mockInventoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockActiveReservation.inventoryIds[0],
        { $set: { status: InventoryStatus.AVAILABLE } },
        expect.anything(),
      );
      expect(mockInventoryHistoryModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            fromStatus: InventoryStatus.RESERVED,
            toStatus: InventoryStatus.AVAILABLE,
          }),
        ]),
        expect.anything(),
      );
      // Request reverts to APPROVED
      expect(mockBloodRequestModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({ status: BloodRequestStatus.APPROVED }),
        }),
        expect.anything(),
      );
    });

    it('TEST 20: cancelled reservation cannot be cancelled again', async () => {
      const mockCancelledReservation = {
        _id: new Types.ObjectId(),
        reservationCode: 'RES-ALREADY-CANCELLED',
        status: ReservationStatus.CANCELLED,
      };

      mockReservationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCancelledReservation),
      });

      await expect(
        service.cancelReservation(mockCancelledReservation._id.toString(), {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('TEST 21: Blood Unit physical status is not modified', () => {
    it('reservation updates inventory status but does not modify physical BloodUnit.status', async () => {
      mockReservationModel.create.mockResolvedValue([
        {
          reservationCode: 'RES-STATUS-CHECK',
          bloodRequestId: sampleApprovedRequest._id,
          requestCode: sampleApprovedRequest.requestCode,
          inventoryIds: [new Types.ObjectId(validInvId1)],
          bloodUnitIds: [new Types.ObjectId(validUnitId1)],
          reservedUnits: [
            {
              inventoryId: new Types.ObjectId(validInvId1),
              bloodUnitId: new Types.ObjectId(validUnitId1),
              unitCode: 'UNIT-001',
              bloodGroup: 'A+',
              componentType: 'WHOLE_BLOOD',
              status: 'RESERVED',
            },
          ],
          status: ReservationStatus.ACTIVE,
          reservedAt: new Date(),
        },
      ]);

      await service.createReservation(validRequestId, {
        inventoryIds: [validInvId1],
      });

      // BloodUnit model should not have any update call
      expect(mockBloodUnitModel.findByIdAndUpdate).toBeUndefined();
    });
  });

  describe('TEST 22: Concurrency collision handling', () => {
    it('throws ConflictException when conditional update fails due to concurrent reservation', async () => {
      // Mock findOneAndUpdate returning null (meaning unit was already updated by another concurrent session)
      mockInventoryModel.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createReservation(validRequestId, { inventoryIds: [validInvId1] }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('TEST 24: Response sanitization', () => {
    it('does not expose donor private information or testing lab logs in reservation response', async () => {
      mockReservationModel.create.mockResolvedValue([
        {
          reservationCode: 'RES-SANITIZED',
          bloodRequestId: sampleApprovedRequest._id,
          requestCode: sampleApprovedRequest.requestCode,
          inventoryIds: [new Types.ObjectId(validInvId1)],
          bloodUnitIds: [new Types.ObjectId(validUnitId1)],
          reservedUnits: [
            {
              inventoryId: new Types.ObjectId(validInvId1),
              bloodUnitId: new Types.ObjectId(validUnitId1),
              unitCode: 'UNIT-001',
              bloodGroup: 'A+',
              componentType: 'WHOLE_BLOOD',
              status: 'RESERVED',
            },
          ],
          status: ReservationStatus.ACTIVE,
          reservedAt: new Date(),
        },
      ]);

      const res = await service.createReservation(validRequestId, {
        inventoryIds: [validInvId1],
      });

      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('donor');
      expect(serialized).not.toContain('phone');
      expect(serialized).not.toContain('address');
      expect(serialized).not.toContain('labResults');
    });
  });
});
