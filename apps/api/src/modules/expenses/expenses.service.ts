import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Expense, ExpenseDocument } from './schemas/expense.schema';
import {
  ExpenseStatus,
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

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    private readonly storageService: StorageService,
  ) {}

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

    const expense = await this.expenseModel.create({
      expenseCode,
      title: dto.title.trim(),
      category: dto.category,
      costCenter: dto.costCenter,
      expenseDate,
      amount: Math.round(dto.amount * 100) / 100,
      currency: 'INR',
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
   */
  async findById(id: string): Promise<ExpenseDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid expense ID format.');
    }

    const expense = await this.expenseModel.findById(id).exec();
    if (!expense || expense.isDeleted) {
      throw new NotFoundException(`Expense with ID '${id}' was not found.`);
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

    if (dto.title !== undefined) expense.title = dto.title.trim();
    if (dto.category !== undefined) expense.category = dto.category;
    if (dto.costCenter !== undefined) expense.costCenter = dto.costCenter;
    if (dto.expenseDate !== undefined) expense.expenseDate = new Date(dto.expenseDate);
    if (dto.amount !== undefined) expense.amount = Math.round(dto.amount * 100) / 100;
    if (dto.vendorName !== undefined) expense.vendorName = dto.vendorName.trim();
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
  async getReceiptStream(id: string) {
    const expense = await this.findById(id);

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

    if (!expense.receipt || !expense.receipt.fileId) {
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
}
