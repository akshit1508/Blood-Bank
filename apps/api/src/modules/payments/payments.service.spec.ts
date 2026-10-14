import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PaymentsService } from './payments.service';
import { Payment } from './schemas/payment.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { BloodAcquisition } from '../blood-acquisitions/schemas/blood-acquisition.schema';
import { ExpenseStatus, ExpensePaymentStatus } from '../expenses/constants/expense.constants';
import { PaymentMethod, PaymentStatus } from './constants/payment.constants';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentModel: any;
  let expenseModel: any;
  let vendorModel: any;
  let bloodAcquisitionModel: any;
  let mockConnection: any;

  const mockAdmin = {
    userId: new Types.ObjectId(),
    fullName: 'Super Admin User',
    email: 'superadmin@bloodbank.org',
    role: 'SUPER_ADMIN',
  };

  const validVendorId = new Types.ObjectId();
  const validExpenseId = new Types.ObjectId();

  beforeEach(async () => {
    paymentModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      collection: {
        createIndex: jest.fn().mockResolvedValue(true),
        indexes: jest.fn().mockResolvedValue([{ key: { idempotencyKey: 1 }, unique: true }]),
      },
    };

    expenseModel = {
      findById: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn(),
    };

    vendorModel = {
      findById: jest.fn(),
    };

    bloodAcquisitionModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
      find: jest.fn(),
    };

    mockConnection = {
      startSession: jest.fn().mockReturnValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
        withTransaction: jest.fn().mockImplementation(async (cb) => {
          return await cb();
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: getModelToken(Expense.name), useValue: expenseModel },
        { provide: getModelToken(Vendor.name), useValue: vendorModel },
        { provide: getModelToken(BloodAcquisition.name), useValue: bloodAcquisitionModel },
        { provide: getConnectionToken(), useValue: mockConnection },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('Validation & Vendor Derivation Safeguards', () => {
    it('should reject payment on non-payable expense (e.g. DRAFT)', async () => {
      expenseModel.findById.mockResolvedValue({
        _id: validExpenseId,
        status: ExpenseStatus.DRAFT,
        vendorId: validVendorId,
      });

      await expect(
        service.recordPayment(
          {
            expenseId: validExpenseId.toString(),
            amount: 500.0,
            paymentMethod: PaymentMethod.UPI,
            referenceNumber: 'UPI-123456',
            paymentDate: '2026-10-13',
            idempotencyKey: 'idemp-test-key-001',
          },
          mockAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow payment on SUBMITTED expense and transition it to APPROVED', async () => {
      expenseModel.findById.mockResolvedValue({
        _id: validExpenseId,
        status: ExpenseStatus.SUBMITTED,
        vendorId: validVendorId,
        vendorName: 'Direct Supplier Co',
        amountPaise: 100000,
        paidAmountPaise: 0,
      });
      paymentModel.findOne.mockResolvedValue(null);
      expenseModel.findOneAndUpdate.mockResolvedValue({
        _id: validExpenseId,
        status: ExpenseStatus.APPROVED,
        paidAmountPaise: 100000,
        paidAmount: 1000.0,
        paymentStatus: ExpensePaymentStatus.PAID,
      });
      const createdPayment = {
        _id: new Types.ObjectId(),
        amountPaise: 100000,
        amount: 1000.0,
        vendorName: 'Direct Supplier Co',
        status: PaymentStatus.COMPLETED,
      };
      paymentModel.create.mockResolvedValue([createdPayment]);
      expenseModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.recordPayment(
        {
          expenseId: validExpenseId.toString(),
          amount: 1000.0,
          paymentMethod: PaymentMethod.UPI,
          referenceNumber: 'UPI-SUBMITTED-01',
          paymentDate: '2026-10-14',
          idempotencyKey: 'idemp-test-submitted-01',
        },
        mockAdmin,
      );

      expect(result).toBeDefined();
      expect(expenseModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: validExpenseId,
          status: { $in: [ExpenseStatus.APPROVED, ExpenseStatus.SUBMITTED] },
        }),
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('should allow payment on historical expense lacking a linked vendor using vendorName directly', async () => {
      expenseModel.findById.mockResolvedValue({
        _id: validExpenseId,
        status: ExpenseStatus.APPROVED,
        vendorId: null, // Unlinked expense
        expenseCode: 'EXP-LEGACY-01',
        vendorName: 'Direct Supplier Co',
        amountPaise: 100000,
        paidAmountPaise: 0,
      });
      paymentModel.findOne.mockResolvedValue(null);
      expenseModel.findOneAndUpdate.mockResolvedValue({
        _id: validExpenseId,
        paidAmountPaise: 50000,
        paidAmount: 500.0,
        paymentStatus: ExpensePaymentStatus.PARTIALLY_PAID,
      });
      const createdPayment = {
        _id: new Types.ObjectId(),
        amountPaise: 50000,
        amount: 500.0,
        vendorName: 'Direct Supplier Co',
        status: PaymentStatus.COMPLETED,
      };
      paymentModel.create.mockResolvedValue([createdPayment]);
      expenseModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.recordPayment(
        {
          expenseId: validExpenseId.toString(),
          amount: 500.0,
          paymentMethod: PaymentMethod.NEFT,
          referenceNumber: 'NEFT-889900',
          paymentDate: '2026-10-13',
          idempotencyKey: 'idemp-test-key-002',
        },
        mockAdmin,
      );

      expect(result).toBe(createdPayment);
      expect(paymentModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            vendorName: 'Direct Supplier Co',
            vendorId: undefined,
          }),
        ]),
        expect.anything(),
      );
    });

    it('should reject payment when client submits conflicting vendorId', async () => {
      const differentVendorId = new Types.ObjectId();
      expenseModel.findById.mockResolvedValue({
        _id: validExpenseId,
        status: ExpenseStatus.APPROVED,
        vendorId: validVendorId,
        amountPaise: 100000,
        paidAmountPaise: 0,
      });

      await expect(
        service.recordPayment(
          {
            expenseId: validExpenseId.toString(),
            vendorId: differentVendorId.toString(), // Conflicting ID
            amount: 500.0,
            paymentMethod: PaymentMethod.UPI,
            referenceNumber: 'UPI-123456',
            paymentDate: '2026-10-13',
            idempotencyKey: 'idemp-test-key-003',
          },
          mockAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject payment with fractional paise (e.g. ₹10.005)', async () => {
      await expect(
        service.recordPayment(
          {
            expenseId: validExpenseId.toString(),
            amount: 10.005, // Invalid fractional paise
            paymentMethod: PaymentMethod.UPI,
            referenceNumber: 'UPI-123456',
            paymentDate: '2026-10-13',
            idempotencyKey: 'idemp-test-key-004',
          },
          mockAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Idempotency & Replay Protection', () => {
    it('should return existing payment when called with same idempotencyKey and identical payload', async () => {
      const expenseDoc = {
        _id: validExpenseId,
        status: ExpenseStatus.APPROVED,
        vendorId: validVendorId,
        amountPaise: 100000,
        paidAmountPaise: 0,
      };
      const vendorDoc = {
        _id: validVendorId,
        name: 'MedTech Supplies Ltd',
        isActive: true,
      };

      expenseModel.findById.mockResolvedValue(expenseDoc);
      vendorModel.findById.mockResolvedValue(vendorDoc);

      const payload = {
        expenseId: validExpenseId.toString(),
        amount: 500.0,
        paymentMethod: PaymentMethod.RTGS,
        referenceNumber: 'RTGS-998877',
        paymentDate: '2026-10-13',
        idempotencyKey: 'idemp-test-key-005',
      };

      const expectedHash = service.computeCanonicalPayloadHash({
        expenseId: validExpenseId.toString(),
        vendorId: validVendorId.toString(),
        amountPaise: 50000,
        paymentMethod: PaymentMethod.RTGS,
        paymentDate: '2026-10-13',
        referenceNumber: 'RTGS-998877',
        notes: undefined,
      });

      const cachedPayment = {
        _id: new Types.ObjectId(),
        idempotencyKey: 'idemp-test-key-005',
        requestPayloadHash: expectedHash,
        amount: 500.0,
        amountPaise: 50000,
        status: PaymentStatus.COMPLETED,
      };

      paymentModel.findOne.mockResolvedValue(cachedPayment);

      const result = await service.recordPayment(payload, mockAdmin);

      expect(result).toBe(cachedPayment);
      // Ensure database update was not called again
      expect(expenseModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should reject with 409 Conflict when same idempotencyKey is reused with different payload', async () => {
      const expenseDoc = {
        _id: validExpenseId,
        status: ExpenseStatus.APPROVED,
        vendorId: validVendorId,
        amountPaise: 100000,
        paidAmountPaise: 0,
      };
      const vendorDoc = {
        _id: validVendorId,
        name: 'MedTech Supplies Ltd',
        isActive: true,
      };

      expenseModel.findById.mockResolvedValue(expenseDoc);
      vendorModel.findById.mockResolvedValue(vendorDoc);

      const cachedPayment = {
        _id: new Types.ObjectId(),
        idempotencyKey: 'idemp-test-key-006',
        requestPayloadHash: 'previous_different_sha256_hash',
        amount: 200.0,
      };

      paymentModel.findOne.mockResolvedValue(cachedPayment);

      await expect(
        service.recordPayment(
          {
            expenseId: validExpenseId.toString(),
            amount: 500.0, // Different amount
            paymentMethod: PaymentMethod.UPI,
            referenceNumber: 'UPI-NEW-REF',
            paymentDate: '2026-10-13',
            idempotencyKey: 'idemp-test-key-006',
          },
          mockAdmin,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Atomic Payment Creation & Balances', () => {
    it('should create payment and derive INR amount strictly from amountPaise', async () => {
      const expenseDoc = {
        _id: validExpenseId,
        status: ExpenseStatus.APPROVED,
        vendorId: validVendorId,
        amountPaise: 100000,
        paidAmountPaise: 0,
      };
      const vendorDoc = {
        _id: validVendorId,
        name: 'MedTech Supplies Ltd',
        isActive: true,
      };

      expenseModel.findById.mockResolvedValue(expenseDoc);
      vendorModel.findById.mockResolvedValue(vendorDoc);
      paymentModel.findOne.mockResolvedValue(null); // No prior key

      expenseModel.findOneAndUpdate.mockResolvedValue({
        _id: validExpenseId,
        paidAmountPaise: 50050,
        paidAmount: 500.5,
        paymentStatus: ExpensePaymentStatus.PARTIALLY_PAID,
      });

      const mockPaymentDoc = {
        _id: new Types.ObjectId(),
        amountPaise: 50050,
        amount: 500.5,
        status: PaymentStatus.COMPLETED,
      };
      paymentModel.create.mockResolvedValue([mockPaymentDoc]);
      expenseModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.recordPayment(
        {
          expenseId: validExpenseId.toString(),
          amount: 500.5,
          paymentMethod: PaymentMethod.IMPS,
          referenceNumber: 'IMPS-112233',
          paymentDate: '2026-10-13',
          idempotencyKey: 'idemp-test-key-007',
        },
        mockAdmin,
      );

      expect(result).toBe(mockPaymentDoc);
      expect(paymentModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            amountPaise: 50050,
            amount: 500.5, // Derived: 50050 / 100
            paymentMethod: PaymentMethod.IMPS,
            status: PaymentStatus.COMPLETED,
          }),
        ]),
        expect.anything(),
      );
    });
  });

  describe('Atomic Payment Cancellation', () => {
    it('should atomically cancel payment and decrement expense balance', async () => {
      const paymentId = new Types.ObjectId();
      const cancelledPayment = {
        _id: paymentId,
        expenseId: validExpenseId,
        amountPaise: 30000,
        amount: 300.0,
        status: PaymentStatus.CANCELLED,
      };

      paymentModel.findOneAndUpdate.mockResolvedValue(cancelledPayment);
      expenseModel.findOneAndUpdate.mockResolvedValue({
        _id: validExpenseId,
        paidAmountPaise: 0,
        paidAmount: 0,
        paymentStatus: ExpensePaymentStatus.UNPAID,
      });
      expenseModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.cancelPayment(
        paymentId.toString(),
        { reason: 'Cheque bounced by vendor bank' },
        mockAdmin,
      );

      expect(result.status).toBe(PaymentStatus.CANCELLED);
      expect(paymentModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: paymentId, status: PaymentStatus.COMPLETED },
        expect.anything(),
        expect.anything(),
      );
    });

    it('should reject cancellation if payment is already cancelled', async () => {
      const paymentId = new Types.ObjectId();
      paymentModel.findOneAndUpdate.mockResolvedValue(null); // Already cancelled or not found

      await expect(
        service.cancelPayment(
          paymentId.toString(),
          { reason: 'Attempting duplicate cancellation' },
          mockAdmin,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
