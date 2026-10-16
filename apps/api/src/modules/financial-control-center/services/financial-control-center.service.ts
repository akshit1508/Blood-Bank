import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BloodIssueInvoice,
  BloodIssueInvoiceDocument,
} from '../../billing/schemas/blood-issue-invoice.schema';
import {
  BloodIssueCollection,
  BloodIssueCollectionDocument,
} from '../../billing/schemas/blood-issue-collection.schema';
import {
  Expense,
  ExpenseDocument,
} from '../../expenses/schemas/expense.schema';
import {
  Payment,
  PaymentDocument,
} from '../../payments/schemas/payment.schema';
import {
  BloodAcquisition,
  BloodAcquisitionDocument,
} from '../../blood-acquisitions/schemas/blood-acquisition.schema';
import {
  MonthlyPayrollRun,
  MonthlyPayrollRunDocument,
} from '../../payroll/schemas/monthly-payroll-run.schema';
import {
  SalaryDisbursement,
  SalaryDisbursementDocument,
} from '../../payroll/schemas/salary-disbursement.schema';
import {
  SalarySlip,
  SalarySlipDocument,
} from '../../payroll/schemas/salary-slip.schema';
import {
  Campaign,
  CampaignDocument,
} from '../../campaigns/schemas/campaign.schema';
import {
  FinancialPeriodPreset,
  FinancialTransactionType,
  FinancialTransactionDirection,
  TRANSACTION_TYPE_LABELS,
  COLLECTION_PAYMENT_METHOD_LABELS,
} from '../constants/financial-control-center.constants';
import { QueryFinancialKpiDto } from '../dto/query-financial-kpi.dto';
import { QueryFinancialLedgerDto } from '../dto/query-financial-ledger.dto';
import { CurrencyUtil } from '../../../common/utils/currency.util';
import { ExpenseStatus, ExpensePaymentStatus, EXPENSE_CATEGORY_LABELS } from '../../expenses/constants/expense.constants';
import { InvoiceStatus, CollectionPaymentMethod } from '../../billing/constants/billing.constants';
import { PaymentStatus, PAYMENT_METHOD_LABELS } from '../../payments/constants/payment.constants';
import { PayrollRunStatus } from '../../payroll/constants/payroll.constants';

export interface FinancialLedgerEntry {
  id: string;
  date: Date;
  reference: string;
  type: FinancialTransactionType;
  typeLabel: string;
  direction: FinancialTransactionDirection;
  category: string;
  description: string;
  amountPaise: number;
  amountInr: number;
  paymentMethod?: string;
  status: string;
  sourceLink?: string;
}

@Injectable()
export class FinancialControlCenterService {
  constructor(
    @InjectModel(BloodIssueInvoice.name)
    private readonly invoiceModel: Model<BloodIssueInvoiceDocument>,
    @InjectModel(BloodIssueCollection.name)
    private readonly collectionModel: Model<BloodIssueCollectionDocument>,
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(BloodAcquisition.name)
    private readonly acquisitionModel: Model<BloodAcquisitionDocument>,
    @InjectModel(MonthlyPayrollRun.name)
    private readonly payrollRunModel: Model<MonthlyPayrollRunDocument>,
    @InjectModel(SalaryDisbursement.name)
    private readonly salaryDisbursementModel: Model<SalaryDisbursementDocument>,
    @InjectModel(SalarySlip.name)
    private readonly salarySlipModel: Model<SalarySlipDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
  ) {}

  /**
   * Resolves canonical start and end UTC timestamps for any period preset.
   */
  resolveDateRange(
    preset?: FinancialPeriodPreset,
    customStart?: string,
    customEnd?: string,
  ): { startDate: Date; endDate: Date; presetName: string } {
    const now = new Date();
    const effectivePreset = preset || FinancialPeriodPreset.THIS_MONTH;

    if (effectivePreset === FinancialPeriodPreset.CUSTOM) {
      if (!customStart || !customEnd) {
        throw new BadRequestException('Both startDate and endDate are required for custom date range.');
      }
      const s = new Date(`${customStart}T00:00:00.000Z`);
      const e = new Date(`${customEnd}T23:59:59.999Z`);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        throw new BadRequestException('Invalid date format for custom range.');
      }
      if (s > e) {
        throw new BadRequestException('startDate cannot be after endDate.');
      }
      return { startDate: s, endDate: e, presetName: 'Custom Date Range' };
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    switch (effectivePreset) {
      case FinancialPeriodPreset.TODAY:
        return { startDate: todayStart, endDate: todayEnd, presetName: 'Today' };

      case FinancialPeriodPreset.YESTERDAY: {
        const yStart = new Date(todayStart);
        yStart.setDate(yStart.getDate() - 1);
        const yEnd = new Date(todayEnd);
        yEnd.setDate(yEnd.getDate() - 1);
        return { startDate: yStart, endDate: yEnd, presetName: 'Yesterday' };
      }

      case FinancialPeriodPreset.LAST_7_DAYS: {
        const d7 = new Date(todayStart);
        d7.setDate(d7.getDate() - 6);
        return { startDate: d7, endDate: todayEnd, presetName: 'Last 7 Days' };
      }

      case FinancialPeriodPreset.LAST_15_DAYS: {
        const d15 = new Date(todayStart);
        d15.setDate(d15.getDate() - 14);
        return { startDate: d15, endDate: todayEnd, presetName: 'Last 15 Days' };
      }

      case FinancialPeriodPreset.THIS_MONTH: {
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { startDate: mStart, endDate: mEnd, presetName: 'This Month' };
      }

      case FinancialPeriodPreset.LAST_MONTH: {
        const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { startDate: lmStart, endDate: lmEnd, presetName: 'Last Month' };
      }

      case FinancialPeriodPreset.THIS_FINANCIAL_YEAR: {
        // Indian Fiscal Year: April 1 to March 31
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed: April is 3
        const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
        const fyEndYear = fyStartYear + 1;
        const fyStart = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
        const fyEnd = new Date(fyEndYear, 2, 31, 23, 59, 59, 999);
        return { startDate: fyStart, endDate: fyEnd, presetName: 'This Financial Year' };
      }

      default:
        return { startDate: todayStart, endDate: todayEnd, presetName: 'Today' };
    }
  }

  /**
   * Aggregates authoritative KPI metrics across all 6 financial business modules.
   */
  async getFinancialKpiSummary(dto: QueryFinancialKpiDto) {
    const { startDate, endDate, presetName } = this.resolveDateRange(
      dto.period,
      dto.startDate,
      dto.endDate,
    );

    // 1. Inflows: Non-reversed Blood Issue Collections within period
    const collections = await this.collectionModel
      .find({
        paymentDate: { $gte: startDate, $lte: endDate },
        isReversed: false,
      })
      .lean()
      .exec();

    let totalCollectionsPaise = 0;
    const paymentMethodMap = new Map<string, { count: number; totalPaise: number }>();

    for (const c of collections) {
      totalCollectionsPaise += c.amountPaise;
      const m = c.paymentMethod || 'OTHER';
      const existing = paymentMethodMap.get(m) || { count: 0, totalPaise: 0 };
      existing.count++;
      existing.totalPaise += c.amountPaise;
      paymentMethodMap.set(m, existing);
    }

    // 2. Outflows: Completed disbursements against expenses within period
    const expenseDisbursements = await this.paymentModel
      .find({
        paymentDate: { $gte: startDate, $lte: endDate },
        status: PaymentStatus.COMPLETED,
      })
      .lean()
      .exec();

    let expensePaymentsPaise = 0;
    for (const p of expenseDisbursements) {
      expensePaymentsPaise += p.amountPaise;
      const m = p.paymentMethod || 'OTHER';
      const existing = paymentMethodMap.get(m) || { count: 0, totalPaise: 0 };
      existing.count++;
      existing.totalPaise += p.amountPaise;
      paymentMethodMap.set(m, existing);
    }

    // 3. Outflows: Salary disbursements within period
    const salaryDisbursements = await this.salaryDisbursementModel
      .find({
        paymentDate: { $gte: startDate, $lte: endDate },
      })
      .lean()
      .exec();

    let salaryOutflowPaise = 0;
    for (const s of salaryDisbursements) {
      salaryOutflowPaise += s.amountPaise;
    }

    const actualCashOutflowsPaise = expensePaymentsPaise + salaryOutflowPaise;

    // 4. Recognized Expenditure: Approved Expenses within period
    const approvedExpenses = await this.expenseModel
      .find({
        expenseDate: { $gte: startDate, $lte: endDate },
        status: ExpenseStatus.APPROVED,
        isDeleted: false,
      })
      .lean()
      .exec();

    let recognizedExpensesPaise = 0;
    let bloodAcquisitionCostPaise = 0;
    let campaignExpenditurePaise = 0;
    const categoryMap = new Map<string, { count: number; totalPaise: number }>();

    for (const exp of approvedExpenses) {
      const expPaise = exp.amountPaise || (exp.amount ? CurrencyUtil.toPaise(exp.amount) : 0);
      recognizedExpensesPaise += expPaise;

      if (exp.acquisitionId) {
        bloodAcquisitionCostPaise += expPaise;
      }
      if (exp.campaignId || exp.costCenter === 'MOBILE_DONATION_CAMPS') {
        campaignExpenditurePaise += expPaise;
      }

      const cat = exp.category || 'OTHER';
      const cur = categoryMap.get(cat) || { count: 0, totalPaise: 0 };
      cur.count++;
      cur.totalPaise += expPaise;
      categoryMap.set(cat, cur);
    }

    // 5. Recognized Payroll Expense: Approved Monthly Payroll Runs in period
    const payrollRuns = await this.payrollRunModel
      .find({
        periodStartDate: { $lte: endDate },
        periodEndDate: { $gte: startDate },
        status: { $in: [PayrollRunStatus.APPROVED, PayrollRunStatus.PARTIALLY_DISBURSED, PayrollRunStatus.COMPLETED] },
      })
      .lean()
      .exec();

    let payrollExpensePaise = 0;
    let outstandingPayrollLiabilityPaise = 0;
    for (const r of payrollRuns) {
      payrollExpensePaise += r.totalNetPayablePaise || 0;
      outstandingPayrollLiabilityPaise += r.totalOutstandingPaise || 0;
    }

    const totalRecognizedExpenditurePaise = recognizedExpensesPaise + payrollExpensePaise;

    // 6. Invoices Billed: Blood Issue Invoices generated within period
    const invoices = await this.invoiceModel
      .find({
        invoiceDate: { $gte: startDate, $lte: endDate },
        status: { $ne: InvoiceStatus.CANCELLED },
      })
      .lean()
      .exec();

    let totalInvoicedGrossPaise = 0;
    let totalWaiversPaise = 0;
    let totalInvoicedNetPaise = 0;

    for (const inv of invoices) {
      totalInvoicedGrossPaise += inv.subtotalPaise || 0;
      totalWaiversPaise += inv.waiverPaise || 0;
      totalInvoicedNetPaise += inv.netPayablePaise || 0;
    }

    // 7. Outstanding Receivables (Cumulative across all uncollected active invoices)
    const activeUncollectedInvoices = await this.invoiceModel
      .find({
        status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_COLLECTED] },
      })
      .lean()
      .exec();

    let outstandingReceivablesPaise = 0;
    for (const inv of activeUncollectedInvoices) {
      outstandingReceivablesPaise += inv.outstandingPaise || 0;
    }

    // 8. Outstanding Supplier & Expense Payables (Cumulative across all approved unpaid expenses)
    const unpaidExpenses = await this.expenseModel
      .find({
        status: { $in: [ExpenseStatus.APPROVED, ExpenseStatus.SUBMITTED] },
        isDeleted: false,
        paymentStatus: { $ne: ExpensePaymentStatus.PAID },
      })
      .lean()
      .exec();

    let outstandingSupplierPayablesPaise = 0;
    for (const exp of unpaidExpenses) {
      let expTotalPaise = exp.amountPaise || (exp.amount ? CurrencyUtil.toPaise(exp.amount) : 0);
      if (exp.acquisitionId) {
        const acq = await this.acquisitionModel.findById(exp.acquisitionId).lean().exec();
        if (acq && acq.adjustments) {
          const credits = acq.adjustments
            .filter((adj: any) => adj.adjustmentType !== 'SUPPLIER_REFUND')
            .reduce((sum: number, adj: any) => sum + (adj.creditAmountPaise || adj.amountPaise || 0), 0);
          expTotalPaise = Math.max(0, expTotalPaise - credits);
        }
      }
      const expPaidPaise = exp.paidAmountPaise || (exp.paidAmount ? CurrencyUtil.toPaise(exp.paidAmount) : 0);
      const remainingPaise = Math.max(0, expTotalPaise - expPaidPaise);
      outstandingSupplierPayablesPaise += remainingPaise;
    }

    const totalOutstandingPayablesPaise = outstandingSupplierPayablesPaise + outstandingPayrollLiabilityPaise;

    // 9. Format breakdowns
    const expenseCategoryBreakdown = Array.from(categoryMap.entries()).map(([cat, val]) => ({
      category: cat,
      label: (EXPENSE_CATEGORY_LABELS as any)[cat] || cat,
      amountPaise: val.totalPaise,
      amountInr: CurrencyUtil.toInr(val.totalPaise),
      count: val.count,
    }));

    const paymentMethodBreakdown = Array.from(paymentMethodMap.entries()).map(([method, val]) => ({
      method,
      label: (COLLECTION_PAYMENT_METHOD_LABELS as any)[method] || (PAYMENT_METHOD_LABELS as any)[method] || method,
      amountPaise: val.totalPaise,
      amountInr: CurrencyUtil.toInr(val.totalPaise),
      count: val.count,
    }));

    return {
      period: {
        preset: dto.period || FinancialPeriodPreset.THIS_MONTH,
        presetName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      kpis: {
        actualMoneyReceived: {
          paise: totalCollectionsPaise,
          inr: CurrencyUtil.toInr(totalCollectionsPaise),
          label: 'Actual Money Received',
          description: 'Confirmed non-reversed collections received from blood issue billing & receipts',
        },
        recognizedExpenditure: {
          paise: totalRecognizedExpenditurePaise,
          inr: CurrencyUtil.toInr(totalRecognizedExpenditurePaise),
          label: 'Recognized / Approved Expenditure',
          description: 'Total approved operational, acquisition, camp expenses and approved payroll liabilities',
        },
        actualCashOutflows: {
          paise: actualCashOutflowsPaise,
          inr: CurrencyUtil.toInr(actualCashOutflowsPaise),
          label: 'Actual Cash / Bank Outflows',
          description: 'Total disbursed supplier payments and employee salary disbursements actually transferred',
        },
        outstandingPayables: {
          paise: totalOutstandingPayablesPaise,
          inr: CurrencyUtil.toInr(totalOutstandingPayablesPaise),
          supplierPayablesPaise: outstandingSupplierPayablesPaise,
          supplierPayablesInr: CurrencyUtil.toInr(outstandingSupplierPayablesPaise),
          payrollPayablesPaise: outstandingPayrollLiabilityPaise,
          payrollPayablesInr: CurrencyUtil.toInr(outstandingPayrollLiabilityPaise),
          label: 'Outstanding Payables',
          description: 'Total pending liabilities owed to vendors, suppliers, and pending salary payments',
        },
        outstandingReceivables: {
          paise: outstandingReceivablesPaise,
          inr: CurrencyUtil.toInr(outstandingReceivablesPaise),
          label: 'Outstanding Receivables',
          description: 'Uncollected balances on blood issue invoices issued to hospitals and recipients',
        },
        bloodAcquisitionCost: {
          paise: bloodAcquisitionCostPaise,
          inr: CurrencyUtil.toInr(bloodAcquisitionCostPaise),
          label: 'Blood Acquisition Cost',
          description: 'Total approved liabilities incurred for externally sourced blood units and consignments',
        },
        campaignExpenditure: {
          paise: campaignExpenditurePaise,
          inr: CurrencyUtil.toInr(campaignExpenditurePaise),
          label: 'Campaign Expenditure',
          description: 'Approved field expenses incurred across mobile blood donation drives & camps',
        },
        payrollExpense: {
          paise: payrollExpensePaise,
          inr: CurrencyUtil.toInr(payrollExpensePaise),
          label: 'Payroll Expense',
          description: 'Recognized net employee salary commitments for approved monthly payroll runs',
        },
        totalInvoicedGross: {
          paise: totalInvoicedGrossPaise,
          inr: CurrencyUtil.toInr(totalInvoicedGrossPaise),
          waiversPaise: totalWaiversPaise,
          waiversInr: CurrencyUtil.toInr(totalWaiversPaise),
          netBilledPaise: totalInvoicedNetPaise,
          netBilledInr: CurrencyUtil.toInr(totalInvoicedNetPaise),
          label: 'Total Blood Issue Invoices',
          description: 'Gross invoice value billed, approved waivers, and net receivable billing',
        },
        totalCollectionsReceived: {
          paise: totalCollectionsPaise,
          inr: CurrencyUtil.toInr(totalCollectionsPaise),
          label: 'Total Collections Received',
          description: 'Total cash, UPI, card, and bank remittances collected across billing desks',
        },
      },
      expenseCategoryBreakdown,
      paymentMethodBreakdown,
      receivablesVsPayables: {
        receivablesPaise: outstandingReceivablesPaise,
        receivablesInr: CurrencyUtil.toInr(outstandingReceivablesPaise),
        payablesPaise: totalOutstandingPayablesPaise,
        payablesInr: CurrencyUtil.toInr(totalOutstandingPayablesPaise),
        netWorkingPositionPaise: outstandingReceivablesPaise - totalOutstandingPayablesPaise,
        netWorkingPositionInr: CurrencyUtil.toSignedInr(outstandingReceivablesPaise - totalOutstandingPayablesPaise),
      },
    };
  }

  /**
   * Retrieves the Unified Central Financial Transaction Ledger.
   * Compiles invoices, collections, expenses, payments, and payroll disbursements into a sorted stream.
   */
  async getFinancialLedger(dto: QueryFinancialLedgerDto) {
    const { startDate, endDate } = this.resolveDateRange(
      dto.period,
      dto.startDate,
      dto.endDate,
    );

    const ledger: FinancialLedgerEntry[] = [];

    // 1. Blood Issue Invoices (Accrual / Receivable)
    if (!dto.type || dto.type === FinancialTransactionType.BLOOD_ISSUE_INVOICE) {
      if (!dto.direction || dto.direction === FinancialTransactionDirection.ACCRUAL) {
        const invoices = await this.invoiceModel
          .find({
            invoiceDate: { $gte: startDate, $lte: endDate },
          })
          .sort({ invoiceDate: -1 })
          .lean()
          .exec();

        for (const inv of invoices) {
          ledger.push({
            id: (inv._id as any).toString(),
            date: inv.invoiceDate,
            reference: inv.invoiceNumber,
            type: FinancialTransactionType.BLOOD_ISSUE_INVOICE,
            typeLabel: TRANSACTION_TYPE_LABELS[FinancialTransactionType.BLOOD_ISSUE_INVOICE],
            direction: FinancialTransactionDirection.ACCRUAL,
            category: 'Blood Issue Billing',
            description: `Invoice for ${inv.hospitalName} (Patient: ${inv.patient?.name || 'N/A'})`,
            amountPaise: inv.netPayablePaise,
            amountInr: inv.netPayable,
            status: inv.status,
            sourceLink: `/super-admin/finance/billing`,
          });
        }
      }
    }

    // 2. Blood Issue Collections (Inflow / Money Received)
    if (!dto.type || dto.type === FinancialTransactionType.BLOOD_ISSUE_COLLECTION) {
      if (!dto.direction || dto.direction === FinancialTransactionDirection.INFLOW) {
        const collections = await this.collectionModel
          .find({
            paymentDate: { $gte: startDate, $lte: endDate },
          })
          .sort({ paymentDate: -1 })
          .lean()
          .exec();

        for (const col of collections) {
          ledger.push({
            id: (col._id as any).toString(),
            date: col.paymentDate,
            reference: col.receiptNumber,
            type: FinancialTransactionType.BLOOD_ISSUE_COLLECTION,
            typeLabel: TRANSACTION_TYPE_LABELS[FinancialTransactionType.BLOOD_ISSUE_COLLECTION],
            direction: FinancialTransactionDirection.INFLOW,
            category: 'Patient / Hospital Collection',
            description: `Collection against Invoice ${col.invoiceNumber} (Ref: ${col.referenceNumber})`,
            amountPaise: col.amountPaise,
            amountInr: col.amount,
            paymentMethod: (COLLECTION_PAYMENT_METHOD_LABELS as any)[col.paymentMethod] || col.paymentMethod,
            status: col.isReversed ? 'REVERSED' : 'CONFIRMED',
            sourceLink: `/super-admin/finance/billing`,
          });
        }
      }
    }

    // 3. Operational & Field Expenses (Accrual / Liability)
    if (!dto.type || dto.type === FinancialTransactionType.EXPENSE_LIABILITY) {
      if (!dto.direction || dto.direction === FinancialTransactionDirection.ACCRUAL) {
        const expenses = await this.expenseModel
          .find({
            expenseDate: { $gte: startDate, $lte: endDate },
            isDeleted: false,
          })
          .sort({ expenseDate: -1 })
          .lean()
          .exec();

        for (const exp of expenses) {
          const expPaise = exp.amountPaise || (exp.amount ? CurrencyUtil.toPaise(exp.amount) : 0);
          ledger.push({
            id: (exp._id as any).toString(),
            date: exp.expenseDate,
            reference: exp.expenseCode,
            type: FinancialTransactionType.EXPENSE_LIABILITY,
            typeLabel: TRANSACTION_TYPE_LABELS[FinancialTransactionType.EXPENSE_LIABILITY],
            direction: FinancialTransactionDirection.ACCRUAL,
            category: (EXPENSE_CATEGORY_LABELS as any)[exp.category] || exp.category,
            description: `${exp.title} (Vendor: ${exp.vendorName})`,
            amountPaise: expPaise,
            amountInr: CurrencyUtil.toInr(expPaise),
            status: exp.status,
            sourceLink: `/super-admin/finance/expenses`,
          });
        }
      }
    }

    // 4. Disbursements / Supplier Payments (Outflow)
    if (!dto.type || dto.type === FinancialTransactionType.EXPENSE_PAYMENT) {
      if (!dto.direction || dto.direction === FinancialTransactionDirection.OUTFLOW) {
        const payments = await this.paymentModel
          .find({
            paymentDate: { $gte: startDate, $lte: endDate },
          })
          .sort({ paymentDate: -1 })
          .lean()
          .exec();

        for (const p of payments) {
          ledger.push({
            id: (p._id as any).toString(),
            date: p.paymentDate,
            reference: p.referenceNumber,
            type: FinancialTransactionType.EXPENSE_PAYMENT,
            typeLabel: TRANSACTION_TYPE_LABELS[FinancialTransactionType.EXPENSE_PAYMENT],
            direction: FinancialTransactionDirection.OUTFLOW,
            category: 'Supplier Disbursement',
            description: `Payment to ${p.vendorName}`,
            amountPaise: p.amountPaise,
            amountInr: p.amount,
            paymentMethod: (PAYMENT_METHOD_LABELS as any)[p.paymentMethod] || p.paymentMethod,
            status: p.status,
            sourceLink: `/super-admin/finance/payments`,
          });
        }
      }
    }

    // 5. Salary Disbursements (Outflow)
    if (!dto.type || dto.type === FinancialTransactionType.PAYROLL_DISBURSEMENT) {
      if (!dto.direction || dto.direction === FinancialTransactionDirection.OUTFLOW) {
        const salaryDisb = await this.salaryDisbursementModel
          .find({
            paymentDate: { $gte: startDate, $lte: endDate },
          })
          .sort({ paymentDate: -1 })
          .lean()
          .exec();

        for (const s of salaryDisb) {
          ledger.push({
            id: (s._id as any).toString(),
            date: s.paymentDate,
            reference: s.disbursementNumber,
            type: FinancialTransactionType.PAYROLL_DISBURSEMENT,
            typeLabel: TRANSACTION_TYPE_LABELS[FinancialTransactionType.PAYROLL_DISBURSEMENT],
            direction: FinancialTransactionDirection.OUTFLOW,
            category: 'Payroll & Salaries',
            description: `Salary Payout (Ref: ${s.transactionReference})`,
            amountPaise: s.amountPaise,
            amountInr: s.amount,
            paymentMethod: s.paymentMethod,
            status: 'DISBURSED',
            sourceLink: `/super-admin/payroll`,
          });
        }
      }
    }

    // 6. Blood Acquisition Consignments (Accrual)
    if (!dto.type || dto.type === FinancialTransactionType.BLOOD_ACQUISITION_COST) {
      if (!dto.direction || dto.direction === FinancialTransactionDirection.ACCRUAL) {
        const acquisitions = await this.acquisitionModel
          .find({
            receivedDate: { $gte: startDate, $lte: endDate },
          })
          .sort({ receivedDate: -1 })
          .lean()
          .exec();

        for (const acq of acquisitions) {
          ledger.push({
            id: (acq._id as any).toString(),
            date: acq.receivedDate,
            reference: acq.receiptCode,
            type: FinancialTransactionType.BLOOD_ACQUISITION_COST,
            typeLabel: TRANSACTION_TYPE_LABELS[FinancialTransactionType.BLOOD_ACQUISITION_COST],
            direction: FinancialTransactionDirection.ACCRUAL,
            category: 'External Blood Acquisition',
            description: `Blood receipt from ${acq.sourceName} (${acq.totalUnitsGenerated} units)`,
            amountPaise: acq.totalPayablePaise || 0,
            amountInr: acq.totalPayable || 0,
            status: acq.status,
            sourceLink: `/super-admin/finance/acquisition-costing`,
          });
        }
      }
    }

    // Sort all records chronologically descending
    ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filter by search string if provided
    let filteredLedger = ledger;
    if (dto.search && dto.search.trim()) {
      const q = dto.search.trim().toLowerCase();
      filteredLedger = ledger.filter(
        (item) =>
          item.reference.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.typeLabel.toLowerCase().includes(q),
      );
    }

    // Pagination
    const page = Math.max(1, Number(dto.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(dto.limit) || 20));
    const total = filteredLedger.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const items = filteredLedger.slice(skip, skip + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      period: {
        preset: dto.period || FinancialPeriodPreset.THIS_MONTH,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  /**
   * Generates aggregated daily timeline trends for income vs expenditure.
   */
  async getFinancialTrends(dto: QueryFinancialKpiDto) {
    const { startDate, endDate } = this.resolveDateRange(
      dto.period,
      dto.startDate,
      dto.endDate,
    );

    // Group non-reversed collections by date
    const collections = await this.collectionModel
      .find({
        paymentDate: { $gte: startDate, $lte: endDate },
        isReversed: false,
      })
      .lean()
      .exec();

    // Group expense payments by date
    const payments = await this.paymentModel
      .find({
        paymentDate: { $gte: startDate, $lte: endDate },
        status: PaymentStatus.COMPLETED,
      })
      .lean()
      .exec();

    // Group salary disbursements by date
    const salaryDisb = await this.salaryDisbursementModel
      .find({
        paymentDate: { $gte: startDate, $lte: endDate },
      })
      .lean()
      .exec();

    const trendMap = new Map<string, { inflowPaise: number; outflowPaise: number }>();

    // Helper to format YYYY-MM-DD
    const toDateKey = (d: Date) => new Date(d).toISOString().slice(0, 10);

    for (const c of collections) {
      const k = toDateKey(c.paymentDate);
      const cur = trendMap.get(k) || { inflowPaise: 0, outflowPaise: 0 };
      cur.inflowPaise += c.amountPaise;
      trendMap.set(k, cur);
    }

    for (const p of payments) {
      const k = toDateKey(p.paymentDate);
      const cur = trendMap.get(k) || { inflowPaise: 0, outflowPaise: 0 };
      cur.outflowPaise += p.amountPaise;
      trendMap.set(k, cur);
    }

    for (const s of salaryDisb) {
      const k = toDateKey(s.paymentDate);
      const cur = trendMap.get(k) || { inflowPaise: 0, outflowPaise: 0 };
      cur.outflowPaise += s.amountPaise;
      trendMap.set(k, cur);
    }

    // Sort by date key ascending
    const sortedKeys = Array.from(trendMap.keys()).sort();
    const dataPoints = sortedKeys.map((dateStr) => {
      const val = trendMap.get(dateStr)!;
      return {
        date: dateStr,
        inflowPaise: val.inflowPaise,
        inflowInr: CurrencyUtil.toInr(val.inflowPaise),
        outflowPaise: val.outflowPaise,
        outflowInr: CurrencyUtil.toInr(val.outflowPaise),
        netPaise: val.inflowPaise - val.outflowPaise,
        netInr: CurrencyUtil.toSignedInr(val.inflowPaise - val.outflowPaise),
      };
    });

    return {
      period: {
        preset: dto.period || FinancialPeriodPreset.THIS_MONTH,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      points: dataPoints,
    };
  }

  /**
   * Super Admin operation: Purge all financial transactional data across all financial modules.
   * This clears expenses, disbursement payments, billing invoices, billing collections,
   * monthly payroll batch runs, salary slips, and salary disbursements for fresh testing.
   */
  async purgeAllFinancialData(): Promise<{
    expenses: number;
    payments: number;
    bloodIssueInvoices: number;
    bloodIssueCollections: number;
    monthlyPayrollRuns: number;
    salarySlips: number;
    salaryDisbursements: number;
  }> {
    const [
      delExpenses,
      delPayments,
      delInvoices,
      delCollections,
      delPayrollRuns,
      delSalarySlips,
      delSalaryDisbursements,
    ] = await Promise.all([
      this.expenseModel.deleteMany({}),
      this.paymentModel.deleteMany({}),
      this.invoiceModel.deleteMany({}),
      this.collectionModel.deleteMany({}),
      this.payrollRunModel.deleteMany({}),
      this.salarySlipModel.deleteMany({}),
      this.salaryDisbursementModel.deleteMany({}),
    ]);

    return {
      expenses: delExpenses.deletedCount || 0,
      payments: delPayments.deletedCount || 0,
      bloodIssueInvoices: delInvoices.deletedCount || 0,
      bloodIssueCollections: delCollections.deletedCount || 0,
      monthlyPayrollRuns: delPayrollRuns.deletedCount || 0,
      salarySlips: delSalarySlips.deletedCount || 0,
      salaryDisbursements: delSalaryDisbursements.deletedCount || 0,
    };
  }
}

