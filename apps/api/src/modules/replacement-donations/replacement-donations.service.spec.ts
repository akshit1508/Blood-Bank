import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types, Model } from 'mongoose';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ReplacementDonationsService } from './replacement-donations.service';
import {
  ReplacementTrackingStatus,
  ReplacementDonorRelationship,
} from './constants/replacement-donation.constants';
import { ReplacementDonation } from './schemas/replacement-donation.schema';
import { BloodRequest } from '../../blood-requests/schemas/blood-request.schema';
import { BloodRequestStatus } from '../../blood-requests/blood-request.constants';
import { Donor } from '../donors/schemas/donor.schema';
import { DonorsService } from '../donors/donors.service';
import { Donation } from '../donations/schemas/donation.schema';
import { BloodUnit } from '../blood-units/schemas/blood-unit.schema';
import { BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('ReplacementDonationsService', () => {
  let service: ReplacementDonationsService;

  const mockBloodRequestId = new Types.ObjectId();
  const mockDonorId = new Types.ObjectId();
  const mockDonationId = new Types.ObjectId();
  const mockBloodUnitId = new Types.ObjectId();

  const mockBloodRequest = {
    _id: mockBloodRequestId,
    requestCode: 'REQ-20261028-TEST',
    patient: { name: 'John Patient', age: 35, gender: 'MALE', phone: '9876543210' },
    bloodGroup: 'O_POSITIVE',
    unitsRequested: 2,
    status: BloodRequestStatus.APPROVED,
  };

  const mockDonor = {
    _id: mockDonorId,
    donorCode: 'DON-20261028-ABCD',
    fullName: 'Jane Relative',
    bloodGroup: 'B_POSITIVE',
    phone: '9123456789',
    deferralStatus: 'NONE',
  };

  const mockDonation = {
    _id: mockDonationId,
    donationCode: 'DON-20261028-1111',
    donorId: mockDonorId,
    status: 'COMPLETED',
  };

  const mockBloodUnit = {
    _id: mockBloodUnitId,
    unitCode: 'UNIT-20261028-U1',
    donationId: mockDonationId,
    status: BloodUnitStatus.APPROVED,
  };

  class MockReplacementModel {
    public data: any;
    constructor(dto: any) {
      this.data = {
        ...dto,
        _id: new Types.ObjectId(),
        save: jest.fn().mockImplementation(async () => this.data),
      };
      return this.data;
    }
    static find = jest.fn();
    static findById = jest.fn();
    static findOne = jest.fn();
    static countDocuments = jest.fn();
    static distinct = jest.fn();
  }

  const mockBloodRequestModel = {
    findById: jest.fn(),
  };

  const mockDonorModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
  };

  const mockDonationModel = {
    findById: jest.fn(),
  };

  const mockBloodUnitModel = {
    findOne: jest.fn(),
  };

  const mockInventoryModel = {
    findOne: jest.fn(),
  };

  const mockDonorsService = {
    create: jest.fn(),
  };

  const mockAuditLogsService = {
    logEvent: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplacementDonationsService,
        {
          provide: getModelToken(ReplacementDonation.name),
          useValue: MockReplacementModel,
        },
        {
          provide: getModelToken(BloodRequest.name),
          useValue: mockBloodRequestModel,
        },
        {
          provide: getModelToken(Donor.name),
          useValue: mockDonorModel,
        },
        {
          provide: getModelToken(Donation.name),
          useValue: mockDonationModel,
        },
        {
          provide: getModelToken(BloodUnit.name),
          useValue: mockBloodUnitModel,
        },
        {
          provide: getModelToken(Inventory.name),
          useValue: mockInventoryModel,
        },
        {
          provide: DonorsService,
          useValue: mockDonorsService,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get<ReplacementDonationsService>(
      ReplacementDonationsService,
    );
  });

  describe('1. Link tracking to an existing Blood Request', () => {
    it('creates tracking case linked to valid request and donor', async () => {
      mockBloodRequestModel.findById.mockResolvedValue(mockBloodRequest);
      mockDonorModel.findById.mockResolvedValue(mockDonor);
      MockReplacementModel.findOne.mockResolvedValue(null);

      const result = await service.createTrackingCase(
        {
          bloodRequestId: mockBloodRequestId.toString(),
          donorId: mockDonorId.toString(),
          relationshipToPatient: ReplacementDonorRelationship.FAMILY,
        },
        { id: 'admin1', fullName: 'Staff One', role: 'ADMIN' },
      );

      expect(result.bloodRequestId).toEqual(mockBloodRequestId);
      expect(result.requestCode).toBe(mockBloodRequest.requestCode);
      expect(result.patientName).toBe('John Patient');
      expect(result.donorName).toBe('Jane Relative');
      expect(result.status).toBe(ReplacementTrackingStatus.DONOR_ASSOCIATED);
      expect(result.timeline.length).toBe(1);
      expect(mockAuditLogsService.logEvent).toHaveBeenCalled();
    });

    it('rejects tracking when BloodRequest is not found', async () => {
      mockBloodRequestModel.findById.mockResolvedValue(null);

      await expect(
        service.createTrackingCase({
          bloodRequestId: new Types.ObjectId().toString(),
          donorId: mockDonorId.toString(),
          relationshipToPatient: ReplacementDonorRelationship.FAMILY,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Associate donor / Register new donor', () => {
    it('registers new donor via DonorsService if newDonor is provided', async () => {
      mockBloodRequestModel.findById.mockResolvedValue(mockBloodRequest);
      mockDonorsService.create.mockResolvedValue({
        success: true,
        donorCode: 'DON-NEW-1234',
        message: 'Registered',
      });
      mockDonorModel.findOne.mockResolvedValue({
        ...mockDonor,
        donorCode: 'DON-NEW-1234',
      });
      MockReplacementModel.findOne.mockResolvedValue(null);

      const result = await service.createTrackingCase({
        bloodRequestId: mockBloodRequestId.toString(),
        newDonor: {
          fullName: 'New Relative',
          phone: '9998887776',
          bloodGroup: 'A_POSITIVE' as any,
          gender: 'FEMALE' as any,
          dateOfBirth: '1995-01-01',
        } as any,
        relationshipToPatient: ReplacementDonorRelationship.FAMILY,
      });

      expect(mockDonorsService.create).toHaveBeenCalled();
      expect(result.donorCode).toBe('DON-NEW-1234');
    });

    it('prevents duplicate active association of same donor to same request', async () => {
      mockBloodRequestModel.findById.mockResolvedValue(mockBloodRequest);
      mockDonorModel.findById.mockResolvedValue(mockDonor);
      MockReplacementModel.findOne.mockResolvedValue({
        trackingCode: 'RPL-20261028-EXIST',
      });

      await expect(
        service.createTrackingCase({
          bloodRequestId: mockBloodRequestId.toString(),
          donorId: mockDonorId.toString(),
          relationshipToPatient: ReplacementDonorRelationship.FAMILY,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('handles deferred donor by setting DONATION_DEFERRED_OR_REJECTED', async () => {
      mockBloodRequestModel.findById.mockResolvedValue(mockBloodRequest);
      mockDonorModel.findById.mockResolvedValue({
        ...mockDonor,
        deferralStatus: 'TEMPORARY',
      });
      MockReplacementModel.findOne.mockResolvedValue(null);

      const result = await service.createTrackingCase({
        bloodRequestId: mockBloodRequestId.toString(),
        donorId: mockDonorId.toString(),
        relationshipToPatient: ReplacementDonorRelationship.FRIEND,
      });

      expect(result.status).toBe(
        ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED,
      );
    });
  });

  describe('3. Link donation lifecycle and validate donor ownership', () => {
    it('rejects linking donation belonging to a different donor', async () => {
      const mockTracking = {
        _id: new Types.ObjectId(),
        donorId: mockDonorId,
        donorCode: 'DON-1',
        status: ReplacementTrackingStatus.DONOR_ASSOCIATED,
        save: jest.fn(),
      };
      MockReplacementModel.findById.mockResolvedValue(mockTracking);
      mockDonationModel.findById.mockResolvedValue({
        _id: mockDonationId,
        donationCode: 'DONATION-99',
        donorId: new Types.ObjectId(), // Different donor!
      });

      await expect(
        service.linkDonation(mockTracking._id.toString(), {
          donationId: mockDonationId.toString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets RELEASED_TO_INVENTORY when donation is COMPLETED, unit is APPROVED, and present in inventory', async () => {
      const mockTracking = {
        _id: new Types.ObjectId(),
        donorId: mockDonorId,
        donorCode: 'DON-1',
        status: ReplacementTrackingStatus.DONOR_ASSOCIATED,
        timeline: [],
        save: jest.fn().mockImplementation(async function () {
          return this;
        }),
      };
      MockReplacementModel.findById.mockResolvedValue(mockTracking);
      mockDonationModel.findById.mockResolvedValue(mockDonation);
      mockBloodUnitModel.findOne.mockResolvedValue(mockBloodUnit);
      mockInventoryModel.findOne.mockResolvedValue({
        _id: new Types.ObjectId(),
        bloodUnitId: mockBloodUnitId,
        status: InventoryStatus.AVAILABLE,
      });

      const updated = await service.linkDonation(mockTracking._id.toString(), {
        donationId: mockDonationId.toString(),
      });

      expect(updated.status).toBe(ReplacementTrackingStatus.RELEASED_TO_INVENTORY);
      expect(updated.bloodUnitId).toEqual(mockBloodUnitId);
    });

    it('sets TESTING_PENDING when unit is APPROVED but supervisor inventory release has not occurred', async () => {
      const mockTracking = {
        _id: new Types.ObjectId(),
        donorId: mockDonorId,
        donorCode: 'DON-1',
        status: ReplacementTrackingStatus.DONOR_ASSOCIATED,
        timeline: [],
        save: jest.fn().mockImplementation(async function () {
          return this;
        }),
      };
      MockReplacementModel.findById.mockResolvedValue(mockTracking);
      mockDonationModel.findById.mockResolvedValue(mockDonation);
      mockBloodUnitModel.findOne.mockResolvedValue(mockBloodUnit);
      mockInventoryModel.findOne.mockResolvedValue(null); // Not yet in inventory

      const updated = await service.linkDonation(mockTracking._id.toString(), {
        donationId: mockDonationId.toString(),
      });

      expect(updated.status).toBe(ReplacementTrackingStatus.TESTING_PENDING);
    });

    it('sets DONATION_DEFERRED_OR_REJECTED when linked blood unit is REJECTED', async () => {
      const mockTracking = {
        _id: new Types.ObjectId(),
        donorId: mockDonorId,
        donorCode: 'DON-1',
        status: ReplacementTrackingStatus.DONOR_ASSOCIATED,
        timeline: [],
        save: jest.fn().mockImplementation(async function () {
          return this;
        }),
      };
      MockReplacementModel.findById.mockResolvedValue(mockTracking);
      mockDonationModel.findById.mockResolvedValue(mockDonation);
      mockBloodUnitModel.findOne.mockResolvedValue({
        ...mockBloodUnit,
        status: BloodUnitStatus.REJECTED,
      });

      const updated = await service.linkDonation(mockTracking._id.toString(), {
        donationId: mockDonationId.toString(),
      });

      expect(updated.status).toBe(
        ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED,
      );
    });

    it('sets TESTING_PENDING when linked blood unit is in TESTING status', async () => {
      const mockTracking = {
        _id: new Types.ObjectId(),
        donorId: mockDonorId,
        donorCode: 'DON-1',
        status: ReplacementTrackingStatus.DONOR_ASSOCIATED,
        timeline: [],
        save: jest.fn().mockImplementation(async function () {
          return this;
        }),
      };
      MockReplacementModel.findById.mockResolvedValue(mockTracking);
      mockDonationModel.findById.mockResolvedValue(mockDonation);
      mockBloodUnitModel.findOne.mockResolvedValue({
        ...mockBloodUnit,
        status: BloodUnitStatus.TESTING,
      });

      const updated = await service.linkDonation(mockTracking._id.toString(), {
        donationId: mockDonationId.toString(),
      });

      expect(updated.status).toBe(ReplacementTrackingStatus.TESTING_PENDING);
    });
  });

  describe('4. STRICT SEPARATION FROM BLOOD ISSUE', () => {
    it('never changes BloodRequest.status or creates inventory reservations', async () => {
      mockBloodRequestModel.findById.mockResolvedValue(mockBloodRequest);
      mockDonorModel.findById.mockResolvedValue(mockDonor);
      MockReplacementModel.findOne.mockResolvedValue(null);

      // Verify initial BloodRequest status
      const initialStatus = mockBloodRequest.status;
      expect(initialStatus).toBe(BloodRequestStatus.APPROVED);

      // Create replacement tracking case
      const tracking = await service.createTrackingCase({
        bloodRequestId: mockBloodRequestId.toString(),
        donorId: mockDonorId.toString(),
        relationshipToPatient: ReplacementDonorRelationship.FAMILY,
      });

      // Assert BloodRequest model is untouched
      expect(mockBloodRequest.status).toBe(initialStatus);
      expect((mockBloodRequest as any).replacementCompleted).toBeUndefined();

      // Blood request unitsRequested and bloodGroup are unaffected
      expect(mockBloodRequest.unitsRequested).toBe(2);
      expect(mockBloodRequest.bloodGroup).toBe('O_POSITIVE');
      expect(tracking.donorBloodGroup).toBe('B_POSITIVE'); // Donor blood group can differ from patient!
    });
  });

  describe('5. Dashboard metrics & Cancellation', () => {
    it('returns database-backed metrics counts', async () => {
      MockReplacementModel.countDocuments
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(10) }) // total
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(6) })  // active
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(2) })  // in progress
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(3) })  // collected
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(4) })  // released
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(1) })  // deferred
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(1) }); // cancelled

      MockReplacementModel.distinct.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([mockDonorId, new Types.ObjectId()]),
      });

      const metrics = await service.getDashboardMetrics();

      expect(metrics.totalCases).toBe(10);
      expect(metrics.activeCases).toBe(6);
      expect(metrics.associatedDonors).toBe(2);
      expect(metrics.donationsInProgress).toBe(2);
      expect(metrics.donationsCollected).toBe(3);
      expect(metrics.releasedDonations).toBe(4);
      expect(metrics.deferredOrRejected).toBe(1);
      expect(metrics.cancelledCases).toBe(1);
    });

    it('cancels replacement tracking and records cancellation reason and timeline', async () => {
      const mockTracking = {
        _id: new Types.ObjectId(),
        trackingCode: 'RPL-CANCEL-1',
        status: ReplacementTrackingStatus.DONOR_ASSOCIATED,
        timeline: [],
        save: jest.fn().mockImplementation(async function () {
          return this;
        }),
      };
      MockReplacementModel.findById.mockResolvedValue(mockTracking);

      const cancelled = await service.cancel(
        mockTracking._id.toString(),
        { cancellationReason: 'Donor relocated out of town' },
        { id: 'admin1', fullName: 'Staff One', role: 'ADMIN' },
      );

      expect(cancelled.status).toBe(ReplacementTrackingStatus.CANCELLED);
      expect(cancelled.cancellationReason).toBe('Donor relocated out of town');
      expect(mockAuditLogsService.logEvent).toHaveBeenCalled();
    });

    it('syncStatus refreshes patient and donor details from source records and catches new deferrals', async () => {
      const mockTracking = {
        _id: new Types.ObjectId(),
        donorId: mockDonorId,
        bloodRequestId: mockBloodRequestId,
        donorCode: 'DON-1',
        donorName: 'Old Jane',
        patientName: 'Old John',
        status: ReplacementTrackingStatus.DONOR_ASSOCIATED,
        timeline: [],
        save: jest.fn().mockImplementation(async function () {
          return this;
        }),
      };
      MockReplacementModel.findById.mockResolvedValue(mockTracking);
      mockDonorModel.findById.mockResolvedValue({
        ...mockDonor,
        fullName: 'Jane Updated',
        deferralStatus: 'TEMPORARY',
      });
      mockBloodRequestModel.findById.mockResolvedValue({
        ...mockBloodRequest,
        patient: { name: 'John Updated', age: 36, gender: 'MALE', phone: '9876543210' },
      });

      const synced = await service.syncStatus(mockTracking._id.toString());
      expect(synced.donorName).toBe('Jane Updated');
      expect(synced.patientName).toBe('John Updated');
      expect(synced.status).toBe(ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED);
    });

    it('findOne dynamically returns fresh donor and patient details from source records', async () => {
      const mockTracking = {
        _id: new Types.ObjectId(),
        donorId: mockDonorId,
        bloodRequestId: mockBloodRequestId,
        donorName: 'Old Jane',
        patientName: 'Old John',
        status: ReplacementTrackingStatus.DONOR_ASSOCIATED,
      };
      MockReplacementModel.findById.mockResolvedValue(mockTracking);
      mockDonorModel.findById.mockResolvedValue({
        ...mockDonor,
        fullName: 'Jane Fresh',
      });
      mockBloodRequestModel.findById.mockResolvedValue({
        ...mockBloodRequest,
        patient: { name: 'John Fresh' },
      });

      const found = await service.findOne(mockTracking._id.toString());
      expect(found.donorName).toBe('Jane Fresh');
      expect(found.patientName).toBe('John Fresh');
    });
  });
});
