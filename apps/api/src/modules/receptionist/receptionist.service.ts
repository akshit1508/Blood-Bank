import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import {
  BloodIssue,
  BloodIssueDocument,
} from '../blood-issues/schemas/blood-issue.schema';
import {
  BloodIssueInvoice,
  BloodIssueInvoiceDocument,
} from '../billing/schemas/blood-issue-invoice.schema';
import {
  BloodIssueCollection,
  BloodIssueCollectionDocument,
} from '../billing/schemas/blood-issue-collection.schema';
import { InvoiceStatus } from '../billing/constants/billing.constants';
import {
  BloodRequest,
  BloodRequestDocument,
} from '../../blood-requests/schemas/blood-request.schema';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import {
  ReceptionistDashboardQueryDto,
  ReceptionistPeriodFilter,
  AttachDocumentDto,
  VerifyDocumentsDto,
} from './dto/receptionist-query.dto';
import { BloodRequestStatus } from '../../blood-requests/blood-request.constants';

@Injectable()
export class ReceptionistService {
  private readonly logger = new Logger(ReceptionistService.name);

  constructor(
    @InjectModel(BloodIssue.name)
    private readonly bloodIssueModel: Model<BloodIssueDocument>,
    @InjectModel(BloodIssueInvoice.name)
    private readonly invoiceModel: Model<BloodIssueInvoiceDocument>,
    @InjectModel(BloodIssueCollection.name)
    private readonly collectionModel: Model<BloodIssueCollectionDocument>,
    @InjectModel(BloodRequest.name)
    private readonly bloodRequestModel: Model<BloodRequestDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
  ) {}

  /**
   * Resolves date boundary timestamps from human period or ISO bounds.
   */
  private resolveDateRange(
    period?: ReceptionistPeriodFilter,
    startIso?: string,
    endIso?: string,
  ): { startDate: Date; endDate: Date } {
    const now = new Date();

    if (period === ReceptionistPeriodFilter.CUSTOM && startIso) {
      const start = new Date(startIso);
      const end = endIso ? new Date(endIso) : new Date();
      return { startDate: start, endDate: end };
    }

    if (period === ReceptionistPeriodFilter.YESTERDAY) {
      const start = new Date(now);
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }

    if (period === ReceptionistPeriodFilter.LAST_7_DAYS) {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: now };
    }

    if (period === ReceptionistPeriodFilter.LAST_15_DAYS) {
      const start = new Date(now);
      start.setDate(now.getDate() - 15);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: now };
    }

    if (period === ReceptionistPeriodFilter.LAST_30_DAYS) {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: now };
    }

    if (period === ReceptionistPeriodFilter.THIS_MONTH) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { startDate: start, endDate: now };
    }

    if (period === ReceptionistPeriodFilter.PREVIOUS_MONTH) {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }

    // Default: TODAY
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end };
  }

  /**
   * Generates comprehensive real-time dashboard metrics and charts.
   */
  async getDashboardMetrics(query: ReceptionistDashboardQueryDto) {
    const { startDate, endDate } = this.resolveDateRange(
      query.period,
      query.startDate,
      query.endDate,
    );

    // 1. Completed Blood Issues in date range
    const issues = await this.bloodIssueModel
      .find({
        issuedAt: { $gte: startDate, $lte: endDate },
      })
      .lean()
      .exec();

    const totalBloodIssues = issues.length;
    let totalUnitsIssued = 0;
    const unitsByComponent: Record<string, number> = {};
    const unitsByBloodGroup: Record<string, number> = {};

    for (const issue of issues) {
      const count = (issue as any).issuedUnitsCount || (issue as any).issuedUnits?.length || (issue as any).unitsIssued || 1;
      totalUnitsIssued += count;

      const comp = (issue as any).componentType || 'WHOLE_BLOOD';
      unitsByComponent[comp] = (unitsByComponent[comp] || 0) + count;

      const bg = (issue as any).bloodGroup || 'O+';
      unitsByBloodGroup[bg] = (unitsByBloodGroup[bg] || 0) + count;
    }

    // 2. Invoices generated in date range
    const invoices = await this.invoiceModel
      .find({
        invoiceDate: { $gte: startDate, $lte: endDate },
      })
      .lean()
      .exec();

    const totalInvoicesGenerated = invoices.length;
    let totalInvoiceAmountPaise = 0;
    let totalOutstandingPaise = 0;
    let pendingTransactionsCount = 0;

    for (const inv of invoices) {
      const netPaise = inv.netPayablePaise ?? ((inv as any).totalAmount ? (inv as any).totalAmount * 100 : 0);
      const outPaise = inv.outstandingPaise ?? ((inv as any).outstandingAmount ? (inv as any).outstandingAmount * 100 : 0);
      totalInvoiceAmountPaise += netPaise;
      totalOutstandingPaise += outPaise;
      if (inv.status === InvoiceStatus.PENDING || inv.status === InvoiceStatus.PARTIALLY_COLLECTED) {
        pendingTransactionsCount++;
      }
    }

    // 3. Payment Collections in date range
    const collections = await this.collectionModel
      .find({
        paymentDate: { $gte: startDate, $lte: endDate },
        isReversed: { $ne: true },
      })
      .lean()
      .exec();

    let totalPaymentsCollectedPaise = 0;
    let totalCashCollectedPaise = 0;
    let totalDigitalCollectedPaise = 0;
    const paymentMethodBreakdown: Record<string, { count: number; amount: number }> = {
      CASH: { count: 0, amount: 0 },
      UPI: { count: 0, amount: 0 },
      CARD: { count: 0, amount: 0 },
      HOSPITAL_CREDIT: { count: 0, amount: 0 },
    };

    for (const col of collections) {
      const paise = col.amountPaise ?? ((col as any).amount ? (col as any).amount * 100 : 0);
      totalPaymentsCollectedPaise += paise;
      const method = col.paymentMethod || 'CASH';

      if (!paymentMethodBreakdown[method]) {
        paymentMethodBreakdown[method] = { count: 0, amount: 0 };
      }
      paymentMethodBreakdown[method].count++;
      paymentMethodBreakdown[method].amount += (col as any).amount || (paise / 100);

      if (method === 'CASH') {
        totalCashCollectedPaise += paise;
      } else {
        totalDigitalCollectedPaise += paise;
      }
    }

    // 4. Time series grouping for charts
    const issuesOverTimeMap: Record<string, { date: string; issues: number; units: number }> = {};
    const collectionsOverTimeMap: Record<string, { date: string; amount: number; cash: number; digital: number }> = {};

    for (const issue of issues) {
      const issueDate = issue.issuedAt || (issue as any).createdAt || new Date();
      const d = (issueDate instanceof Date ? issueDate : new Date(issueDate)).toISOString().slice(0, 10);
      if (!issuesOverTimeMap[d]) {
        issuesOverTimeMap[d] = { date: d, issues: 0, units: 0 };
      }
      issuesOverTimeMap[d].issues++;
      issuesOverTimeMap[d].units += (issue as any).issuedUnitsCount || (issue as any).unitsIssued || 1;
    }

    for (const col of collections) {
      const colDate = (col as any).paymentDate || (col as any).collectedAt || (col as any).createdAt || new Date();
      const d = (colDate instanceof Date ? colDate : new Date(colDate)).toISOString().slice(0, 10);
      if (!collectionsOverTimeMap[d]) {
        collectionsOverTimeMap[d] = { date: d, amount: 0, cash: 0, digital: 0 };
      }
      const val = col.amount || ((col as any).amountPaise ? (col as any).amountPaise / 100 : 0);
      collectionsOverTimeMap[d].amount += val;
      if (col.paymentMethod === 'CASH') {
        collectionsOverTimeMap[d].cash += val;
      } else {
        collectionsOverTimeMap[d].digital += val;
      }
    }

    const issuesOverTime = Object.values(issuesOverTimeMap).sort((a, b) => a.date.localeCompare(b.date));
    const collectionsOverTime = Object.values(collectionsOverTimeMap).sort((a, b) => a.date.localeCompare(b.date));

    const paymentMethodDistribution = Object.entries(paymentMethodBreakdown).map(([method, data]) => ({
      method,
      amount: data.amount,
      count: data.count,
    }));

    const componentDistribution = Object.entries(unitsByComponent).map(([component, units]) => ({
      component,
      units,
    }));

    // Daily Combined Activity
    const allDates = Array.from(new Set([...Object.keys(issuesOverTimeMap), ...Object.keys(collectionsOverTimeMap)])).sort();
    const dailyActivity = allDates.map((date) => ({
      date,
      issues: issuesOverTimeMap[date]?.issues || 0,
      collections: collectionsOverTimeMap[date]?.amount || 0,
      cash: collectionsOverTimeMap[date]?.cash || 0,
      digital: collectionsOverTimeMap[date]?.digital || 0,
    }));

    // 5. Recent Transactions table (up to 50 items)
    const limit = query.limit || 30;
    const recentInvoices = await this.invoiceModel
      .find({
        invoiceDate: { $gte: startDate, $lte: endDate },
      })
      .sort({ invoiceDate: -1 })
      .limit(limit)
      .lean()
      .exec();

    // Map each invoice to a transaction item
    const recentTransactions = await Promise.all(
      recentInvoices.map(async (inv) => {
        // Find latest collection receipt
        const latestCol = await this.collectionModel
          .findOne({ invoiceId: inv._id, isReversed: { $ne: true } })
          .sort({ paymentDate: -1 })
          .lean()
          .exec();

        const firstItem = inv.items?.[0];
        const unitsCount = inv.items?.length || 1;

        return {
          transactionNumber: latestCol?.receiptNumber || inv.invoiceNumber,
          receiptNumber: latestCol?.receiptNumber || null,
          invoiceNumber: inv.invoiceNumber,
          invoiceId: inv._id.toString(),
          issueId: inv.issueId?.toString(),
          issueCode: inv.issueCode,
          bloodRequestId: inv.bloodRequestId?.toString(),
          requestCode: inv.requestCode,
          patient: inv.patient,
          hospitalName: inv.hospitalName,
          doctorName: inv.doctorName,
          bloodGroup: firstItem?.bloodGroup || '—',
          componentType: firstItem?.componentType || 'WHOLE_BLOOD',
          quantity: unitsCount,
          issueDate: inv.invoiceDate,
          invoiceAmount: inv.netPayable,
          amountCollected: inv.collectedAmount,
          outstandingAmount: inv.outstandingAmount,
          paymentStatus: inv.status,
          issueStatus: 'ISSUED',
        };
      }),
    );

    return {
      dateRange: {
        startDate,
        endDate,
        period: query.period || ReceptionistPeriodFilter.TODAY,
      },
      summary: {
        totalBloodIssues,
        totalUnitsIssued,
        totalInvoicesGenerated,
        totalInvoiceAmount: totalInvoiceAmountPaise / 100,
        totalPaymentsCollected: totalPaymentsCollectedPaise / 100,
        totalCashCollected: totalCashCollectedPaise / 100,
        totalDigitalCollected: totalDigitalCollectedPaise / 100,
        totalOutstanding: totalOutstandingPaise / 100,
        pendingTransactionsCount,
        unitsByComponent,
        unitsByBloodGroup,
        paymentMethodBreakdown,
      },
      charts: {
        issuesOverTime,
        collectionsOverTime,
        paymentMethodDistribution,
        componentDistribution,
        dailyActivity,
      },
      recentTransactions,
    };
  }

  /**
   * Searches for existing patients across blood requests.
   */
  async searchPatients(q: string) {
    if (!q || q.trim().length < 2) {
      return [];
    }

    const regex = new RegExp(q.trim(), 'i');

    const matchingRequests = await this.bloodRequestModel
      .find({
        $or: [
          { 'patient.phone': regex },
          { 'patient.name': regex },
          { hospitalCaseNumber: regex },
          { requestCode: regex },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();

    // Group distinct patients by phone or composite key
    const patientMap = new Map<string, any>();

    for (const req of matchingRequests) {
      const patient = req.patient || {
        name: (req as any).patientName || 'Unknown Patient',
        age: (req as any).patientAge || 0,
        gender: (req as any).patientGender || 'Unspecified',
        phone: (req as any).contactPhone || req.contactPerson?.phone || '',
      };
      const pName = patient.name || (req as any).patientName || 'Unknown Patient';
      const pPhone = patient.phone || (req as any).contactPhone || req.contactPerson?.phone || '';
      const pAge = patient.age ?? (req as any).patientAge ?? 0;
      const pGender = patient.gender || (req as any).patientGender || 'Unspecified';

      const key = pPhone
        ? pPhone.trim()
        : `${pName.toLowerCase()}_${pAge}_${pGender}`;

      if (!patientMap.has(key)) {
        patientMap.set(key, {
          patientKey: key,
          name: pName,
          age: pAge,
          gender: pGender,
          phone: pPhone,
          hospitalName: req.hospitalName,
          doctorName: req.doctorName,
          hospitalCaseNumber: req.hospitalCaseNumber || '',
          bloodGroup: req.bloodGroup,
          lastRequestCode: req.requestCode,
          lastRequestId: (req as any)._id?.toString() || (req as any).id,
          lastRequestDate: (req as any).createdAt || new Date(),
          lastStatus: req.status,
          totalRequests: 1,
          recentRequests: [
            {
              id: (req as any)._id?.toString() || (req as any).id,
              requestCode: req.requestCode,
              bloodGroup: req.bloodGroup,
              componentType: req.componentType,
              unitsRequested: req.unitsRequested,
              status: req.status,
              createdAt: (req as any).createdAt || new Date(),
            },
          ],
        });
      } else {
        const existing = patientMap.get(key);
        existing.totalRequests++;
        if (existing.recentRequests.length < 5) {
          existing.recentRequests.push({
            id: (req as any)._id?.toString() || (req as any).id,
            requestCode: req.requestCode,
            bloodGroup: req.bloodGroup,
            componentType: req.componentType,
            unitsRequested: req.unitsRequested,
            status: req.status,
            createdAt: (req as any).createdAt || new Date(),
          });
        }
      }
    }

    return Array.from(patientMap.values());
  }

  /**
   * Attaches a supporting document to a blood request.
   */
  async attachDocument(requestId: string, dto: AttachDocumentDto, admin: any) {
    const request = await this.bloodRequestModel.findById(requestId);
    if (!request) {
      throw new NotFoundException(`Blood request '${requestId}' not found`);
    }

    const doc = {
      documentType: dto.documentType,
      fileName: dto.fileName,
      fileUrl: dto.fileUrl,
      fileSize: dto.fileSize || 0,
      isVerified: true,
      verifiedBy: admin?.fullName || 'Finance Receptionist',
      verifiedAt: new Date(),
      notes: dto.notes || '',
    };

    request.documents = request.documents || [];
    request.documents.push(doc as any);
    request.documentVerificationStatus = 'VERIFIED';
    request.documentVerifiedBy = admin?.fullName || 'Finance Receptionist';
    request.documentVerifiedAt = new Date();

    await request.save();
    return request;
  }

  /**
   * Verifies all documents for a blood request and updates status.
   */
  async verifyDocuments(requestId: string, dto: VerifyDocumentsDto, admin: any) {
    const request = await this.bloodRequestModel.findById(requestId);
    if (!request) {
      throw new NotFoundException(`Blood request '${requestId}' not found`);
    }

    request.documentVerificationStatus = dto.status;
    request.documentVerifiedBy = admin?.fullName || 'Finance Receptionist';
    request.documentVerifiedAt = new Date();

    if (dto.status === 'VERIFIED' && request.status === BloodRequestStatus.REQUESTED) {
      request.status = BloodRequestStatus.VERIFIED;
      request.statusReason = `Documents verified by ${admin?.fullName || 'Receptionist'}${dto.notes ? ': ' + dto.notes : ''}`;
      request.statusUpdatedAt = new Date();
    } else if (dto.status === 'REJECTED' && request.status === BloodRequestStatus.REQUESTED) {
      request.statusReason = `Documents flagged as incomplete: ${dto.notes || 'Missing required clinical documentation'}`;
      request.statusUpdatedAt = new Date();
    }

    await request.save();
    return request;
  }
}
