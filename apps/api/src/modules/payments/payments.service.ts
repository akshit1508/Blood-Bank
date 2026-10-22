import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, isValidObjectId } from 'mongoose';
import * as crypto from 'crypto';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import { CreatePaymentDto, CancelPaymentDto, QueryPaymentsDto } from './dto/payment.dto';
import { PaymentStatus } from './constants/payment.constants';
import { ExpenseStatus, ExpenseAuditEventType, ExpensePaymentStatus } from '../expenses/constants/expense.constants';
import { CurrencyUtil } from '../../common/utils/currency.util';

import {
  BloodAcquisition,
  BloodAcquisitionDocument,
} from '../blood-acquisitions/schemas/blood-acquisition.schema';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AuditActionType,
  AuditEntityType,
} from '../audit-logs/constants/audit-log.constants';

@Injectable()
export class PaymentsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(BloodAcquisition.name)
    private readonly bloodAcquisitionModel: Model<BloodAcquisitionDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    @Optional()
    private readonly auditLogsService?: AuditLogsService,
  ) {}

  /**
   * Preflight verification: Ensure unique index on payments.idempotencyKey exists.
   */
  async onApplicationBootstrap() {
    try {
      await this.paymentModel.collection.createIndex(
        { idempotencyKey: 1 },
        { unique: true, background: true },
      );
      const indexes = await this.paymentModel.collection.indexes();
      const hasUnique = indexes.some(
        (idx) => idx.key?.idempotencyKey === 1 && idx.unique === true,
      );
      if (!hasUnique) {
        this.logger.error(
          'CRITICAL: Unique index on "payments.idempotencyKey" is not present.',
        );
      } else {
        this.logger.log('Preflight verified: Unique index on "payments.idempotencyKey" is active.');
      }
    } catch (err: any) {
      this.logger.warn(`Could not verify or create idempotencyKey index: ${err.message}`);
    }
  }

  /**
   * Generates a deterministic SHA-256 canonical hash across all material financial fields.
   */
  computeCanonicalPayloadHash(data: {
    expenseId: string;
    vendorId?: string;
    amountPaise: number;
    paymentMethod: string;
    paymentDate: string; // YYYY-MM-DD
    referenceNumber: string;
    notes?: string;
  }): string {
    const canonical = {
      amountPaise: data.amountPaise,
      expenseId: data.expenseId.toString(),
      notes: (data.notes || '').trim(),
      paymentDate: data.paymentDate.trim(),
      paymentMethod: data.paymentMethod.trim().toUpperCase(),
      referenceNumber: data.referenceNumber.trim(),
      vendorId: (data.vendorId || '').toString(),
    };
    return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  /**
   * Records a payment against an approved expense with atomic concurrency control and persistent idempotency.
   */
  async recordPayment(dto: CreatePaymentDto, currentAdmin: any): Promise<Payment> {
    if (!isValidObjectId(dto.expenseId)) {
      throw new BadRequestException('Invalid expense ID format.');
    }

    const paymentPaise = CurrencyUtil.toPaise(dto.amount);
    const derivedInrAmount = CurrencyUtil.toInr(paymentPaise);

    // 1. Fetch & Validate Expense
    const expense = await this.expenseModel.findById(dto.expenseId);
    if (!expense || expense.isDeleted) {
      throw new NotFoundException(`Expense with ID '${dto.expenseId}' not found.`);
    }

    if (expense.status !== ExpenseStatus.APPROVED && expense.status !== ExpenseStatus.SUBMITTED) {
      throw new BadRequestException({
        message: `Payments can only be recorded against APPROVED or SUBMITTED expenses. Current status: ${expense.status}`,
        code: 'EXPENSE_NOT_PAYABLE',
      });
    }

    if (dto.vendorId && expense.vendorId && String(dto.vendorId) !== String(expense.vendorId)) {
      throw new BadRequestException({
        message: 'Submitted vendor ID does not match the expense vendor ID.',
        code: 'VENDOR_MISMATCH',
      });
    }

    // 2. Compute Canonical Fingerprint
    const payloadHash = this.computeCanonicalPayloadHash({
      expenseId: expense._id.toString(),
      vendorId: expense.vendorId ? expense.vendorId.toString() : '',
      amountPaise: paymentPaise,
      paymentMethod: dto.paymentMethod,
      paymentDate: dto.paymentDate,
      referenceNumber: dto.referenceNumber,
      notes: dto.notes,
    });

    // 4. Compute Effective Net Liability (accounting for approved credit notes)
    let effectiveNetLiabilityPaise =
      expense.amountPaise || (expense.amount != null ? CurrencyUtil.toPaise(expense.amount) : 0);
    if (expense.acquisitionId) {
      const acquisition = await this.bloodAcquisitionModel.findById(expense.acquisitionId).exec();
      if (acquisition && acquisition.adjustments && acquisition.adjustments.length > 0) {
        const totalCredits = acquisition.adjustments
          .filter((adj) => adj.adjustmentType !== 'SUPPLIER_REFUND')
          .reduce((sum, adj) => sum + (adj.creditAmountPaise || adj.amountPaise || 0), 0);
        effectiveNetLiabilityPaise = Math.max(0, effectiveNetLiabilityPaise - totalCredits);
      }
    }

    if ((expense.paidAmountPaise || 0) + paymentPaise > effectiveNetLiabilityPaise) {
      const remainingPaise = Math.max(0, effectiveNetLiabilityPaise - (expense.paidAmountPaise || 0));
      throw new BadRequestException({
        statusCode: 400,
        error: 'INSUFFICIENT_OUTSTANDING_BALANCE',
        message: `Disbursement exceeds effective net payable balance of ₹${CurrencyUtil.toInr(remainingPaise).toFixed(2)} (accounting for approved credit memos).`,
      });
    }

    // 5. Pre-check Persistent Idempotency Key
    const existingPayment = await this.paymentModel.findOne({ idempotencyKey: dto.idempotencyKey });
    if (existingPayment) {
      if (existingPayment.requestPayloadHash === payloadHash) {
        return existingPayment; // Idempotent success replay
      }
      throw new ConflictException({
        statusCode: 409,
        error: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
        message: 'The idempotency key was previously used with different payment parameters.',
      });
    }

    // 6. Execute Atomic Database Mutation with Bounded Retries
    const maxRetries = 3;
    let attempt = 0;

    const reviewerId = currentAdmin?.id
      ? new Types.ObjectId(currentAdmin.id)
      : currentAdmin?._id
      ? new Types.ObjectId(currentAdmin._id)
      : expense.reviewedBy || null;

    while (attempt < maxRetries) {
      attempt++;
      const session = await this.connection.startSession();
      try {
        let createdPayment: any = null;

        await session.withTransaction(async () => {
          // Atomic conditional balance update on Expense using effectiveNetLiabilityPaise
          const updatedExpense = await this.expenseModel.findOneAndUpdate(
            {
              _id: expense._id,
              status: { $in: [ExpenseStatus.APPROVED, ExpenseStatus.SUBMITTED] },
              // Invariant guard: Paid paise + payment paise <= effective net liability
              $expr: {
                $lte: [{ $add: ['$paidAmountPaise', paymentPaise] }, effectiveNetLiabilityPaise],
              },
            },
            [
              {
                $set: {
                  paidAmountPaise: { $add: ['$paidAmountPaise', paymentPaise] },
                  status: ExpenseStatus.APPROVED,
                  reviewedBy: reviewerId,
                  reviewedAt: expense.reviewedAt || new Date(),
                },
              },
              {
                $set: {
                  paidAmount: { $divide: ['$paidAmountPaise', 100] },
                  paymentStatus: {
                    $cond: {
                      if: { $gte: ['$paidAmountPaise', effectiveNetLiabilityPaise] },
                      then: ExpensePaymentStatus.PAID,
                      else: ExpensePaymentStatus.PARTIALLY_PAID,
                    },
                  },
                },
              },
            ],
            { session, new: true }
          );

          if (!updatedExpense) {
            throw new ConflictException(
              'Payment rejected: Remaining expense balance is insufficient or an atomic write conflict occurred.'
            );
          }

          // Insert Payment document with derived amount
          const [paymentDoc] = await this.paymentModel.create(
            [
              {
                expenseId: expense._id,
                vendorId: expense.vendorId || undefined,
                vendorName: expense.vendorName,
                amountPaise: paymentPaise,
                amount: derivedInrAmount,
                paymentMethod: dto.paymentMethod,
                referenceNumber: dto.referenceNumber.trim(),
                paymentDate: new Date(`${dto.paymentDate}T00:00:00.000Z`),
                notes: dto.notes ? dto.notes.trim() : '',
                status: PaymentStatus.COMPLETED,
                idempotencyKey: dto.idempotencyKey,
                requestPayloadHash: payloadHash,
                createdBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
                createdByName: currentAdmin.fullName || 'Super Admin',
                createdByRole: currentAdmin.role || 'SUPER_ADMIN',
              },
            ],
            { session }
          );

          // Append Audit Trail to Expense
          const fromStatus = expense.status;
          const auditNotes =
            fromStatus === ExpenseStatus.SUBMITTED
              ? `Disbursement of ₹${derivedInrAmount.toFixed(2)} recorded with Super Admin approval via ${dto.paymentMethod} (Ref: ${dto.referenceNumber.trim()}). Payment ID: ${paymentDoc._id}`
              : `Disbursement of ₹${derivedInrAmount.toFixed(2)} recorded via ${dto.paymentMethod} (Ref: ${dto.referenceNumber.trim()}). Payment ID: ${paymentDoc._id}`;

          await this.expenseModel.updateOne(
            { _id: expense._id },
            {
              $push: {
                auditHistory: {
                  action: ExpenseAuditEventType.DISBURSEMENT_RECORDED,
                  fromStatus,
                  toStatus: ExpenseStatus.APPROVED,
                  performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
                  performedByName: currentAdmin.fullName || 'Super Admin',
                  performedByEmail: currentAdmin.email,
                  timestamp: new Date(),
                  notes: auditNotes,
                },
              },
            },
            { session }
          );

          createdPayment = paymentDoc;
        });

        await session.endSession();

        if (this.auditLogsService && createdPayment) {
          await this.auditLogsService.logEvent({
            actorId: currentAdmin.id || currentAdmin._id,
            actorName: currentAdmin.fullName || 'Super Admin',
            actorEmail: currentAdmin.email,
            actorRole: currentAdmin.role || 'SUPER_ADMIN',
            action: AuditActionType.DISBURSEMENT_RECORDED,
            entityType: AuditEntityType.PAYMENT,
            entityId: createdPayment._id.toString(),
            entityIdentifier: dto.referenceNumber.trim(),
            description: `Payment disbursement of ₹${derivedInrAmount.toFixed(2)} recorded for expense ${expense.expenseCode} (${expense.vendorName})`,
            afterState: {
              amountPaise: paymentPaise,
              amount: derivedInrAmount,
              paymentMethod: dto.paymentMethod,
              referenceNumber: dto.referenceNumber.trim(),
              status: PaymentStatus.COMPLETED,
            },
            metadata: { expenseCode: expense.expenseCode, vendorName: expense.vendorName },
          });
        }

        return createdPayment!;
      } catch (error: any) {
        await session.endSession();

        // Handle MongoDB E11000 Duplicate Key Error (Concurrent Race with Same Key)
        if (
          error.code === 11000 &&
          (error.keyPattern?.idempotencyKey || error.message?.includes('idempotencyKey'))
        ) {
          const racedPayment = await this.paymentModel.findOne({ idempotencyKey: dto.idempotencyKey });
          if (racedPayment) {
            if (racedPayment.requestPayloadHash === payloadHash) {
              return racedPayment; // Idempotent return of winner
            }
            throw new ConflictException({
              statusCode: 409,
              error: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
              message: 'The idempotency key was previously used with different payment parameters.',
            });
          }
        }

        // Reconcile UnknownTransactionCommitResult
        if (error.hasErrorLabel && error.hasErrorLabel('UnknownTransactionCommitResult')) {
          const committedPayment = await this.paymentModel.findOne({ idempotencyKey: dto.idempotencyKey });
          if (committedPayment) {
            if (committedPayment.requestPayloadHash === payloadHash) {
              return committedPayment;
            }
            throw new ConflictException({
              statusCode: 409,
              error: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
              message: 'Uncertain commit detected with conflicting idempotency record.',
            });
          }
        }

        // Allow retry only on TransientTransactionError within bounded ceiling
        if (
          error.hasErrorLabel &&
          error.hasErrorLabel('TransientTransactionError') &&
          attempt < maxRetries
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new InternalServerErrorException('Transaction failed after maximum bounded retry attempts.');
  }

  /**
   * Atomically cancels a COMPLETED payment and rolls back the expense balance.
   */
  async cancelPayment(paymentId: string, dto: CancelPaymentDto, currentAdmin: any): Promise<Payment> {
    if (!isValidObjectId(paymentId)) {
      throw new BadRequestException('Invalid payment ID format.');
    }

    const session = await this.connection.startSession();
    try {
      let cancelledResult: Payment | null = null;

      await session.withTransaction(async () => {
        // 1. Atomic conditional lock: Must be COMPLETED
        const cancelledPayment = await this.paymentModel.findOneAndUpdate(
          {
            _id: new Types.ObjectId(paymentId),
            status: PaymentStatus.COMPLETED,
          },
          {
            $set: {
              status: PaymentStatus.CANCELLED,
              cancelledAt: new Date(),
              cancelledBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
              cancelledByName: currentAdmin.fullName || currentAdmin.email || 'Super Admin',
              cancelledByRole: currentAdmin.role || 'SUPER_ADMIN',
              cancellationReason: dto.reason.trim(),
            },
          },
          { session, new: true }
        );

        if (!cancelledPayment) {
          throw new ConflictException(
            'Cancellation rejected: Payment does not exist, is already cancelled, or is undergoing concurrent cancellation.'
          );
        }

        // 2. Atomic conditional decrement on Expense balance
        const updatedExpense = await this.expenseModel.findOneAndUpdate(
          {
            _id: cancelledPayment.expenseId,
            // Invariant guard: Paid balance must be >= payment being reversed
            $expr: {
              $gte: ['$paidAmountPaise', cancelledPayment.amountPaise],
            },
          },
          [
            {
              $set: {
                paidAmountPaise: { $subtract: ['$paidAmountPaise', cancelledPayment.amountPaise] },
              },
            },
            {
              $set: {
                paidAmount: { $divide: ['$paidAmountPaise', 100] },
                paymentStatus: {
                  $cond: {
                    if: { $eq: ['$paidAmountPaise', 0] },
                    then: ExpensePaymentStatus.UNPAID,
                    else: ExpensePaymentStatus.PARTIALLY_PAID,
                  },
                },
              },
            },
          ],
          { session, new: true }
        );

        if (!updatedExpense) {
          throw new InternalServerErrorException(
            'Ledger Invariant Fault: Expense paid balance cannot accommodate payment reversal.'
          );
        }

        // 3. Append Audit Trail to Expense
        await this.expenseModel.updateOne(
          { _id: cancelledPayment.expenseId },
          {
            $push: {
              auditHistory: {
                action: ExpenseAuditEventType.DISBURSEMENT_CANCELLED,
                performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
                performedByName: currentAdmin.fullName || 'Super Admin',
                performedByEmail: currentAdmin.email,
                timestamp: new Date(),
                notes: `Disbursement ${cancelledPayment._id} of ₹${cancelledPayment.amount.toFixed(2)} CANCELLED. Reason: ${dto.reason.trim()}`,
              },
            },
          },
          { session }
        );

        cancelledResult = cancelledPayment;
      });

      await session.endSession();

      if (this.auditLogsService && cancelledResult) {
        await this.auditLogsService.logEvent({
          actorId: currentAdmin.id || currentAdmin._id,
          actorName: currentAdmin.fullName || currentAdmin.email || 'Super Admin',
          actorEmail: currentAdmin.email,
          actorRole: currentAdmin.role || 'SUPER_ADMIN',
          action: AuditActionType.DISBURSEMENT_CANCELLED,
          entityType: AuditEntityType.PAYMENT,
          entityId: (cancelledResult as any)._id?.toString() || paymentId,
          entityIdentifier: (cancelledResult as any).referenceNumber || paymentId,
          description: `Disbursement of ₹${(cancelledResult as any).amount?.toFixed(2)} cancelled: ${dto.reason.trim()}`,
          beforeState: { status: PaymentStatus.COMPLETED },
          afterState: { status: PaymentStatus.CANCELLED, cancellationReason: dto.reason.trim() },
          metadata: { reason: dto.reason.trim() },
        });
      }

      return cancelledResult!;
    } catch (error) {
      await session.endSession();
      throw error;
    }
  }

  /**
   * Lists payments with pagination and filters (Super Admin only).
   */
  async findAll(query: QueryPaymentsDto): Promise<any> {
    const filter: any = {};

    if (query.vendorId && isValidObjectId(query.vendorId)) {
      filter.vendorId = new Types.ObjectId(query.vendorId);
    }

    if (query.expenseId && isValidObjectId(query.expenseId)) {
      filter.expenseId = new Types.ObjectId(query.expenseId);
    }

    if (query.paymentMethod) {
      filter.paymentMethod = query.paymentMethod;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.startDate || query.endDate) {
      filter.paymentDate = {};
      if (query.startDate) {
        filter.paymentDate.$gte = new Date(`${query.startDate}T00:00:00.000Z`);
      }
      if (query.endDate) {
        filter.paymentDate.$lte = new Date(`${query.endDate}T23:59:59.999Z`);
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .populate('expenseId', 'expenseCode title status reviewedByName reviewedByRole reviewedAt creatorName creatorRole')
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.paymentModel.countDocuments(filter).exec(),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves single payment by ID with linked expense details.
   */
  async findById(id: string): Promise<any> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid payment ID format.');
    }

    const payment = await this.paymentModel.findById(id).lean().exec();
    if (!payment) {
      throw new NotFoundException(`Payment with ID '${id}' was not found.`);
    }

    const expense = await this.expenseModel
      .findById(payment.expenseId)
      .select('expenseCode title amount amountPaise paidAmount paidAmountPaise paymentStatus invoiceNumber expenseDate status reviewedByName reviewedByRole reviewedAt approvalRemarks creatorName creatorRole submittedByName submittedByRole submittedAt')
      .lean()
      .exec();

    return {
      ...payment,
      expense,
    };
  }

  /**
   * Aggregates all approved expenses with unpaid balances ($B > 0), grouped by vendor.
   */
  async getOutstandingDues(): Promise<any> {
    const expenses = await this.expenseModel
      .find({
        status: { $in: [ExpenseStatus.APPROVED, ExpenseStatus.SUBMITTED] },
        isDeleted: false,
        paymentStatus: { $ne: ExpensePaymentStatus.PAID },
      })
      .sort({ expenseDate: 1 })
      .lean()
      .exec();

    // Group by vendor
    const vendorMap = new Map<string, {
      vendorId: string | null;
      vendorName: string;
      isLinked: boolean;
      totalInvoicedPaise: number;
      totalPaidPaise: number;
      outstandingPaise: number;
      expenseCount: number;
      expenses: any[];
    }>();

    let grandTotalInvoicedPaise = 0;
    let grandTotalPaidPaise = 0;
    let grandTotalOutstandingPaise = 0;

    for (const exp of expenses) {
      let expTotalPaise = exp.amountPaise || (exp.amount != null ? CurrencyUtil.toPaise(exp.amount) : 0);
      if (exp.acquisitionId) {
        const acquisition = await this.bloodAcquisitionModel.findById(exp.acquisitionId).lean().exec();
        if (acquisition && acquisition.adjustments && acquisition.adjustments.length > 0) {
          const totalCredits = acquisition.adjustments
            .filter((adj: any) => adj.adjustmentType !== 'SUPPLIER_REFUND')
            .reduce((sum: number, adj: any) => sum + (adj.creditAmountPaise || adj.amountPaise || 0), 0);
          expTotalPaise = Math.max(0, expTotalPaise - totalCredits);
        }
      }
      const expPaidPaise = exp.paidAmountPaise || (exp.paidAmount != null ? CurrencyUtil.toPaise(exp.paidAmount) : 0);
      const expDuePaise = Math.max(0, expTotalPaise - expPaidPaise);
      if (expDuePaise === 0 && expPaidPaise >= expTotalPaise && expTotalPaise > 0) {
        continue;
      }

      const expDate = exp.expenseDate ? new Date(exp.expenseDate) : null;
      let ageDays = 0;
      let agingBucket = '0-30 Days';

      if (expDate && !isNaN(expDate.getTime())) {
        const now = new Date();
        const diffMs = Math.max(0, now.getTime() - expDate.getTime());
        ageDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (ageDays <= 30) {
          agingBucket = '0-30 Days';
        } else if (ageDays <= 60) {
          agingBucket = '31-60 Days';
        } else if (ageDays <= 90) {
          agingBucket = '61-90 Days';
        } else {
          agingBucket = '90+ Days';
        }
      } else {
        agingBucket = 'Unknown';
      }

      grandTotalInvoicedPaise += expTotalPaise;
      grandTotalPaidPaise += expPaidPaise;
      grandTotalOutstandingPaise += expDuePaise;

      const normalizedVendorName = (exp.vendorName || 'Unspecified Payee').trim();
      const groupKey = normalizedVendorName.toUpperCase();

      if (!vendorMap.has(groupKey)) {
        vendorMap.set(groupKey, {
          vendorId: exp.vendorId ? exp.vendorId.toString() : null,
          vendorName: normalizedVendorName,
          isLinked: true,
          totalInvoicedPaise: 0,
          totalPaidPaise: 0,
          outstandingPaise: 0,
          expenseCount: 0,
          expenses: [],
        });
      }

      const group = vendorMap.get(groupKey)!;
      group.totalInvoicedPaise += expTotalPaise;
      group.totalPaidPaise += expPaidPaise;
      group.outstandingPaise += expDuePaise;
      group.expenseCount += 1;
      group.expenses.push({
        _id: exp._id,
        expenseCode: exp.expenseCode,
        title: exp.title,
        status: exp.status,
        category: exp.category,
        invoiceNumber: exp.invoiceNumber,
        expenseDate: exp.expenseDate,
        amount: CurrencyUtil.toInr(expTotalPaise),
        originalAmount: exp.amount,
        amountPaise: expTotalPaise,
        paidAmount: CurrencyUtil.toInr(expPaidPaise),
        paidAmountPaise: expPaidPaise,
        outstandingAmount: CurrencyUtil.toInr(expDuePaise),
        outstandingPaise: expDuePaise,
        paymentStatus: exp.paymentStatus || 'UNPAID',
        acquisitionId: exp.acquisitionId,
        vendorId: exp.vendorId,
        vendorName: exp.vendorName,
        reviewedByName: exp.reviewedByName,
        reviewedByRole: exp.reviewedByRole,
        reviewedAt: exp.reviewedAt,
        creatorName: exp.creatorName,
        creatorRole: exp.creatorRole,
        submittedByName: exp.submittedByName,
        submittedByRole: exp.submittedByRole,
        submittedAt: exp.submittedAt,
        ageDays,
        agingBucket,
      });
    }

    const creditors = Array.from(vendorMap.values()).map((c) => ({
      ...c,
      totalInvoicedInr: CurrencyUtil.toInr(c.totalInvoicedPaise),
      totalPaidInr: CurrencyUtil.toInr(c.totalPaidPaise),
      outstandingInr: CurrencyUtil.toInr(c.outstandingPaise),
    })).sort((a, b) => b.outstandingPaise - a.outstandingPaise);

    // Aging breakdown summary
    const agingSummary = {
      under30DaysInr: 0,
      days31To60Inr: 0,
      days61To90Inr: 0,
      over90DaysInr: 0,
    };

    for (const c of creditors) {
      for (const e of c.expenses) {
        if (e.agingBucket === '0-30 Days') agingSummary.under30DaysInr += e.outstandingAmount;
        else if (e.agingBucket === '31-60 Days') agingSummary.days31To60Inr += e.outstandingAmount;
        else if (e.agingBucket === '61-90 Days') agingSummary.days61To90Inr += e.outstandingAmount;
        else if (e.agingBucket === '90+ Days') agingSummary.over90DaysInr += e.outstandingAmount;
      }
    }

    return {
      summary: {
        totalOutstandingInr: CurrencyUtil.toInr(grandTotalOutstandingPaise),
        totalOutstandingPaise: grandTotalOutstandingPaise,
        totalInvoicedInr: CurrencyUtil.toInr(grandTotalInvoicedPaise),
        totalInvoicedPaise: grandTotalInvoicedPaise,
        totalPaidInr: CurrencyUtil.toInr(grandTotalPaidPaise),
        totalPaidPaise: grandTotalPaidPaise,
        pendingExpensesCount: expenses.length,
        creditorsCount: creditors.length,
        aging: agingSummary,
      },
      creditors,
    };
  }
}
