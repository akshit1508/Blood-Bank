import { Model } from 'mongoose';
import { ExpenseDocument } from '../schemas/expense.schema';
import { ExpenseAuditEventType, ExpensePaymentStatus } from '../constants/expense.constants';

export interface MigrationSummary {
  totalProcessed: number;
  migratedCount: number;
  quarantinedCount: number;
  skippedCount: number;
  errors: string[];
}

export async function runHistoricalExpenseMigration(
  expenseModel: Model<ExpenseDocument>,
): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    totalProcessed: 0,
    migratedCount: 0,
    quarantinedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  const cursor = expenseModel
    .find({
      $or: [{ amountPaise: { $exists: false } }, { amountPaise: null }],
    })
    .cursor();

  for await (const doc of cursor) {
    summary.totalProcessed++;
    try {
      const hasLegacyPaidAmount = doc.paidAmount && doc.paidAmount > 0;
      const hasPaymentAuditTrail = doc.auditHistory?.some(
        (a) =>
          a.notes?.toLowerCase().includes('paid') ||
          a.notes?.toLowerCase().includes('disbursement'),
      );
      const isMonetarilyInvalid =
        typeof doc.amount !== 'number' || isNaN(doc.amount) || doc.amount < 0.01;

      if (hasLegacyPaidAmount || hasPaymentAuditTrail || isMonetarilyInvalid) {
        // Quarantine suspicious or inconsistent legacy records
        await expenseModel.updateOne(
          { _id: doc._id },
          {
            $set: {
              migrationStatus: 'QUARANTINED_REQUIRES_RECONCILIATION',
              isPaymentLocked: true,
            },
            $push: {
              auditHistory: {
                action: ExpenseAuditEventType.UPDATED,
                performedByName: 'SYSTEM_MIGRATION',
                performedByEmail: 'system@internal',
                timestamp: new Date(),
                notes:
                  'Record quarantined during Phase 3 migration due to existing payment indicators or monetary anomalies.',
              },
            },
          },
        );
        summary.quarantinedCount++;
        continue;
      }

      // Safe clean initialization
      const amountPaise = Math.round(doc.amount * 100);
      await expenseModel.updateOne(
        { _id: doc._id },
        {
          $set: {
            amountPaise,
            paidAmountPaise: 0,
            paidAmount: 0,
            paymentStatus: ExpensePaymentStatus.UNPAID,
            migrationStatus: 'MIGRATED',
          },
        },
      );
      summary.migratedCount++;
    } catch (err: any) {
      summary.errors.push(`Error on expense ${doc._id}: ${err.message}`);
    }
  }

  return summary;
}
