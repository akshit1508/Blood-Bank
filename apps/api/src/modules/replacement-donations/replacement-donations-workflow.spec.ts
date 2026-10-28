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
      const item = store.find((x) => x._id.toString() === id.toString());
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

    ModelClass.findOne = jest.fn().mockImplementation(async (query: any) => {
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
    });

    ModelClass.find = jest.fn().mockImplementation(() => ({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockImplementation(async () => store),
          }),
        }),
        exec: jest.fn().mockImplementation(async () => store),
      }),
    }));

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
    auditLogsStore.length = 0;

    service = new ReplacementDonationsService(
      mockReplacementModel as any,
      mockBloodRequestModel as any,
      mockDonorModel as any,
      mockDonationModel as any,
      mockBloodUnitModel as any,
      mockInventoryModel as any,
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
});
