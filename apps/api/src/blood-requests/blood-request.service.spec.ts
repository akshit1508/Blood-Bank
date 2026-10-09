import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BloodRequestService } from './blood-request.service';
import { BloodRequest } from './schemas/blood-request.schema';
import { InventoryService } from '../modules/inventory/inventory.service';
import {
  BloodComponent,
  BloodGroup,
  BloodRequestStatus,
  RequestPriority,
} from './blood-request.constants';

import { BloodIssue } from '../modules/blood-issues/schemas/blood-issue.schema';

describe('BloodRequestService', () => {
  let service: BloodRequestService;
  let mockModel: any;
  let mockBloodIssueModel: any;
  let mockInventoryService: any;

  const sampleCreateDto = {
    patient: { name: 'Alice Smith', age: 29, gender: 'FEMALE' },
    bloodGroup: BloodGroup.O_POSITIVE,
    componentType: BloodComponent.PRBC,
    unitsRequested: 2,
    hospitalName: 'Memorial Central',
    doctorName: 'Dr. Evans',
    priority: RequestPriority.URGENT,
    contactPerson: {
      name: 'Bob Smith',
      phone: '+1 555-0199',
      relationship: 'Brother',
    },
    requiredDate: '2026-10-10',
  };

  beforeEach(async () => {
    function MockModel(dto: any) {
      this.data = { ...dto };
      this.save = jest.fn().mockResolvedValue(this.data);
    }
    MockModel.exists = jest.fn().mockResolvedValue(false);
    MockModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });
    MockModel.findById = jest.fn();
    MockModel.findOne = jest.fn();
    MockModel.findByIdAndUpdate = jest.fn();

    mockModel = MockModel;
    mockBloodIssueModel = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    };
    mockInventoryService = {
      findMatches: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloodRequestService,
        {
          provide: getModelToken(BloodRequest.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(BloodIssue.name),
          useValue: mockBloodIssueModel,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    service = module.get<BloodRequestService>(BloodRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('1 & 5 & 6. create blood request', () => {
    it('creates a request with initial REQUESTED status and generates unique requestCode', async () => {
      const created = await service.create(sampleCreateDto as any);

      expect(created).toBeDefined();
      expect(created.status).toBe(BloodRequestStatus.REQUESTED);
      expect(created.requestCode).toMatch(/^REQ-\d{8}-[A-Z0-9]{4}$/);
      expect(created.patient.name).toBe('Alice Smith');
      expect(created.unitsRequested).toBe(2);
    });
  });

  describe('7 & 8. status transitions', () => {
    it('allows valid status transition from REQUESTED to VERIFIED', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.REQUESTED,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockExisting,
          status: BloodRequestStatus.VERIFIED,
          statusReason: 'Documents checked',
        }),
      });

      const updated = await service.updateStatus('507f1f77bcf86cd799439011', {
        status: BloodRequestStatus.VERIFIED,
        statusReason: 'Documents checked',
      });

      expect(updated.status).toBe(BloodRequestStatus.VERIFIED);
    });

    it('allows valid status transition from VERIFIED to APPROVED', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.VERIFIED,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockExisting,
          status: BloodRequestStatus.APPROVED,
        }),
      });

      const updated = await service.updateStatus('507f1f77bcf86cd799439011', {
        status: BloodRequestStatus.APPROVED,
      });

      expect(updated.status).toBe(BloodRequestStatus.APPROVED);
    });

    it('rejects invalid status transition (e.g. REQUESTED directly to ISSUED)', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.REQUESTED,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      await expect(
        service.updateStatus('507f1f77bcf86cd799439011', {
          status: BloodRequestStatus.ISSUED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects direct generic status transition to RESERVED (requires physical unit reservation)', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.APPROVED,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      await expect(
        service.updateStatus('507f1f77bcf86cd799439011', {
          status: BloodRequestStatus.RESERVED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects direct generic status transition to ISSUED (requires blood issue operation)', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.RESERVED,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      await expect(
        service.updateStatus('507f1f77bcf86cd799439011', {
          status: BloodRequestStatus.ISSUED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects direct generic status transition to COMPLETED (requires completeRequest validation)', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.ISSUED,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      await expect(
        service.updateStatus('507f1f77bcf86cd799439011', {
          status: BloodRequestStatus.COMPLETED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects any transition from a terminal state like REJECTED', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.REJECTED,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      await expect(
        service.updateStatus('507f1f77bcf86cd799439011', {
          status: BloodRequestStatus.APPROVED,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeRequest (Task 96317 Dedicated Completion)', () => {
    it('successfully completes request when valid completed blood issues exist with sufficient quantity', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.ISSUED,
        unitsRequested: 1,
      };

      const mockCompletedIssues = [
        {
          _id: '607f1f77bcf86cd799439022',
          issueCode: 'ISS-20261007-TEST',
          status: 'COMPLETED',
          issuedUnits: [{ unitCode: 'UNIT-001', bloodGroup: 'A+', componentType: 'PRBC' }],
        },
      ];

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      mockBloodIssueModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCompletedIssues),
      });

      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockExisting,
          status: BloodRequestStatus.COMPLETED,
          statusReason: 'Fulfillment completed. Attending doctor verified.',
        }),
      });

      const result = await service.completeRequest('507f1f77bcf86cd799439011', {
        notes: 'Attending doctor verified.',
      });

      expect(result.status).toBe(BloodRequestStatus.COMPLETED);
    });

    it('rejects completion if request is not in ISSUED status', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.APPROVED,
        unitsRequested: 1,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      await expect(
        service.completeRequest('507f1f77bcf86cd799439011'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects completion if no completed blood issue records exist', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.ISSUED,
        unitsRequested: 1,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      mockBloodIssueModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.completeRequest('507f1f77bcf86cd799439011'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects completion if issued units count is less than requested units', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-TEST',
        status: BloodRequestStatus.ISSUED,
        unitsRequested: 2,
      };

      const mockCompletedIssues = [
        {
          _id: '607f1f77bcf86cd799439022',
          issueCode: 'ISS-20261007-TEST',
          status: 'COMPLETED',
          issuedUnits: [{ unitCode: 'UNIT-001' }],
        },
      ];

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });

      mockBloodIssueModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCompletedIssues),
      });

      await expect(
        service.completeRequest('507f1f77bcf86cd799439011'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('9 & 10. query requests', () => {
    it('returns request list', async () => {
      const mockList = [
        { requestCode: 'REQ-01', status: BloodRequestStatus.REQUESTED },
        { requestCode: 'REQ-02', status: BloodRequestStatus.APPROVED },
      ];

      mockModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockList),
        }),
      });

      const list = await service.findAll();
      expect(list).toHaveLength(2);
      expect(list[0].requestCode).toBe('REQ-01');
    });

    it('returns request details by public tracking code', async () => {
      const mockRecord = {
        _id: '507f1f77bcf86cd799439011',
        requestCode: 'REQ-20261007-A9F2',
        status: BloodRequestStatus.REQUESTED,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRecord),
      });

      const found = await service.findOne('REQ-20261007-A9F2');
      expect(found).toBeDefined();
      expect(found.requestCode).toBe('REQ-20261007-A9F2');
    });

    it('throws NotFoundException for non-existent identifier', async () => {
      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne('REQ-NOT-EXIST')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMatches (Phase 6A Matching)', () => {
    const mockRequest = {
      _id: '507f1f77bcf86cd799439011',
      requestCode: 'REQ-20261008-ABCD',
      bloodGroup: BloodGroup.A_POSITIVE,
      componentType: BloodComponent.WHOLE_BLOOD,
      unitsRequested: 2,
      status: BloodRequestStatus.REQUESTED,
    };

    it('returns matching units and canFulfill=true when available >= requested', async () => {
      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRequest),
      });

      const mockMatches = [
        {
          inventoryId: 'inv-1',
          bloodUnitId: 'unit-1',
          unitCode: 'UNIT-001',
          bloodGroup: 'A+',
          componentType: 'WHOLE_BLOOD',
          expiryDate: '2026-11-01T00:00:00.000Z',
          storageLocation: 'Shelf 1',
          status: 'AVAILABLE',
        },
        {
          inventoryId: 'inv-2',
          bloodUnitId: 'unit-2',
          unitCode: 'UNIT-002',
          bloodGroup: 'A+',
          componentType: 'WHOLE_BLOOD',
          expiryDate: '2026-11-05T00:00:00.000Z',
          storageLocation: 'Shelf 2',
          status: 'AVAILABLE',
        },
      ];

      mockInventoryService.findMatches.mockResolvedValue(mockMatches);

      const result = await service.getMatches('507f1f77bcf86cd799439011');

      expect(mockInventoryService.findMatches).toHaveBeenCalledWith(
        BloodGroup.A_POSITIVE,
        BloodComponent.WHOLE_BLOOD,
      );
      expect(result.request.requestCode).toBe('REQ-20261008-ABCD');
      expect(result.availableUnits).toBe(2);
      expect(result.unitsRequested).toBe(2);
      expect(result.canFulfill).toBe(true);
      expect(result.matchingUnits).toHaveLength(2);
    });

    it('returns canFulfill=false when available < requested', async () => {
      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRequest),
      });

      const mockMatches = [
        {
          inventoryId: 'inv-1',
          bloodUnitId: 'unit-1',
          unitCode: 'UNIT-001',
          bloodGroup: 'A+',
          componentType: 'WHOLE_BLOOD',
          expiryDate: '2026-11-01T00:00:00.000Z',
          storageLocation: 'Shelf 1',
          status: 'AVAILABLE',
        },
      ];

      mockInventoryService.findMatches.mockResolvedValue(mockMatches);

      const result = await service.getMatches('507f1f77bcf86cd799439011');

      expect(result.availableUnits).toBe(1);
      expect(result.unitsRequested).toBe(2);
      expect(result.canFulfill).toBe(false);
      expect(result.matchingUnits).toHaveLength(1);
    });

    it('returns empty list and canFulfill=false when zero matching units found', async () => {
      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRequest),
      });

      mockInventoryService.findMatches.mockResolvedValue([]);

      const result = await service.getMatches('507f1f77bcf86cd799439011');

      expect(result.availableUnits).toBe(0);
      expect(result.unitsRequested).toBe(2);
      expect(result.canFulfill).toBe(false);
      expect(result.matchingUnits).toEqual([]);
    });

    it('throws NotFoundException if request does not exist', async () => {
      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getMatches('REQ-NON-EXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not mutate request status or call status updates (read-only)', async () => {
      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRequest),
      });
      mockInventoryService.findMatches.mockResolvedValue([]);

      await service.getMatches('507f1f77bcf86cd799439011');

      expect(mockModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
