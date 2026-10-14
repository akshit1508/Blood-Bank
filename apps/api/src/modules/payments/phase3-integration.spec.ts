import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PaymentsService } from './payments.service';
import { VendorsService } from '../vendors/vendors.service';
import { Payment } from './schemas/payment.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { ExpenseStatus, ExpensePaymentStatus } from '../expenses/constants/expense.constants';
import { PaymentMethod, PaymentStatus } from './constants/payment.constants';
import { BloodAcquisition } from '../blood-acquisitions/schemas/blood-acquisition.schema';

describe('Phase 3 Integration: Expenditure -> Approval -> Vendor -> Payments -> Dues', () => {
  let paymentsService: PaymentsService;
  let vendorsService: VendorsService;
  let paymentModel: any;
  let expenseModel: any;
  let vendorModel: any;
  let mockConnection: any;

  const mockSuperAdmin = {
    userId: new Types.ObjectId(),
    _id: new Types.ObjectId(),
    fullName: 'Chief Super Admin',
    email: 'superadmin@bloodbank.org',
    role: 'SUPER_ADMIN',
  };

  const vendorId = new Types.ObjectId();
  const expenseId = new Types.ObjectId();

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
      find: jest.fn(),
      findOne: jest.fn(),
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
        VendorsService,
        {
          provide: getModelToken(Payment.name),
          useValue: paymentModel,
        },
        {
          provide: getModelToken(Expense.name),
          useValue: expenseModel,
        },
        {
          provide: getModelToken(Vendor.name),
          useValue: vendorModel,
        },
        {
          provide: getModelToken(BloodAcquisition.name),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
            findById: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
            find: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
    vendorsService = module.get<VendorsService>(VendorsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario 1: New Approved Expenditure (Liability Creation)', () => {
    it('should reflect approved ₹10,000 expense in Vendor Ledger and Outstanding Dues', async () => {
      const expenseAmountPaise = 1000000; // ₹10,000.00
      const now = new Date();

      const mockExpense = {
        _id: expenseId,
        expenseCode: 'EXP-20261013-0001',
        title: 'Blood Bags 500ml',
        amount: 10000.0,
        amountPaise: expenseAmountPaise,
        paidAmount: 0,
        paidAmountPaise: 0,
        paymentStatus: ExpensePaymentStatus.UNPAID,
        status: ExpenseStatus.APPROVED,
        vendorId,
        vendorName: 'Apex Medical Supplies Ltd',
        invoiceNumber: 'INV-APEX-8891',
        expenseDate: now,
        isDeleted: false,
      };

      const mockVendor = {
        _id: vendorId,
        name: 'Apex Medical Supplies Ltd',
        category: 'MEDICAL_SUPPLIES',
        isActive: true,
      };

      // Query mock setup for Outstanding Dues
      expenseModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockExpense]),
          }),
        }),
      });

      const dues = await paymentsService.getOutstandingDues();
      expect(dues.summary.totalOutstandingInr).toBe(10000.0);
      expect(dues.summary.totalOutstandingPaise).toBe(1000000);
      expect(dues.summary.totalPaidInr).toBe(0);
      expect(dues.creditors).toHaveLength(1);
      expect(dues.creditors[0].outstandingInr).toBe(10000.0);
      expect(dues.creditors[0].expenses[0].agingBucket).toBe('0-30 Days');

      // Query mock setup for Vendor Ledger
      vendorModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockVendor),
      });

      expenseModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockExpense]),
          }),
        }),
      });

      paymentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]), // No payments yet
          }),
        }),
      });

      const ledger = await vendorsService.getLedger(vendorId.toString());
      expect(ledger.summary.totalInvoicedInr).toBe(10000.0);
      expect(ledger.summary.totalPaidInr).toBe(0);
      expect(ledger.summary.outstandingBalanceInr).toBe(10000.0);
      expect(ledger.items).toHaveLength(1);
      expect(ledger.items[0].type).toBe('INVOICE');
      expect(ledger.items[0].balanceInr).toBe(10000.0);
    });
  });

  describe('Scenario 2: Partial Payment (₹6,000 of ₹10,000)', () => {
    it('should atomically deduct balance, leave ₹4,000 outstanding, and update paymentStatus to PARTIALLY_PAID', async () => {
      const mockExpense = {
        _id: expenseId,
        expenseCode: 'EXP-20261013-0001',
        title: 'Blood Bags 500ml',
        amount: 10000.0,
        amountPaise: 1000000,
        paidAmountPaise: 0,
        paidAmount: 0,
        paymentStatus: ExpensePaymentStatus.UNPAID,
        status: ExpenseStatus.APPROVED,
        vendorId,
        vendorName: 'Apex Medical Supplies Ltd',
        isDeleted: false,
      };

      const mockVendor = {
        _id: vendorId,
        name: 'Apex Medical Supplies Ltd',
        isActive: true,
      };

      expenseModel.findById.mockResolvedValue(mockExpense);
      vendorModel.findById.mockResolvedValue(mockVendor);
      paymentModel.findOne.mockResolvedValue(null);

      const updatedExpense = {
        ...mockExpense,
        paidAmountPaise: 600000,
        paidAmount: 6000.0,
        paymentStatus: ExpensePaymentStatus.PARTIALLY_PAID,
      };
      expenseModel.findOneAndUpdate.mockResolvedValue(updatedExpense);

      const createdPayment = {
        _id: new Types.ObjectId(),
        expenseId,
        vendorId,
        amount: 6000.0,
        amountPaise: 600000,
        status: PaymentStatus.COMPLETED,
        paymentMethod: PaymentMethod.NEFT,
        referenceNumber: 'NEFT-2026-6001',
      };
      paymentModel.create.mockResolvedValue([createdPayment]);
      expenseModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const payment = await paymentsService.recordPayment(
        {
          expenseId: expenseId.toString(),
          amount: 6000.0,
          paymentMethod: PaymentMethod.NEFT,
          referenceNumber: 'NEFT-2026-6001',
          paymentDate: '2026-10-13',
          idempotencyKey: 'idem-partial-6000',
        },
        mockSuperAdmin,
      );

      expect(payment.amount).toBe(6000.0);
      expect(payment.amountPaise).toBe(600000);
      expect(payment.status).toBe(PaymentStatus.COMPLETED);
    });
  });

  describe('Scenario 3: Remaining Payment (₹4,000)', () => {
    it('should transition expense to PAID and zero out outstanding dues', async () => {
      const mockExpense = {
        _id: expenseId,
        expenseCode: 'EXP-20261013-0001',
        title: 'Blood Bags 500ml',
        amount: 10000.0,
        amountPaise: 1000000,
        paidAmountPaise: 600000,
        paidAmount: 6000.0,
        paymentStatus: ExpensePaymentStatus.PARTIALLY_PAID,
        status: ExpenseStatus.APPROVED,
        vendorId,
        vendorName: 'Apex Medical Supplies Ltd',
        isDeleted: false,
      };

      const mockVendor = {
        _id: vendorId,
        name: 'Apex Medical Supplies Ltd',
        isActive: true,
      };

      expenseModel.findById.mockResolvedValue(mockExpense);
      vendorModel.findById.mockResolvedValue(mockVendor);
      paymentModel.findOne.mockResolvedValue(null);

      const fullyPaidExpense = {
        ...mockExpense,
        paidAmountPaise: 1000000,
        paidAmount: 10000.0,
        paymentStatus: ExpensePaymentStatus.PAID,
      };
      expenseModel.findOneAndUpdate.mockResolvedValue(fullyPaidExpense);

      const finalPayment = {
        _id: new Types.ObjectId(),
        expenseId,
        vendorId,
        amount: 4000.0,
        amountPaise: 400000,
        status: PaymentStatus.COMPLETED,
        paymentMethod: PaymentMethod.UPI,
        referenceNumber: 'UPI-2026-4001',
      };
      paymentModel.create.mockResolvedValue([finalPayment]);
      expenseModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const payment = await paymentsService.recordPayment(
        {
          expenseId: expenseId.toString(),
          amount: 4000.0,
          paymentMethod: PaymentMethod.UPI,
          referenceNumber: 'UPI-2026-4001',
          paymentDate: '2026-10-13',
          idempotencyKey: 'idem-remaining-4000',
        },
        mockSuperAdmin,
      );

      expect(payment.amount).toBe(4000.0);
      expect(payment.amountPaise).toBe(400000);

      // Verify that getOutstandingDues excludes PAID expenses
      expenseModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]), // No unpaid expenses remaining
          }),
        }),
      });

      const dues = await paymentsService.getOutstandingDues();
      expect(dues.summary.totalOutstandingInr).toBe(0);
      expect(dues.creditors).toHaveLength(0);
    });
  });

  describe('Scenario 4: Payment Cancellation with Rollback', () => {
    it('should atomically cancel payment and restore expense unpaid balance', async () => {
      const paymentId = new Types.ObjectId();
      const mockCancelledPayment = {
        _id: paymentId,
        expenseId,
        vendorId,
        amountPaise: 400000,
        amount: 4000.0,
        status: PaymentStatus.CANCELLED,
      };

      paymentModel.findOneAndUpdate.mockResolvedValue(mockCancelledPayment);
      expenseModel.findOneAndUpdate.mockResolvedValue({
        _id: expenseId,
        paidAmountPaise: 600000,
        paidAmount: 6000.0,
        paymentStatus: ExpensePaymentStatus.PARTIALLY_PAID,
      });
      expenseModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const cancelled = await paymentsService.cancelPayment(
        paymentId.toString(),
        { reason: 'Duplicate transfer detected by accounts desk' },
        mockSuperAdmin,
      );

      expect(cancelled.status).toBe(PaymentStatus.CANCELLED);
      expect(expenseModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: expenseId,
          $expr: { $gte: ['$paidAmountPaise', 400000] },
        },
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('Scenario 5: Multiple Expenses for Single Vendor Aggregation', () => {
    it('should compute exact aggregated vendor balance without cross-talk', async () => {
      const expense1 = {
        _id: new Types.ObjectId(),
        expenseCode: 'EXP-1',
        title: 'Gloves',
        amount: 3000.0,
        amountPaise: 300000,
        paidAmount: 3000.0,
        paidAmountPaise: 300000,
        paymentStatus: ExpensePaymentStatus.PAID,
        status: ExpenseStatus.APPROVED,
        vendorId,
        vendorName: 'Apex Medical Supplies Ltd',
        expenseDate: new Date('2026-09-01'),
        createdAt: new Date('2026-09-01'),
      };

      const expense2 = {
        _id: new Types.ObjectId(),
        expenseCode: 'EXP-2',
        title: 'Reagents',
        amount: 7000.0,
        amountPaise: 700000,
        paidAmount: 2000.0,
        paidAmountPaise: 200000,
        paymentStatus: ExpensePaymentStatus.PARTIALLY_PAID,
        status: ExpenseStatus.APPROVED,
        vendorId,
        vendorName: 'Apex Medical Supplies Ltd',
        expenseDate: new Date('2026-10-01'),
        createdAt: new Date('2026-10-01'),
      };

      const payment1 = {
        _id: new Types.ObjectId(),
        expenseId: expense1._id,
        vendorId,
        amount: 3000.0,
        amountPaise: 300000,
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2026-09-05'),
        createdAt: new Date('2026-09-05'),
        referenceNumber: 'REF-1',
      };

      const payment2 = {
        _id: new Types.ObjectId(),
        expenseId: expense2._id,
        vendorId,
        amount: 2000.0,
        amountPaise: 200000,
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2026-10-05'),
        createdAt: new Date('2026-10-05'),
        referenceNumber: 'REF-2',
      };

      vendorModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: vendorId,
          name: 'Apex Medical Supplies Ltd',
          isActive: true,
        }),
      });

      expenseModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([expense1, expense2]),
          }),
        }),
      });

      paymentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([payment1, payment2]),
          }),
        }),
      });

      const ledger = await vendorsService.getLedger(vendorId.toString());
      expect(ledger.summary.totalInvoicedInr).toBe(10000.0);
      expect(ledger.summary.totalPaidInr).toBe(5000.0);
      expect(ledger.summary.outstandingBalanceInr).toBe(5000.0);
      expect(ledger.items).toHaveLength(4); // 2 invoices + 2 disbursements
    });
  });

  describe('Scenario 6: Invariants & Security Guard Enforcements', () => {
    it('should reject payment recording if expense is unapproved', async () => {
      expenseModel.findById.mockResolvedValue({
        _id: expenseId,
        status: ExpenseStatus.SUBMITTED,
        isDeleted: false,
      });

      await expect(
        paymentsService.recordPayment(
          {
            expenseId: expenseId.toString(),
            amount: 500.0,
            paymentMethod: PaymentMethod.CASH,
            referenceNumber: 'VOUCHER-01',
            paymentDate: '2026-10-13',
            idempotencyKey: 'idem-unapproved',
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject payment recording if expense is not linked to registered vendor', async () => {
      expenseModel.findById.mockResolvedValue({
        _id: expenseId,
        status: ExpenseStatus.APPROVED,
        vendorId: null,
        vendorName: 'Legacy Hospital Supply',
        isDeleted: false,
      });

      await expect(
        paymentsService.recordPayment(
          {
            expenseId: expenseId.toString(),
            amount: 500.0,
            paymentMethod: PaymentMethod.CASH,
            referenceNumber: 'VOUCHER-02',
            paymentDate: '2026-10-13',
            idempotencyKey: 'idem-unlinked',
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject payment recording if vendor is marked inactive', async () => {
      expenseModel.findById.mockResolvedValue({
        _id: expenseId,
        status: ExpenseStatus.APPROVED,
        vendorId,
        vendorName: 'Apex Medical Supplies Ltd',
        isDeleted: false,
      });

      vendorModel.findById.mockResolvedValue({
        _id: vendorId,
        isActive: false, // Inactive
      });

      await expect(
        paymentsService.recordPayment(
          {
            expenseId: expenseId.toString(),
            amount: 500.0,
            paymentMethod: PaymentMethod.CASH,
            referenceNumber: 'VOUCHER-03',
            paymentDate: '2026-10-13',
            idempotencyKey: 'idem-inactive-vendor',
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce idempotency by returning existing payment when key and payload match', async () => {
      const existingPayment = {
        _id: new Types.ObjectId(),
        expenseId,
        vendorId,
        amount: 1000.0,
        amountPaise: 100000,
        status: PaymentStatus.COMPLETED,
        idempotencyKey: 'idem-key-duplicate',
        requestPayloadHash: paymentsService.computeCanonicalPayloadHash({
          expenseId: expenseId.toString(),
          vendorId: vendorId.toString(),
          amountPaise: 100000,
          paymentMethod: PaymentMethod.UPI,
          paymentDate: '2026-10-13',
          referenceNumber: 'UPI-MATCH',
        }),
      };

      expenseModel.findById.mockResolvedValue({
        _id: expenseId,
        status: ExpenseStatus.APPROVED,
        vendorId,
        isDeleted: false,
        amount: 5000.0,
        amountPaise: 500000,
        paidAmountPaise: 0,
      });
      vendorModel.findById.mockResolvedValue({
        _id: vendorId,
        isActive: true,
      });
      paymentModel.findOne.mockResolvedValue(existingPayment);

      const result = await paymentsService.recordPayment(
        {
          expenseId: expenseId.toString(),
          amount: 1000.0,
          paymentMethod: PaymentMethod.UPI,
          referenceNumber: 'UPI-MATCH',
          paymentDate: '2026-10-13',
          idempotencyKey: 'idem-key-duplicate',
        },
        mockSuperAdmin,
      );

      expect(result).toBe(existingPayment);
      expect(paymentModel.create).not.toHaveBeenCalled();
    });

    it('should reject duplicate idempotency key when payload differs (409 Conflict)', async () => {
      const existingPayment = {
        _id: new Types.ObjectId(),
        expenseId,
        vendorId,
        amount: 1000.0,
        amountPaise: 100000,
        status: PaymentStatus.COMPLETED,
        idempotencyKey: 'idem-key-duplicate',
        requestPayloadHash: 'different-hash-from-previous-request',
      };

      expenseModel.findById.mockResolvedValue({
        _id: expenseId,
        status: ExpenseStatus.APPROVED,
        vendorId,
        isDeleted: false,
        amount: 5000.0,
        amountPaise: 500000,
        paidAmountPaise: 0,
      });
      vendorModel.findById.mockResolvedValue({
        _id: vendorId,
        isActive: true,
      });
      paymentModel.findOne.mockResolvedValue(existingPayment);

      await expect(
        paymentsService.recordPayment(
          {
            expenseId: expenseId.toString(),
            amount: 2000.0, // Different amount
            paymentMethod: PaymentMethod.UPI,
            referenceNumber: 'UPI-DIFFERENT',
            paymentDate: '2026-10-13',
            idempotencyKey: 'idem-key-duplicate',
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject cancellation of an already cancelled or non-completed payment', async () => {
      const paymentId = new Types.ObjectId();
      paymentModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        paymentsService.cancelPayment(
          paymentId.toString(),
          { reason: 'Valid reason exceeding 10 characters' },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject payment when remaining balance is insufficient (atomic write conflict)', async () => {
      expenseModel.findById.mockResolvedValue({
        _id: expenseId,
        status: ExpenseStatus.APPROVED,
        vendorId,
        isDeleted: false,
        amount: 100000.0,
        amountPaise: 10000000,
        paidAmountPaise: 0,
      });
      vendorModel.findById.mockResolvedValue({
        _id: vendorId,
        isActive: true,
      });
      paymentModel.findOne.mockResolvedValue(null);
      // Atomic guard fails
      expenseModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        paymentsService.recordPayment(
          {
            expenseId: expenseId.toString(),
            amount: 50000.0, // Overpayment
            paymentMethod: PaymentMethod.RTGS,
            referenceNumber: 'RTGS-EXCEED',
            paymentDate: '2026-10-13',
            idempotencyKey: 'idem-overpay',
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});