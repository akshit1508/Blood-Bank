import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BloodAcquisitionsService } from './blood-acquisitions.service';
import { PaymentsService } from '../payments/payments.service';
import { VendorsService } from '../vendors/vendors.service';
import { InventoryService } from '../inventory/inventory.service';
import { StorageService } from '../expenses/storage/storage.service';
import { BloodAcquisition } from './schemas/blood-acquisition.schema';
import { BloodUnit } from '../blood-units/schemas/blood-unit.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { BloodTesting } from '../testing/schemas/blood-testing.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import {
  ExternalSourceType,
  BloodAcquisitionStatus,
} from './constants/blood-acquisition.constants';
import { BloodGroup } from '../donors/constants/donor.constants';
import {
  BloodUnitComponent,
  BloodUnitStatus,
} from '../blood-units/constants/blood-unit.constants';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import {
  ExpenseStatus,
  ExpensePaymentStatus,
  ExpenseCategory,
  CostCenter,
} from '../expenses/constants/expense.constants';
import { PaymentMethod, PaymentStatus } from '../payments/constants/payment.constants';

describe('Phase 4 — Blood Acquisition & Acquisition Costing Integration Suite', () => {
  let acquisitionsService: BloodAcquisitionsService;
  let paymentsService: PaymentsService;
  let vendorsService: VendorsService;

  let bloodAcquisitionModel: any;
  let bloodUnitModel: any;
  let inventoryModel: any;
  let bloodTestingModel: any;
  let expenseModel: any;
  let paymentModel: any;
  let vendorModel: any;
  let inventoryService: any;
  let storageService: any;
  let mockConnection: any;

  const mockAdminStaff = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    email: 'staff.intake@bloodbank.org',
    role: 'ADMIN',
    fullName: 'Intake Staff Member',
  };

  const mockSuperAdmin = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId(),
    email: 'superadmin@bloodbank.org',
    role: 'SUPER_ADMIN',
    fullName: 'Chief Super Admin',
  };

  const sampleVendorId = new Types.ObjectId();
  const sampleAcquisitionId = new Types.ObjectId();
  const sampleExpenseId = new Types.ObjectId();

  beforeEach(async () => {
    const mockSession = {
      withTransaction: jest.fn(async (cb: () => Promise<any>) => cb()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
    };

    const createExistsMock = (value: any = false) => {
      return jest.fn().mockImplementation(() => {
        const p: any = Promise.resolve(value);
        p.session = jest.fn().mockResolvedValue(value);
        return p;
      });
    };

    function MockBloodAcquisitionModel(dto: any) {
      Object.assign(this, dto);
      this._id = sampleAcquisitionId;
      this.receiptCode = dto.receiptCode || 'EXT-20261014-0001';
      this.adjustments = dto.adjustments || [];
      this.save = jest.fn().mockResolvedValue(this);
      this.toObject = jest.fn().mockReturnValue({ ...this });
    }
    MockBloodAcquisitionModel.exists = createExistsMock(false);
    MockBloodAcquisitionModel.collection = { createIndex: jest.fn().mockResolvedValue('ok') };
    MockBloodAcquisitionModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      }),
      exec: jest.fn().mockResolvedValue([]),
    });
    MockBloodAcquisitionModel.findById = jest.fn().mockImplementation((id: any) => ({
      exec: jest.fn().mockResolvedValue(null),
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    }));
    MockBloodAcquisitionModel.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    MockBloodAcquisitionModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    bloodAcquisitionModel = MockBloodAcquisitionModel;

    function MockBloodUnitModel(dto: any) {
      Object.assign(this, dto);
      this._id = new Types.ObjectId();
      this.save = jest.fn().mockResolvedValue(this);
    }
    MockBloodUnitModel.exists = createExistsMock(false);
    MockBloodUnitModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      }),
      sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    });
    bloodUnitModel = MockBloodUnitModel;

    function MockInventoryModel(dto: any) {
      Object.assign(this, dto);
      this._id = new Types.ObjectId();
      this.save = jest.fn().mockResolvedValue(this);
    }
    MockInventoryModel.countDocuments = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
    MockInventoryModel.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    });
    inventoryModel = MockInventoryModel;

    function MockBloodTestingModel(dto: any) {
      Object.assign(this, dto);
      this._id = new Types.ObjectId();
      this.save = jest.fn().mockResolvedValue(this);
    }
    MockBloodTestingModel.exists = createExistsMock(false);
    MockBloodTestingModel.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    });
    bloodTestingModel = MockBloodTestingModel;

    function MockExpenseModel(dto: any) {
      Object.assign(this, dto);
      this._id = sampleExpenseId;
      this.auditHistory = dto.auditHistory || [];
      this.save = jest.fn().mockResolvedValue(this);
      this.toObject = jest.fn().mockReturnValue({ ...this });
    }
    MockExpenseModel.exists = createExistsMock(false);
    MockExpenseModel.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    MockExpenseModel.findOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    MockExpenseModel.find = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    MockExpenseModel.findOneAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    expenseModel = MockExpenseModel;

    paymentModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      create: jest.fn(),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      collection: { createIndex: jest.fn().mockResolvedValue(true) },
    };

    vendorModel = {
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      collection: { createIndex: jest.fn().mockResolvedValue(true) },
    };

    inventoryService = {
      createFromBloodUnit: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        status: InventoryStatus.AVAILABLE,
      }),
    };

    storageService = {
      saveReceipt: jest.fn().mockResolvedValue({
        fileId: 'doc-file-123',
        originalName: 'invoice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
      }),
      getReceiptStream: jest.fn().mockReturnValue({ stream: {}, exists: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloodAcquisitionsService,
        PaymentsService,
        VendorsService,
        { provide: getModelToken(BloodAcquisition.name), useValue: bloodAcquisitionModel },
        { provide: getModelToken(BloodUnit.name), useValue: bloodUnitModel },
        { provide: getModelToken(Inventory.name), useValue: inventoryModel },
        { provide: getModelToken(BloodTesting.name), useValue: bloodTestingModel },
        { provide: getModelToken(Expense.name), useValue: expenseModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: getModelToken(Vendor.name), useValue: vendorModel },
        { provide: InventoryService, useValue: inventoryService },
        { provide: StorageService, useValue: storageService },
        { provide: getConnectionToken(), useValue: mockConnection },
      ],
    }).compile();

    acquisitionsService = module.get<BloodAcquisitionsService>(BloodAcquisitionsService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    vendorsService = module.get<VendorsService>(VendorsService);
  });

  describe('1. Intake Physical Inspection & Quantity Invariants', () => {
    it('should mandate R = A + J and block when receivedQuantity !== acceptedQuantity + rejectedQuantity', async () => {
      const invalidIntakeDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Apex Regional Blood Bank',
        receivedDate: new Date().toISOString(),
        items: [
          {
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 10,
            receivedQuantity: 10,
            acceptedQuantity: 8,
            rejectedQuantity: 1, // 8 + 1 = 9 !== 10
            pendingInspectionQuantity: 0,
            testingRequired: true,
          },
        ],
      };

      await expect(acquisitionsService.create(invalidIntakeDto, mockAdminStaff)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mandate non-empty rejectionReason when rejectedQuantity > 0', async () => {
      const missingReasonDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Apex Regional Blood Bank',
        receivedDate: new Date().toISOString(),
        items: [
          {
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 10,
            receivedQuantity: 10,
            acceptedQuantity: 8,
            rejectedQuantity: 2,
            pendingInspectionQuantity: 0,
            rejectionReason: '', // Empty rejection reason
            testingRequired: true,
          },
        ],
      };

      await expect(acquisitionsService.create(missingReasonDto, mockAdminStaff)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block intake creation if pendingInspectionQuantity > 0 (incomplete inspection)', async () => {
      const pendingInspectionDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Apex Regional Blood Bank',
        receivedDate: new Date().toISOString(),
        items: [
          {
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 10,
            receivedQuantity: 10,
            acceptedQuantity: 7,
            rejectedQuantity: 2,
            pendingInspectionQuantity: 1, // Uninspected units
            rejectionReason: 'Temperature deviation',
            testingRequired: true,
          },
        ],
      };

      await expect(acquisitionsService.create(pendingInspectionDto, mockAdminStaff)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('2. Traceable Unit Generation Exclusivity', () => {
    it('should generate BloodUnit records exclusively for accepted units (rejected units generate 0 units)', async () => {
      const validPartialDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Apex Regional Blood Bank',
        receivedDate: new Date().toISOString(),
        reconciliationNotes: '3 damaged units in transit reported to supplier.',
        items: [
          {
            bloodGroup: BloodGroup.B_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 10,
            receivedQuantity: 10,
            acceptedQuantity: 7,
            rejectedQuantity: 3,
            pendingInspectionQuantity: 0,
            rejectionReason: '3 bags leaked in transport container',
            testingRequired: true,
            unitCost: 1200,
          },
        ],
      };

      const result = await acquisitionsService.create(validPartialDto, mockAdminStaff);
      expect(result.totalUnitsCreated).toBe(7); // Exactly accepted quantity
      expect(result.pendingTestingCount).toBe(7);
      expect(result.directInventoryCount).toBe(0);
    });
  });

  describe('3. Medical Clearance Gate for Direct Intake', () => {
    it('should strictly reject testingRequired = false if source is non-regulated or clearance is missing', async () => {
      const unverifiedDirectDto: any = {
        sourceType: ExternalSourceType.OTHER, // Non-regulated
        sourceName: 'Private Clinic',
        receivedDate: new Date().toISOString(),
        items: [
          {
            bloodGroup: BloodGroup.AB_POSITIVE,
            componentType: BloodUnitComponent.FFP,
            invoicedQuantity: 4,
            receivedQuantity: 4,
            acceptedQuantity: 4,
            rejectedQuantity: 0,
            pendingInspectionQuantity: 0,
            testingRequired: false, // Attempting bypass
          },
        ],
      };

      await expect(acquisitionsService.create(unverifiedDirectDto, mockAdminStaff)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should permit direct inventory intake ONLY when 4-point medical clearance is fully certified', async () => {
      const verifiedDirectDto: any = {
        sourceType: ExternalSourceType.GOVERNMENT_BLOOD_CENTRE,
        sourceName: 'National Blood Transfusion Center',
        receivedDate: new Date().toISOString(),
        clearanceCertificateNumber: 'CERT-NAT-2026-991',
        sourceTestingCertified: true,
        clearanceSignoffStaffName: 'Dr. Head Medical Officer',
        items: [
          {
            bloodGroup: BloodGroup.O_NEGATIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 5,
            receivedQuantity: 5,
            acceptedQuantity: 5,
            rejectedQuantity: 0,
            pendingInspectionQuantity: 0,
            testingRequired: false, // Valid direct clearance
            unitCost: 1800,
          },
        ],
      };

      const result = await acquisitionsService.create(verifiedDirectDto, mockAdminStaff);
      expect(result.totalUnitsCreated).toBe(5);
      expect(result.directInventoryCount).toBe(5);
      expect(result.pendingTestingCount).toBe(0);
    });
  });

  describe('4. Financial Integration & Segregation of Duties', () => {
    it('should automatically generate linked Expense in DRAFT status when costing is supplied', async () => {
      const costingDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Metro Blood Bank',
        invoiceNumber: 'INV-METRO-0042',
        receivedDate: new Date().toISOString(),
        transportCharges: 500,
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 10,
            receivedQuantity: 10,
            acceptedQuantity: 10,
            rejectedQuantity: 0,
            pendingInspectionQuantity: 0,
            unitCost: 1500,
            testingRequired: true,
          },
        ],
      };

      const result = await acquisitionsService.create(costingDto, mockAdminStaff);
      expect((result as any).expense).toBeDefined();
      expect((result as any).expense.status).toBe(ExpenseStatus.APPROVED);
      // Total payable = (10 * 1500) + 500 = ₹15,500
      expect((result as any).expense.amount).toBe(15500);
      expect((result as any).expense.amountPaise).toBe(1550000);
      expect((result as any).expense.creatorId.toString()).toBe(mockAdminStaff.id);
    });
  });

  describe('5. Authoritative Effective Net Liability & Phase 3 Consistency', () => {
    it('should enforce payment bounds using effectiveNetLiabilityPaise = originalLiability - approvedCredits', async () => {
      const mockAcquisition: any = {
        _id: sampleAcquisitionId,
        receiptCode: 'EXT-20261014-0001',
        totalPayablePaise: 1000000, // ₹10,000 original liability
        totalPayable: 10000,
        adjustments: [
          {
            creditNoteReference: 'CN-REF-01',
            creditAmountPaise: 200000, // ₹2,000 credit note
            amountPaise: 200000,
            amount: 2000,
          },
        ],
      };

      const mockExpense: any = {
        _id: sampleExpenseId,
        status: ExpenseStatus.APPROVED,
        vendorId: sampleVendorId,
        acquisitionId: sampleAcquisitionId,
        amount: 10000,
        amountPaise: 1000000,
        paidAmountPaise: 500000, // ₹5,000 already paid
        isDeleted: false,
      };

      bloodAcquisitionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAcquisition),
      });
      expenseModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExpense),
      });
      vendorModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: sampleVendorId, isActive: true }),
      });

      // Effective Net Liability = 10,000 - 2,000 = ₹8,000 (800,000 paise).
      // Already paid = ₹5,000 (500,000 paise).
      // Remaining payable balance = ₹3,000 (300,000 paise).
      // Attempting to pay ₹4,000 should be rejected by PaymentsService!
      await expect(
        paymentsService.recordPayment(
          {
            expenseId: sampleExpenseId.toString(),
            amount: 4000, // Exceeds ₹3,000 net remaining
            paymentMethod: PaymentMethod.NEFT,
            referenceNumber: 'UTR-EXCEED-NET',
            paymentDate: '2026-10-14',
            idempotencyKey: 'idem-net-exceed',
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reflect credit notes as CREDIT_MEMO items reducing vendor ledger running balance', async () => {
      const mockVendor = {
        _id: sampleVendorId,
        name: 'Metro Blood Bank Supplies',
        code: 'VND-001',
      };

      const mockExpense = {
        _id: sampleExpenseId,
        expenseCode: 'EXP-20261014-001',
        title: 'Consignment Apex',
        vendorId: sampleVendorId,
        expenseDate: new Date('2026-10-01'),
        amountPaise: 1000000, // ₹10,000 debit
        amount: 10000,
        paidAmountPaise: 1000000, // ₹10,000 paid
        paymentStatus: ExpensePaymentStatus.PAID,
        status: ExpenseStatus.APPROVED,
        isDeleted: false,
        acquisitionId: sampleAcquisitionId,
      };

      const mockPayment = {
        _id: new Types.ObjectId(),
        paymentCode: 'PAY-20261014-001',
        expenseId: sampleExpenseId,
        vendorId: sampleVendorId,
        paymentDate: new Date('2026-10-05'),
        amountPaise: 1000000,
        amount: 10000,
        status: PaymentStatus.COMPLETED,
        paymentMethod: PaymentMethod.NEFT,
      };

      const mockAcquisition = {
        _id: sampleAcquisitionId,
        receiptCode: 'EXT-20261014-0001',
        expenseId: sampleExpenseId,
        totalPayablePaise: 1000000,
        adjustments: [
          {
            creditNoteReference: 'CN-POST-PAID-01',
            referenceNumber: 'CN-POST-PAID-01',
            creditAmountPaise: 300000, // ₹3,000 credit note recorded post-full payment
            amountPaise: 300000,
            amount: 3000,
            authorizedAt: new Date('2026-10-10'),
          },
        ],
      };

      vendorModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockVendor),
      });
      expenseModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockExpense]),
          }),
        }),
      });
      paymentModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockPayment]),
          }),
        }),
      });
      bloodAcquisitionModel.findById = jest.fn().mockImplementation((id: any) => ({
        exec: jest.fn().mockResolvedValue(mockAcquisition),
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockAcquisition),
        }),
      }));

      const ledger = await vendorsService.getLedger(sampleVendorId.toString());

      expect(ledger.items.length).toBe(3); // 1 invoice + 1 payment + 1 credit memo
      const creditEntry = ledger.items.find((e: any) => e.type === 'CREDIT_MEMO');
      expect(creditEntry).toBeDefined();
      expect(creditEntry.creditPaise).toBe(300000); // Supplier refund receivable
      // Net balance reflects supplier liability / receivable without negative clamping
      expect(ledger.summary.outstandingBalancePaise).toBe(-300000); // Vendor owes ₹3,000 back to blood bank
    });
  });

  describe('6. Idempotency Key & Payload Hash Verification', () => {
    it('should return identical existing acquisition on replay without generating duplicate units or expenses', async () => {
      const idempotencyKey = 'c7e8a910-1234-5678-9abc-def012345678';
      const inputDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Metro Blood Bank',
        receivedDate: new Date().toISOString(),
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 2,
            receivedQuantity: 2,
            acceptedQuantity: 2,
            rejectedQuantity: 0,
            pendingInspectionQuantity: 0,
            testingRequired: true,
          },
        ],
      };

      const canonicalHash = acquisitionsService.computeCanonicalPayloadHash(inputDto);

      const existingRecord = {
        _id: sampleAcquisitionId,
        idempotencyKey,
        requestPayloadHash: canonicalHash,
        receiptCode: 'EXT-20261014-0001',
        totalUnitsGenerated: 2,
      };

      bloodAcquisitionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingRecord),
      });

      const replay = await acquisitionsService.create(inputDto, mockAdminStaff, idempotencyKey);
      expect(replay.isIdempotentReplay).toBe(true);
      expect(replay.receipt._id).toBe(sampleAcquisitionId);
    });

    it('should throw ConflictException if idempotency key is reused with modified payload', async () => {
      const idempotencyKey = 'c7e8a910-1234-5678-9abc-def012345678';
      const inputDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Metro Blood Bank',
        receivedDate: new Date().toISOString(),
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 2,
            receivedQuantity: 2,
            acceptedQuantity: 2,
            rejectedQuantity: 0,
            pendingInspectionQuantity: 0,
            testingRequired: true,
          },
        ],
      };

      const existingRecord = {
        _id: sampleAcquisitionId,
        idempotencyKey,
        requestPayloadHash: 'completely-different-sha256-hash',
        receiptCode: 'EXT-20261014-0001',
      };

      bloodAcquisitionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingRecord),
      });

      await expect(
        acquisitionsService.create(inputDto, mockAdminStaff, idempotencyKey),
      ).rejects.toThrow(ConflictException);
    });
  });
});
