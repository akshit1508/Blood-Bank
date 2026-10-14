import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Expense, ExpenseDocument } from './schemas/expense.schema';
import {
  ExpenseStatus,
  ExpensePaymentStatus,
  ExpenseAuditEventType,
  ExpenseCategory,
  CostCenter,
} from './constants/expense.constants';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  SubmitExpenseDto,
  ResubmitExpenseDto,
  ApproveExpenseDto,
  RejectExpenseDto,
  QueryExpensesDto,
} from './dto/expense.dto';
import { StorageService } from './storage/storage.service';
import { AdminRole } from '../auth/schemas/admin-user.schema';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import { CurrencyUtil } from '../../common/utils/currency.util';

@Injectable()
export class ExpensesService implements OnModuleInit {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
    private readonly storageService: StorageService,
  ) {}

  async onModuleInit() {
    await this.syncHistoricalAcquisitionExpenses();
  }

  /**
   * Auto-promotes any legacy acquisition-linked expense in DRAFT or SUBMITTED to APPROVED,
   * as blood acquisition expenses are fixed and do not require permission for approval.
   */
  async syncHistoricalAcquisitionExpenses() {
    try {
      const unapprovedAcquisitionExpenses = await this.expenseModel.find({
        acquisitionId: { $exists: true, $ne: null },
        status: { $in: [ExpenseStatus.DRAFT, ExpenseStatus.SUBMITTED] },
        isDeleted: false,
      }).exec();

      if (unapprovedAcquisitionExpenses.length > 0) {
        this.logger.log(`Promoting ${unapprovedAcquisitionExpenses.length} historical acquisition expense(s) to APPROVED...`);
        for (const exp of unapprovedAcquisitionExpenses) {
          const fromStatus = exp.status;
          exp.status = ExpenseStatus.APPROVED;
          exp.reviewedAt = exp.reviewedAt || new Date();
          exp.approvalRemarks = 'Fixed acquisition cost auto-approved upon consignment submission.';
          exp.auditHistory.push({
            action: ExpenseAuditEventType.APPROVED,
            fromStatus,
            toStatus: ExpenseStatus.APPROVED,
            performedBy: exp.creatorId,
            performedByEmail: exp.creatorEmail || 'system@internal',
            performedByName: 'SYSTEM_TRANSITION',
            notes: 'Fixed blood acquisition consignment expense automatically approved (no separate approval required).',
            timestamp: new Date(),
          } as any);
          await exp.save();
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not sync historical acquisition expenses: ${err.message}`);
    }
  }

  /**
   * Generates unique sequential expense code: EXP-YYYYMMDD-XXXX
   */
  private generateExpenseCode(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `EXP-${yyyy}${mm}${dd}-${rand}`;
  }

  /**
   * Creates a new Expense in DRAFT status.
   */
  async createExpense(dto: CreateExpenseDto, currentAdmin: any): Promise<Expense> {
    const expenseCode = this.generateExpenseCode();

    const expenseDate = new Date(dto.expenseDate);
    if (isNaN(expenseDate.getTime())) {
      throw new BadRequestException('Invalid expense date format.');
    }

    const auditEvent = {
      action: ExpenseAuditEventType.CREATED,
      fromStatus: null,
      toStatus: ExpenseStatus.DRAFT,
      performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
      performedByEmail: currentAdmin.email,
      performedByName: currentAdmin.fullName || 'Admin Staff',
      notes: 'Initial expense draft created.',
      timestamp: new Date(),
    };

    const amountPaise = CurrencyUtil.toPaise(dto.amount);
    let linkedVendorId: Types.ObjectId | undefined = undefined;

    if (dto.vendorId) {
      if (!isValidObjectId(dto.vendorId)) {
        throw new BadRequestException('Invalid vendorId format.');
      }
      const vendor = await this.vendorModel.findById(dto.vendorId);
      if (!vendor || !vendor.isActive) {
        throw new BadRequestException('Selected vendor does not exist or is inactive.');
      }
      linkedVendorId = vendor._id;
    }

    const expense = await this.expenseModel.create({
      expenseCode,
      title: dto.title.trim(),
      category: dto.category,
      costCenter: dto.costCenter,
      expenseDate,
      amount: CurrencyUtil.toInr(amountPaise),
      amountPaise,
      paidAmountPaise: 0,
      paidAmount: 0,
      paymentStatus: ExpensePaymentStatus.UNPAID,
      currency: 'INR',
      vendorId: linkedVendorId,
      vendorName: dto.vendorName.trim(),
      invoiceNumber: dto.invoiceNumber.trim(),
      gstinNumber: dto.gstinNumber ? dto.gstinNumber.trim().toUpperCase() : undefined,
      taxAmount: dto.taxAmount ? Math.round(dto.taxAmount * 100) / 100 : 0,
      description: dto.description ? dto.description.trim() : undefined,
      status: ExpenseStatus.DRAFT,
      creatorId: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
      creatorEmail: currentAdmin.email,
      creatorRole: currentAdmin.role,
      auditHistory: [auditEvent],
      isDeleted: false,
    });

    return expense;
  }

  /**
   * Checks for duplicate invoices registered for the given vendor.
   */
  async checkDuplicateInvoice(
    vendorName: string,
    invoiceNumber: string,
    excludeId?: string,
  ): Promise<{ isDuplicate: boolean; existingExpense?: any }> {
    if (!vendorName || !invoiceNumber) {
      return { isDuplicate: false };
    }

    const query: any = {
      vendorName: { $regex: new RegExp(`^${vendorName.trim()}$`, 'i') },
      invoiceNumber: { $regex: new RegExp(`^${invoiceNumber.trim()}$`, 'i') },
      isDeleted: false,
      status: { $ne: ExpenseStatus.CANCELLED },
    };

    if (excludeId && isValidObjectId(excludeId)) {
      query._id = { $ne: new Types.ObjectId(excludeId) };
    }

    const found = await this.expenseModel
      .findOne(query)
      .select('expenseCode title amount expenseDate status')
      .lean()
      .exec();

    return {
      isDuplicate: !!found,
      existingExpense: found || undefined,
    };
  }

  /**
   * Retrieves list of expenses with filters, search, and pagination.
   */
  async findAll(queryDto: QueryExpensesDto): Promise<{
    items: Expense[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(queryDto.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(queryDto.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = { isDeleted: false };

    if (queryDto.status && queryDto.status !== 'all') {
      filter.status = queryDto.status;
    }

    if (queryDto.paymentStatus && queryDto.paymentStatus !== 'all') {
      filter.paymentStatus = queryDto.paymentStatus;
    }

    if (queryDto.category && queryDto.category !== 'all') {
      filter.category = queryDto.category;
    }

    if (queryDto.costCenter && queryDto.costCenter !== 'all') {
      filter.costCenter = queryDto.costCenter;
    }

    if (queryDto.startDate || queryDto.endDate) {
      filter.expenseDate = {};
      if (queryDto.startDate) {
        filter.expenseDate.$gte = new Date(queryDto.startDate);
      }
      if (queryDto.endDate) {
        const end = new Date(queryDto.endDate);
        end.setHours(23, 59, 59, 999);
        filter.expenseDate.$lte = end;
      }
    }

    if (queryDto.search && queryDto.search.trim()) {
      const regex = new RegExp(queryDto.search.trim(), 'i');
      filter.$or = [
        { expenseCode: regex },
        { title: regex },
        { vendorName: regex },
        { invoiceNumber: regex },
        { description: regex },
      ];
    }

    const [items, total] = await Promise.all([
      this.expenseModel.find(filter).sort({ expenseDate: -1, createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.expenseModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Computes precise financial aggregates with zero double-counting.
   */
  async getSummary(startDate?: string, endDate?: string) {
    const matchFilter: any = { isDeleted: false };

    if (startDate || endDate) {
      matchFilter.expenseDate = {};
      if (startDate) matchFilter.expenseDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchFilter.expenseDate.$lte = end;
      }
    }

    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await this.expenseModel.aggregate(pipeline).exec();

    let approvedAmount = 0;
    let approvedCount = 0;
    let submittedAmount = 0;
    let submittedCount = 0;
    let rejectedAmount = 0;
    let rejectedCount = 0;
    let draftAmount = 0;
    let draftCount = 0;

    for (const r of results) {
      if (r._id === ExpenseStatus.APPROVED) {
        approvedAmount = r.totalAmount;
        approvedCount = r.count;
      } else if (r._id === ExpenseStatus.SUBMITTED) {
        submittedAmount = r.totalAmount;
        submittedCount = r.count;
      } else if (r._id === ExpenseStatus.REJECTED) {
        rejectedAmount = r.totalAmount;
        rejectedCount = r.count;
      } else if (r._id === ExpenseStatus.DRAFT) {
        draftAmount = r.totalAmount;
        draftCount = r.count;
      }
    }

    // Category distribution for APPROVED expenses
    const categoryPipeline = [
      { $match: { ...matchFilter, status: ExpenseStatus.APPROVED } },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ];

    const categoryResults = await this.expenseModel.aggregate(categoryPipeline).exec();
    const byCategory: Record<string, number> = {};
    for (const c of categoryResults) {
      byCategory[c._id] = Math.round(c.totalAmount * 100) / 100;
    }

    return {
      approvedAmount: Math.round(approvedAmount * 100) / 100,
      approvedCount,
      submittedAmount: Math.round(submittedAmount * 100) / 100,
      submittedCount,
      rejectedAmount: Math.round(rejectedAmount * 100) / 100,
      rejectedCount,
      draftAmount: Math.round(draftAmount * 100) / 100,
      draftCount,
      currency: 'INR',
      byCategory,
    };
  }

  /**
   * Retrieves single expense by ID.
   * If currentAdmin is provided and has role ADMIN, ensures the admin is the creator of the expense.
   */
  async findById(id: string, currentAdmin?: any): Promise<ExpenseDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid expense ID format.');
    }

    const expense = await this.expenseModel.findById(id).exec();
    if (!expense || expense.isDeleted) {
      throw new NotFoundException(`Expense with ID '${id}' was not found.`);
    }

    if (currentAdmin && currentAdmin.role === AdminRole.ADMIN) {
      const currentAdminId = (currentAdmin.id || currentAdmin._id).toString();
      const creatorId = expense.creatorId.toString();
      if (creatorId !== currentAdminId) {
        throw new ForbiddenException({
          message: 'Access denied: You are only authorized to view expense records created by your own account.',
          code: 'ACCESS_DENIED_NOT_CREATOR',
        });
      }
    }

    return expense;
  }

  /**
   * Updates an existing DRAFT or REJECTED expense.
   * Note: While editing a rejected expense, its status remains REJECTED until resubmitted.
   */
  async updateExpense(id: string, dto: UpdateExpenseDto, currentAdmin: any): Promise<Expense> {
    const expense = await this.findById(id);

    if (expense.status === ExpenseStatus.APPROVED) {
      throw new BadRequestException({
        message: 'Approved expenses are immutable and cannot be modified.',
        code: 'EXPENSE_ALREADY_APPROVED',
      });
    }

    if (expense.status === ExpenseStatus.SUBMITTED) {
      throw new BadRequestException({
        message: 'Expense is currently submitted for review. It cannot be edited until reviewed.',
        code: 'EXPENSE_IN_REVIEW',
      });
    }

    // Only creator or Super Admin can edit
    const isCreator = expense.creatorId.toString() === (currentAdmin.id || currentAdmin._id).toString();
    const isSuperAdmin = currentAdmin.role === 'SUPER_ADMIN';
    if (!isCreator && !isSuperAdmin) {
      throw new ForbiddenException('Only the expense creator or Super Admin can edit this expense.');
    }

    if (expense.paidAmountPaise && expense.paidAmountPaise > 0) {
      throw new BadRequestException({
        message: 'Cannot modify an expense with active disbursements.',
        code: 'CANNOT_ALTER_EXPENSE_WITH_ACTIVE_PAYMENTS',
      });
    }

    if (expense.isPaymentLocked) {
      throw new BadRequestException({
        message: 'This expense is locked for payment reconciliation.',
        code: 'EXPENSE_PAYMENT_LOCKED',
      });
    }

    if (dto.title !== undefined) expense.title = dto.title.trim();
    if (dto.category !== undefined) expense.category = dto.category;
    if (dto.costCenter !== undefined) expense.costCenter = dto.costCenter;
    if (dto.expenseDate !== undefined) expense.expenseDate = new Date(dto.expenseDate);
    if (dto.amount !== undefined) {
      const amountPaise = CurrencyUtil.toPaise(dto.amount);
      expense.amount = CurrencyUtil.toInr(amountPaise);
      expense.amountPaise = amountPaise;
    }
    if (dto.vendorId !== undefined) {
      if (!isValidObjectId(dto.vendorId)) {
        throw new BadRequestException('Invalid vendorId format.');
      }
      const vendor = await this.vendorModel.findById(dto.vendorId);
      if (!vendor || !vendor.isActive) {
        throw new BadRequestException('Selected vendor does not exist or is inactive.');
      }
      expense.vendorId = vendor._id;
      expense.vendorName = vendor.name;
    } else if (dto.vendorName !== undefined) {
      expense.vendorName = dto.vendorName.trim();
    }
    if (dto.invoiceNumber !== undefined) expense.invoiceNumber = dto.invoiceNumber.trim();
    if (dto.gstinNumber !== undefined) expense.gstinNumber = dto.gstinNumber.trim().toUpperCase() || undefined;
    if (dto.taxAmount !== undefined) expense.taxAmount = Math.round(dto.taxAmount * 100) / 100;
    if (dto.description !== undefined) expense.description = dto.description.trim() || undefined;

    expense.auditHistory.push({
      action: ExpenseAuditEventType.UPDATED,
      fromStatus: expense.status,
      toStatus: expense.status,
      performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
      performedByEmail: currentAdmin.email,
      performedByName: currentAdmin.fullName || 'Admin Staff',
      notes: dto.correctionNotes || 'Expense details updated.',
      timestamp: new Date(),
    } as any);

    return await expense.save();
  }

  /**
   * Uploads and attaches receipt document.
   */
  async uploadReceipt(
    id: string,
    file: Express.Multer.File,
    currentAdmin: any,
  ): Promise<Expense> {
    if (!file) {
      throw new BadRequestException('No receipt file uploaded.');
    }

    const expense = await this.findById(id);

    if (expense.status === ExpenseStatus.APPROVED) {
      throw new BadRequestException('Cannot modify receipt of an approved expense.');
    }

    if (expense.status === ExpenseStatus.SUBMITTED) {
      throw new BadRequestException('Cannot replace receipt while expense is under review.');
    }

    const fileId = `${new Types.ObjectId().toString()}`;
    const stored = await this.storageService.saveReceipt(file, fileId);

    // If an existing receipt existed, clean up its file
    if (expense.receipt?.fileId) {
      await this.storageService.deleteReceipt(expense.receipt.fileId).catch(() => null);
    }

    expense.receipt = {
      fileId: stored.fileId,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      uploadedAt: new Date(),
      uploadedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
    };

    expense.auditHistory.push({
      action: ExpenseAuditEventType.RECEIPT_UPLOADED,
      fromStatus: expense.status,
      toStatus: expense.status,
      performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
      performedByEmail: currentAdmin.email,
      performedByName: currentAdmin.fullName || 'Admin Staff',
      notes: `Receipt uploaded: ${stored.originalName} (${(stored.sizeBytes / 1024).toFixed(1)} KB)`,
      timestamp: new Date(),
    } as any);

    return await expense.save();
  }

  /**
   * Removes receipt document from a DRAFT or REJECTED expense.
   */
  async removeReceipt(id: string, currentAdmin: any): Promise<Expense> {
    const expense = await this.findById(id);

    if (expense.status === ExpenseStatus.APPROVED || expense.status === ExpenseStatus.SUBMITTED) {
      throw new BadRequestException('Cannot delete receipt for submitted or approved expenses.');
    }

    if (!expense.receipt?.fileId) {
      throw new BadRequestException('Expense has no receipt attached.');
    }

    await this.storageService.deleteReceipt(expense.receipt.fileId).catch(() => null);

    const oldName = expense.receipt.originalName;
    expense.receipt = undefined;

    expense.auditHistory.push({
      action: ExpenseAuditEventType.RECEIPT_REMOVED,
      fromStatus: expense.status,
      toStatus: expense.status,
      performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
      performedByEmail: currentAdmin.email,
      performedByName: currentAdmin.fullName || 'Admin Staff',
      notes: `Receipt removed: ${oldName}`,
      timestamp: new Date(),
    } as any);

    return await expense.save();
  }

  /**
   * Streams the attached receipt document securely.
   */
  async getReceiptStream(id: string, currentAdmin?: any) {
    const expense = await this.findById(id, currentAdmin);

    if (!expense.receipt || !expense.receipt.fileId) {
      throw new NotFoundException('Expense has no receipt document attached.');
    }

    const { stream, exists } = this.storageService.getReceiptStream(expense.receipt.fileId);
    if (!exists || !stream) {
      throw new NotFoundException('Receipt file could not be located in secure storage.');
    }

    return {
      stream,
      originalName: expense.receipt.originalName,
      mimeType: expense.receipt.mimeType,
      sizeBytes: expense.receipt.sizeBytes,
    };
  }

  /**
   * Submits a DRAFT expense for review.
   * Enforces mandatory receipt attachment and core invoice details.
   */
  async submitExpense(id: string, dto: SubmitExpenseDto, currentAdmin: any): Promise<Expense> {
    const expense = await this.findById(id);

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException({
        message: `Only DRAFT expenses can be submitted. Current status: ${expense.status}`,
        code: 'INVALID_STATUS_FOR_SUBMISSION',
      });
    }

    if ((!expense.receipt || !expense.receipt.fileId) && !expense.acquisitionId) {
      throw new BadRequestException({
        message: 'A digital bill or receipt attachment is mandatory before submitting for approval.',
        code: 'RECEIPT_REQUIRED',
      });
    }

    if (!expense.vendorName || !expense.invoiceNumber || !expense.amount || expense.amount <= 0) {
      throw new BadRequestException({
        message: 'Vendor name, invoice number, and positive amount are required before submission.',
        code: 'INCOMPLETE_EXPENSE_DETAILS',
      });
    }

    const isSuperAdmin = currentAdmin.role === AdminRole.SUPER_ADMIN;
    // Acquisition-linked expenses must always go through explicit approval (segregation of duties)
    const autoApprove = isSuperAdmin && !expense.acquisitionId;

    if (autoApprove) {
      expense.status = ExpenseStatus.APPROVED;
      expense.submittedAt = new Date();
      expense.reviewedBy = new Types.ObjectId(currentAdmin.id || currentAdmin._id);
      expense.reviewedByEmail = currentAdmin.email;
      expense.reviewedAt = new Date();
      if (dto.submissionRemarks?.trim()) {
        expense.approvalRemarks = dto.submissionRemarks.trim();
      }

      expense.auditHistory.push({
        action: ExpenseAuditEventType.APPROVED,
        fromStatus: ExpenseStatus.DRAFT,
        toStatus: ExpenseStatus.APPROVED,
        performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
        performedByEmail: currentAdmin.email,
        performedByName: currentAdmin.fullName || 'Super Admin',
        notes: dto.submissionRemarks
          ? `Directly approved by Super Admin on creation: ${dto.submissionRemarks.trim()}`
          : 'Directly approved by Super Admin on creation.',
        timestamp: new Date(),
      } as any);
    } else {
      expense.status = ExpenseStatus.SUBMITTED;
      expense.submittedAt = new Date();

      expense.auditHistory.push({
        action: ExpenseAuditEventType.SUBMITTED,
        fromStatus: ExpenseStatus.DRAFT,
        toStatus: ExpenseStatus.SUBMITTED,
        performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
        performedByEmail: currentAdmin.email,
        performedByName: currentAdmin.fullName || 'Admin Staff',
        notes: dto.submissionRemarks || 'Expense submitted for Super Admin review.',
        timestamp: new Date(),
      } as any);
    }

    return await expense.save();
  }

  /**
   * Resubmits a REJECTED expense after operator corrections.
   * Requires non-empty submissionRemarks explaining the correction.
   */
  async resubmitExpense(id: string, dto: ResubmitExpenseDto, currentAdmin: any): Promise<Expense> {
    const expense = await this.findById(id);

    if (expense.status !== ExpenseStatus.REJECTED) {
      throw new BadRequestException({
        message: `Only REJECTED expenses can be resubmitted. Current status: ${expense.status}`,
        code: 'INVALID_STATUS_FOR_RESUBMISSION',
      });
    }

    if (!expense.receipt || !expense.receipt.fileId) {
      throw new BadRequestException({
        message: 'A digital bill or receipt attachment is mandatory before resubmission.',
        code: 'RECEIPT_REQUIRED',
      });
    }

    const isSuperAdmin = currentAdmin.role === AdminRole.SUPER_ADMIN;

    if (isSuperAdmin) {
      expense.status = ExpenseStatus.APPROVED;
      expense.submittedAt = new Date();
      expense.reviewedBy = new Types.ObjectId(currentAdmin.id || currentAdmin._id);
      expense.reviewedByEmail = currentAdmin.email;
      expense.reviewedAt = new Date();
      expense.approvalRemarks = `Directly approved by Super Admin upon revision: ${dto.submissionRemarks.trim()}`;

      expense.auditHistory.push({
        action: ExpenseAuditEventType.APPROVED,
        fromStatus: ExpenseStatus.REJECTED,
        toStatus: ExpenseStatus.APPROVED,
        performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
        performedByEmail: currentAdmin.email,
        performedByName: currentAdmin.fullName || 'Super Admin',
        notes: `Directly approved by Super Admin upon revision: ${dto.submissionRemarks.trim()}`,
        timestamp: new Date(),
      } as any);
    } else {
      expense.status = ExpenseStatus.SUBMITTED;
      expense.submittedAt = new Date();

      expense.auditHistory.push({
        action: ExpenseAuditEventType.RESUBMITTED,
        fromStatus: ExpenseStatus.REJECTED,
        toStatus: ExpenseStatus.SUBMITTED,
        performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
        performedByEmail: currentAdmin.email,
        performedByName: currentAdmin.fullName || 'Admin Staff',
        notes: `Resubmitted with corrections: ${dto.submissionRemarks.trim()}`,
        timestamp: new Date(),
      } as any);
    }

    return await expense.save();
  }

  /**
   * Approves a SUBMITTED expense.
   * Enforces strict segregation of duties (self-approval prohibited).
   */
  async approveExpense(id: string, dto: ApproveExpenseDto, currentAdmin: any): Promise<Expense> {
    const expense = await this.findById(id);

    if (expense.status !== ExpenseStatus.SUBMITTED) {
      throw new BadRequestException({
        message: `Only SUBMITTED expenses can be approved. Current status: ${expense.status}`,
        code: 'INVALID_STATUS_FOR_APPROVAL',
      });
    }

    const currentAdminId = (currentAdmin.id || currentAdmin._id).toString();
    const creatorId = expense.creatorId.toString();

    // Segregation of duties: Creator cannot approve their own expense
    if (creatorId === currentAdminId) {
      throw new ForbiddenException({
        message: 'Segregation of duties violation: You cannot approve an expense that you personally created or submitted.',
        code: 'SELF_APPROVAL_PROHIBITED',
      });
    }

    expense.status = ExpenseStatus.APPROVED;
    expense.reviewedBy = new Types.ObjectId(currentAdminId);
    expense.reviewedByEmail = currentAdmin.email;
    expense.reviewedAt = new Date();
    if (dto.approvalRemarks?.trim()) {
      expense.approvalRemarks = dto.approvalRemarks.trim();
    }

    expense.auditHistory.push({
      action: ExpenseAuditEventType.APPROVED,
      fromStatus: ExpenseStatus.SUBMITTED,
      toStatus: ExpenseStatus.APPROVED,
      performedBy: new Types.ObjectId(currentAdminId),
      performedByEmail: currentAdmin.email,
      performedByName: currentAdmin.fullName || 'Super Admin',
      notes: dto.approvalRemarks ? `Approved: ${dto.approvalRemarks.trim()}` : 'Expense approved.',
      timestamp: new Date(),
    } as any);

    return await expense.save();
  }

  /**
   * Rejects a SUBMITTED expense with a mandatory rejection reason.
   * Enforces strict segregation of duties (creator cannot reject their own expense).
   */
  async rejectExpense(id: string, dto: RejectExpenseDto, currentAdmin: any): Promise<Expense> {
    const expense = await this.findById(id);

    if (expense.status !== ExpenseStatus.SUBMITTED) {
      throw new BadRequestException({
        message: `Only SUBMITTED expenses can be rejected. Current status: ${expense.status}`,
        code: 'INVALID_STATUS_FOR_REJECTION',
      });
    }

    const currentAdminId = (currentAdmin.id || currentAdmin._id).toString();
    const creatorId = expense.creatorId.toString();

    // Segregation of duties: Creator cannot review/reject their own expense
    if (creatorId === currentAdminId) {
      throw new ForbiddenException({
        message: 'Segregation of duties violation: You cannot reject an expense that you personally created or submitted.',
        code: 'SELF_REVIEW_PROHIBITED',
      });
    }

    if (!dto.rejectionReason || !dto.rejectionReason.trim()) {
      throw new BadRequestException({
        message: 'A mandatory rejection reason is required when rejecting an expense.',
        code: 'REJECTION_REASON_REQUIRED',
      });
    }

    expense.status = ExpenseStatus.REJECTED;
    expense.reviewedBy = new Types.ObjectId(currentAdminId);
    expense.reviewedByEmail = currentAdmin.email;
    expense.reviewedAt = new Date();
    expense.rejectionReason = dto.rejectionReason.trim();

    expense.auditHistory.push({
      action: ExpenseAuditEventType.REJECTED,
      fromStatus: ExpenseStatus.SUBMITTED,
      toStatus: ExpenseStatus.REJECTED,
      performedBy: new Types.ObjectId(currentAdminId),
      performedByEmail: currentAdmin.email,
      performedByName: currentAdmin.fullName || 'Super Admin',
      notes: `Rejected: ${dto.rejectionReason.trim()}`,
      timestamp: new Date(),
    } as any);

    return await expense.save();
  }

  /**
   * Soft-deletes a DRAFT expense, preserving audit accountability.
   */
  async deleteExpense(id: string, currentAdmin: any): Promise<{ success: boolean; message: string }> {
    const expense = await this.findById(id);

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException({
        message: `Only DRAFT expenses can be deleted. Current status: ${expense.status}`,
        code: 'CANNOT_DELETE_NON_DRAFT',
      });
    }

    const currentAdminId = (currentAdmin.id || currentAdmin._id).toString();
    const creatorId = expense.creatorId.toString();
    const isSuperAdmin = currentAdmin.role === 'SUPER_ADMIN';

    if (creatorId !== currentAdminId && !isSuperAdmin) {
      throw new ForbiddenException('Only the expense creator or Super Admin can delete this draft.');
    }

    expense.isDeleted = true;
    expense.status = ExpenseStatus.CANCELLED;

    expense.auditHistory.push({
      action: ExpenseAuditEventType.CANCELLED,
      fromStatus: ExpenseStatus.DRAFT,
      toStatus: ExpenseStatus.CANCELLED,
      performedBy: new Types.ObjectId(currentAdminId),
      performedByEmail: currentAdmin.email,
      performedByName: currentAdmin.fullName || 'Admin Staff',
      notes: 'Draft expense cancelled by user.',
      timestamp: new Date(),
    } as any);

    await expense.save();

    // If a draft receipt file was stored, clean it up
    if (expense.receipt?.fileId) {
      await this.storageService.deleteReceipt(expense.receipt.fileId).catch(() => null);
    }

    return {
      success: true,
      message: `Draft expense '${expense.expenseCode}' has been cancelled successfully.`,
    };
  }

  /**
   * Explicitly links a historical or unlinked expense to a registered Vendor (Super Admin only).
   * Preserves historical vendorName string and records an immutable audit log.
   */
  async linkVendor(id: string, vendorId: string, currentAdmin: any): Promise<Expense> {
    if (!isValidObjectId(id) || !isValidObjectId(vendorId)) {
      throw new BadRequestException('Invalid ID format for expense or vendor.');
    }

    const expense = await this.findById(id);

    if (expense.isDeleted || expense.status === ExpenseStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'Cannot link a vendor to a cancelled or deleted expense.',
        code: 'EXPENSE_CANCELLED_OR_DELETED',
      });
    }

    if (expense.paidAmountPaise && expense.paidAmountPaise > 0) {
      throw new BadRequestException({
        message: 'Cannot re-link vendor for an expense that already has recorded disbursements.',
        code: 'CANNOT_ALTER_EXPENSE_WITH_ACTIVE_PAYMENTS',
      });
    }

    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor || !vendor.isActive) {
      throw new BadRequestException({
        message: 'Target vendor does not exist or is inactive.',
        code: 'VENDOR_INACTIVE_OR_NOT_FOUND',
      });
    }

    const oldVendorName = expense.vendorName;
    expense.vendorId = vendor._id;

    expense.auditHistory.push({
      action: ExpenseAuditEventType.VENDOR_LINKED,
      fromStatus: expense.status,
      toStatus: expense.status,
      performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
      performedByName: currentAdmin.fullName || 'Super Admin',
      performedByEmail: currentAdmin.email,
      notes: `Linked to registered vendor "${vendor.name}" (${vendor._id}). Historical vendor string "${oldVendorName}" preserved.`,
      timestamp: new Date(),
    } as any);

    return await expense.save();
  }
}
