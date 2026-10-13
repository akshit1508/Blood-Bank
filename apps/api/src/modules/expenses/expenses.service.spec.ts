import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ExpensesService } from './expenses.service';
import { Expense } from './schemas/expense.schema';
import { StorageService } from './storage/storage.service';
import { ExpenseStatus, ExpenseCategory, CostCenter } from './constants/expense.constants';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let mockExpenseModel: any;
  let mockStorageService: any;

  const mockAdminUser = {
    id: new Types.ObjectId().toString(),
    email: 'admin@bloodbank.org',
    fullName: 'Operational Admin',
    role: 'ADMIN',
  };

  const mockSuperAdminUser = {
    id: new Types.ObjectId().toString(),
    email: 'superadmin@bloodbank.org',
    fullName: 'Chief Super Admin',
    role: 'SUPER_ADMIN',
  };

  beforeEach(async () => {
    mockExpenseModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };

    mockStorageService = {
      saveReceipt: jest.fn(),
      getReceiptStream: jest.fn(),
      deleteReceipt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: getModelToken(Expense.name),
          useValue: mockExpenseModel,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  describe('createExpense', () => {
    it('creates a draft expense with INR currency and audit trail', async () => {
      const dto = {
        title: '500 Triple Blood Bags',
        category: ExpenseCategory.MEDICAL_SUPPLIES,
        costCenter: CostCenter.BLOOD_BANK_OPERATIONS,
        expenseDate: '2026-10-13T10:00:00.000Z',
        amount: 25000.5,
        vendorName: 'Hindustan Syringes & Medical Devices',
        invoiceNumber: 'INV-2026-991',
        gstinNumber: '07AAAAA0000A1Z5',
        taxAmount: 4500,
      };

      mockExpenseModel.create.mockImplementation((data: any) => Promise.resolve({ ...data, _id: new Types.ObjectId() }));

      const res = await service.createExpense(dto as any, mockAdminUser);
      expect(res).toBeDefined();
      expect(res.currency).toBe('INR');
      expect(res.status).toBe(ExpenseStatus.DRAFT);
      expect(res.amount).toBe(25000.5);
      expect(res.auditHistory.length).toBe(1);
      expect(res.auditHistory[0].action).toBe('CREATED');
    });
  });

  describe('submitExpense', () => {
    it('throws BadRequestException if receipt is missing', async () => {
      const draftExpense = {
        _id: new Types.ObjectId(),
        status: ExpenseStatus.DRAFT,
        vendorName: 'Med Supplies',
        invoiceNumber: 'INV-1',
        amount: 500,
        receipt: null,
      };
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(draftExpense),
      });

      await expect(service.submitExpense(draftExpense._id.toString(), {}, mockAdminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('submits successfully when receipt is attached by normal Admin (transitions to SUBMITTED)', async () => {
      const draftExpense: any = {
        _id: new Types.ObjectId(),
        status: ExpenseStatus.DRAFT,
        vendorName: 'Med Supplies',
        invoiceNumber: 'INV-1',
        amount: 500,
        receipt: { fileId: 'file-123' },
        auditHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      draftExpense.save.mockResolvedValue(draftExpense);
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(draftExpense),
      });

      const res = await service.submitExpense(draftExpense._id.toString(), { submissionRemarks: 'Ready' }, mockAdminUser);
      expect(draftExpense.status).toBe(ExpenseStatus.SUBMITTED);
      expect(draftExpense.auditHistory.length).toBe(1);
      expect(draftExpense.auditHistory[0].action).toBe('SUBMITTED');
    });

    it('directly approves expense when submitted by SUPER_ADMIN without entering pending queue', async () => {
      const draftExpense: any = {
        _id: new Types.ObjectId(),
        status: ExpenseStatus.DRAFT,
        vendorName: 'Direct Super Vendor',
        invoiceNumber: 'INV-SA-1',
        amount: 1500,
        receipt: { fileId: 'file-sa-1' },
        auditHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      draftExpense.save.mockResolvedValue(draftExpense);
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(draftExpense),
      });

      const res = await service.submitExpense(
        draftExpense._id.toString(),
        { submissionRemarks: 'Approved on creation' },
        mockSuperAdminUser,
      );
      expect(draftExpense.status).toBe(ExpenseStatus.APPROVED);
      expect(draftExpense.reviewedBy.toString()).toBe(mockSuperAdminUser.id);
      expect(draftExpense.reviewedByEmail).toBe(mockSuperAdminUser.email);
      expect(draftExpense.auditHistory.length).toBe(1);
      expect(draftExpense.auditHistory[0].action).toBe('APPROVED');
    });
  });

  describe('approveExpense', () => {
    it('prevents self-approval when approver is the expense creator', async () => {
      const submittedExpense: any = {
        _id: new Types.ObjectId(),
        status: ExpenseStatus.SUBMITTED,
        creatorId: new Types.ObjectId(mockSuperAdminUser.id),
      };
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(submittedExpense),
      });

      await expect(
        service.approveExpense(submittedExpense._id.toString(), {}, mockSuperAdminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('approves successfully when approver is a distinct Super Admin', async () => {
      const submittedExpense: any = {
        _id: new Types.ObjectId(),
        status: ExpenseStatus.SUBMITTED,
        creatorId: new Types.ObjectId(mockAdminUser.id),
        auditHistory: [],
        save: jest.fn(),
      };
      submittedExpense.save.mockResolvedValue(submittedExpense);
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(submittedExpense),
      });

      const res = await service.approveExpense(submittedExpense._id.toString(), { approvalRemarks: 'Verified bill' }, mockSuperAdminUser);
      expect(submittedExpense.status).toBe(ExpenseStatus.APPROVED);
      expect(submittedExpense.reviewedBy.toString()).toBe(mockSuperAdminUser.id);
      expect(submittedExpense.auditHistory.length).toBe(1);
      expect(submittedExpense.auditHistory[0].action).toBe('APPROVED');
    });
  });

  describe('rejectExpense', () => {
    it('throws BadRequestException if rejection reason is empty', async () => {
      const submittedExpense: any = {
        _id: new Types.ObjectId(),
        status: ExpenseStatus.SUBMITTED,
        creatorId: new Types.ObjectId(mockAdminUser.id),
      };
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(submittedExpense),
      });

      await expect(
        service.rejectExpense(submittedExpense._id.toString(), { rejectionReason: '' }, mockSuperAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects successfully with mandatory reason and audit entry', async () => {
      const submittedExpense: any = {
        _id: new Types.ObjectId(),
        status: ExpenseStatus.SUBMITTED,
        creatorId: new Types.ObjectId(mockAdminUser.id),
        auditHistory: [],
        save: jest.fn(),
      };
      submittedExpense.save.mockResolvedValue(submittedExpense);
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(submittedExpense),
      });

      await service.rejectExpense(submittedExpense._id.toString(), { rejectionReason: 'Tax mismatch' }, mockSuperAdminUser);
      expect(submittedExpense.status).toBe(ExpenseStatus.REJECTED);
      expect(submittedExpense.rejectionReason).toBe('Tax mismatch');
      expect(submittedExpense.auditHistory[0].action).toBe('REJECTED');
    });
  });

  describe('resubmitExpense', () => {
    it('transitions REJECTED to SUBMITTED preserving history and requiring remarks', async () => {
      const rejectedExpense: any = {
        _id: new Types.ObjectId(),
        status: ExpenseStatus.REJECTED,
        receipt: { fileId: 'file-123' },
        auditHistory: [{ action: 'REJECTED' }],
        save: jest.fn(),
      };
      rejectedExpense.save.mockResolvedValue(rejectedExpense);
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(rejectedExpense),
      });

      await service.resubmitExpense(rejectedExpense._id.toString(), { submissionRemarks: 'Fixed invoice tax' }, mockAdminUser);
      expect(rejectedExpense.status).toBe(ExpenseStatus.SUBMITTED);
      expect(rejectedExpense.auditHistory.length).toBe(2);
      expect(rejectedExpense.auditHistory[1].action).toBe('RESUBMITTED');
    });
  });

  describe('deleteExpense', () => {
    it('soft deletes draft setting status to CANCELLED and isDeleted true', async () => {
      const draftExpense: any = {
        _id: new Types.ObjectId(),
        status: ExpenseStatus.DRAFT,
        creatorId: new Types.ObjectId(mockAdminUser.id),
        auditHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(draftExpense),
      });

      const res = await service.deleteExpense(draftExpense._id.toString(), mockAdminUser);
      expect(draftExpense.isDeleted).toBe(true);
      expect(draftExpense.status).toBe(ExpenseStatus.CANCELLED);
    });
  });

  describe('findById ownership security', () => {
    it('allows SUPER_ADMIN to view any expense record', async () => {
      const otherUserExpense: any = {
        _id: new Types.ObjectId(),
        creatorId: new Types.ObjectId(mockAdminUser.id),
        title: 'Other Admin Claim',
      };
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(otherUserExpense),
      });

      const res = await service.findById(otherUserExpense._id.toString(), mockSuperAdminUser);
      expect(res).toBe(otherUserExpense);
    });

    it('denies normal ADMIN from viewing expense created by another staff account', async () => {
      const anotherAdminId = new Types.ObjectId().toString();
      const otherUserExpense: any = {
        _id: new Types.ObjectId(),
        creatorId: new Types.ObjectId(anotherAdminId),
        title: 'Another Admin Claim',
      };
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(otherUserExpense),
      });

      await expect(
        service.findById(otherUserExpense._id.toString(), mockAdminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows normal ADMIN to view their own created expense', async () => {
      const ownExpense: any = {
        _id: new Types.ObjectId(),
        creatorId: new Types.ObjectId(mockAdminUser.id),
        title: 'Own Claim',
      };
      mockExpenseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(ownExpense),
      });

      const res = await service.findById(ownExpense._id.toString(), mockAdminUser);
      expect(res).toBe(ownExpense);
    });
  });
});
