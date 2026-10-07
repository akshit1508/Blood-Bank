import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BloodRequestService } from './blood-request.service';
import { BloodRequest } from './schemas/blood-request.schema';
import {
  BloodComponent,
  BloodGroup,
  BloodRequestStatus,
  RequestPriority,
} from './blood-request.constants';

describe('BloodRequestService', () => {
  let service: BloodRequestService;
  let mockModel: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloodRequestService,
        {
          provide: getModelToken(BloodRequest.name),
          useValue: mockModel,
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
});
