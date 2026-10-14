import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Connection, Model, Types } from 'mongoose';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as dotenv from 'dotenv';
dotenv.config();

import { BloodAcquisitionsModule } from './blood-acquisitions.module';
import { BloodAcquisitionsService } from './blood-acquisitions.service';
import { BloodAcquisition, BloodAcquisitionDocument } from './schemas/blood-acquisition.schema';
import { BloodUnit, BloodUnitDocument } from '../blood-units/schemas/blood-unit.schema';
import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import { BloodTesting, BloodTestingDocument } from '../testing/schemas/blood-testing.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import { Donor, DonorDocument } from '../donors/schemas/donor.schema';
import { Donation, DonationDocument } from '../donations/schemas/donation.schema';

import { PaymentsService } from '../payments/payments.service';
import { VendorsService } from '../vendors/vendors.service';
import { ExpensesService } from '../expenses/expenses.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsModule } from '../payments/payments.module';
import { VendorsModule } from '../vendors/vendors.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { InventoryModule } from '../inventory/inventory.module';
import { BloodUnitsModule } from '../blood-units/blood-units.module';
import { TestingModule as BloodTestingModule } from '../testing/testing.module';

import { ExternalSourceType, BloodAcquisitionStatus } from './constants/blood-acquisition.constants';
import { BloodGroup } from '../donors/constants/donor.constants';
import { BloodUnitComponent, BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import { ExpenseStatus, ExpensePaymentStatus, ExpenseCategory } from '../expenses/constants/expense.constants';
import { PaymentMethod, PaymentStatus } from '../payments/constants/payment.constants';

import { MongoMemoryReplSet } from 'mongodb-memory-server';

describe('Blood Acquisition MongoDB Replica Set Transaction Audit', () => {
  jest.setTimeout(60000);

  let replSet: MongoMemoryReplSet;
  let moduleRef: TestingModule;
  let connection: Connection;

  let acquisitionsService: BloodAcquisitionsService;
  let paymentsService: PaymentsService;
  let vendorsService: VendorsService;
  let expensesService: ExpensesService;
  let inventoryService: InventoryService;

  let bloodAcquisitionModel: Model<BloodAcquisitionDocument>;
  let bloodUnitModel: Model<BloodUnitDocument>;
  let inventoryModel: Model<InventoryDocument>;
  let testingModel: Model<BloodTestingDocument>;
  let expenseModel: Model<ExpenseDocument>;
  let paymentModel: Model<PaymentDocument>;
  let vendorModel: Model<VendorDocument>;
  let donorModel: Model<DonorDocument>;
  let donationModel: Model<DonationDocument>;

  const adminCreator = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId(),
    email: 'admin.creator@bloodbank.org',
    role: 'ADMIN',
    fullName: 'Admin Consignment Officer',
  };

  const superAdminApprover = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId(),
    email: 'superadmin.approver@bloodbank.org',
    role: 'SUPER_ADMIN',
    fullName: 'Chief Super Admin Approver',
  };

  const labTechStaff = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId(),
    email: 'labtech@bloodbank.org',
    role: 'LAB_TECHNICIAN',
    fullName: 'Lab Technician User',
  };

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      instanceOpts: [{ launchTimeout: 60000 }],
    });
    const mongoUri = replSet.getUri();

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongoUri, {
          dbName: 'blood_bank_acquisition_audit',
        }),
        BloodAcquisitionsModule,
        PaymentsModule,
        VendorsModule,
        ExpensesModule,
        InventoryModule,
        BloodUnitsModule,
        BloodTestingModule,
      ],
    }).compile();

    connection = moduleRef.get<Connection>(getConnectionToken());
    acquisitionsService = moduleRef.get<BloodAcquisitionsService>(BloodAcquisitionsService);
    paymentsService = moduleRef.get<PaymentsService>(PaymentsService);
    vendorsService = moduleRef.get<VendorsService>(VendorsService);
    expensesService = moduleRef.get<ExpensesService>(ExpensesService);
    inventoryService = moduleRef.get<InventoryService>(InventoryService);

    bloodAcquisitionModel = moduleRef.get<Model<BloodAcquisitionDocument>>(getModelToken(BloodAcquisition.name));
    bloodUnitModel = moduleRef.get<Model<BloodUnitDocument>>(getModelToken(BloodUnit.name));
    inventoryModel = moduleRef.get<Model<InventoryDocument>>(getModelToken(Inventory.name));
    testingModel = moduleRef.get<Model<BloodTestingDocument>>(getModelToken(BloodTesting.name));
    expenseModel = moduleRef.get<Model<ExpenseDocument>>(getModelToken(Expense.name));
    paymentModel = moduleRef.get<Model<PaymentDocument>>(getModelToken(Payment.name));
    vendorModel = moduleRef.get<Model<VendorDocument>>(getModelToken(Vendor.name));

    // Ensure collections exist & create unique indexes
    await bloodAcquisitionModel.createCollection();
    await bloodUnitModel.createCollection();
    await inventoryModel.createCollection();
    await expenseModel.createCollection();
    await paymentModel.createCollection();
    await vendorModel.createCollection();

    await bloodAcquisitionModel.collection.createIndex({ idempotencyKey: 1 }, { unique: true });
    await bloodAcquisitionModel.collection.createIndex(
      { sourceName: 1, invoiceNumber: 1, referenceNumber: 1, receivedDate: 1 },
      { unique: true },
    );
  });

  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
    if (replSet) {
      await replSet.stop();
    }
  });

  beforeEach(async () => {
    // Clear test collections between tests
    await bloodAcquisitionModel.deleteMany({});
    await bloodUnitModel.deleteMany({});
    await inventoryModel.deleteMany({});
    await testingModel.deleteMany({});
    await expenseModel.deleteMany({});
    await paymentModel.deleteMany({});
    await vendorModel.deleteMany({});
  });

  describe('Section 2: Real Database Multi-Document Transaction & Intake Audit', () => {
    it('should create acquisition with multiple blood groups/components and generate units exclusively for accepted quantities', async () => {
      const intakeDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'National Red Cross Center',
        invoiceNumber: 'INV-NRC-2026-01',
        referenceNumber: 'REF-NRC-01',
        receivedDate: new Date().toISOString(),
        transportCharges: 500,
        reconciliationNotes: '2 rejected units damaged upon arrival and set aside.',
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 5,
            receivedQuantity: 5,
            acceptedQuantity: 4,
            rejectedQuantity: 1,
            pendingInspectionQuantity: 0,
            rejectionReason: '1 bag damaged during transit',
            testingRequired: true,
            unitCost: 1500,
          },
          {
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.FFP,
            invoicedQuantity: 3,
            receivedQuantity: 3,
            acceptedQuantity: 2,
            rejectedQuantity: 1,
            pendingInspectionQuantity: 0,
            rejectionReason: '1 bag thawed / temperature broken',
            testingRequired: true,
            unitCost: 1200,
          },
        ],
      };

      const result = await acquisitionsService.create(intakeDto, adminCreator);

      // Verify return
      expect(result.totalUnitsCreated).toBe(6); // 4 + 2 accepted = 6
      expect(result.pendingTestingCount).toBe(6);
      expect(result.directInventoryCount).toBe(0);

      // Verify real MongoDB database records
      const dbReceipt = await bloodAcquisitionModel.findById(result.receipt._id).exec();
      expect(dbReceipt).toBeDefined();
      expect(dbReceipt!.status).toBe(BloodAcquisitionStatus.PROCESSING);
      expect(dbReceipt!.hasDiscrepancy).toBe(true);

      const dbUnits = await bloodUnitModel.find({ externalReceiptId: result.receipt._id }).exec();
      expect(dbUnits.length).toBe(6);

      // Verify rejected units generated zero BloodUnit records
      const aPosUnits = dbUnits.filter((u) => u.bloodGroup === BloodGroup.A_POSITIVE);
      const oPosUnits = dbUnits.filter((u) => u.bloodGroup === BloodGroup.O_POSITIVE);
      expect(aPosUnits.length).toBe(4);
      expect(oPosUnits.length).toBe(2);

      // Confirm all testing-required units are in TESTING status and NOT in inventory
      for (const unit of dbUnits) {
        expect(unit.status).toBe(BloodUnitStatus.TESTING);
      }
      const dbInventory = await inventoryModel.find({}).exec();
      expect(dbInventory.length).toBe(0); // Zero units in inventory

      // Confirm linked Expense created in APPROVED in database (fixed acquisition cost auto-approved)
      const dbExpense = await expenseModel.findById((result as any).expense._id).exec();
      expect(dbExpense).toBeDefined();
      expect(dbExpense!.status).toBe(ExpenseStatus.APPROVED);
      // Payable: (5 * 1500) + (3 * 1200) + 500 = 7500 + 3600 + 500 = ₹11,600 (1,160,000 paise)
      expect(dbExpense!.amountPaise).toBe(1160000);
      expect(dbExpense!.paidAmountPaise).toBe(0);
    });

    it('should reject intake when pendingInspectionQuantity > 0 and create zero units', async () => {
      const pendingDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Metro Hospital Blood Bank',
        receivedDate: new Date().toISOString(),
        items: [
          {
            bloodGroup: BloodGroup.B_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 4,
            receivedQuantity: 4,
            acceptedQuantity: 2,
            rejectedQuantity: 1,
            pendingInspectionQuantity: 1, // Incomplete inspection!
            rejectionReason: '1 broken seal',
            testingRequired: true,
          },
        ],
      };

      await expect(acquisitionsService.create(pendingDto, adminCreator)).rejects.toThrow(BadRequestException);

      // Verify no records written to database
      const count = await bloodAcquisitionModel.countDocuments();
      expect(count).toBe(0);
      const unitsCount = await bloodUnitModel.countDocuments();
      expect(unitsCount).toBe(0);
    });

    it('should permit direct intake strictly when 4-point clearance gate is documented and sign-off recorded', async () => {
      const verifiedDirectDto: any = {
        sourceType: ExternalSourceType.GOVERNMENT_BLOOD_CENTRE,
        sourceName: 'Central Government Transfusion Center',
        receivedDate: new Date().toISOString(),
        clearanceCertificateNumber: 'CERT-GOV-2026-888',
        sourceTestingCertified: true,
        clearanceSignoffStaffName: 'Dr. Ramesh Kumar, MD',
        items: [
          {
            bloodGroup: BloodGroup.AB_POSITIVE,
            componentType: BloodUnitComponent.PLATELETS,
            invoicedQuantity: 3,
            receivedQuantity: 3,
            acceptedQuantity: 3,
            rejectedQuantity: 0,
            pendingInspectionQuantity: 0,
            testingRequired: false, // Direct Intake
            unitCost: 1000,
          },
        ],
      };

      const result = await acquisitionsService.create(verifiedDirectDto, adminCreator);
      expect(result.directInventoryCount).toBe(3);
      expect(result.pendingTestingCount).toBe(0);
      expect(result.receipt.status).toBe(BloodAcquisitionStatus.COMPLETED);

      // Verify real Inventory collection contains the 3 units with AVAILABLE status
      const dbInv = await inventoryModel.find({}).exec();
      expect(dbInv.length).toBe(3);
      for (const inv of dbInv) {
        expect(inv.status).toBe(InventoryStatus.AVAILABLE);
      }
    });

    it('should roll back multi-document transaction completely if failure occurs mid-transaction', async () => {
      // Force failure during transaction by passing invalid unit cost that triggers validation or injecting mock error
      jest.spyOn(bloodUnitModel.prototype, 'save').mockImplementationOnce(() => {
        throw new Error('Simulated disk/driver I/O failure during blood unit insertion');
      });

      const intakeDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Rollback Test Bank',
        receivedDate: new Date().toISOString(),
        items: [
          {
            bloodGroup: BloodGroup.O_NEGATIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 3,
            receivedQuantity: 3,
            acceptedQuantity: 3,
            rejectedQuantity: 0,
            pendingInspectionQuantity: 0,
            testingRequired: true,
            unitCost: 2000,
          },
        ],
      };

      await expect(acquisitionsService.create(intakeDto, adminCreator)).rejects.toThrow(
        'Simulated disk/driver I/O failure during blood unit insertion',
      );

      // Restore mock
      jest.restoreAllMocks();

      // Verify atomicity in real database: 0 acquisitions, 0 units, 0 inventory, 0 expenses!
      expect(await bloodAcquisitionModel.countDocuments()).toBe(0);
      expect(await bloodUnitModel.countDocuments()).toBe(0);
      expect(await inventoryModel.countDocuments()).toBe(0);
      expect(await expenseModel.countDocuments()).toBe(0);
    });

    it('should handle idempotency key replay, payload mismatch conflict, and duplicate business invoice rejection', async () => {
      const idempotencyKey = 'uuid-idem-test-999';
      const intakeDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Duplicate Test Bank',
        invoiceNumber: 'INV-DUP-001',
        referenceNumber: 'REF-DUP-001',
        receivedDate: new Date(Date.now() - 3600000).toISOString(),
        items: [
          {
            bloodGroup: BloodGroup.A_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 2,
            receivedQuantity: 2,
            acceptedQuantity: 2,
            rejectedQuantity: 0,
            pendingInspectionQuantity: 0,
            testingRequired: true,
            unitCost: 1000,
          },
        ],
      };

      // 1. Initial creation
      const res1 = await acquisitionsService.create(intakeDto, adminCreator, idempotencyKey);
      expect(res1.isIdempotentReplay).toBe(false);

      // 2. Replay with identical key + identical payload -> returns existing without creating extra units
      const res2 = await acquisitionsService.create(intakeDto, adminCreator, idempotencyKey);
      expect(res2.isIdempotentReplay).toBe(true);
      expect(res2.receipt._id.toString()).toBe(res1.receipt._id.toString());
      expect(await bloodUnitModel.countDocuments()).toBe(2); // Still exactly 2 units!

      // 3. Replay with identical key + DIFFERENT payload -> 409 Conflict
      const alteredDto = { ...intakeDto, notes: 'Altered payload parameters' };
      await expect(acquisitionsService.create(alteredDto, adminCreator, idempotencyKey)).rejects.toThrow(
        ConflictException,
      );

      // 4. Submission with NEW idempotency key but IDENTICAL business invoice -> 409 Conflict (Duplicate Invoice)
      const newKeyDifferentDto = { ...intakeDto };
      await expect(acquisitionsService.create(newKeyDifferentDto, adminCreator, 'different-uuid-key')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('Section 3 & 4: Real Financial Integration, Segregation of Duties & Credit Reconciliations', () => {
    it('should execute full financial lifecycle: ₹10,000 liability, ₹6,000 payment, ₹2,000 credit note, post-payment credit, and ₹2,000 supplier refund receipt reconciliation', async () => {
      // 1. Create registered vendor
      const vendorDoc = new vendorModel({
        name: 'Apex Blood Transfusion Supplies Ltd',
        category: ExpenseCategory.MEDICAL_SUPPLIES,
        contactPerson: 'Apex Account Manager',
        phone: '9876543210',
        isActive: true,
        createdBy: adminCreator.userId,
        createdByName: adminCreator.fullName,
      });
      const vendor = await vendorDoc.save();

      // 2. Admin creates blood acquisition with ₹10,000 payable liability
      const intakeDto: any = {
        sourceType: ExternalSourceType.BLOOD_BANK,
        sourceName: 'Apex Blood Transfusion Supplies Ltd',
        vendorId: vendor._id.toString(),
        invoiceNumber: 'INV-APEX-10000',
        receivedDate: new Date(Date.now() - 7200000).toISOString(),
        transportCharges: 1000,
        items: [
          {
            bloodGroup: BloodGroup.O_POSITIVE,
            componentType: BloodUnitComponent.PRBC,
            invoicedQuantity: 6,
            receivedQuantity: 6,
            acceptedQuantity: 6,
            rejectedQuantity: 0,
            pendingInspectionQuantity: 0,
            testingRequired: true,
            unitCost: 1500, // 6 * 1500 = ₹9,000 + ₹1,000 transport = ₹10,000 total payable
          },
        ],
      };

      const acquisition = await acquisitionsService.create(intakeDto, adminCreator);
      const expenseId = (acquisition as any).expense._id.toString();

      // Attach supplier bill / delivery challan to draft expense before submission
      await expenseModel.findByIdAndUpdate(expenseId, {
        receipt: {
          fileId: 'consignment-bill-apex-10000.pdf',
          originalName: 'Apex-Delivery-Challan-10000.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          uploadedAt: new Date(),
          uploadedBy: adminCreator.userId,
        },
      });

      // 3. Confirm expense was created directly in APPROVED status (fixed acquisition cost auto-approved)
      let dbExp = await expenseModel.findById(expenseId).exec();
      expect(dbExp!.status).toBe(ExpenseStatus.APPROVED);
      expect(dbExp!.amountPaise).toBe(1000000); // ₹10,000.00
      expect(dbExp!.paidAmountPaise).toBe(0);

      // Check initial Outstanding Dues
      let dues = await paymentsService.getOutstandingDues();
      expect(dues.summary.totalOutstandingPaise).toBe(1000000); // ₹10,000

      // 6. Record ₹6,000 payment; outstanding must be ₹4,000
      await paymentsService.recordPayment(
        {
          expenseId,
          amount: 6000,
          paymentMethod: PaymentMethod.NEFT,
          referenceNumber: 'NEFT-STAGE-1',
          paymentDate: '2026-10-14',
          idempotencyKey: 'pay-key-6000',
        },
        superAdminApprover,
      );

      dbExp = await expenseModel.findById(expenseId).exec();
      expect(dbExp!.paidAmountPaise).toBe(600000); // ₹6,000 paid
      expect(dbExp!.paymentStatus).toBe(ExpensePaymentStatus.PARTIALLY_PAID);

      dues = await paymentsService.getOutstandingDues();
      expect(dues.summary.totalOutstandingPaise).toBe(400000); // Exactly ₹4,000 outstanding!

      // 7. Approve a ₹2,000 credit note; effective liability must be ₹8,000 and outstanding ₹2,000
      await acquisitionsService.recordAdjustment(
        acquisition.receipt._id.toString(),
        {
          adjustmentType: 'CREDIT_NOTE',
          creditNoteReference: 'CN-APEX-01',
          amount: 2000,
          reason: 'Defective packaging discovered during intake audit',
        },
        superAdminApprover,
      );

      // Verify payment guards: Attempting to pay ₹3,000 must be rejected because outstanding is only ₹2,000!
      await expect(
        paymentsService.recordPayment(
          {
            expenseId,
            amount: 3000, // Exceeds remaining ₹2,000
            paymentMethod: PaymentMethod.NEFT,
            referenceNumber: 'NEFT-REJECT-EXCEED',
            paymentDate: '2026-10-14',
            idempotencyKey: 'pay-key-exceed',
          },
          superAdminApprover,
        ),
      ).rejects.toThrow(BadRequestException);

      // Verify Outstanding Dues reflects ₹2,000
      dues = await paymentsService.getOutstandingDues();
      expect(dues.summary.totalOutstandingPaise).toBe(200000); // Exactly ₹2,000 outstanding!

      // 8. Attempt to receive a supplier refund right now -> Must be rejected because NO refund is due!
      await expect(
        acquisitionsService.recordAdjustment(
          acquisition.receipt._id.toString(),
          {
            adjustmentType: 'SUPPLIER_REFUND',
            referenceNumber: 'REFUND-PREMATURE',
            amount: 1000,
            reason: 'Attempted premature refund',
          },
          superAdminApprover,
        ),
      ).rejects.toThrow(BadRequestException);

      // 9. Pay the remaining ₹2,000 balance -> Status becomes PAID, outstanding becomes ₹0
      await paymentsService.recordPayment(
        {
          expenseId,
          amount: 2000,
          paymentMethod: PaymentMethod.NEFT,
          referenceNumber: 'NEFT-FINAL-2000',
          paymentDate: '2026-10-14',
          idempotencyKey: 'pay-key-2000',
        },
        superAdminApprover,
      );

      dbExp = await expenseModel.findById(expenseId).exec();
      expect(dbExp!.paymentStatus).toBe(ExpensePaymentStatus.PAID);
      expect(dbExp!.paidAmountPaise).toBe(800000); // ₹8,000 total paid

      // 10. Issue post-payment Credit Note of ₹2,000 (Paid ₹8,000 against new net liability ₹6,000)
      await acquisitionsService.recordAdjustment(
        acquisition.receipt._id.toString(),
        {
          adjustmentType: 'CREDIT_NOTE',
          creditNoteReference: 'CN-POST-PAID-02',
          amount: 2000,
          reason: 'Post-distribution supplier quality settlement',
        },
        superAdminApprover,
      );

      // Check Vendor Ledger: running balance must be -₹2,000 (Supplier owes refund to Blood Bank)
      let ledger = await vendorsService.getLedger(vendor._id.toString());
      expect(ledger.summary.outstandingBalancePaise).toBe(-200000); // Exactly -₹2,000 receivable!

      // 11. Supplier issues formal refund of ₹2,000 to Blood Bank's account.
      // Receive ₹2,000 supplier refund receipt.
      await acquisitionsService.recordAdjustment(
        acquisition.receipt._id.toString(),
        {
          adjustmentType: 'SUPPLIER_REFUND',
          referenceNumber: 'UTR-REFUND-RECEIVED-01',
          amount: 2000,
          reason: 'Bank UTR confirmation for ₹2,000 returned by supplier',
        },
        superAdminApprover,
      );

      // Verify that the refund receipt reduced the receivable back to ₹0, and did NOT reduce net liability again!
      ledger = await vendorsService.getLedger(vendor._id.toString());
      expect(ledger.summary.outstandingBalancePaise).toBe(0); // Perfect reconciliation to ₹0!

      // Further refund attempt must be rejected because receivable is fully settled
      await expect(
        acquisitionsService.recordAdjustment(
          acquisition.receipt._id.toString(),
          {
            adjustmentType: 'SUPPLIER_REFUND',
            referenceNumber: 'UTR-EXCESS-REFUND',
            amount: 500,
            reason: 'Excess refund attempt',
          },
          superAdminApprover,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
