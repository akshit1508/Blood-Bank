import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { BloodAcquisitionsService } from './blood-acquisitions.service';
import { BloodAcquisition } from './schemas/blood-acquisition.schema';
import { BloodUnit } from '../blood-units/schemas/blood-unit.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { BloodTesting } from '../testing/schemas/blood-testing.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { InventoryService } from '../inventory/inventory.service';
import { StorageService } from '../expenses/storage/storage.service';
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
import { ExpenseStatus, ExpensePaymentStatus } from '../expenses/constants/expense.constants';
import { Types } from 'mongoose';

describe('BloodAcquisitionsService', () => {
  let service: BloodAcquisitionsService;
  let mockBloodAcquisitionModel: any;
  let mockBloodUnitModel: any;
  let mockInventoryModel: any;
  let mockBloodTestingModel: any;
  let mockExpenseModel: any;
  let mockVendorModel: any;
  let mockInventoryService: any;
  let mockStorageService: any;
  let mockSession: any;
  let mockConnection: any;

  const validReceiptId = new Types.ObjectId();
  const mockAdmin = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    email: 'lab.admin@bloodbank.org',
    role: 'SUPER_ADMIN',
    fullName: 'Dr. Jane Admin',
  };

  beforeEach(async () => {
    mockSession = {
      withTransaction: jest.fn(async (cb: () => Promise<any>) => cb()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
    };

    function MockBloodAcquisitionModel(dto: any) {
      Object.assign(this, dto);
      this._id = validReceiptId;
      this.receiptCode = dto.receiptCode || 'EXT-20261013-0001';
      this.adjustments = dto.adjustments || [];
      this.save = jest.fn().mockResolvedValue(this);
      this.toObject = jest.fn().mockReturnValue({ ...this });
    }

    const createExistsMock = (value: any = false) => {
      return jest.fn().mockImplementation(() => {
        const p: any = Promise.resolve(value);
        p.session = jest.fn().mockResolvedValue(value);
        return p;
      });
    };

    MockBloodAcquisitionModel.exists = createExistsMock(false);
    MockBloodAcquisitionModel.collection = {
      createIndex: jest.fn().mockResolvedValue('ok'),
    };
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
    MockBloodAcquisitionModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    MockBloodAcquisitionModel.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    MockBloodAcquisitionModel.deleteOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    mockBloodAcquisitionModel = MockBloodAcquisitionModel;

    function MockBloodUnitModel(dto: any) {
      Object.assign(this, dto);
      this._id = new Types.ObjectId();
      this.save = jest.fn().mockResolvedValue(this);
    }
    MockBloodUnitModel.exists = createExistsMock(false);
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

    function MockInventoryModel(dto: any) {
      Object.assign(this, dto);
      this._id = new Types.ObjectId();
      this.save = jest.fn().mockResolvedValue(this);
    }
    MockInventoryModel.create = jest.fn();
    MockInventoryModel.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });
    MockInventoryModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    MockInventoryModel.deleteOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    mockInventoryModel = MockInventoryModel;

    function MockBloodTestingModel(dto: any) {
      Object.assign(this, dto);
      this._id = new Types.ObjectId();
      this.save = jest.fn().mockResolvedValue(this);
    }
    MockBloodTestingModel.exists = createExistsMock(false);
    MockBloodTestingModel.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });

    mockBloodTestingModel = MockBloodTestingModel;

    function MockExpenseModel(dto: any) {
      Object.assign(this, dto);
      this._id = new Types.ObjectId();
      this.auditHistory = dto.auditHistory || [];
      this.save = jest.fn().mockResolvedValue(this);
      this.toObject = jest.fn().mockReturnValue({ ...this });
    }
    MockExpenseModel.exists = createExistsMock(false);
    MockExpenseModel.findById = jest.fn();
    MockExpenseModel.findOne = jest.fn();

    mockExpenseModel = MockExpenseModel;

    mockVendorModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
    };

    mockInventoryService = {
      createFromBloodUnit: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        status: InventoryStatus.AVAILABLE,
      }),
    };

    mockStorageService = {
      saveReceipt: jest.fn().mockResolvedValue({
        fileId: 'file-123',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      }),
      getReceiptStream: jest.fn().mockReturnValue({
        stream: {},
        exists: true,
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
          provide: getModelToken(Expense.name),
          useValue: mockExpenseModel,
        },
        {
          provide: getModelToken(Vendor.name),
          useValue: mockVendorModel,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<BloodAcquisitionsService>(BloodAcquisitionsService);
  });

  describe('create - Phase 4 Invariants and Rules', () => {
    const validDto: any = {
      sourceType: ExternalSourceType.BLOOD_BANK,
      sourceName: 'Metro Blood Centre',
      referenceNumber: 'REF-2026-001',
      invoiceNumber: 'INV-2026-999',
      receivedDate: new Date(Date.now() - 3600000).toISOString(),
      notes: 'Bulk transfer shipment',
      transportCharges: 250,
      clearanceCertificateNumber: 'CERT-REG-888',
      sourceTestingCertified: true,
      clearanceSignoffStaffName: 'Dr. Clearance Medical Officer',
      items: [
        {
          bloodGroup: BloodGroup.A_POSITIVE,
          componentType: BloodUnitComponent.PRBC,
          invoicedQuantity: 2,
          receivedQuantity: 2,
          acceptedQuantity: 2,
          rejectedQuantity: 0,
          pendingInspectionQuantity: 0,
          unitCost: 1500,
          testingRequired: false,
          volumePerUnit: 450,
        },
        {
          bloodGroup: BloodGroup.O_POSITIVE,
          componentType: BloodUnitComponent.PRBC,
          invoicedQuantity: 3,
          receivedQuantity: 3,
          acceptedQuantity: 3,
          rejectedQuantity: 0,
          pendingInspectionQuantity: 0,
          unitCost: 1500,
          testingRequired: true,
          volumePerUnit: 450,
        },
      ],
    };

    it('should successfully create acquisition, generate units for accepted quantity, and create SUBMITTED expense', async () => {
      const result = await service.create(validDto, mockAdmin);

      expect(result).toBeDefined();
      expect(result.totalUnitsCreated).toBe(5);
      expect(result.directInventoryCount).toBe(2);
      expect(result.pendingTestingCount).toBe(3);
      expect(result.receipt.receiptCode).toMatch(/^EXT-\d{8}-[A-Z0-9]{4}$/);
      expect((result as any).expense).toBeDefined();
      expect((result as any).expense?.status).toBe(ExpenseStatus.SUBMITTED);
      expect(result.isIdempotentReplay).toBe(false);
    });

    it('should enforce quantity invariant: receivedQuantity = acceptedQuantity + rejectedQuantity', async () => {
      const invalidDto = {
        ...validDto,
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 5,
            receivedQuantity: 5,
            acceptedQuantity: 3,
            rejectedQuantity: 1, // 3 + 1 = 4 != 5
            pendingInspectionQuantity: 0,
            testingRequired: true,
          },
        ],
      };

      await expect(service.create(invalidDto, mockAdmin)).rejects.toThrow(BadRequestException);
    });

    it('should mandate non-empty rejectionReason when rejectedQuantity > 0', async () => {
      const invalidDto = {
        ...validDto,
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 5,
            receivedQuantity: 5,
            acceptedQuantity: 3,
            rejectedQuantity: 2, // 3 + 2 = 5
            pendingInspectionQuantity: 0,
            rejectionReason: '', // Empty reason
            testingRequired: true,
          },
        ],
      };

      await expect(service.create(invalidDto, mockAdmin)).rejects.toThrow(BadRequestException);
    });

    it('should reject intake if pendingInspectionQuantity > 0 (inspection incomplete)', async () => {
      const invalidDto = {
        ...validDto,
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 5,
            receivedQuantity: 5,
            acceptedQuantity: 3,
            rejectedQuantity: 2,
            pendingInspectionQuantity: 1, // Pending > 0
            testingRequired: true,
          },
        ],
      };

      await expect(service.create(invalidDto, mockAdmin)).rejects.toThrow(BadRequestException);
    });

    it('should reject testingRequired = false if regulated source or clearance certificate is missing', async () => {
      const uncertifiedDto = {
        ...validDto,
        sourceType: ExternalSourceType.OTHER, // Not regulated BLOOD_BANK or HOSPITAL
        clearanceCertificateNumber: undefined,
        clearanceAttestationConfirmed: false,
        clearanceSignoffStaffName: undefined,
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 2,
            receivedQuantity: 2,
            acceptedQuantity: 2,
            rejectedQuantity: 0,
            pendingInspectionQuantity: 0,
            testingRequired: false,
          },
        ],
      };

      await expect(service.create(uncertifiedDto, mockAdmin)).rejects.toThrow(BadRequestException);
    });

    it('should reject receivedDate in the future', async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const invalidDto = {
        ...validDto,
        receivedDate: futureDate,
      };

      await expect(service.create(invalidDto, mockAdmin)).rejects.toThrow(BadRequestException);
    });

    it('should reject empty items array', async () => {
      const invalidDto = {
        ...validDto,
        items: [],
      };

      await expect(service.create(invalidDto, mockAdmin)).rejects.toThrow(BadRequestException);
    });

    it('should return existing receipt on idempotent replay with matching canonical hash', async () => {
      const idempotencyKey = '123e4567-e89b-12d3-a456-426614174000';
      const canonicalHash = service.computeCanonicalPayloadHash(validDto);

      const existingReceipt = {
        _id: validReceiptId,
        idempotencyKey,
        requestPayloadHash: canonicalHash,
        receiptCode: 'EXT-20261013-0001',
        totalUnitsGenerated: 5,
        expenseId: new Types.ObjectId(),
      };

      mockBloodAcquisitionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingReceipt),
      });
      mockExpenseModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: existingReceipt.expenseId, status: ExpenseStatus.DRAFT }),
      });

      const replayResult = await service.create(validDto, mockAdmin, idempotencyKey);

      expect(replayResult.isIdempotentReplay).toBe(true);
      expect(replayResult.receipt._id).toBe(validReceiptId);
    });

    it('should throw ConflictException on idempotent key reuse with mismatched payload', async () => {
      const idempotencyKey = '123e4567-e89b-12d3-a456-426614174000';
      const existingReceipt = {
        _id: validReceiptId,
        idempotencyKey,
        requestPayloadHash: 'different-sha256-hash',
        receiptCode: 'EXT-20261013-0001',
        totalUnitsGenerated: 5,
      };

      mockBloodAcquisitionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingReceipt),
      });

      await expect(service.create(validDto, mockAdmin, idempotencyKey)).rejects.toThrow(ConflictException);
    });
  });

  describe('recordAdjustment - Phase 4 Credit Memos', () => {
    it('should successfully record credit adjustment and update linked expense net liability', async () => {
      const mockExpense = {
        _id: new Types.ObjectId(),
        amountPaise: 500000, // ₹5,000
        paidAmountPaise: 200000, // ₹2,000 paid
        paymentStatus: ExpensePaymentStatus.PARTIALLY_PAID,
        auditHistory: [] as any[],
        save: jest.fn().mockResolvedValue(true),
      };

      const mockReceipt: any = {
        _id: validReceiptId,
        receiptCode: 'EXT-20261013-0001',
        totalPayablePaise: 500000,
        totalPayable: 5000,
        expenseId: mockExpense._id,
        adjustments: [] as any[],
        save: jest.fn().mockResolvedValue(true),
      };

      mockBloodAcquisitionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockReceipt),
      });
      mockExpenseModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExpense),
      });

      // Mock findOne for the returned result
      jest.spyOn(service, 'findOne').mockResolvedValue(mockReceipt as any);

      const adjDto: any = {
        adjustmentType: 'CREDIT_NOTE',
        creditNoteReference: 'CR-NOTE-001',
        amount: 1000, // ₹1,000
        reason: 'Hemolyzed units during transport',
      };

      await service.recordAdjustment(validReceiptId.toString(), adjDto, mockAdmin);

      expect(mockReceipt.adjustments.length).toBe(1);
      expect((mockReceipt.adjustments[0] as any).creditAmountPaise).toBe(100000);
      expect(mockExpense.save).toHaveBeenCalled();
      expect(mockExpense.auditHistory.length).toBe(1);
    });

    it('should reject adjustment if cumulative credits exceed total payable amount', async () => {
      const mockReceipt = {
        _id: validReceiptId,
        receiptCode: 'EXT-20261013-0001',
        totalPayablePaise: 50000, // ₹500
        totalPayable: 500,
        adjustments: [
          { creditAmountPaise: 40000, creditNoteReference: 'CR-1' },
        ],
        save: jest.fn(),
      };

      mockBloodAcquisitionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockReceipt),
      });

      const adjDto: any = {
        adjustmentType: 'CREDIT_NOTE',
        creditNoteReference: 'CR-2',
        amount: 200, // ₹200 + ₹400 = ₹600 > ₹500
        reason: 'Excess credit memo beyond payable',
      };

      await expect(service.recordAdjustment(validReceiptId.toString(), adjDto, mockAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject duplicate credit note reference on the same acquisition', async () => {
      const mockReceipt = {
        _id: validReceiptId,
        receiptCode: 'EXT-20261013-0001',
        totalPayablePaise: 500000,
        totalPayable: 5000,
        adjustments: [
          { creditAmountPaise: 100000, creditNoteReference: 'DUPLICATE-REF' },
        ],
        save: jest.fn(),
      };

      mockBloodAcquisitionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockReceipt),
      });

      const adjDto: any = {
        adjustmentType: 'CREDIT_NOTE',
        creditNoteReference: 'DUPLICATE-REF',
        amount: 500,
        reason: 'Attempted duplicate credit note',
      };

      await expect(service.recordAdjustment(validReceiptId.toString(), adjDto, mockAdmin)).rejects.toThrow(
        ConflictException,
      );
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

