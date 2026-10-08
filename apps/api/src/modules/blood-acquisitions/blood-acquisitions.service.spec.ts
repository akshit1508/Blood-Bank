import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BloodAcquisitionsService } from './blood-acquisitions.service';
import { BloodAcquisition } from './schemas/blood-acquisition.schema';
import { BloodUnit } from '../blood-units/schemas/blood-unit.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { BloodTesting } from '../testing/schemas/blood-testing.schema';
import { InventoryService } from '../inventory/inventory.service';
import {
  ExternalSourceType,
  BloodUnitSourceType,
  BloodAcquisitionStatus,
} from './constants/blood-acquisition.constants';
import { BloodGroup } from '../donors/constants/donor.constants';
import {
  BloodUnitComponent,
  BloodUnitStatus,
} from '../blood-units/constants/blood-unit.constants';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import { Types } from 'mongoose';

describe('BloodAcquisitionsService', () => {
  let service: BloodAcquisitionsService;
  let mockBloodAcquisitionModel: any;
  let mockBloodUnitModel: any;
  let mockInventoryModel: any;
  let mockBloodTestingModel: any;
  let mockInventoryService: any;

  const validReceiptId = new Types.ObjectId();

  beforeEach(async () => {
    function MockBloodAcquisitionModel(dto: any) {
      this._id = validReceiptId;
      this.receiptCode = dto.receiptCode;
      this.sourceType = dto.sourceType;
      this.sourceName = dto.sourceName;
      this.referenceNumber = dto.referenceNumber;
      this.receivedDate = dto.receivedDate;
      this.notes = dto.notes;
      this.status = dto.status || BloodAcquisitionStatus.PROCESSING;
      this.totalUnitsGenerated = dto.totalUnitsGenerated;
      this.items = dto.items || [];
      this.save = jest.fn().mockResolvedValue(this);
      this.toObject = jest.fn().mockReturnValue({
        _id: this._id,
        receiptCode: this.receiptCode,
        sourceType: this.sourceType,
        sourceName: this.sourceName,
        referenceNumber: this.referenceNumber,
        receivedDate: this.receivedDate,
        notes: this.notes,
        status: this.status,
        totalUnitsGenerated: this.totalUnitsGenerated,
        items: this.items,
      });
    }

    MockBloodAcquisitionModel.exists = jest.fn().mockResolvedValue(false);
    MockBloodAcquisitionModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
    MockBloodAcquisitionModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    MockBloodAcquisitionModel.findById = jest.fn();
    MockBloodAcquisitionModel.findOne = jest.fn();
    MockBloodAcquisitionModel.deleteOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    mockBloodAcquisitionModel = MockBloodAcquisitionModel;

    function MockBloodUnitModel(dto: any) {
      this._id = new Types.ObjectId();
      this.unitCode = dto.unitCode;
      this.sourceType = dto.sourceType;
      this.externalReceiptId = dto.externalReceiptId;
      this.bloodGroup = dto.bloodGroup;
      this.componentType = dto.componentType;
      this.collectionDate = dto.collectionDate;
      this.expiryDate = dto.expiryDate;
      this.volume = dto.volume;
      this.status = dto.status;
      this.storageLocation = dto.storageLocation;
      this.notes = dto.notes;
      this.save = jest.fn().mockResolvedValue(this);
    }

    MockBloodUnitModel.exists = jest.fn().mockResolvedValue(false);
    MockBloodUnitModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });
    MockBloodUnitModel.deleteOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    mockBloodUnitModel = MockBloodUnitModel;

    mockInventoryModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      }),
      deleteOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      }),
    };

    mockBloodTestingModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    mockInventoryService = {
      createFromBloodUnit: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        status: InventoryStatus.AVAILABLE,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloodAcquisitionsService,
        {
          provide: getModelToken(BloodAcquisition.name),
          useValue: mockBloodAcquisitionModel,
        },
        {
          provide: getModelToken(BloodUnit.name),
          useValue: mockBloodUnitModel,
        },
        {
          provide: getModelToken(Inventory.name),
          useValue: mockInventoryModel,
        },
        {
          provide: getModelToken(BloodTesting.name),
          useValue: mockBloodTestingModel,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    service = module.get<BloodAcquisitionsService>(BloodAcquisitionsService);
  });

  describe('create', () => {
    const validDto = {
      sourceType: ExternalSourceType.BLOOD_BANK,
      sourceName: 'Metro Blood Centre',
      referenceNumber: 'REF-2026-001',
      receivedDate: new Date('2026-10-07T10:00:00.000Z').toISOString(),
      notes: 'Bulk transfer shipment',
      items: [
        {
          bloodGroup: BloodGroup.A_POSITIVE,
          componentType: BloodUnitComponent.PRBC,
          quantity: 2,
          testingRequired: false,
          volumePerUnit: 450,
        },
        {
          bloodGroup: BloodGroup.O_POSITIVE,
          componentType: BloodUnitComponent.PRBC,
          quantity: 3,
          testingRequired: true,
          volumePerUnit: 450,
        },
      ],
    };

    it('should successfully create a receipt and generate individual blood units', async () => {
      const result = await service.create(validDto);

      expect(result).toBeDefined();
      expect(result.totalUnitsCreated).toBe(5);
      expect(result.directInventoryCount).toBe(2);
      expect(result.pendingTestingCount).toBe(3);
      expect(result.receipt.receiptCode).toMatch(/^EXT-\d{8}-[A-Z0-9]{4}$/);

      // Verify that direct-to-inventory units were sent to InventoryService
      expect(mockInventoryService.createFromBloodUnit).toHaveBeenCalledTimes(2);

      // Verify unit details
      expect(result.units.length).toBe(5);
      const aPosUnits = result.units.filter((u) => u.bloodGroup === BloodGroup.A_POSITIVE);
      const oPosUnits = result.units.filter((u) => u.bloodGroup === BloodGroup.O_POSITIVE);
      expect(aPosUnits.length).toBe(2);
      expect(oPosUnits.length).toBe(3);

      expect(aPosUnits[0].status).toBe(BloodUnitStatus.APPROVED);
      expect(oPosUnits[0].status).toBe(BloodUnitStatus.TESTING);
    });

    it('should reject receivedDate in the future', async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const invalidDto = {
        ...validDto,
        receivedDate: futureDate,
      };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should reject empty items array', async () => {
      const invalidDto = {
        ...validDto,
        items: [],
      };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should reject item with zero or negative quantity', async () => {
      const invalidDto = {
        ...validDto,
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            quantity: 0,
            testingRequired: false,
          },
        ],
      };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should reject expiryDate before or equal to receivedDate', async () => {
      const invalidDto = {
        ...validDto,
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            quantity: 2,
            testingRequired: false,
            expiryDate: new Date('2026-10-06T00:00:00.000Z').toISOString(), // Before receivedDate
          },
        ],
      };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should mark receipt COMPLETED if all units require no testing', async () => {
      const allDirectDto = {
        ...validDto,
        items: [
          {
            bloodGroup: BloodGroup.AB_POSITIVE,
            componentType: BloodUnitComponent.FFP,
            quantity: 2,
            testingRequired: false,
          },
        ],
      };

      const result = await service.create(allDirectDto);
      expect(result.receipt.status).toBe(BloodAcquisitionStatus.COMPLETED);
      expect(result.pendingTestingCount).toBe(0);
      expect(result.directInventoryCount).toBe(2);
    });

    it('should clean up and rollback on failure during unit generation', async () => {
      mockInventoryService.createFromBloodUnit.mockRejectedValueOnce(
        new Error('Inventory DB failure'),
      );

      await expect(service.create(validDto)).rejects.toThrow('Inventory DB failure');
      expect(mockBloodAcquisitionModel.deleteOne).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated receipts with live unit breakdown counts', async () => {
      const mockReceiptObj = {
        _id: validReceiptId,
        receiptCode: 'EXT-20261008-0001',
        sourceType: ExternalSourceType.HOSPITAL,
        sourceName: 'City General Hospital',
        toObject: () => ({
          _id: validReceiptId,
          receiptCode: 'EXT-20261008-0001',
          sourceType: ExternalSourceType.HOSPITAL,
          sourceName: 'City General Hospital',
        }),
      };

      mockBloodAcquisitionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockReceiptObj]),
            }),
          }),
        }),
      });
      mockBloodAcquisitionModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      mockBloodUnitModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { status: BloodUnitStatus.APPROVED },
              { status: BloodUnitStatus.TESTING },
            ]),
          }),
        }),
      });

      const result = await service.findAll({});

      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.items[0].unitsSummary).toEqual({
        total: 2,
        testing: 1,
        approved: 1,
        rejected: 0,
      });
    });
  });

  describe('findOne', () => {
    it('should return single receipt with unit stats', async () => {
      const mockReceiptObj = {
        _id: validReceiptId,
        receiptCode: 'EXT-20261008-0001',
        sourceName: 'City Hospital',
        toObject: () => ({
          _id: validReceiptId,
          receiptCode: 'EXT-20261008-0001',
          sourceName: 'City Hospital',
        }),
      };

      mockBloodAcquisitionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockReceiptObj),
      });

      mockBloodUnitModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { _id: new Types.ObjectId(), status: BloodUnitStatus.APPROVED },
            ]),
          }),
        }),
      });

      mockInventoryModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findOne(validReceiptId.toString());
      expect(result).toBeDefined();
      expect(result.stats.totalUnits).toBe(1);
      expect(result.stats.approved).toBe(1);
      expect(result.stats.inInventory).toBe(1);
    });

    it('should throw NotFoundException if receipt does not exist', async () => {
      mockBloodAcquisitionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockBloodAcquisitionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSummary', () => {
    it('should return correct high-level KPI counts', async () => {
      mockBloodAcquisitionModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(4),
      });

      mockBloodUnitModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { _id: new Types.ObjectId(), status: BloodUnitStatus.APPROVED },
              { _id: new Types.ObjectId(), status: BloodUnitStatus.APPROVED },
              { _id: new Types.ObjectId(), status: BloodUnitStatus.TESTING },
            ]),
          }),
        }),
      });

      mockInventoryModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });

      const stats = await service.getSummary();

      expect(stats.totalReceipts).toBe(4);
      expect(stats.totalUnitsReceived).toBe(3);
      expect(stats.pendingTesting).toBe(1);
      expect(stats.directToInventory).toBe(2);
    });
  });
});
