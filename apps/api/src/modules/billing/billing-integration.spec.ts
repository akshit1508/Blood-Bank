import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TariffsService } from './services/tariffs.service';
import { InvoicesService } from './services/invoices.service';
import { CollectionsService } from './services/collections.service';
import { BillingReportsService } from './services/billing-reports.service';
import { BloodIssueTariff } from './schemas/blood-issue-tariff.schema';
import { BloodIssueInvoice } from './schemas/blood-issue-invoice.schema';
import { BloodIssueCollection } from './schemas/blood-issue-collection.schema';
import { BloodIssue } from '../blood-issues/schemas/blood-issue.schema';
import { BloodRequest } from '../../blood-requests/schemas/blood-request.schema';
import { BloodIssueStatus } from '../blood-issues/constants/blood-issue.constants';
import { BloodUnitComponent } from '../blood-units/constants/blood-unit.constants';
import {
  InvoiceStatus,
  CollectionPaymentMethod,
  WaiverCategory,
  ADMIN_MAX_WAIVER_PAISE,
} from './constants/billing.constants';
import { CurrencyUtil } from '../../common/utils/currency.util';

describe('Phase 5 — Billing & Collections Integration Suite', () => {
  let tariffsService: TariffsService;
  let invoicesService: InvoicesService;
  let collectionsService: CollectionsService;
  let reportsService: BillingReportsService;

  let tariffStore: any[] = [];
  let invoiceStore: any[] = [];
  let collectionStore: any[] = [];

  const mockAdminUser = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    email: 'cashier@bloodbank.org',
    role: 'ADMIN',
    fullName: 'Billing Cashier Admin',
  };

  const mockSuperAdmin = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    email: 'superadmin@bloodbank.org',
    role: 'SUPER_ADMIN',
    fullName: 'Chief Finance Officer',
  };

  const mockIssueId = new Types.ObjectId();
  const mockRequestId = new Types.ObjectId();

  const mockBloodIssue: any = {
    _id: mockIssueId,
    issueCode: 'ISS-20261014-TEST',
    bloodRequestId: mockRequestId,
    requestCode: 'REQ-20261014-001',
    status: BloodIssueStatus.COMPLETED,
    issuedUnits: [
      {
        inventoryId: new Types.ObjectId(),
        bloodUnitId: new Types.ObjectId(),
        unitCode: 'UNIT-PRBC-001',
        bloodGroup: 'O+',
        componentType: BloodUnitComponent.PRBC,
        volume: 350,
        status: 'ISSUED',
      },
      {
        inventoryId: new Types.ObjectId(),
        bloodUnitId: new Types.ObjectId(),
        unitCode: 'UNIT-FFP-002',
        bloodGroup: 'O+',
        componentType: BloodUnitComponent.FFP,
        volume: 200,
        status: 'ISSUED',
      },
    ],
  };

  const mockBloodRequest: any = {
    _id: mockRequestId,
    requestCode: 'REQ-20261014-001',
    patient: {
      name: 'Rohan Sharma',
      age: 42,
      gender: 'Male',
      phone: '9876543210',
    },
    hospitalName: 'Apollo Speciality Hospital',
    doctorName: 'Dr. A. Verma',
    hospitalCaseNumber: 'AP-2026-991',
  };

  beforeEach(async () => {
    tariffStore = [
      {
        _id: new Types.ObjectId(),
        componentType: BloodUnitComponent.PRBC,
        processingFeePaise: 145000,
        processingFee: 1450,
        crossmatchFeePaise: 30000,
        crossmatchFee: 300,
        isActive: true,
      },
      {
        _id: new Types.ObjectId(),
        componentType: BloodUnitComponent.FFP,
        processingFeePaise: 40000,
        processingFee: 400,
        crossmatchFeePaise: 0,
        crossmatchFee: 0,
        isActive: true,
      },
    ];
    invoiceStore = [];
    collectionStore = [];

    const mockTariffModel: any = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockImplementation(async () => tariffStore),
        }),
      }),
      findOne: jest.fn().mockImplementation((query: any) => ({
        exec: jest.fn().mockImplementation(async () => {
          return tariffStore.find((t) => t.componentType === query.componentType) || null;
        }),
      })),
      findOneAndUpdate: jest.fn().mockImplementation((filter: any, update: any) => {
        let t = tariffStore.find((item) => item.componentType === filter.componentType);
        if (!t) {
          t = { _id: new Types.ObjectId(), ...filter, ...update.$set, createdAt: new Date() };
          tariffStore.push(t);
        } else {
          Object.assign(t, update.$set, { updatedAt: new Date() });
        }
        return t;
      }),
      create: jest.fn().mockImplementation(async (docs: any) => docs),
    };

    const mockInvoiceModel: any = {
      find: jest.fn().mockImplementation((filter: any) => ({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockImplementation(async () => invoiceStore),
            }),
          }),
          exec: jest.fn().mockImplementation(async () => invoiceStore),
        }),
        exec: jest.fn().mockImplementation(async () => invoiceStore),
      })),
      findOne: jest.fn().mockImplementation((query: any) => ({
        exec: jest.fn().mockImplementation(async () => {
          if (query.issueId) {
            return invoiceStore.find((inv) => inv.issueId?.toString() === query.issueId.toString()) || null;
          }
          if (query.invoiceNumber) {
            return invoiceStore.find((inv) => inv.invoiceNumber === query.invoiceNumber) || null;
          }
          return null;
        }),
      })),
      findById: jest.fn().mockImplementation((id: any) => ({
        exec: jest.fn().mockImplementation(async () => {
          return invoiceStore.find((inv) => inv._id?.toString() === id.toString()) || null;
        }),
      })),
      exists: jest.fn().mockImplementation(async (filter: any) => {
        return invoiceStore.some((inv) => inv.invoiceNumber === filter.invoiceNumber);
      }),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockImplementation(async () => invoiceStore.length),
      }),
      create: jest.fn().mockImplementation(async (docs: any[]) => {
        const created = docs.map((d) => {
          const doc = {
            ...d,
            _id: d._id || new Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            save: jest.fn().mockResolvedValue(true),
          };
          invoiceStore.push(doc);
          return doc;
        });
        return created;
      }),
      findOneAndUpdate: jest.fn().mockImplementation((filter: any, update: any) => {
        const inv = invoiceStore.find((i) => i._id.toString() === filter._id.toString());
        if (!inv) return null;
        if (filter.outstandingPaise && filter.outstandingPaise.$gte) {
          if (inv.outstandingPaise < filter.outstandingPaise.$gte) {
            return null;
          }
        }
        Object.assign(inv, update.$set, { updatedAt: new Date() });
        return inv;
      }),
    };

    const mockCollectionModel: any = {
      find: jest.fn().mockImplementation((filter: any) => ({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockImplementation(async () => collectionStore),
            }),
          }),
          exec: jest.fn().mockImplementation(async () => collectionStore),
        }),
        exec: jest.fn().mockImplementation(async () => collectionStore),
      })),
      findOne: jest.fn().mockImplementation((query: any) => ({
        exec: jest.fn().mockImplementation(async () => {
          if (query.idempotencyKey) {
            return collectionStore.find((c) => c.idempotencyKey === query.idempotencyKey) || null;
          }
          if (query.receiptNumber) {
            return collectionStore.find((c) => c.receiptNumber === query.receiptNumber) || null;
          }
          return null;
        }),
      })),
      findById: jest.fn().mockImplementation((id: any) => ({
        exec: jest.fn().mockImplementation(async () => {
          return collectionStore.find((c) => c._id?.toString() === id.toString()) || null;
        }),
      })),
      exists: jest.fn().mockImplementation(async (filter: any) => {
        return collectionStore.some((c) => c.receiptNumber === filter.receiptNumber);
      }),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockImplementation(async () => collectionStore.length),
      }),
      create: jest.fn().mockImplementation(async (docs: any[]) => {
        const created = docs.map((d) => {
          const doc = {
            ...d,
            _id: d._id || new Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          collectionStore.push(doc);
          return doc;
        });
        return created;
      }),
    };

    const mockBloodIssueModel: any = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBloodIssue),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBloodIssue),
      }),
    };

    const mockBloodRequestModel: any = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBloodRequest),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBloodRequest),
      }),
    };

    const mockConnection: any = {
      startSession: jest.fn().mockResolvedValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TariffsService,
        InvoicesService,
        CollectionsService,
        BillingReportsService,
        { provide: getModelToken(BloodIssueTariff.name), useValue: mockTariffModel },
        { provide: getModelToken(BloodIssueInvoice.name), useValue: mockInvoiceModel },
        { provide: getModelToken(BloodIssueCollection.name), useValue: mockCollectionModel },
        { provide: getModelToken(BloodIssue.name), useValue: mockBloodIssueModel },
        { provide: getModelToken(BloodRequest.name), useValue: mockBloodRequestModel },
        { provide: getConnectionToken(), useValue: mockConnection },
      ],
    }).compile();

    tariffsService = module.get<TariffsService>(TariffsService);
    invoicesService = module.get<InvoicesService>(InvoicesService);
    collectionsService = module.get<CollectionsService>(CollectionsService);
    reportsService = module.get<BillingReportsService>(BillingReportsService);
  });

  describe('Tariffs & Fee Schedule Engine', () => {
    it('should retrieve existing component tariffs', async () => {
      const tariffs = await tariffsService.findAll();
      expect(tariffs.length).toBe(2);
      expect(tariffs[0].processingFee).toBe(1450);
      expect(tariffs[0].crossmatchFee).toBe(300);
    });

    it('should allow Super Admin to update tariff rates', async () => {
      const updated = await tariffsService.updateTariff(
        {
          componentType: BloodUnitComponent.PRBC,
          processingFee: 1500,
          crossmatchFee: 350,
          description: 'Updated NABH rate',
        },
        mockSuperAdmin,
      );

      expect(updated.processingFeePaise).toBe(150000);
      expect(updated.processingFee).toBe(1500);
      expect(updated.crossmatchFeePaise).toBe(35000);
      expect(updated.crossmatchFee).toBe(350);
    });
  });

  describe('Blood Issue Invoicing Flow', () => {
    it('should generate an invoice snapshotting patient, hospital, and exact integer paise line items', async () => {
      const invoice = await invoicesService.generateInvoice(
        mockBloodIssue._id.toString(),
        { applyCrossmatchFee: true },
        mockAdminUser,
      );

      expect(invoice.invoiceNumber).toMatch(/^INV-\d{8}-[A-Z0-9]{4}$/);
      expect(invoice.patient.name).toBe('Rohan Sharma');
      expect(invoice.hospitalName).toBe('Apollo Speciality Hospital');
      expect(invoice.items.length).toBe(2);

      // PRBC: 145000 + 30000 = 175000 paise
      // FFP: 40000 + 0 = 40000 paise
      // Gross Subtotal = 215000 paise (₹2,150.00)
      expect(invoice.subtotalPaise).toBe(215000);
      expect(invoice.subtotal).toBe(2150);
      expect(invoice.netPayablePaise).toBe(215000);
      expect(invoice.outstandingPaise).toBe(215000);
      expect(invoice.status).toBe(InvoiceStatus.PENDING);
    });

    it('should prevent double-invoicing for the same blood issue', async () => {
      await invoicesService.generateInvoice(
        mockBloodIssue._id.toString(),
        { applyCrossmatchFee: true },
        mockAdminUser,
      );

      await expect(
        invoicesService.generateInvoice(
          mockBloodIssue._id.toString(),
          {},
          mockAdminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Payment Collections & Idempotency', () => {
    let generatedInvoice: any;

    beforeEach(async () => {
      generatedInvoice = await invoicesService.generateInvoice(
        mockBloodIssue._id.toString(),
        { applyCrossmatchFee: true },
        mockAdminUser,
      );
    });

    it('should record a partial payment collection and update invoice status to PARTIALLY_COLLECTED', async () => {
      const collection = await collectionsService.recordCollection(
        generatedInvoice.invoiceNumber,
        {
          amount: 1000, // ₹1,000.00 = 100,000 paise
          paymentMethod: CollectionPaymentMethod.UPI,
          referenceNumber: 'UPI/20261014/123456',
          idempotencyKey: 'IDEMP-TEST-001',
        },
        mockAdminUser,
      );

      expect(collection.receiptNumber).toMatch(/^REC-\d{8}-[A-Z0-9]{4}$/);
      expect(collection.amountPaise).toBe(100000);
      expect(collection.amount).toBe(1000);

      const refreshed = await invoicesService.findOne(generatedInvoice.invoiceNumber);
      expect(refreshed.collectedPaise).toBe(100000);
      expect(refreshed.outstandingPaise).toBe(115000); // 215000 - 100000
      expect(refreshed.status).toBe(InvoiceStatus.PARTIALLY_COLLECTED);
    });

    it('should prevent over-collection exceeding outstanding balance', async () => {
      await expect(
        collectionsService.recordCollection(
          generatedInvoice.invoiceNumber,
          {
            amount: 3000, // ₹3,000 > ₹2,150
            paymentMethod: CollectionPaymentMethod.CASH,
            referenceNumber: 'CASH-001',
            idempotencyKey: 'IDEMP-TEST-OVERPAY',
          },
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should idempotently return existing receipt when same idempotencyKey and payload are submitted', async () => {
      const first = await collectionsService.recordCollection(
        generatedInvoice.invoiceNumber,
        {
          amount: 500,
          paymentMethod: CollectionPaymentMethod.CASH,
          referenceNumber: 'CASH-REC-1',
          idempotencyKey: 'IDEMP-REPLAY-KEY',
        },
        mockAdminUser,
      );

      const second = await collectionsService.recordCollection(
        generatedInvoice.invoiceNumber,
        {
          amount: 500,
          paymentMethod: CollectionPaymentMethod.CASH,
          referenceNumber: 'CASH-REC-1',
          idempotencyKey: 'IDEMP-REPLAY-KEY',
        },
        mockAdminUser,
      );

      expect(first.receiptNumber).toBe(second.receiptNumber);
      expect(first.amountPaise).toBe(second.amountPaise);
    });

    it('should reject replay if same idempotencyKey is used with different payload', async () => {
      await collectionsService.recordCollection(
        generatedInvoice.invoiceNumber,
        {
          amount: 500,
          paymentMethod: CollectionPaymentMethod.CASH,
          referenceNumber: 'CASH-REC-1',
          idempotencyKey: 'IDEMP-CONFLICT-KEY',
        },
        mockAdminUser,
      );

      await expect(
        collectionsService.recordCollection(
          generatedInvoice.invoiceNumber,
          {
            amount: 800, // Different amount
            paymentMethod: CollectionPaymentMethod.CARD,
            referenceNumber: 'CARD-DIFF',
            idempotencyKey: 'IDEMP-CONFLICT-KEY',
          },
          mockAdminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should transition invoice to PAID when fully settled', async () => {
      await collectionsService.recordCollection(
        generatedInvoice.invoiceNumber,
        {
          amount: 2150, // Full balance
          paymentMethod: CollectionPaymentMethod.CARD,
          referenceNumber: 'CARD-AUTH-987',
          idempotencyKey: 'IDEMP-SETTLE-FULL',
        },
        mockAdminUser,
      );

      const refreshed = await invoicesService.findOne(generatedInvoice.invoiceNumber);
      expect(refreshed.collectedPaise).toBe(215000);
      expect(refreshed.outstandingPaise).toBe(0);
      expect(refreshed.status).toBe(InvoiceStatus.PAID);
    });
  });

  describe('Waivers & Exemption Authority Gates', () => {
    let generatedInvoice: any;

    beforeEach(async () => {
      generatedInvoice = await invoicesService.generateInvoice(
        mockBloodIssue._id.toString(),
        { applyCrossmatchFee: true },
        mockAdminUser,
      );
    });

    it('should allow standard Admin to apply waiver within threshold (<= ₹500)', async () => {
      const updated = await invoicesService.applyWaiver(
        generatedInvoice.invoiceNumber,
        {
          category: WaiverCategory.DISCRETIONARY_ADMIN,
          amount: 400, // ₹400 <= ₹500 limit
          reason: 'Emergency partial indigent discount approved by on-duty medical officer',
        },
        mockAdminUser,
      );

      expect(updated.waiverPaise).toBe(40000);
      expect(updated.netPayablePaise).toBe(175000); // 215000 - 40000
      expect(updated.outstandingPaise).toBe(175000);
      expect(updated.waivers.length).toBe(1);
      expect(updated.waivers[0].authorizedByRole).toBe('ADMIN');
    });

    it('should reject standard Admin attempting waiver exceeding ₹500', async () => {
      await expect(
        invoicesService.applyWaiver(
          generatedInvoice.invoiceNumber,
          {
            category: WaiverCategory.BPL_CARDHOLDER,
            amount: 1000, // ₹1,000 > ₹500 limit
            reason: 'BPL Cardholder request',
          },
          mockAdminUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Super Admin to apply 100% full exemption', async () => {
      const updated = await invoicesService.applyWaiver(
        generatedInvoice.invoiceNumber,
        {
          category: WaiverCategory.THALASSEMIA_HEMOPHILIA,
          isFullWaiver: true,
          reason: 'Registered Thalassemia Major patient lifelong zero-cost provision',
          documentRef: 'THAL-MAJ-2026-081',
        },
        mockSuperAdmin,
      );

      expect(updated.waiverPaise).toBe(215000);
      expect(updated.netPayablePaise).toBe(0);
      expect(updated.outstandingPaise).toBe(0);
      expect(updated.status).toBe(InvoiceStatus.WAIVED);
    });
  });

  describe('Daily Register & Revenue Analytics', () => {
    it('should compile daily cashier cash book categorized by payment method', async () => {
      const inv = await invoicesService.generateInvoice(
        mockBloodIssue._id.toString(),
        { applyCrossmatchFee: true },
        mockAdminUser,
      );

      await collectionsService.recordCollection(
        inv.invoiceNumber,
        {
          amount: 500,
          paymentMethod: CollectionPaymentMethod.CASH,
          referenceNumber: 'CASH-1',
          idempotencyKey: 'ID-DAY-1',
        },
        mockAdminUser,
      );

      await collectionsService.recordCollection(
        inv.invoiceNumber,
        {
          amount: 600,
          paymentMethod: CollectionPaymentMethod.UPI,
          referenceNumber: 'UPI-1',
          idempotencyKey: 'ID-DAY-2',
        },
        mockAdminUser,
      );

      const register = await reportsService.getDailyRegister();
      expect(register.totalCount).toBe(2);
      expect(register.totalCollectionsAmount).toBe(1100);
      expect(register.byMethod.CASH.totalAmount).toBe(500);
      expect(register.byMethod.UPI.totalAmount).toBe(600);
    });
  });
});
