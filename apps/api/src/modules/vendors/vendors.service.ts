import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Vendor, VendorDocument } from './schemas/vendor.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { ExpenseStatus } from '../expenses/constants/expense.constants';
import { PaymentStatus } from '../payments/constants/payment.constants';
import { CurrencyUtil } from '../../common/utils/currency.util';

import {
  BloodAcquisition,
  BloodAcquisitionDocument,
} from '../blood-acquisitions/schemas/blood-acquisition.schema';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(BloodAcquisition.name)
    private readonly bloodAcquisitionModel: Model<BloodAcquisitionDocument>,
  ) {}

  /**
   * Narrow projection for Admin and Super Admin expense creation dropdown.
   * Excludes bank details, GSTIN/PAN, and financial ledgers.
   */
  async getActiveOptions(): Promise<{ _id: string; name: string; category: string }[]> {
    return this.vendorModel
      .find({ isActive: true })
      .select('_id name category')
      .sort({ name: 1 })
      .lean()
      .exec() as any;
  }

  /**
   * Registers a new vendor profile (Super Admin only).
   */
  async create(dto: CreateVendorDto, currentAdmin: any): Promise<Vendor> {
    const existing = await this.vendorModel.findOne({
      name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
    });

    if (existing) {
      throw new ConflictException(`A vendor with the name "${dto.name.trim()}" already exists.`);
    }

    const auditHistoryItem = {
      action: 'CREATED',
      performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
      performedByName: currentAdmin.fullName || 'Super Admin',
      performedByEmail: currentAdmin.email,
      notes: 'Vendor registered in system.',
      timestamp: new Date(),
    };

    const vendor = await this.vendorModel.create({
      name: dto.name.trim(),
      category: dto.category,
      contactPerson: dto.contactPerson.trim(),
      email: dto.email ? dto.email.trim().toLowerCase() : undefined,
      phone: dto.phone.trim(),
      gstinNumber: dto.gstinNumber ? dto.gstinNumber.trim().toUpperCase() : undefined,
      panNumber: dto.panNumber ? dto.panNumber.trim().toUpperCase() : undefined,
      bankDetails: dto.bankDetails
        ? {
            bankName: dto.bankDetails.bankName.trim(),
            accountNumber: dto.bankDetails.accountNumber.trim(),
            ifscCode: dto.bankDetails.ifscCode.trim().toUpperCase(),
            branchName: dto.bankDetails.branchName ? dto.bankDetails.branchName.trim() : '',
          }
        : undefined,
      notes: dto.notes ? dto.notes.trim() : undefined,
      isActive: true,
      createdBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
      createdByName: currentAdmin.fullName || 'Super Admin',
      auditHistory: [auditHistoryItem],
    });

    return vendor;
  }

  /**
   * Lists vendors with masked bank details for Super Admin directory view.
   */
  async findAll(query: { category?: string; search?: string; isActive?: string }): Promise<any[]> {
    const filter: any = {};

    if (query.category) {
      filter.category = query.category;
    }

    if (query.isActive !== undefined && query.isActive !== '') {
      filter.isActive = query.isActive === 'true';
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { contactPerson: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { gstinNumber: { $regex: term, $options: 'i' } },
      ];
    }

    const vendors = await this.vendorModel.find(filter).sort({ name: 1 }).lean().exec();

    // Mask bank account number: ••••••••1234
    return vendors.map((v) => {
      const copy: any = { ...v };
      if (copy.bankDetails && copy.bankDetails.accountNumber) {
        const raw = copy.bankDetails.accountNumber;
        const last4 = raw.slice(-4);
        copy.bankDetails = {
          ...copy.bankDetails,
          maskedAccountNumber: `••••••••${last4}`,
          accountNumber: `••••••••${last4}`,
        };
      }
      return copy;
    });
  }

  /**
   * Retrieves single vendor by ID with complete unmasked bank details (Super Admin only).
   */
  async findById(id: string): Promise<VendorDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid vendor ID format.');
    }
    const vendor = await this.vendorModel.findById(id).exec();
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID '${id}' was not found.`);
    }
    return vendor;
  }

  /**
   * Updates vendor profile and records audit entries for bank details modification.
   */
  async update(id: string, dto: UpdateVendorDto, currentAdmin: any): Promise<Vendor> {
    const vendor = await this.findById(id);

    if (dto.name && dto.name.trim() !== vendor.name) {
      const existing = await this.vendorModel.findOne({
        _id: { $ne: vendor._id },
        name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
      });
      if (existing) {
        throw new ConflictException(`A vendor with the name "${dto.name.trim()}" already exists.`);
      }
      vendor.name = dto.name.trim();
    }

    if (dto.category !== undefined) vendor.category = dto.category;
    if (dto.contactPerson !== undefined) vendor.contactPerson = dto.contactPerson.trim();
    if (dto.email !== undefined) vendor.email = dto.email ? dto.email.trim().toLowerCase() : undefined;
    if (dto.phone !== undefined) vendor.phone = dto.phone.trim();
    if (dto.gstinNumber !== undefined) vendor.gstinNumber = dto.gstinNumber ? dto.gstinNumber.trim().toUpperCase() : undefined;
    if (dto.panNumber !== undefined) vendor.panNumber = dto.panNumber ? dto.panNumber.trim().toUpperCase() : undefined;
    if (dto.isActive !== undefined) vendor.isActive = dto.isActive;
    if (dto.notes !== undefined) vendor.notes = dto.notes ? dto.notes.trim() : undefined;

    let bankDetailsChanged = false;
    if (dto.bankDetails) {
      const oldAcc = vendor.bankDetails?.accountNumber || 'None';
      const newAcc = dto.bankDetails.accountNumber.trim();
      vendor.bankDetails = {
        bankName: dto.bankDetails.bankName.trim(),
        accountNumber: newAcc,
        ifscCode: dto.bankDetails.ifscCode.trim().toUpperCase(),
        branchName: dto.bankDetails.branchName ? dto.bankDetails.branchName.trim() : '',
      };
      bankDetailsChanged = true;

      vendor.auditHistory.push({
        action: 'BANK_DETAILS_UPDATED',
        performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
        performedByName: currentAdmin.fullName || 'Super Admin',
        performedByEmail: currentAdmin.email,
        notes: `Bank details updated: Account ending in ${newAcc.slice(-4)}, IFSC ${dto.bankDetails.ifscCode.trim().toUpperCase()}`,
        timestamp: new Date(),
      });
    }

    if (!bankDetailsChanged) {
      vendor.auditHistory.push({
        action: 'UPDATED',
        performedBy: new Types.ObjectId(currentAdmin.id || currentAdmin._id),
        performedByName: currentAdmin.fullName || 'Super Admin',
        performedByEmail: currentAdmin.email,
        notes: 'Vendor details updated.',
        timestamp: new Date(),
      });
    }

    return await vendor.save();
  }

  /**
   * Generates chronological financial statement and balance for a registered vendor.
   */
  async getLedger(vendorId: string): Promise<any> {
    const vendor = await this.findById(vendorId);

    // 1. Fetch approved expenses
    const expenses = await this.expenseModel
      .find({
        vendorId: vendor._id,
        status: ExpenseStatus.APPROVED,
        isDeleted: false,
      })
      .sort({ expenseDate: 1, createdAt: 1 })
      .lean()
      .exec();

    // 2. Fetch payments
    const payments = await this.paymentModel
      .find({
        vendorId: vendor._id,
      })
      .sort({ paymentDate: 1, createdAt: 1 })
      .lean()
      .exec();

    // 3. Assemble timeline
    type LedgerItem = {
      date: Date;
      type: 'INVOICE' | 'DISBURSEMENT' | 'DISBURSEMENT_CANCELLED';
      reference: string;
      code: string;
      title: string;
      debitPaise: number; // Invoice billed
      creditPaise: number; // Payment made
      balancePaise: number;
      debitInr: number;
      creditInr: number;
      balanceInr: number;
      status?: string;
      notes?: string;
    };

    const rawEvents: Array<{
      date: Date;
      createdAt: Date;
      type: 'INVOICE' | 'DISBURSEMENT' | 'DISBURSEMENT_CANCELLED';
      reference: string;
      code: string;
      title: string;
      debitPaise: number;
      creditPaise: number;
      status?: string;
      notes?: string;
    }> = [];

    for (const exp of expenses) {
      const expPaise = exp.amountPaise || CurrencyUtil.toPaise(exp.amount);
      rawEvents.push({
        date: exp.expenseDate,
        createdAt: exp.createdAt,
        type: 'INVOICE',
        reference: exp.invoiceNumber,
        code: exp.expenseCode,
        title: exp.title,
        debitPaise: expPaise,
        creditPaise: 0,
        status: exp.paymentStatus || 'UNPAID',
        notes: exp.description,
      });

      // If expense links to an acquisition, include any approved credit memos/adjustments
      if (exp.acquisitionId) {
        const acq = await this.bloodAcquisitionModel.findById(exp.acquisitionId).lean().exec();
        if (acq && acq.adjustments && acq.adjustments.length > 0) {
          for (const adj of acq.adjustments) {
            const isRefund = adj.adjustmentType === 'SUPPLIER_REFUND';
            rawEvents.push({
              date: (adj as any).authorizedAt || (adj as any).createdAt || exp.expenseDate,
              createdAt: (adj as any).createdAt || (adj as any).authorizedAt || exp.createdAt,
              type: (isRefund ? 'SUPPLIER_REFUND' : 'CREDIT_MEMO') as any,
              reference: adj.referenceNumber,
              code: isRefund ? `${exp.expenseCode}-REFUND` : `${exp.expenseCode}-CR`,
              title: isRefund
                ? `Supplier Refund Receipt: ${adj.referenceNumber} (${adj.reason})`
                : `Credit Note: ${adj.adjustmentType} (${adj.reason})`,
              debitPaise: isRefund ? adj.creditAmountPaise : 0,
              creditPaise: isRefund ? 0 : adj.creditAmountPaise,
              status: isRefund ? 'COMPLETED' : 'APPROVED',
              notes: isRefund
                ? `Supplier refund received & authorized by ${adj.authorizedByName}`
                : `Credit adjustment authorized by ${adj.authorizedByName}`,
            });
          }
        }
      }
    }

    for (const p of payments) {
      if (p.status === PaymentStatus.COMPLETED) {
        rawEvents.push({
          date: p.paymentDate,
          createdAt: p.createdAt,
          type: 'DISBURSEMENT',
          reference: p.referenceNumber,
          code: p._id.toString(),
          title: `Disbursement via ${p.paymentMethod}`,
          debitPaise: 0,
          creditPaise: p.amountPaise,
          status: 'COMPLETED',
          notes: p.notes,
        });
      } else {
        rawEvents.push({
          date: p.cancelledAt || p.paymentDate,
          createdAt: p.createdAt,
          type: 'DISBURSEMENT_CANCELLED',
          reference: p.referenceNumber,
          code: p._id.toString(),
          title: `CANCELLED: Disbursement via ${p.paymentMethod}`,
          debitPaise: 0,
          creditPaise: 0,
          status: 'CANCELLED',
          notes: `Reason: ${p.cancellationReason || 'Cancelled'}`,
        });
      }
    }

    // Sort chronologically
    rawEvents.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let runningBalancePaise = 0;
    let totalInvoicedPaise = 0;
    let totalPaidPaise = 0;

    const items: LedgerItem[] = rawEvents.map((ev) => {
      if (ev.type === 'INVOICE') {
        runningBalancePaise += ev.debitPaise;
        totalInvoicedPaise += ev.debitPaise;
      } else if (ev.type === 'DISBURSEMENT') {
        runningBalancePaise -= ev.creditPaise;
        totalPaidPaise += ev.creditPaise;
      } else if ((ev as any).type === 'CREDIT_MEMO') {
        runningBalancePaise -= ev.creditPaise;
      } else if ((ev as any).type === 'SUPPLIER_REFUND') {
        runningBalancePaise += ev.debitPaise;
      }

      return {
        date: ev.date,
        type: ev.type,
        reference: ev.reference,
        code: ev.code,
        title: ev.title,
        debitPaise: ev.debitPaise,
        creditPaise: ev.creditPaise,
        balancePaise: runningBalancePaise,
        debitInr: CurrencyUtil.toInr(ev.debitPaise),
        creditInr: CurrencyUtil.toInr(ev.creditPaise),
        balanceInr: CurrencyUtil.toSignedInr(runningBalancePaise),
        status: ev.status,
        notes: ev.notes,
      };
    });

    return {
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        category: vendor.category,
        contactPerson: vendor.contactPerson,
        phone: vendor.phone,
        email: vendor.email,
        gstinNumber: vendor.gstinNumber,
        panNumber: vendor.panNumber,
        bankDetails: vendor.bankDetails,
      },
      summary: {
        totalInvoicedInr: CurrencyUtil.toInr(totalInvoicedPaise),
        totalInvoicedPaise,
        totalPaidInr: CurrencyUtil.toInr(totalPaidPaise),
        totalPaidPaise,
        outstandingBalanceInr: CurrencyUtil.toSignedInr(runningBalancePaise),
        outstandingBalancePaise: runningBalancePaise,
        invoicesCount: expenses.length,
        disbursementsCount: payments.filter((p) => p.status === PaymentStatus.COMPLETED).length,
      },
      items,
    };
  }
}
