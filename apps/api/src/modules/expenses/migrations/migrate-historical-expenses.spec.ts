import { runHistoricalExpenseMigration } from './migrate-historical-expenses';
import { Types } from 'mongoose';
import { ExpensePaymentStatus } from '../constants/expense.constants';

describe('runHistoricalExpenseMigration', () => {
  let mockExpenseModel: any;

  beforeEach(() => {
    mockExpenseModel = {
      find: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
  });

  it('should initialize clean legacy expenses with amountPaise and UNPAID status', async () => {
    const cleanLegacyExpense = {
      _id: new Types.ObjectId(),
      amount: 1500.5,
      auditHistory: [],
    };

    mockExpenseModel.find.mockReturnValue({
      cursor: jest.fn().mockReturnValue([cleanLegacyExpense]),
    });

    const summary = await runHistoricalExpenseMigration(mockExpenseModel);

    expect(summary.totalProcessed).toBe(1);
    expect(summary.migratedCount).toBe(1);
    expect(summary.quarantinedCount).toBe(0);
    expect(mockExpenseModel.updateOne).toHaveBeenCalledWith(
      { _id: cleanLegacyExpense._id },
      {
        $set: {
          amountPaise: 150050,
          paidAmountPaise: 0,
          paidAmount: 0,
          paymentStatus: ExpensePaymentStatus.UNPAID,
          migrationStatus: 'MIGRATED',
        },
      },
    );
  });

  it('should quarantine legacy expenses with nonzero paid amount or payment indicators', async () => {
    const dirtyLegacyExpense = {
      _id: new Types.ObjectId(),
      amount: 2000.0,
      paidAmount: 500.0, // Existing legacy paid amount indicator
      auditHistory: [{ notes: 'Partial cheque payment recorded offline' }],
    };

    mockExpenseModel.find.mockReturnValue({
      cursor: jest.fn().mockReturnValue([dirtyLegacyExpense]),
    });

    const summary = await runHistoricalExpenseMigration(mockExpenseModel);

    expect(summary.totalProcessed).toBe(1);
    expect(summary.migratedCount).toBe(0);
    expect(summary.quarantinedCount).toBe(1);
    expect(mockExpenseModel.updateOne).toHaveBeenCalledWith(
      { _id: dirtyLegacyExpense._id },
      expect.objectContaining({
        $set: {
          migrationStatus: 'QUARANTINED_REQUIRES_RECONCILIATION',
          isPaymentLocked: true,
        },
      }),
    );
  });
});
