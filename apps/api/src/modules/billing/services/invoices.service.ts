import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import {
  BloodIssueInvoice,
  BloodIssueInvoiceDocument,
} from '../schemas/blood-issue-invoice.schema';
import { InvoiceStatus, ADMIN_MAX_WAIVER_PAISE } from '../constants/billing.constants';
import {
  GenerateInvoiceDto,
  CancelInvoiceDto,
} from '../dto/invoice.dto';
import { ApplyWaiverDto } from '../dto/waiver.dto';
import { QueryInvoicesDto } from '../dto/query-billing.dto';
import {
  BloodIssue,
  BloodIssueDocument,
} from '../../blood-issues/schemas/blood-issue.schema';
import { BloodIssueStatus } from '../../blood-issues/constants/blood-issue.constants';
import {
  BloodRequest,
  BloodRequestDocument,
} from '../../../blood-requests/schemas/blood-request.schema';
import { TariffsService } from './tariffs.service';
import { CurrencyUtil } from '../../../common/utils/currency.util';
import { AdminRole } from '../../auth/schemas/admin-user.schema';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import {
  AuditActionType,
  AuditEntityType,
} from '../../audit-logs/constants/audit-log.constants';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(BloodIssueInvoice.name)
    private readonly invoiceModel: Model<BloodIssueInvoiceDocument>,
    @InjectModel(BloodIssue.name)
    private readonly bloodIssueModel: Model<BloodIssueDocument>,
    @InjectModel(BloodRequest.name)
    private readonly bloodRequestModel: Model<BloodRequestDocument>,
    private readonly tariffsService: TariffsService,
    @Optional()
    private readonly auditLogsService?: AuditLogsService,
  ) {}

  /**
   * Generates a unique invoice number.
   * Format: INV-YYYYMMDD-XXXX (e.g. INV-20261014-A1B2)
   */
  private generateInvoiceNumber(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INV-${datePart}-${randomPart}`;
  }

  /**
   * Generates a billing invoice for a completed blood issue.
   */
  async generateInvoice(
    issueIdentifier: string,
    dto: GenerateInvoiceDto,
    user: { id?: string; email?: string; fullName?: string; role?: string },
  ) {
    // 1. Locate Blood Issue
    let bloodIssue: BloodIssueDocument | null = null;
    if (isValidObjectId(issueIdentifier)) {
      bloodIssue = await this.bloodIssueModel.findById(issueIdentifier).exec();
    }
    if (!bloodIssue) {
      bloodIssue = await this.bloodIssueModel
        .findOne({ issueCode: issueIdentifier.toUpperCase() })
        .exec();
    }

    if (!bloodIssue) {
      throw new NotFoundException({
        message: `Blood issue '${issueIdentifier}' was not found.`,
        code: 'BLOOD_ISSUE_NOT_FOUND',
      });
    }

    if (bloodIssue.status !== BloodIssueStatus.COMPLETED) {
      throw new BadRequestException({
        message: `Blood issue '${bloodIssue.issueCode}' is in status '${bloodIssue.status}'. Only COMPLETED issues can be billed.`,
        code: 'BLOOD_ISSUE_NOT_COMPLETED',
      });
    }

    // 2. Ensure an invoice doesn't already exist for this issue
    const existingInvoice = await this.invoiceModel
      .findOne({ issueId: bloodIssue._id })
      .exec();

    if (existingInvoice) {
      throw new ConflictException({
        message: `Invoice '${existingInvoice.invoiceNumber}' has already been generated for blood issue '${bloodIssue.issueCode}'.`,
        code: 'INVOICE_ALREADY_EXISTS',
        invoiceId: (existingInvoice._id as any).toString(),
        invoiceNumber: existingInvoice.invoiceNumber,
      });
    }

    // 3. Locate Blood Request for patient & hospital details
    const bloodRequest = await this.bloodRequestModel
      .findById(bloodIssue.bloodRequestId)
      .exec();

    if (!bloodRequest) {
      throw new NotFoundException({
        message: `Blood request for issue '${bloodIssue.issueCode}' was not found.`,
        code: 'BLOOD_REQUEST_NOT_FOUND',
      });
    }

    // 4. Build line items with current tariff rates
    const applyCrossmatch =
      dto?.applyCrossmatchFee !== undefined ? dto.applyCrossmatchFee : true;
    const customChargesMap = new Map<string, { processingFee?: number; crossmatchFee?: number }>();
    if (dto?.customCharges?.length) {
      for (const c of dto.customCharges) {
        customChargesMap.set(c.unitCode.toUpperCase(), c);
      }
    }

    const items = [];
    let subtotalPaise = 0;

    for (const unit of bloodIssue.issuedUnits) {
      const tariff = await this.tariffsService.findByComponent(unit.componentType as any);

      const custom = customChargesMap.get(unit.unitCode.toUpperCase());
      let baseFeePaise = tariff.processingFeePaise;
      let crossmatchFeePaise = applyCrossmatch ? tariff.crossmatchFeePaise : 0;

      if (custom?.processingFee !== undefined) {
        baseFeePaise = CurrencyUtil.toPaise(custom.processingFee);
      }
      if (custom?.crossmatchFee !== undefined) {
        crossmatchFeePaise = CurrencyUtil.toPaise(custom.crossmatchFee);
      }

      const lineTotalPaise = baseFeePaise + crossmatchFeePaise;
      subtotalPaise += lineTotalPaise;

      items.push({
        inventoryId: unit.inventoryId,
        bloodUnitId: unit.bloodUnitId,
        unitCode: unit.unitCode,
        bloodGroup: unit.bloodGroup,
        componentType: unit.componentType,
        baseProcessingFeePaise: baseFeePaise,
        baseProcessingFee: CurrencyUtil.toInr(baseFeePaise),
        crossmatchFeePaise,
        crossmatchFee: CurrencyUtil.toInr(crossmatchFeePaise),
        lineTotalPaise,
        lineTotal: CurrencyUtil.toInr(lineTotalPaise),
      });
    }

    // Generate unique invoice number
    let invoiceNumber = this.generateInvoiceNumber();
    let attempts = 0;
    while (await this.invoiceModel.exists({ invoiceNumber })) {
      invoiceNumber = this.generateInvoiceNumber();
      attempts++;
      if (attempts > 5) {
        invoiceNumber = `INV-${Date.now()}`;
        break;
      }
    }

    const netPayablePaise = subtotalPaise;
    const outstandingPaise = netPayablePaise;

    const [created] = await this.invoiceModel.create([
      {
        invoiceNumber,
        issueId: bloodIssue._id,
        issueCode: bloodIssue.issueCode,
        bloodRequestId: bloodRequest._id,
        requestCode: bloodRequest.requestCode,
        patient: {
          name: bloodRequest.patient?.name || 'Unknown Patient',
          age: bloodRequest.patient?.age || 0,
          gender: bloodRequest.patient?.gender || 'Unknown',
          phone: bloodRequest.patient?.phone || undefined,
          hospitalCaseNumber: bloodRequest.hospitalCaseNumber || undefined,
        },
        hospitalName: bloodRequest.hospitalName || 'Walk-in / Direct Patient',
        doctorName: bloodRequest.doctorName || 'Attending Physician',
        items,
        subtotalPaise,
        subtotal: CurrencyUtil.toInr(subtotalPaise),
        waiverPaise: 0,
        waiverAmount: 0,
        netPayablePaise,
        netPayable: CurrencyUtil.toInr(netPayablePaise),
        collectedPaise: 0,
        collectedAmount: 0,
        outstandingPaise,
        outstandingAmount: CurrencyUtil.toInr(outstandingPaise),
        status: InvoiceStatus.PENDING,
        waivers: [],
        invoiceDate: new Date(),
        billedBy: user?.id ? new Types.ObjectId(user.id) : new Types.ObjectId(),
        billedByName: user?.fullName || user?.email || 'Billing Officer',
        billedByRole: (user as any)?.role || undefined,
        notes: dto?.notes?.trim() || undefined,
      },
    ]);

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: user?.id,
        actorName: user?.fullName || user?.email,
        actorEmail: user?.email,
        actorRole: (user as any)?.role,
        action: AuditActionType.INVOICE_GENERATED,
        entityType: AuditEntityType.INVOICE,
        entityId: (created._id as any).toString(),
        entityIdentifier: invoiceNumber,
        description: `Billing invoice ${invoiceNumber} generated for blood issue ${bloodIssue.issueCode} (Amount: ₹${CurrencyUtil.toInr(netPayablePaise)})`,
        afterState: {
          invoiceNumber,
          issueCode: bloodIssue.issueCode,
          netPayablePaise,
          outstandingPaise,
        },
      });
    }

    return this.findOne((created._id as any).toString());
  }

  async findAll(query?: QueryInvoicesDto) {
    const filter: any = {};

    if (query?.status) {
      filter.status = query.status;
    }
    if (query?.hospitalName?.trim()) {
      filter.hospitalName = new RegExp(query.hospitalName.trim(), 'i');
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      filter.$or = [
        { invoiceNumber: new RegExp(s, 'i') },
        { issueCode: new RegExp(s, 'i') },
        { requestCode: new RegExp(s, 'i') },
        { 'patient.name': new RegExp(s, 'i') },
        { hospitalName: new RegExp(s, 'i') },
      ];
    }
    if (query?.startDate || query?.endDate) {
      filter.invoiceDate = {};
      if (query.startDate) {
        filter.invoiceDate.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.invoiceDate.$lte = end;
      }
    }

    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.invoiceModel.countDocuments(filter).exec(),
    ]);

    return {
      data: invoices.map((inv) => this.mapInvoiceToDto(inv)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(identifier: string) {
    let invoice: BloodIssueInvoiceDocument | null = null;
    if (isValidObjectId(identifier)) {
      invoice = await this.invoiceModel.findById(identifier).exec();
    }
    if (!invoice) {
      invoice = await this.invoiceModel
        .findOne({ invoiceNumber: identifier.toUpperCase() })
        .exec();
    }

    if (!invoice) {
      throw new NotFoundException({
        message: `Invoice '${identifier}' was not found.`,
        code: 'INVOICE_NOT_FOUND',
      });
    }

    return this.mapInvoiceToDto(invoice);
  }

  /**
   * Retrieves all completed blood issues that have not yet had a billing invoice generated.
   */
  async findUnbilledIssues() {
    const completedIssues = await this.bloodIssueModel
      .find({ status: BloodIssueStatus.COMPLETED })
      .sort({ issuedAt: -1, createdAt: -1 })
      .limit(100)
      .exec();

    if (completedIssues.length === 0) return [];

    const issueIds = completedIssues.map((i) => i._id);
    const existingInvoices = await this.invoiceModel
      .find({ issueId: { $in: issueIds } }, { issueId: 1 })
      .exec();
    const billedIssueIdSet = new Set(
      existingInvoices.map((inv) => inv.issueId?.toString()),
    );

    const unbilled = completedIssues.filter(
      (iss) => !billedIssueIdSet.has(iss._id.toString()),
    );

    return unbilled;
  }

  async findByIssueId(issueIdentifier: string) {
    let invoice: BloodIssueInvoiceDocument | null = null;
    if (isValidObjectId(issueIdentifier)) {
      invoice = await this.invoiceModel
        .findOne({ issueId: new Types.ObjectId(issueIdentifier) })
        .exec();
    }
    if (!invoice) {
      invoice = await this.invoiceModel
        .findOne({ issueCode: issueIdentifier.toUpperCase() })
        .exec();
    }

    if (!invoice) {
      return null;
    }

    return this.mapInvoiceToDto(invoice);
  }

  async findByRequestId(requestId: string) {
    let filter: any = {};
    if (isValidObjectId(requestId)) {
      filter.bloodRequestId = new Types.ObjectId(requestId);
    } else {
      filter.requestCode = requestId.toUpperCase();
    }

    const invoices = await this.invoiceModel
      .find(filter)
      .sort({ invoiceDate: -1 })
      .exec();

    return invoices.map((inv) => this.mapInvoiceToDto(inv));
  }

  /**
   * Applies an authorized waiver / fee exemption to an outstanding invoice.
   * Enforces role-based authority gates (Admin <= ₹500, Super Admin full/any).
   */
  async applyWaiver(
    identifier: string,
    dto: ApplyWaiverDto,
    user: { id?: string; email?: string; fullName?: string; role?: string },
  ) {
    let invoice: BloodIssueInvoiceDocument | null = null;
    if (isValidObjectId(identifier)) {
      invoice = await this.invoiceModel.findById(identifier).exec();
    }
    if (!invoice) {
      invoice = await this.invoiceModel
        .findOne({ invoiceNumber: identifier.toUpperCase() })
        .exec();
    }

    if (!invoice) {
      throw new NotFoundException({
        message: `Invoice '${identifier}' was not found.`,
        code: 'INVOICE_NOT_FOUND',
      });
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException({
        message: `Invoice '${invoice.invoiceNumber}' is CANCELLED and cannot accept waivers.`,
        code: 'INVOICE_CANCELLED',
      });
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException({
        message: `Invoice '${invoice.invoiceNumber}' is already PAID in full. No outstanding balance to waive.`,
        code: 'INVOICE_ALREADY_PAID',
      });
    }

    if (invoice.outstandingPaise <= 0) {
      throw new BadRequestException({
        message: `Invoice '${invoice.invoiceNumber}' has zero outstanding balance.`,
        code: 'ZERO_OUTSTANDING_BALANCE',
      });
    }

    let waiverPaise = 0;
    if (dto.isFullWaiver) {
      waiverPaise = invoice.outstandingPaise;
    } else if (dto.amount !== undefined) {
      waiverPaise = CurrencyUtil.toPaise(dto.amount);
    } else {
      throw new BadRequestException({
        message: 'Either amount or isFullWaiver must be specified.',
        code: 'INVALID_WAIVER_SPECIFICATION',
      });
    }

    if (waiverPaise <= 0) {
      throw new BadRequestException({
        message: 'Waiver amount must be greater than zero.',
        code: 'INVALID_WAIVER_AMOUNT',
      });
    }

    if (waiverPaise > invoice.outstandingPaise) {
      throw new BadRequestException({
        message: `Waiver amount (₹${CurrencyUtil.toInr(waiverPaise)}) exceeds the current outstanding balance (₹${CurrencyUtil.toInr(invoice.outstandingPaise)}).`,
        code: 'WAIVER_EXCEEDS_OUTSTANDING',
      });
    }

    // Segregation-of-duties: Standard Admin waiver authority threshold
    const userRole = user?.role || AdminRole.ADMIN;
    if (userRole !== AdminRole.SUPER_ADMIN) {
      if (waiverPaise > ADMIN_MAX_WAIVER_PAISE) {
        throw new ForbiddenException({
          message: `Standard Admin can only authorize waivers up to ₹${CurrencyUtil.toInr(ADMIN_MAX_WAIVER_PAISE)}. Waivers greater than ₹500 or 100% full exemptions require SUPER_ADMIN authorization.`,
          code: 'WAIVER_EXCEEDS_ADMIN_LIMIT',
          maxAdminLimit: CurrencyUtil.toInr(ADMIN_MAX_WAIVER_PAISE),
        });
      }
      if (dto.isFullWaiver && waiverPaise > ADMIN_MAX_WAIVER_PAISE) {
        throw new ForbiddenException({
          message: `100% full waiver requires SUPER_ADMIN authorization.`,
          code: 'FULL_WAIVER_REQUIRES_SUPER_ADMIN',
        });
      }
    }

    // Apply waiver
    const newWaiverPaise = invoice.waiverPaise + waiverPaise;
    const newNetPayablePaise = Math.max(0, invoice.subtotalPaise - newWaiverPaise);
    const newOutstandingPaise = Math.max(0, newNetPayablePaise - invoice.collectedPaise);

    let nextStatus: InvoiceStatus = invoice.status;
    if (newOutstandingPaise === 0) {
      nextStatus = invoice.collectedPaise > 0 ? InvoiceStatus.PAID : InvoiceStatus.WAIVED;
    } else if (invoice.collectedPaise > 0) {
      nextStatus = InvoiceStatus.PARTIALLY_COLLECTED;
    }

    const waiverRecord = {
      category: dto.category,
      reason: dto.reason.trim(),
      amountPaise: waiverPaise,
      amount: CurrencyUtil.toInr(waiverPaise),
      authorizedBy: user?.id ? new Types.ObjectId(user.id) : new Types.ObjectId(),
      authorizedByName: user?.fullName || user?.email || 'Authorized Officer',
      authorizedByRole: userRole,
      appliedAt: new Date(),
      documentRef: dto.documentRef?.trim() || undefined,
    };

    invoice.waiverPaise = newWaiverPaise;
    invoice.waiverAmount = CurrencyUtil.toInr(newWaiverPaise);
    invoice.netPayablePaise = newNetPayablePaise;
    invoice.netPayable = CurrencyUtil.toInr(newNetPayablePaise);
    invoice.outstandingPaise = newOutstandingPaise;
    invoice.outstandingAmount = CurrencyUtil.toInr(newOutstandingPaise);
    invoice.status = nextStatus;
    invoice.waivers.push(waiverRecord as any);

    await invoice.save();

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: user?.id,
        actorName: user?.fullName || user?.email,
        actorEmail: user?.email,
        actorRole: userRole,
        action: AuditActionType.INVOICE_WAIVER_APPLIED,
        entityType: AuditEntityType.INVOICE,
        entityId: (invoice._id as any).toString(),
        entityIdentifier: invoice.invoiceNumber,
        description: `Waiver of ₹${CurrencyUtil.toInr(waiverPaise)} applied to invoice ${invoice.invoiceNumber} (${dto.category}): ${dto.reason}`,
        afterState: {
          waiverPaise: newWaiverPaise,
          netPayablePaise: newNetPayablePaise,
          outstandingPaise: newOutstandingPaise,
          status: nextStatus,
        },
        metadata: { category: dto.category, reason: dto.reason },
      });
    }

    return this.findOne((invoice._id as any).toString());
  }

  /**
   * Cancels an invoice (Super Admin only).
   */
  async cancelInvoice(
    identifier: string,
    dto: CancelInvoiceDto,
    user: { id?: string; email?: string; fullName?: string },
  ) {
    let invoice: BloodIssueInvoiceDocument | null = null;
    if (isValidObjectId(identifier)) {
      invoice = await this.invoiceModel.findById(identifier).exec();
    }
    if (!invoice) {
      invoice = await this.invoiceModel
        .findOne({ invoiceNumber: identifier.toUpperCase() })
        .exec();
    }

    if (!invoice) {
      throw new NotFoundException({
        message: `Invoice '${identifier}' was not found.`,
        code: 'INVOICE_NOT_FOUND',
      });
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException({
        message: `Invoice '${invoice.invoiceNumber}' is already cancelled.`,
        code: 'INVOICE_ALREADY_CANCELLED',
      });
    }

    if (invoice.collectedPaise > 0) {
      throw new BadRequestException({
        message: `Cannot cancel invoice '${invoice.invoiceNumber}': ₹${invoice.collectedAmount} has already been collected. Collections must be reversed or settled through credit adjustments first.`,
        code: 'CANNOT_CANCEL_COLLECTED_INVOICE',
      });
    }

    const previousStatus = invoice.status;
    invoice.status = InvoiceStatus.CANCELLED;
    invoice.cancelledAt = new Date();
    invoice.cancelledBy = user?.id ? new Types.ObjectId(user.id) : undefined;
    invoice.cancelledByName = user?.fullName || user?.email || undefined;
    invoice.cancelledByRole = (user as any)?.role || undefined;
    invoice.cancellationReason = dto.reason.trim();
    invoice.outstandingPaise = 0;
    invoice.outstandingAmount = 0;

    await invoice.save();

    if (this.auditLogsService) {
      await this.auditLogsService.logEvent({
        actorId: user?.id,
        actorName: user?.fullName || user?.email,
        actorEmail: user?.email,
        actorRole: (user as any)?.role,
        action: AuditActionType.INVOICE_CANCELLED,
        entityType: AuditEntityType.INVOICE,
        entityId: (invoice._id as any).toString(),
        entityIdentifier: invoice.invoiceNumber,
        description: `Invoice ${invoice.invoiceNumber} cancelled: ${dto.reason}`,
        beforeState: { status: previousStatus },
        afterState: { status: InvoiceStatus.CANCELLED, cancellationReason: dto.reason },
        metadata: { reason: dto.reason },
      });
    }

    return this.findOne((invoice._id as any).toString());
  }

  private mapInvoiceToDto(inv: BloodIssueInvoiceDocument | any) {
    return {
      _id: (inv._id as any).toString(),
      invoiceNumber: inv.invoiceNumber,
      issueId: inv.issueId?.toString(),
      issueCode: inv.issueCode,
      bloodRequestId: inv.bloodRequestId?.toString(),
      requestCode: inv.requestCode,
      patient: inv.patient,
      hospitalName: inv.hospitalName,
      doctorName: inv.doctorName,
      items: inv.items.map((item: any) => ({
        inventoryId: item.inventoryId?.toString(),
        bloodUnitId: item.bloodUnitId?.toString(),
        unitCode: item.unitCode,
        bloodGroup: item.bloodGroup,
        componentType: item.componentType,
        baseProcessingFeePaise: item.baseProcessingFeePaise,
        baseProcessingFee: item.baseProcessingFee,
        crossmatchFeePaise: item.crossmatchFeePaise,
        crossmatchFee: item.crossmatchFee,
        lineTotalPaise: item.lineTotalPaise,
        lineTotal: item.lineTotal,
      })),
      subtotalPaise: inv.subtotalPaise,
      subtotal: inv.subtotal,
      waiverPaise: inv.waiverPaise,
      waiverAmount: inv.waiverAmount,
      netPayablePaise: inv.netPayablePaise,
      netPayable: inv.netPayable,
      collectedPaise: inv.collectedPaise,
      collectedAmount: inv.collectedAmount,
      outstandingPaise: inv.outstandingPaise,
      outstandingAmount: inv.outstandingAmount,
      status: inv.status,
      waivers: inv.waivers.map((w: any) => ({
        category: w.category,
        reason: w.reason,
        amountPaise: w.amountPaise,
        amount: w.amount,
        authorizedByName: w.authorizedByName,
        authorizedByRole: w.authorizedByRole,
        appliedAt: w.appliedAt,
        documentRef: w.documentRef || null,
      })),
      invoiceDate: inv.invoiceDate,
      billedBy: inv.billedBy?.toString(),
      billedByName: inv.billedByName,
      billedByRole: inv.billedByRole || null,
      notes: inv.notes || null,
      cancelledBy: inv.cancelledBy?.toString(),
      cancelledByName: inv.cancelledByName || null,
      cancelledByRole: inv.cancelledByRole || null,
      cancelledAt: inv.cancelledAt || null,
      cancellationReason: inv.cancellationReason || null,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    };
  }
}
