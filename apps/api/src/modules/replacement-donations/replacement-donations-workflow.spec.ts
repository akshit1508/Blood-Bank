import { Types } from 'mongoose';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ReplacementDonationsService } from './replacement-donations.service';
import {
  ReplacementTrackingStatus,
  ReplacementDonorRelationship,
} from './constants/replacement-donation.constants';
import { BloodRequestStatus } from '../../blood-requests/blood-request.constants';
import { BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import { AdminRole } from '../auth/schemas/admin-user.schema';

describe('Replacement Donation Tracking End-to-End Workflow & Integrity Suite', () => {
  let service: ReplacementDonationsService;

  // Real in-memory stores to simulate database operations across models
  let trackingStore: any[] = [];
  let bloodRequestsStore: any[] = [];
  let donorsStore: any[] = [];
  let donationsStore: any[] = [];
  let bloodUnitsStore: any[] = [];
  let inventoryStore: any[] = [];
  let crossmatchStore: any[] = [];
  let bloodIssuesStore: any[] = [];
  let invoicesStore: any[] = [];
  let auditLogsStore: any[] = [];

  const staffAdmin = {
    id: new Types.ObjectId().toString(),
    fullName: 'Operational Admin',
    email: 'admin@bloodbank.org',
    role: AdminRole.ADMIN,
  };

  const createMockModel = (store: any[]) => {
    const ModelClass: any = function (doc: any) {
      const instance = {
        ...doc,
        _id: doc._id || new Types.ObjectId(),
        save: jest.fn().mockImplementation(async function () {
          const idx = store.findIndex((x) => x._id.toString() === this._id.toString());
          if (idx >= 0) {
            store[idx] = { ...this };
          } else {
            store.push({ ...this });
          }
          return this;
        }),
      };
      return instance;
    };

    ModelClass.findById = jest.fn().mockImplementation(async (id: any) => {
      const item = store.find((x) => x._id?.toString() === id?.toString());
      if (!item) return null;
      return {
        ...item,
        save: jest.fn().mockImplementation(async function () {
          const idx = store.findIndex((x) => x._id.toString() === this._id.toString());
          if (idx >= 0) store[idx] = { ...this };
          return this;
        }),
      };
    });

    ModelClass.findOne = jest.fn().mockImplementation((query: any) => {
      const execFn = async () => {
        const item = store.find((x) => {
          for (const k of Object.keys(query)) {
            if (k === 'status' && query.status?.$in) {
              if (!query.status.$in.includes(x.status)) return false;
            } else if (k === 'bloodRequestId') {
              if (x.bloodRequestId?.toString() !== query[k]?.toString()) return false;
            } else if (k === 'donorId') {
              if (x.donorId?.toString() !== query[k]?.toString()) return false;
            } else if (k === 'bloodUnitId') {
              if (x.bloodUnitId?.toString() !== query[k]?.toString()) return false;
            } else if (k === 'donationId') {
              if (x.donationId?.toString() !== query[k]?.toString()) return false;
            } else if (k === 'donorCode') {
              if (x.donorCode !== query[k]) return false;
            } else if (x[k] !== query[k]) {
              return false;
            }
          }
          return true;
        });
        if (!item) return null;
        return {
          ...item,
          save: jest.fn().mockImplementation(async function () {
            const idx = store.findIndex((x) => x._id.toString() === this._id.toString());
            if (idx >= 0) store[idx] = { ...this };
            return this;
          }),
        };
      };

      return {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockImplementation(execFn),
        then: (resolve: any, reject: any) => execFn().then(resolve, reject),
      };
    });

    ModelClass.find = jest.fn().mockImplementation((query?: any) => {
      const execFn = async () => {
        if (!query) return store;
        return store.filter((x) => {
          for (const k of Object.keys(query)) {
            if (k === 'status' && query.status?.$ne) {
              if (x.status === query.status.$ne) return false;
            } else if (k === 'status' && query.status?.$in) {
              if (!query.status.$in.includes(x.status)) return false;
            } else if (k === 'bloodRequestId') {
              if (x.bloodRequestId?.toString() !== query[k]?.toString()) return false;
            } else if (k === 'donorId') {
              if (x.donorId?.toString() !== query[k]?.toString()) return false;
            } else if (x[k] !== query[k]) {
              return false;
            }
          }
          return true;
        });
      };
      return {
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockImplementation(execFn),
            }),
          }),
          exec: jest.fn().mockImplementation(execFn),
        }),
        exec: jest.fn().mockImplementation(execFn),
      };
    });

    ModelClass.countDocuments = jest.fn().mockImplementation((query?: any) => ({
      exec: jest.fn().mockImplementation(async () => {
        if (!query) return store.length;
        if (query.status?.$in) {
          return store.filter((x) => query.status.$in.includes(x.status)).length;
        }
        if (query.status) {
          return store.filter((x) => x.status === query.status).length;
        }
        return store.length;
      }),
    }));

    ModelClass.distinct = jest.fn().mockImplementation((field: string) => ({
      exec: jest.fn().mockImplementation(async () => {
        const set = new Set(store.map((x) => x[field]?.toString()));
        return Array.from(set);
      }),
    }));

    return ModelClass;
  };

  const mockReplacementModel = createMockModel(trackingStore);
  const mockBloodRequestModel = createMockModel(bloodRequestsStore);
  const mockDonorModel = createMockModel(donorsStore);
  const mockDonationModel = createMockModel(donationsStore);
  const mockBloodUnitModel = createMockModel(bloodUnitsStore);
  const mockInventoryModel = createMockModel(inventoryStore);
  const mockCrossmatchModel = createMockModel(crossmatchStore);
  const mockBloodIssueModel = createMockModel(bloodIssuesStore);
  const mockInvoiceModel = createMockModel(invoicesStore);

  const mockDonorsService = {
    create: jest.fn().mockImplementation(async (dto: any) => {
      const code = `DON-20261028-${Math.floor(Math.random() * 10000)}`;
      const donorDoc = {
        _id: new Types.ObjectId(),
        donorCode: code,
        fullName: dto.fullName,
        phone: dto.phone,
        bloodGroup: dto.bloodGroup,
        deferralStatus: 'NONE',
      };
      donorsStore.push(donorDoc);
      return { success: true, donorCode: code, message: 'Created' };
    }),
  };

  const mockAuditLogsService = {
    logEvent: jest.fn().mockImplementation(async (log: any) => {
      auditLogsStore.push(log);
      return null;
    }),
  };

  beforeEach(() => {
    trackingStore.length = 0;
    bloodRequestsStore.length = 0;
    donorsStore.length = 0;
    donationsStore.length = 0;
    bloodUnitsStore.length = 0;
    inventoryStore.length = 0;
    crossmatchStore.length = 0;
    bloodIssuesStore.length = 0;
    invoicesStore.length = 0;
    auditLogsStore.length = 0;

    service = new ReplacementDonationsService(
      mockReplacementModel as any,
      mockBloodRequestModel as any,
      mockDonorModel as any,
      mockDonationModel as any,
      mockBloodUnitModel as any,
      mockInventoryModel as any,
      mockCrossmatchModel as any,
      mockBloodIssueModel as any,
      mockInvoiceModel as any,
      mockDonorsService as any,
      mockAuditLogsService as any,
    );
  });

  it('executes full replacement tracking lifecycle without mutating Blood Request or Inventory', async () => {
    // 1. Seed existing Blood Request (APPROVED, 2 units needed, O+)
    const bloodRequest = {
      _id: new Types.ObjectId(),
      requestCode: 'REQ-20261028-TEST',
      patient: { name: 'Arun Sharma', age: 42, gender: 'MALE', phone: '9811223344' },
      bloodGroup: 'O_POSITIVE',
      unitsRequested: 2,
      status: BloodRequestStatus.APPROVED,
    };
    bloodRequestsStore.push(bloodRequest);

    // 2. Seed existing Donor (Relative: Brother, B+)
    const donor1 = {
      _id: new Types.ObjectId(),
      donorCode: 'DON-20261028-BRO1',
      fullName: 'Vikram Sharma',
      bloodGroup: 'B_POSITIVE',
      phone: '9811223355',
      deferralStatus: 'NONE',
    };
    donorsStore.push(donor1);

    // 3. Associate Donor to Request
    const tracking1 = await service.createTrackingCase(
      {
        bloodRequestId: bloodRequest._id.toString(),
        donorId: donor1._id.toString(),
        relationshipToPatient: ReplacementDonorRelationship.FAMILY,
        notes: 'Patient brother Vikram donating',
      },
      staffAdmin,
    );

    expect(tracking1).toBeDefined();
    expect(tracking1.status).toBe(ReplacementTrackingStatus.DONOR_ASSOCIATED);
    expect(tracking1.donorCode).toBe(donor1.donorCode);
    expect(tracking1.patientName).toBe('Arun Sharma');
    expect(tracking1.timeline.length).toBe(1);
    expect(tracking1.timeline[0].event).toBe('CASE_CREATED');

    // 4. Test duplicate active association prevention
    await expect(
      service.createTrackingCase(
        {
          bloodRequestId: bloodRequest._id.toString(),
          donorId: donor1._id.toString(),
          relationshipToPatient: ReplacementDonorRelationship.FAMILY,
        },
        staffAdmin,
      ),
    ).rejects.toThrow(ConflictException);

    // 5. Test multiple distinct replacement donors on same request (e.g. Sister, A+)
    const donor2 = {
      _id: new Types.ObjectId(),
      donorCode: 'DON-20261028-SIS2',
      fullName: 'Pooja Sharma',
      bloodGroup: 'A_POSITIVE',
      phone: '9811223366',
      deferralStatus: 'NONE',
    };
    donorsStore.push(donor2);

    const tracking2 = await service.createTrackingCase(
      {
        bloodRequestId: bloodRequest._id.toString(),
        donorId: donor2._id.toString(),
        relationshipToPatient: ReplacementDonorRelationship.FAMILY,
        notes: 'Patient sister Pooja donating',
      },
      staffAdmin,
    );
    expect(tracking2).toBeDefined();
    expect(tracking2.donorCode).toBe(donor2.donorCode);
    expect(trackingStore.length).toBe(2);

    // 6. Record physical donation for Donor 1 (COMPLETED)
    const donation1 = {
      _id: new Types.ObjectId(),
      donationCode: 'DONATION-20261028-V1',
      donorId: donor1._id,
      donationDate: new Date(),
      status: 'COMPLETED',
      quantity: 1,
    };
    donationsStore.push(donation1);

    // 7. Blood Unit is in TESTING status
    const bloodUnit1 = {
      _id: new Types.ObjectId(),
      unitCode: 'UNIT-20261028-U1',
      donationId: donation1._id,
      donorId: donor1._id,
      status: BloodUnitStatus.TESTING,
    };
    bloodUnitsStore.push(bloodUnit1);

    // 8. Link physical donation to Tracking 1
    const linked = await service.linkDonation(
      (tracking1 as any)._id.toString(),
      { donationId: donation1._id.toString() },
      staffAdmin,
    );
    expect(linked.status).toBe(ReplacementTrackingStatus.TESTING_PENDING);
    expect(linked.bloodUnitId?.toString()).toBe(bloodUnit1._id.toString());

    // 9. Now laboratory testing approves the unit, but supervisor has NOT yet authorized release
    bloodUnit1.status = BloodUnitStatus.APPROVED;
    const syncedBeforeRelease = await service.syncStatus((tracking1 as any)._id.toString());
    // Since it is NOT in inventory yet, status MUST be TESTING_PENDING (awaiting supervisor inventory intake)
    expect(syncedBeforeRelease.status).toBe(ReplacementTrackingStatus.TESTING_PENDING);

    // 10. Supervisor authorizes lab release and inventory intake completes
    inventoryStore.push({
      _id: new Types.ObjectId(),
      bloodUnitId: bloodUnit1._id,
      status: InventoryStatus.AVAILABLE,
    });

    const syncedAfterRelease = await service.syncStatus((tracking1 as any)._id.toString());
    expect(syncedAfterRelease.status).toBe(ReplacementTrackingStatus.RELEASED_TO_INVENTORY);

    // 11. Verify Timeline contains complete audit trail
    const timelineEvents = syncedAfterRelease.timeline.map((t) => t.event);
    expect(timelineEvents).toContain('CASE_CREATED');
    expect(timelineEvents).toContain('DONATION_LINKED');
    expect(timelineEvents).toContain('STATUS_SYNCED');

    // 12. Cancel Tracking 2 with valid reason
    const cancelled = await service.cancel(
      (tracking2 as any)._id.toString(),
      { cancellationReason: 'Donor POOJA felt unwell during pre-donation check' },
      staffAdmin,
    );
    expect(cancelled.status).toBe(ReplacementTrackingStatus.CANCELLED);
    expect(cancelled.cancellationReason).toBe(
      'Donor POOJA felt unwell during pre-donation check',
    );

    // 13. STRICT ISOLATION ASSERTION:
    // Verify that the original BloodRequest was completely untouched
    const freshRequest = await mockBloodRequestModel.findById(bloodRequest._id);
    expect(freshRequest.status).toBe(BloodRequestStatus.APPROVED);
    expect(freshRequest.unitsRequested).toBe(2);
    expect(freshRequest.bloodGroup).toBe('O_POSITIVE');
    expect((freshRequest as any).reservationId).toBeUndefined();
    expect((freshRequest as any).issuedUnits).toBeUndefined();
  });

  it('completes the 5-stage replacement-to-blood-issue workflow with clinical separation (relative B+ donor, patient A+ recipient)', async () => {
    // Stage 1 & 2: Patient requires A+ PRBC, Relative donates B+ blood
    const patientRequest = {
      _id: new Types.ObjectId(),
      requestCode: 'REQ-20261028-APOS',
      patient: { name: 'Kavita Verma', age: 29, gender: 'FEMALE', phone: '9899001122' },
      bloodGroup: 'A_POSITIVE',
      unitsRequested: 1,
      status: BloodRequestStatus.APPROVED,
    };
    bloodRequestsStore.push(patientRequest);

    const relativeDonor = {
      _id: new Types.ObjectId(),
      donorCode: 'DON-20261028-RELB',
      fullName: 'Ramesh Verma',
      bloodGroup: 'B_POSITIVE',
      phone: '9899001133',
      deferralStatus: 'NONE',
    };
    donorsStore.push(relativeDonor);

    // 1. Create tracking case
    const tracking = await service.createTrackingCase(
      {
        bloodRequestId: patientRequest._id.toString(),
        donorId: relativeDonor._id.toString(),
        relationshipToPatient: ReplacementDonorRelationship.FAMILY,
        notes: 'Husband Ramesh donating replacement blood (B+)',
      },
      staffAdmin,
    );
    expect(tracking.status).toBe(ReplacementTrackingStatus.DONOR_ASSOCIATED);
    expect(tracking.donorBloodGroup).toBe('B_POSITIVE');
    expect(tracking.patientBloodGroup).toBe('A_POSITIVE');

    // 2. Relative completes donation
    const relativeDonation = {
      _id: new Types.ObjectId(),
      donationCode: 'DONATION-REL-B01',
      donorId: relativeDonor._id,
      donationDate: new Date(),
      status: 'COMPLETED',
      quantity: 1,
    };
    donationsStore.push(relativeDonation);

    const relativeUnit = {
      _id: new Types.ObjectId(),
      unitCode: 'UNIT-B-POS-888',
      donationId: relativeDonation._id,
      donorId: relativeDonor._id,
      bloodGroup: 'B_POSITIVE',
      status: BloodUnitStatus.APPROVED,
    };
    bloodUnitsStore.push(relativeUnit);

    // Link donation to tracking case
    await service.linkDonation(
      (tracking as any)._id.toString(),
      { donationId: relativeDonation._id.toString() },
      staffAdmin,
    );

    // 3. Inventory release of relative's B+ unit
    inventoryStore.push({
      _id: new Types.ObjectId(),
      bloodUnitId: relativeUnit._id,
      unitCode: relativeUnit.unitCode,
      bloodGroup: 'B_POSITIVE',
      status: InventoryStatus.AVAILABLE,
    });

    // 4. Patient clinical crossmatch for an A+ unit from inventory
    const patientCrossmatchedUnit = {
      _id: new Types.ObjectId(),
      unitCode: 'UNIT-A-POS-999',
      bloodGroup: 'A_POSITIVE',
      status: BloodUnitStatus.APPROVED,
    };
    bloodUnitsStore.push(patientCrossmatchedUnit);

    const crossmatchRecord = {
      _id: new Types.ObjectId(),
      bloodRequestId: patientRequest._id,
      patientBloodGroup: 'A_POSITIVE',
      selectedUnit: {
        bloodUnitId: patientCrossmatchedUnit._id,
        unitCode: patientCrossmatchedUnit.unitCode,
        donorBloodGroup: 'A_POSITIVE',
      },
      status: 'COMPATIBLE',
      createdAt: new Date(),
    };
    crossmatchStore.push(crossmatchRecord);

    // 5. Patient Blood Issue from inventory
    const bloodIssueRecord = {
      _id: new Types.ObjectId(),
      bloodRequestId: patientRequest._id,
      issueCode: 'ISSUE-20261028-001',
      issuedUnits: [
        {
          bloodUnitId: patientCrossmatchedUnit._id,
          unitCode: patientCrossmatchedUnit.unitCode,
          bloodGroup: 'A_POSITIVE',
          status: 'ISSUED',
        },
      ],
      createdAt: new Date(),
    };
    bloodIssuesStore.push(bloodIssueRecord);

    // 6. Patient Billing Invoice
    const invoiceRecord = {
      _id: new Types.ObjectId(),
      bloodRequestId: patientRequest._id,
      invoiceNumber: 'INV-20261028-001',
      status: 'PAID',
      subtotal: 1500,
      waiverAmount: 300,
      collectedAmount: 1200,
      outstandingAmount: 0,
      createdAt: new Date(),
    };
    invoicesStore.push(invoiceRecord);

    // 7. Synchronize tracking and fetch 5-stage trace
    await service.syncStatus((tracking as any)._id.toString(), staffAdmin);
    const trace = await service.getWorkflowTrace((tracking as any)._id.toString());

    // Verify Stage 1: Relative Donation
    expect(trace.relativeDonation.donorBloodGroup).toBe('B_POSITIVE');
    expect(trace.relativeDonation.unitCode).toBe('UNIT-B-POS-888');
    expect(trace.relativeDonation.isReleasedToInventory).toBe(true);

    // Verify Stage 2: Patient & Request
    expect(trace.patientRequest.patientBloodGroup).toBe('A_POSITIVE');
    expect(trace.patientRequest.requestCode).toBe('REQ-20261028-APOS');

    // Verify Stage 3: Crossmatching
    expect(trace.crossmatching.status).toBe('COMPATIBLE');
    expect(trace.crossmatching.selectedInventoryUnit).toBe('UNIT-A-POS-999');

    // Verify Stage 4: Blood Issue
    expect(trace.bloodIssue.issueCode).toBe('ISSUE-20261028-001');
    expect(trace.bloodIssue.issuedUnits.length).toBe(1);
    expect(trace.bloodIssue.issuedUnits[0].unitCode).toBe('UNIT-A-POS-999');

    // Verify Stage 5: Billing & Payments
    expect(trace.payment.invoiceNumber).toBe('INV-20261028-001');
    expect(trace.payment.status).toBe('PAID');
    expect(trace.payment.subtotal).toBe(1500);
    expect(trace.payment.waiverTotal).toBe(300);
    expect(trace.payment.paidAmount).toBe(1200);
    expect(trace.payment.balanceDue).toBe(0);

    // Verify Clinical Separation Guarantee
    expect(trace.separationNotice).toContain('CLINICAL SEPARATION');
    expect(trace.relativeDonation.unitCode).not.toBe(trace.bloodIssue.issuedUnits[0].unitCode);
    expect(trace.relativeDonation.donorBloodGroup).toBe('B_POSITIVE');
    expect(trace.patientRequest.patientBloodGroup).toBe('A_POSITIVE');
  });

  it('guarantees 1-to-1 explicit linkage for multiple replacement cases and prevents indiscriminate unit assignment', async () => {
    // Patient request needing 2 units
    const requestDoc = {
      _id: new Types.ObjectId(),
      requestCode: 'REQ-MULTI-2026',
      patient: { name: 'Deepak Patel', age: 50, gender: 'MALE', phone: '9822334455' },
      bloodGroup: 'B_POSITIVE',
      unitsRequested: 2,
      status: BloodRequestStatus.APPROVED,
    };
    bloodRequestsStore.push(requestDoc);

    // Donor 1 (Relative 1)
    const donor1 = {
      _id: new Types.ObjectId(),
      donorCode: 'DON-REL-1',
      fullName: 'Sanjay Patel',
      bloodGroup: 'O_POSITIVE',
      phone: '9822334466',
      deferralStatus: 'NONE',
    };
    donorsStore.push(donor1);

    // Donor 2 (Relative 2)
    const donor2 = {
      _id: new Types.ObjectId(),
      donorCode: 'DON-REL-2',
      fullName: 'Anita Patel',
      bloodGroup: 'AB_POSITIVE',
      phone: '9822334477',
      deferralStatus: 'NONE',
    };
    donorsStore.push(donor2);

    // Create 2 replacement cases for the same Blood Request
    const case1 = await service.createTrackingCase(
      {
        bloodRequestId: requestDoc._id.toString(),
        donorId: donor1._id.toString(),
        relationshipToPatient: ReplacementDonorRelationship.FAMILY,
        notes: 'First relative donating',
      },
      staffAdmin,
    );

    const case2 = await service.createTrackingCase(
      {
        bloodRequestId: requestDoc._id.toString(),
        donorId: donor2._id.toString(),
        relationshipToPatient: ReplacementDonorRelationship.FAMILY,
        notes: 'Second relative donating',
      },
      staffAdmin,
    );

    expect(case1.issuedBloodUnitId).toBeUndefined();
    expect(case2.issuedBloodUnitId).toBeUndefined();

    // 1. First blood unit issued for the patient (Unit #1)
    const issuedUnit1 = {
      bloodUnitId: new Types.ObjectId(),
      unitCode: 'PATIENT-UNIT-01',
      bloodGroup: 'B_POSITIVE',
      componentType: 'WHOLE_BLOOD',
      status: 'ISSUED',
    };

    const firstIssueRecord = {
      _id: new Types.ObjectId(),
      bloodRequestId: requestDoc._id,
      issueCode: 'ISSUE-MULTI-01',
      issuedUnits: [issuedUnit1],
      createdAt: new Date('2026-10-28T10:00:00Z'),
    };
    bloodIssuesStore.push(firstIssueRecord);

    // Sync Case 1 and Case 2
    const syncedCase1 = await service.syncStatus((case1 as any)._id.toString(), staffAdmin);
    const syncedCase2 = await service.syncStatus((case2 as any)._id.toString(), staffAdmin);

    // Case 1 gets linked to Unit 1
    expect(syncedCase1.issuedUnitCode).toBe('PATIENT-UNIT-01');
    expect(syncedCase1.bloodIssueId?.toString()).toBe(firstIssueRecord._id.toString());

    // Case 2 MUST NOT be linked to Unit 1 (prevents indiscriminate assignment)
    expect(syncedCase2.issuedUnitCode).toBeUndefined();
    expect(syncedCase2.issuedBloodUnitId).toBeUndefined();

    // 2. Second blood unit issued for the patient (Unit #2)
    const issuedUnit2 = {
      bloodUnitId: new Types.ObjectId(),
      unitCode: 'PATIENT-UNIT-02',
      bloodGroup: 'B_POSITIVE',
      componentType: 'WHOLE_BLOOD',
      status: 'ISSUED',
    };

    const secondIssueRecord = {
      _id: new Types.ObjectId(),
      bloodRequestId: requestDoc._id,
      issueCode: 'ISSUE-MULTI-02',
      issuedUnits: [issuedUnit2],
      createdAt: new Date('2026-10-28T11:00:00Z'),
    };
    bloodIssuesStore.push(secondIssueRecord);

    // Re-sync both cases
    const reSyncedCase1 = await service.syncStatus((case1 as any)._id.toString(), staffAdmin);
    const reSyncedCase2 = await service.syncStatus((case2 as any)._id.toString(), staffAdmin);

    // Case 1 retains its original Unit 1
    expect(reSyncedCase1.issuedUnitCode).toBe('PATIENT-UNIT-01');
    expect(reSyncedCase1.issueCode).toBe('ISSUE-MULTI-01');

    // Case 2 now receives the second unclaimed Unit 2
    expect(reSyncedCase2.issuedUnitCode).toBe('PATIENT-UNIT-02');
    expect(reSyncedCase2.issueCode).toBe('ISSUE-MULTI-02');

    // STRICT MULTI-CASE GUARANTEE: The two cases have distinct issued units!
    expect(reSyncedCase1.issuedUnitCode).not.toBe(reSyncedCase2.issuedUnitCode);
  });

  it('strictly isolates replacement tracking cases from issues of other blood requests', async () => {
    // Request A & Request B
    const reqA = {
      _id: new Types.ObjectId(),
      requestCode: 'REQ-ISOLATION-A',
      patient: { name: 'Patient A', age: 30, gender: 'MALE', phone: '9811000001' },
      bloodGroup: 'A_POSITIVE',
      status: BloodRequestStatus.APPROVED,
    };
    const reqB = {
      _id: new Types.ObjectId(),
      requestCode: 'REQ-ISOLATION-B',
      patient: { name: 'Patient B', age: 35, gender: 'FEMALE', phone: '9811000002' },
      bloodGroup: 'B_POSITIVE',
      status: BloodRequestStatus.APPROVED,
    };
    bloodRequestsStore.push(reqA, reqB);

    const donorA = {
      _id: new Types.ObjectId(),
      donorCode: 'DON-A',
      fullName: 'Donor For A',
      bloodGroup: 'O_POSITIVE',
      deferralStatus: 'NONE',
    };
    donorsStore.push(donorA);

    const trackingCaseA = await service.createTrackingCase(
      {
        bloodRequestId: reqA._id.toString(),
        donorId: donorA._id.toString(),
        relationshipToPatient: ReplacementDonorRelationship.FAMILY,
      },
      staffAdmin,
    );

    // An issue occurs ONLY for Request B
    const issueForB = {
      _id: new Types.ObjectId(),
      bloodRequestId: reqB._id,
      issueCode: 'ISSUE-FOR-B-ONLY',
      issuedUnits: [
        {
          bloodUnitId: new Types.ObjectId(),
          unitCode: 'UNIT-B-ONLY',
          bloodGroup: 'B_POSITIVE',
          componentType: 'WHOLE_BLOOD',
          status: 'ISSUED',
        },
      ],
      createdAt: new Date(),
    };
    bloodIssuesStore.push(issueForB);

    // Sync tracking for Request A
    const syncedA = await service.syncStatus((trackingCaseA as any)._id.toString(), staffAdmin);

    // Request A's tracking case MUST NOT associate with Request B's issue
    expect(syncedA.bloodIssueId).toBeUndefined();
    expect(syncedA.issueCode).toBeUndefined();
    expect(syncedA.issuedBloodUnitId).toBeUndefined();
    expect(syncedA.issuedUnitCode).toBeUndefined();
  });
});
