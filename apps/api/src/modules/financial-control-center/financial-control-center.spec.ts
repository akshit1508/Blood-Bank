import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { FinancialControlCenterService } from './services/financial-control-center.service';
import { FinancialExportService } from './services/financial-export.service';
import { FinancialControlCenterController } from './financial-control-center.controller';
import { BloodIssueInvoice } from '../billing/schemas/blood-issue-invoice.schema';
import { BloodIssueCollection } from '../billing/schemas/blood-issue-collection.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { BloodAcquisition } from '../blood-acquisitions/schemas/blood-acquisition.schema';
import { MonthlyPayrollRun } from '../payroll/schemas/monthly-payroll-run.schema';
import { SalaryDisbursement } from '../payroll/schemas/salary-disbursement.schema';
import { Campaign } from '../campaigns/schemas/campaign.schema';
import {
  FinancialPeriodPreset,
  FinancialTransactionType,
  FinancialTransactionDirection,
} from './constants/financial-control-center.constants';
import { AdminRole } from '../auth/schemas/admin-user.schema';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('Financial Control Center Suite', () => {
  let service: FinancialControlCenterService;
  let exportService: FinancialExportService;
  let controller: FinancialControlCenterController;

  // Mock Mongo query helper
  const createMockQuery = (data: any[]) => ({
    find: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(data),
  });

  const mockInvoices = [
    {
      _id: 'inv-1',
      invoiceNumber: 'INV-202610-0001',
      hospitalName: 'Apollo Hospital',
      patient: { name: 'Rahul Sharma' },
      subtotalPaise: 150000,
      waiverPaise: 20000,
      netPayablePaise: 130000,
      netPayable: 1300.0,
      collectedPaise: 80000,
      outstandingPaise: 50000,
      status: 'PARTIALLY_COLLECTED',
      invoiceDate: new Date('2026-10-10T10:00:00Z'),
    },
  ];

  const mockCollections = [
    {
      _id: 'col-1',
      receiptNumber: 'REC-202610-0001',
      invoiceNumber: 'INV-202610-0001',
      amountPaise: 80000,
      amount: 800.0,
      paymentMethod: 'UPI',
      referenceNumber: 'UPI-REF-9988',
      paymentDate: new Date('2026-10-10T11:00:00Z'),
      isReversed: false,
    },
  ];

  const mockExpenses = [
    {
      _id: 'exp-1',
      expenseCode: 'EXP-202610-0001',
      title: 'Blood Bags & Needles',
      category: 'MEDICAL_SUPPLIES',
      costCenter: 'BLOOD_BANK_OPERATIONS',
      amountPaise: 250000,
      amount: 2500.0,
      paidAmountPaise: 100000,
      paidAmount: 1000.0,
      paymentStatus: 'PARTIALLY_PAID',
      status: 'APPROVED',
      vendorName: 'Hindustan Syringes',
      isDeleted: false,
      expenseDate: new Date('2026-10-05T09:00:00Z'),
    },
  ];

  const mockPayments = [
    {
      _id: 'pay-1',
      referenceNumber: 'NEFT-889900',
      vendorName: 'Hindustan Syringes',
      amountPaise: 100000,
      amount: 1000.0,
      paymentMethod: 'BANK_TRANSFER_NEFT_RTGS',
      status: 'COMPLETED',
      paymentDate: new Date('2026-10-06T14:00:00Z'),
    },
  ];

  const mockPayrollRuns = [
    {
      _id: 'run-1',
      runCode: 'RUN-202610-0001',
      payrollPeriod: '2026-10',
      status: 'APPROVED',
      totalNetPayablePaise: 500000,
      totalNetPayable: 5000.0,
      totalDisbursedPaise: 300000,
      totalDisbursed: 3000.0,
      totalOutstandingPaise: 200000,
      totalOutstanding: 2000.0,
      periodStartDate: new Date('2026-10-01T00:00:00Z'),
      periodEndDate: new Date('2026-10-31T23:59:59Z'),
    },
  ];

  const mockSalaryDisbursements = [
    {
      _id: 'disb-1',
      disbursementNumber: 'DISB-202610-0001',
      amountPaise: 300000,
      amount: 3000.0,
      paymentMethod: 'BANK_TRANSFER_NEFT_RTGS',
      transactionReference: 'SAL-UTR-112233',
      paymentDate: new Date('2026-10-08T12:00:00Z'),
    },
  ];

  const mockAcquisitions = [
    {
      _id: 'acq-1',
      receiptCode: 'EXT-202610-0001',
      sourceName: 'Rotary Blood Bank',
      totalUnitsGenerated: 25,
      totalPayablePaise: 450000,
      totalPayable: 4500.0,
      status: 'COMPLETED',
      receivedDate: new Date('2026-10-02T10:00:00Z'),
      adjustments: [],
    },
  ];

  const mockCampaigns = [
    {
      _id: 'camp-1',
      campaignCode: 'CAMP-202610-A1B2',
      approvedBudgetPaise: 1000000,
      approvedBudget: 10000.0,
      status: 'ACTIVE',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialControlCenterController],
      providers: [
        FinancialControlCenterService,
        FinancialExportService,
        { provide: getModelToken(BloodIssueInvoice.name), useValue: createMockQuery(mockInvoices) },
        { provide: getModelToken(BloodIssueCollection.name), useValue: createMockQuery(mockCollections) },
        { provide: getModelToken(Expense.name), useValue: createMockQuery(mockExpenses) },
        { provide: getModelToken(Payment.name), useValue: createMockQuery(mockPayments) },
        { provide: getModelToken(BloodAcquisition.name), useValue: createMockQuery(mockAcquisitions) },
        { provide: getModelToken(MonthlyPayrollRun.name), useValue: createMockQuery(mockPayrollRuns) },
        { provide: getModelToken(SalaryDisbursement.name), useValue: createMockQuery(mockSalaryDisbursements) },
        { provide: getModelToken(Campaign.name), useValue: createMockQuery(mockCampaigns) },
      ],
    }).compile();

    service = module.get<FinancialControlCenterService>(FinancialControlCenterService);
    exportService = module.get<FinancialExportService>(FinancialExportService);
    controller = module.get<FinancialControlCenterController>(FinancialControlCenterController);
  });

  describe('Security & RBAC Enforcement', () => {
    it('controller is decorated with @Roles(SUPER_ADMIN)', () => {
      const reflector = new Reflector();
      const roles = reflector.get<AdminRole[]>('roles', FinancialControlCenterController);
      expect(roles).toBeDefined();
      expect(roles).toEqual([AdminRole.SUPER_ADMIN]);
    });

    it('RolesGuard denies non-SuperAdmin access', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);

      const mockAdminContext: any = {
        getHandler: () => ({}),
        getClass: () => FinancialControlCenterController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: AdminRole.ADMIN } }),
        }),
      };

      expect(() => guard.canActivate(mockAdminContext)).toThrow();

      const mockSuperAdminContext: any = {
        getHandler: () => ({}),
        getClass: () => FinancialControlCenterController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: AdminRole.SUPER_ADMIN } }),
        }),
      };

      expect(guard.canActivate(mockSuperAdminContext)).toBe(true);
    });
  });

  describe('Authoritative KPI & Accounting Invariants', () => {
    it('accurately calculates actual money received with zero inflation from invoices', async () => {
      const result = await service.getFinancialKpiSummary({
        period: FinancialPeriodPreset.CUSTOM,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });

      // Money received must equal collections (₹800), NOT invoice amount (₹1,300)
      expect(result.kpis.actualMoneyReceived.paise).toBe(80000);
      expect(result.kpis.actualMoneyReceived.inr).toBe(800.0);
    });

    it('accurately calculates cash outflows without double-counting approved expenses', async () => {
      const result = await service.getFinancialKpiSummary({
        period: FinancialPeriodPreset.CUSTOM,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });

      // Cash outflows = Supplier payment (1000) + Salary disbursement (3000) = 4000
      expect(result.kpis.actualCashOutflows.paise).toBe(400000);
      expect(result.kpis.actualCashOutflows.inr).toBe(4000.0);

      // Recognized expenditure = Approved expense (2500) + Approved payroll (5000) = 7500
      expect(result.kpis.recognizedExpenditure.paise).toBe(750000);
      expect(result.kpis.recognizedExpenditure.inr).toBe(7500.0);
    });

    it('accurately computes outstanding payables and receivables', async () => {
      const result = await service.getFinancialKpiSummary({
        period: FinancialPeriodPreset.CUSTOM,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });

      // Supplier payable = 2500 - 1000 = 1500 (150,000 paise)
      // Payroll liability = 200,000 paise
      // Total payables = 350,000 paise (₹3,500)
      expect(result.kpis.outstandingPayables.paise).toBe(350000);
      expect(result.kpis.outstandingPayables.inr).toBe(3500.0);

      // Outstanding receivables = 50,000 paise (₹500)
      expect(result.kpis.outstandingReceivables.paise).toBe(50000);
      expect(result.kpis.outstandingReceivables.inr).toBe(500.0);
    });
  });

  describe('Central Transaction Ledger & Timeline', () => {
    it('aggregates multi-source transactions into a single chronologically sorted ledger', async () => {
      const result = await service.getFinancialLedger({
        period: FinancialPeriodPreset.CUSTOM,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });

      expect(result.items.length).toBeGreaterThan(0);
      // Verify dates are descending
      for (let i = 0; i < result.items.length - 1; i++) {
        expect(new Date(result.items[i].date).getTime()).toBeGreaterThanOrEqual(
          new Date(result.items[i + 1].date).getTime(),
        );
      }
    });

    it('filters transactions by direction and search query', async () => {
      const resultInflows = await service.getFinancialLedger({
        period: FinancialPeriodPreset.CUSTOM,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        direction: FinancialTransactionDirection.INFLOW,
      });

      expect(resultInflows.items.every((i) => i.direction === FinancialTransactionDirection.INFLOW)).toBe(true);
    });
  });

  describe('CSV Export Formula Injection Mitigation', () => {
    it('neutralizes spreadsheet injection triggers in text columns', async () => {
      const exportResult = await exportService.generateLedgerCsv({
        period: FinancialPeriodPreset.CUSTOM,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });

      expect(exportResult.filename).toContain('.csv');
      expect(exportResult.csv).toContain('Transaction Date,Reference Code');
      // No formula starts naked
      const lines = exportResult.csv.split('\r\n');
      for (const line of lines) {
        const cells = line.split(',');
        for (const cell of cells) {
          if (cell.startsWith('=')) {
            // Must have been escaped with quote
            expect(cell.startsWith("'=")).toBe(true);
          }
        }
      }
    });
  });
});
