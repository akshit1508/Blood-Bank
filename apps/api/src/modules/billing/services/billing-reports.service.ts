import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BloodIssueCollection,
  BloodIssueCollectionDocument,
} from '../schemas/blood-issue-collection.schema';
import {
  BloodIssueInvoice,
  BloodIssueInvoiceDocument,
} from '../schemas/blood-issue-invoice.schema';
import {
  InvoiceStatus,
  CollectionPaymentMethod,
} from '../constants/billing.constants';
import { CurrencyUtil } from '../../../common/utils/currency.util';

@Injectable()
export class BillingReportsService {
  constructor(
    @InjectModel(BloodIssueCollection.name)
    private readonly collectionModel: Model<BloodIssueCollectionDocument>,
    @InjectModel(BloodIssueInvoice.name)
    private readonly invoiceModel: Model<BloodIssueInvoiceDocument>,
  ) {}

  /**
   * Generates the Daily Day-End Cashier Register / Period Cashier Report.
   */
  async getDailyRegister(
    dateString?: string,
    period?: string,
    startDateStr?: string,
    endDateStr?: string,
  ) {
    const now = new Date();
    let startOfDay: Date;
    let endOfDay: Date;

    if (period === 'yesterday') {
      startOfDay = new Date(now);
      startOfDay.setDate(now.getDate() - 1);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(now);
      endOfDay.setDate(now.getDate() - 1);
      endOfDay.setHours(23, 59, 59, 999);
    } else if (period === 'last_7_days') {
      startOfDay = new Date(now);
      startOfDay.setDate(now.getDate() - 7);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
    } else if (period === 'last_15_days') {
      startOfDay = new Date(now);
      startOfDay.setDate(now.getDate() - 15);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
    } else if (period === 'last_30_days') {
      startOfDay = new Date(now);
      startOfDay.setDate(now.getDate() - 30);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
    } else if (period === 'this_month') {
      startOfDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
    } else if (period === 'previous_month') {
      startOfDay = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endOfDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (startDateStr || endDateStr) {
      startOfDay = startDateStr ? new Date(startDateStr) : new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = endDateStr ? new Date(endDateStr) : new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
    } else {
      const targetDate = dateString ? new Date(dateString) : new Date();
      startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
    }

    const collections = await this.collectionModel
      .find({
        paymentDate: { $gte: startOfDay, $lte: endOfDay },
        isReversed: false,
      })
      .sort({ paymentDate: -1 })
      .exec();

    let totalCollectionsPaise = 0;
    const byMethod: Record<
      CollectionPaymentMethod,
      { count: number; totalPaise: number; totalAmount: number }
    > = {
      [CollectionPaymentMethod.CASH]: { count: 0, totalPaise: 0, totalAmount: 0 },
      [CollectionPaymentMethod.UPI]: { count: 0, totalPaise: 0, totalAmount: 0 },
      [CollectionPaymentMethod.CARD]: { count: 0, totalPaise: 0, totalAmount: 0 },
      [CollectionPaymentMethod.NEFT_RTGS]: { count: 0, totalPaise: 0, totalAmount: 0 },
      [CollectionPaymentMethod.HOSPITAL_CREDIT]: { count: 0, totalPaise: 0, totalAmount: 0 },
    };

    for (const c of collections) {
      totalCollectionsPaise += c.amountPaise;
      const method = c.paymentMethod as CollectionPaymentMethod;
      if (byMethod[method]) {
        byMethod[method].count++;
        byMethod[method].totalPaise += c.amountPaise;
        byMethod[method].totalAmount = CurrencyUtil.toInr(byMethod[method].totalPaise);
      }
    }

    const totalCash = byMethod[CollectionPaymentMethod.CASH]?.totalAmount || 0;
    const totalDigital =
      (byMethod[CollectionPaymentMethod.UPI]?.totalAmount || 0) +
      (byMethod[CollectionPaymentMethod.CARD]?.totalAmount || 0) +
      (byMethod[CollectionPaymentMethod.NEFT_RTGS]?.totalAmount || 0);
    const totalCollected = CurrencyUtil.toInr(totalCollectionsPaise);

    const mappedTransactions = collections.map((c) => ({
      _id: (c._id as any).toString(),
      receiptNumber: c.receiptNumber,
      invoiceNumber: c.invoiceNumber,
      amount: c.amount,
      paymentMethod: c.paymentMethod,
      referenceNumber: c.referenceNumber,
      paymentDate: c.paymentDate,
      createdAt: c.paymentDate || (c as any).createdAt,
      collectedByName: c.collectedByName,
    }));

    return {
      date: startOfDay.toISOString().slice(0, 10),
      startDate: startOfDay.toISOString().slice(0, 10),
      endDate: endOfDay.toISOString().slice(0, 10),
      period: period || 'custom',
      totalCount: collections.length,
      transactionCount: collections.length,
      totalCollectionsPaise,
      totalCollectionsAmount: totalCollected,
      totalCollected,
      totalCash,
      totalDigital,
      byMethod,
      collections: mappedTransactions,
      transactions: mappedTransactions,
    };
  }

  /**
   * Aggregates platform-wide billing and revenue summary metrics.
   */
  async getRevenueSummary() {
    const [invoices, todayRegister] = await Promise.all([
      this.invoiceModel.find({ status: { $ne: InvoiceStatus.CANCELLED } }).exec(),
      this.getDailyRegister(),
    ]);

    let totalInvoicedPaise = 0;
    let totalWaivedPaise = 0;
    let totalCollectedPaise = 0;
    let totalOutstandingPaise = 0;

    let pendingCount = 0;
    let partialCount = 0;
    let paidCount = 0;
    let waivedCount = 0;

    for (const inv of invoices) {
      totalInvoicedPaise += inv.subtotalPaise;
      totalWaivedPaise += inv.waiverPaise;
      totalCollectedPaise += inv.collectedPaise;
      totalOutstandingPaise += inv.outstandingPaise;

      switch (inv.status) {
        case InvoiceStatus.PENDING:
          pendingCount++;
          break;
        case InvoiceStatus.PARTIALLY_COLLECTED:
          partialCount++;
          break;
        case InvoiceStatus.PAID:
          paidCount++;
          break;
        case InvoiceStatus.WAIVED:
          waivedCount++;
          break;
      }
    }

    return {
      totalInvoicesCount: invoices.length,
      pendingCount,
      partialCount,
      paidCount,
      waivedCount,
      totalInvoicedPaise,
      totalInvoicedAmount: CurrencyUtil.toInr(totalInvoicedPaise),
      totalWaivedPaise,
      totalWaivedAmount: CurrencyUtil.toInr(totalWaivedPaise),
      totalCollectedPaise,
      totalCollectedAmount: CurrencyUtil.toInr(totalCollectedPaise),
      totalOutstandingPaise,
      totalOutstandingAmount: CurrencyUtil.toInr(totalOutstandingPaise),
      todayCollectionsAmount: todayRegister.totalCollectionsAmount,
      todayCollectionsCount: todayRegister.totalCount,
    };
  }
}
