import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CrossmatchingService } from './crossmatching.service';
import { CrossmatchRecord } from './schemas/crossmatch-record.schema';
import { BloodRequest } from '../../blood-requests/schemas/blood-request.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { BloodUnit } from '../blood-units/schemas/blood-unit.schema';
import { ReservationsService } from '../reservations/reservations.service';
import { BloodIssuesService } from '../blood-issues/blood-issues.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CrossmatchStatus,
  SampleCondition,
  AntibodyScreenResult,
  CrossmatchMethod,
  CrossmatchResult,
  ReviewDecision,
  RBC_COMPATIBILITY_MATRIX,
  checkTheoreticalRbcEligibility,
  isRbcComponent,
} from './constants/crossmatching.constants';
import { BloodRequestStatus } from '../../blood-requests/blood-request.constants';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import { BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';

describe('CrossmatchingService Unit & Clinical Safety Suite', () => {
  let service: CrossmatchingService;
  let mockCrossmatchModel: any;
  let mockBloodRequestModel: any;
  let mockInventoryModel: any;
  let mockBloodUnitModel: any;
  let mockReservationsService: any;
  let mockBloodIssuesService: any;
  let mockAuditLogsService: any;

  const mockAdminActor = {
    _id: '507f191e810c19729de860ea',
    fullName: 'Dr. Sarah Connor',
    email: 'sarah.connor@bloodbank.org',
    role: 'ADMIN',
  };

  const mockLabTechActor = {
    _id: '507f191e810c19729de860eb',
    fullName: 'John Technician',
    email: 'john.tech@bloodbank.org',
    role: 'LAB_TECHNICIAN',
  };

  beforeEach(async () => {
    mockCrossmatchModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
      findOne: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
    };

    mockBloodRequestModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
    };

    mockInventoryModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
      findById: jest.fn(),
    };

    mockBloodUnitModel = {
      findById: jest.fn(),
    };

    mockReservationsService = {
      createReservation: jest.fn(),
      cancelReservation: jest.fn(),
    };

    mockBloodIssuesService = {
      issueReservation: jest.fn(),
    };

    mockAuditLogsService = {
      logEvent: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrossmatchingService,
        {
          provide: getModelToken(CrossmatchRecord.name),
          useValue: mockCrossmatchModel,
        },
        {
          provide: getModelToken(BloodRequest.name),
          useValue: mockBloodRequestModel,
        },
        {
          provide: getModelToken(Inventory.name),
          useValue: mockInventoryModel,
        },
        {
          provide: getModelToken(BloodUnit.name),
          useValue: mockBloodUnitModel,
        },
        {
          provide: ReservationsService,
          useValue: mockReservationsService,
        },
        {
          provide: BloodIssuesService,
          useValue: mockBloodIssuesService,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get<CrossmatchingService>(CrossmatchingService);
  });

  describe('Section 1: ABO/RhD Red Blood Cell Compatibility Reference Rules', () => {
    it('should verify all eight ABO/RhD patient blood groups according to the RBC reference', () => {
      // O- can only receive O-
      expect(RBC_COMPATIBILITY_MATRIX['O-']).toEqual(['O-']);

      // O+ can receive O- and O+
      expect(RBC_COMPATIBILITY_MATRIX['O+']).toEqual(['O-', 'O+']);

      // A- can receive O- and A-
      expect(RBC_COMPATIBILITY_MATRIX['A-']).toEqual(['O-', 'A-']);

      // A+ can receive O-, O+, A-, A+
      expect(RBC_COMPATIBILITY_MATRIX['A+']).toEqual(['O-', 'O+', 'A-', 'A+']);

      // B- can receive O- and B-
      expect(RBC_COMPATIBILITY_MATRIX['B-']).toEqual(['O-', 'B-']);

      // B+ can receive O-, O+, B-, B+
      expect(RBC_COMPATIBILITY_MATRIX['B+']).toEqual(['O-', 'O+', 'B-', 'B+']);

      // AB- can receive O-, A-, B-, AB-
      expect(RBC_COMPATIBILITY_MATRIX['AB-']).toEqual(['O-', 'A-', 'B-', 'AB-']);

      // AB+ is universal RBC recipient (all 8 groups)
      expect(RBC_COMPATIBILITY_MATRIX['AB+']).toEqual([
        'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+',
      ]);
    });

    it('should correctly separate RBC/PRBC from Plasma (FFP) and Platelets', () => {
      expect(isRbcComponent('PRBC')).toBe(true);
      expect(isRbcComponent('WHOLE_BLOOD')).toBe(false);
      expect(isRbcComponent('FFP')).toBe(false);
      expect(isRbcComponent('PLATELETS')).toBe(false);
    });

    it('should accurately evaluate theoretical RBC eligibility', () => {
      const match1 = checkTheoreticalRbcEligibility('A+', 'O-');
      expect(match1.eligible).toBe(true);

      const match2 = checkTheoreticalRbcEligibility('O-', 'A+');
      expect(match2.eligible).toBe(false);
      expect(match2.reason).toContain('Incompatible');
    });
  });

  describe('Section 2: Patient Sample Verification Safety Gates', () => {
    it('should reject sample and transition to INVALID_SAMPLE if tube is hemolyzed or defective', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        crossmatchCode: 'XM-20261026-TEST',
        status: CrossmatchStatus.PENDING_SAMPLE_VERIFICATION,
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      const result = await service.verifySample(
        '607f191e810c19729de86001',
        {
          sampleId: 'SMP-101',
          sampleCollectedAt: new Date(Date.now() - 3600000).toISOString(),
          sampleReceivedAt: new Date().toISOString(),
          sampleCondition: SampleCondition.HEMOLYZED,
          sampleIdentityVerified: true,
          verifiedAboRh: 'A+',
          antibodyScreenResult: AntibodyScreenResult.NEGATIVE,
        },
        mockLabTechActor,
      );

      expect(result.status).toBe(CrossmatchStatus.INVALID_SAMPLE);
      expect(result.sample.isSampleValid).toBe(false);
    });

    it('should reject sample if patient identity wristband/tube mismatch occurs', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        crossmatchCode: 'XM-20261026-TEST',
        status: CrossmatchStatus.PENDING_SAMPLE_VERIFICATION,
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      const result = await service.verifySample(
        '607f191e810c19729de86001',
        {
          sampleId: 'SMP-102',
          sampleCollectedAt: new Date(Date.now() - 3600000).toISOString(),
          sampleReceivedAt: new Date().toISOString(),
          sampleCondition: SampleCondition.VALID,
          sampleIdentityVerified: false, // MISMATCH
          verifiedAboRh: 'A+',
          antibodyScreenResult: AntibodyScreenResult.NEGATIVE,
        },
        mockLabTechActor,
      );

      expect(result.status).toBe(CrossmatchStatus.INVALID_SAMPLE);
      expect(result.sample.sampleIdentityVerified).toBe(false);
    });

    it('should accept valid sample and transition status to SAMPLE_VERIFIED', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        crossmatchCode: 'XM-20261026-TEST',
        status: CrossmatchStatus.PENDING_SAMPLE_VERIFICATION,
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      const result = await service.verifySample(
        '607f191e810c19729de86001',
        {
          sampleId: 'SMP-103',
          sampleCollectedAt: new Date(Date.now() - 3600000).toISOString(),
          sampleReceivedAt: new Date().toISOString(),
          sampleCondition: SampleCondition.VALID,
          sampleIdentityVerified: true,
          verifiedAboRh: 'A+',
          antibodyScreenResult: AntibodyScreenResult.NEGATIVE,
        },
        mockLabTechActor,
      );

      expect(result.status).toBe(CrossmatchStatus.SAMPLE_VERIFIED);
      expect(result.sample.isSampleValid).toBe(true);
    });
  });

  describe('Section 3: Unit Selection & Candidate Evaluation Gates', () => {
    it('should block unit selection if patient sample is not valid', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        status: CrossmatchStatus.PENDING_SAMPLE_VERIFICATION,
        sample: { isSampleValid: false },
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      await expect(
        service.selectUnit('607f191e810c19729de86001', { inventoryId: 'inv-123' }, mockLabTechActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block unit if physical blood unit is not APPROVED (e.g. still in quarantine or testing)', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        status: CrossmatchStatus.SAMPLE_VERIFIED,
        patientBloodGroup: 'A+',
        requestedComponent: 'PRBC',
        sample: { isSampleValid: true },
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      const mockInventoryItem: any = {
        _id: 'inv-123',
        status: InventoryStatus.AVAILABLE,
        bloodUnitId: {
          _id: 'unit-123',
          unitCode: 'UNIT-20261020-001',
          bloodGroup: 'A+',
          componentType: 'PRBC',
          status: BloodUnitStatus.TESTING, // NOT APPROVED
        },
      };

      mockInventoryModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockInventoryItem),
        }),
      });

      await expect(
        service.selectUnit('607f191e810c19729de86001', { inventoryId: 'inv-123' }, mockLabTechActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block unit if component type does not match requested component', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        status: CrossmatchStatus.SAMPLE_VERIFIED,
        patientBloodGroup: 'A+',
        requestedComponent: 'PRBC',
        sample: { isSampleValid: true },
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      const mockInventoryItem: any = {
        _id: 'inv-123',
        status: InventoryStatus.AVAILABLE,
        bloodUnitId: {
          _id: 'unit-123',
          unitCode: 'UNIT-20261020-002',
          bloodGroup: 'A+',
          componentType: 'FFP', // MISMATCH
          status: BloodUnitStatus.APPROVED,
        },
      };

      mockInventoryModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockInventoryItem),
        }),
      });

      await expect(
        service.selectUnit('607f191e810c19729de86001', { inventoryId: 'inv-123' }, mockLabTechActor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Section 4: Laboratory Test Recording & Independent Authorization Gate', () => {
    it('should record COMPATIBLE result and place in RESULT_RECORDED awaiting review', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        status: CrossmatchStatus.UNIT_SELECTED,
        sample: { isSampleValid: true },
        selectedUnit: { bloodUnitId: 'unit-123', unitCode: 'UNIT-001' },
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      const result = await service.recordResult(
        '607f191e810c19729de86001',
        {
          testMethod: CrossmatchMethod.GEL_CARD,
          testPhases: ['AHG_PHASE'],
          crossmatchResult: CrossmatchResult.COMPATIBLE,
          reactionGrade: '0',
        },
        mockLabTechActor,
      );

      expect(result.status).toBe(CrossmatchStatus.RESULT_RECORDED);
      expect(result.laboratoryTest.crossmatchResult).toBe(CrossmatchResult.COMPATIBLE);
    });

    it('should enforce independent review policy: reject technician self-authorization', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        status: CrossmatchStatus.RESULT_RECORDED,
        laboratoryTest: {
          testedBy: mockLabTechActor._id, // Performed by John
          crossmatchResult: CrossmatchResult.COMPATIBLE,
        },
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      // Same technician John attempts to approve his own test
      await expect(
        service.reviewAndAuthorize(
          '607f191e810c19729de86001',
          {
            reviewDecision: ReviewDecision.COMPATIBLE_AUTHORIZED,
            reviewNotes: 'Looks good to me',
          },
          mockLabTechActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow independent reviewer/supervisor to authorize compatible crossmatch', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        status: CrossmatchStatus.RESULT_RECORDED,
        laboratoryTest: {
          testedBy: mockLabTechActor._id, // Performed by John
          crossmatchResult: CrossmatchResult.COMPATIBLE,
        },
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      // Independent reviewer Dr. Sarah Connor reviews John's test
      const result = await service.reviewAndAuthorize(
        '607f191e810c19729de86001',
        {
          reviewDecision: ReviewDecision.COMPATIBLE_AUTHORIZED,
          reviewNotes: 'Negative AHG confirmed on gel card. Authorized for patient issue.',
        },
        mockAdminActor,
      );

      expect(result.status).toBe(CrossmatchStatus.AUTHORIZED_COMPATIBLE);
      expect(result.review.reviewDecision).toBe(ReviewDecision.COMPATIBLE_AUTHORIZED);
    });

    it('should block routine issue before clinical authorization is complete', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        status: CrossmatchStatus.RESULT_RECORDED, // NOT YET AUTHORIZED_COMPATIBLE
        selectedUnit: { inventoryId: 'inv-123' },
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      await expect(
        service.reserveUnit('607f191e810c19729de86001', {}, mockAdminActor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Section 5: Integration with Reservations & Blood Issues', () => {
    it('should integrate with ReservationsService when unit is AUTHORIZED_COMPATIBLE', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        status: CrossmatchStatus.AUTHORIZED_COMPATIBLE,
        bloodRequestId: 'req-123',
        selectedUnit: { inventoryId: 'inv-123', unitCode: 'UNIT-001' },
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      mockBloodRequestModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'req-123',
          status: BloodRequestStatus.APPROVED,
          save: jest.fn().mockResolvedValue(true),
        }),
      });

      mockReservationsService.createReservation.mockResolvedValue({
        _id: 'res-123',
        reservationCode: 'RES-20261026-A101',
      });

      const result = await service.reserveUnit('607f191e810c19729de86001', {}, mockAdminActor);

      expect(mockReservationsService.createReservation).toHaveBeenCalledWith(
        'req-123',
        { inventoryIds: ['inv-123'], allowCompatibleBloodGroup: true },
        mockAdminActor,
      );
      expect(result.status).toBe(CrossmatchStatus.RESERVED);
      expect(result.reservationCode).toBe('RES-20261026-A101');
    });

    it('should integrate with BloodIssuesService to issue reserved unit', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        crossmatchCode: 'XM-20261026-001',
        status: CrossmatchStatus.RESERVED,
        reservationId: 'res-123',
        patient: { name: 'Alice Patient', hospitalCaseNumber: 'HC-9988' },
        selectedUnit: { unitCode: 'UNIT-001' },
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      mockBloodIssuesService.issueReservation.mockResolvedValue({
        _id: 'iss-123',
        issueCode: 'ISS-20261026-B202',
      });

      const result = await service.issueUnit(
        '607f191e810c19729de86001',
        { recipientName: 'Alice Patient', issueNotes: 'Clinical issue for surgery' },
        mockAdminActor,
      );

      expect(mockBloodIssuesService.issueReservation).toHaveBeenCalled();
      expect(result.status).toBe(CrossmatchStatus.ISSUED);
      expect(result.issueCode).toBe('ISS-20261026-B202');
    });
  });

  describe('Section 6: Rigorous Transfusion Compatibility & Clinical Safety Regression Suite', () => {
    // Scenario 1: O+ patient with O- RBC/PRBC unit
    it('Scenario 1: should allow O- PRBC unit for O+ patient and reserve with allowCompatibleBloodGroup: true', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86001',
        crossmatchCode: 'XM-20261026-001',
        status: CrossmatchStatus.AUTHORIZED_COMPATIBLE,
        bloodRequestId: 'req-101',
        patientBloodGroup: 'O+',
        requestedComponent: 'PRBC',
        selectedUnit: {
          inventoryId: 'inv-prbc-o-minus',
          unitCode: 'UNIT-PRBC-O-MINUS',
          donorBloodGroup: 'O-',
          componentType: 'PRBC',
        },
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      mockBloodRequestModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'req-101',
          bloodGroup: 'O+',
          componentType: 'PRBC',
          status: BloodRequestStatus.APPROVED,
          save: jest.fn().mockResolvedValue(true),
        }),
      });

      mockReservationsService.createReservation.mockResolvedValue({
        _id: 'res-prbc-101',
        reservationCode: 'RES-PRBC-101',
      });

      const result = await service.reserveUnit('607f191e810c19729de86001', {}, mockAdminActor);

      expect(mockReservationsService.createReservation).toHaveBeenCalledWith(
        'req-101',
        { inventoryIds: ['inv-prbc-o-minus'], allowCompatibleBloodGroup: true },
        mockAdminActor,
      );
      expect(result.status).toBe(CrossmatchStatus.RESERVED);
      expect(result.reservationCode).toBe('RES-PRBC-101');
    });

    // Scenario 2: O+ patient with O+ RBC/PRBC unit
    it('Scenario 2: should allow identical O+ PRBC unit for O+ patient and reserve successfully', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86002',
        crossmatchCode: 'XM-20261026-002',
        status: CrossmatchStatus.AUTHORIZED_COMPATIBLE,
        bloodRequestId: 'req-102',
        patientBloodGroup: 'O+',
        requestedComponent: 'PRBC',
        selectedUnit: {
          inventoryId: 'inv-prbc-o-plus',
          unitCode: 'UNIT-PRBC-O-PLUS',
          donorBloodGroup: 'O+',
          componentType: 'PRBC',
        },
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      mockBloodRequestModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'req-102',
          bloodGroup: 'O+',
          componentType: 'PRBC',
          status: BloodRequestStatus.APPROVED,
          save: jest.fn().mockResolvedValue(true),
        }),
      });

      mockReservationsService.createReservation.mockResolvedValue({
        _id: 'res-prbc-102',
        reservationCode: 'RES-PRBC-102',
      });

      const result = await service.reserveUnit('607f191e810c19729de86002', {}, mockAdminActor);

      expect(result.status).toBe(CrossmatchStatus.RESERVED);
      expect(result.reservationCode).toBe('RES-PRBC-102');
    });

    // Scenario 3: O+ patient with O- Whole Blood unit (must fail/be ineligible)
    it('Scenario 3: should strictly reject O- Whole Blood unit for O+ patient requisition', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86003',
        crossmatchCode: 'XM-20261026-003',
        status: CrossmatchStatus.SAMPLE_VERIFIED,
        bloodRequestId: 'req-103',
        patientBloodGroup: 'O+',
        requestedComponent: 'WHOLE_BLOOD',
        sample: { isSampleValid: true },
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      // Inventory candidate: O- Whole Blood
      const mockInventoryCandidate: any = {
        _id: 'inv-wb-o-minus',
        status: InventoryStatus.AVAILABLE,
        bloodGroup: 'O-',
        componentType: 'WHOLE_BLOOD',
        storageLocation: 'Shelf 1',
        createdAt: new Date(),
        bloodUnitId: {
          _id: 'unit-wb-o-minus',
          unitCode: 'UNIT-WB-O-MINUS',
          bloodGroup: 'O-',
          componentType: 'WHOLE_BLOOD',
          status: BloodUnitStatus.APPROVED,
          expiryDate: new Date(Date.now() + 86400000 * 20),
        },
      };

      mockInventoryModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockInventoryCandidate]),
          }),
        }),
      });

      mockBloodRequestModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'req-103',
          bloodGroup: 'O+',
          componentType: 'WHOLE_BLOOD',
          status: BloodRequestStatus.APPROVED,
          save: jest.fn().mockResolvedValue(true),
        }),
      });

      // Check candidate evaluation in getEligibleUnits
      const eligibleResult = await service.getEligibleUnits('607f191e810c19729de86003');
      const wbCandidate = eligibleResult.candidateUnits.find((u) => u.unitCode === 'UNIT-WB-O-MINUS');
      expect(wbCandidate).toBeDefined();
      expect(wbCandidate?.isEligible).toBe(false);
      expect(wbCandidate?.eligibilityReason).toContain('Whole Blood transfusions strictly require identical ABO/RhD match');

      // Now attempt selectUnit: selectUnit will record isAboRhCompatible = false with clinical rationale
      mockInventoryModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockInventoryCandidate),
        }),
      });

      const selected = await service.selectUnit(
        '607f191e810c19729de86003',
        { inventoryId: 'inv-wb-o-minus' },
        mockLabTechActor,
      );
      expect(selected.selectedUnit?.isAboRhCompatible).toBe(false);
      expect(selected.selectedUnit?.compatibilityRuleReference).toContain('strictly require identical ABO/RhD match');

      // If user tries to reserve this unit, reserveUnit MUST throw BadRequestException
      selected.status = CrossmatchStatus.AUTHORIZED_COMPATIBLE;
      jest.spyOn(service, 'findOne').mockResolvedValue(selected as any);

      await expect(
        service.reserveUnit('607f191e810c19729de86003', {}, mockAdminActor),
      ).rejects.toThrow(BadRequestException);
    });

    // Scenario 4: Component mismatch between request and unit
    it('Scenario 4: should reject unit selection if component type mismatches request (e.g. PRBC requested vs Whole Blood unit)', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86004',
        status: CrossmatchStatus.SAMPLE_VERIFIED,
        patientBloodGroup: 'O+',
        requestedComponent: 'PRBC',
        sample: { isSampleValid: true },
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      const mockMismatchInventory: any = {
        _id: 'inv-wb-1',
        status: InventoryStatus.AVAILABLE,
        bloodUnitId: {
          _id: 'unit-wb-1',
          unitCode: 'UNIT-WB-1',
          bloodGroup: 'O+',
          componentType: 'WHOLE_BLOOD', // Mismatch against PRBC request
          status: BloodUnitStatus.APPROVED,
        },
      };

      mockInventoryModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockMismatchInventory),
        }),
      });

      await expect(
        service.selectUnit('607f191e810c19729de86004', { inventoryId: 'inv-wb-1' }, mockLabTechActor),
      ).rejects.toThrow(BadRequestException);
    });

    // Scenario 5: Incompatible crossmatch result
    it('Scenario 5: should transition to INCOMPATIBLE and block supervisory authorization when physical test is incompatible', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86005',
        status: CrossmatchStatus.UNIT_SELECTED,
        sample: { isSampleValid: true },
        selectedUnit: {
          inventoryId: 'inv-123',
          bloodUnitId: 'unit-123',
          unitCode: 'UNIT-001',
          donorBloodGroup: 'O+',
          componentType: 'PRBC',
        },
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      // 1. Record physical INCOMPATIBLE test (e.g. agglutination grade 3+)
      const testResult = await service.recordResult(
        '607f191e810c19729de86005',
        {
          testMethod: CrossmatchMethod.GEL_CARD,
          testPhases: ['AHG_PHASE'],
          crossmatchResult: CrossmatchResult.INCOMPATIBLE,
          reactionGrade: '3+',
          testingNotes: 'Agglutination observed in AHG microtube',
        },
        mockLabTechActor,
      );

      expect(testResult.status).toBe(CrossmatchStatus.INCOMPATIBLE);
      expect(testResult.laboratoryTest.crossmatchResult).toBe(CrossmatchResult.INCOMPATIBLE);

      // 2. Supervisor cannot authorize an incompatible test for routine release
      await expect(
        service.reviewAndAuthorize(
          '607f191e810c19729de86005',
          {
            reviewDecision: ReviewDecision.COMPATIBLE_AUTHORIZED,
            reviewNotes: 'Trying to inappropriately authorize incompatible test',
          },
          mockAdminActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // 3. Reservation is blocked
      await expect(
        service.reserveUnit('607f191e810c19729de86005', {}, mockAdminActor),
      ).rejects.toThrow(BadRequestException);
    });

    // Scenario 6: Authorized crossmatch result with an ineligible unit
    it('Scenario 6: should block reservation even if status was AUTHORIZED_COMPATIBLE if the unit is clinically ineligible', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86006',
        crossmatchCode: 'XM-20261026-MP3R',
        status: CrossmatchStatus.AUTHORIZED_COMPATIBLE,
        bloodRequestId: 'req-o-plus-wb',
        patientBloodGroup: 'O+',
        requestedComponent: 'WHOLE_BLOOD',
        selectedUnit: {
          inventoryId: 'inv-o-minus-wb',
          unitCode: 'UNIT-20261016-KAZV',
          donorBloodGroup: 'O-', // INCOMPATIBLE for WHOLE_BLOOD
          componentType: 'WHOLE_BLOOD',
        },
        timeline: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      mockBloodRequestModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'req-o-plus-wb',
          bloodGroup: 'O+',
          componentType: 'WHOLE_BLOOD',
          status: BloodRequestStatus.APPROVED,
          save: jest.fn().mockResolvedValue(true),
        }),
      });

      // Even if supervisory review somehow signed off, reservation safety validation MUST fail
      await expect(
        service.reserveUnit('607f191e810c19729de86006', {}, mockAdminActor),
      ).rejects.toThrow(BadRequestException);
    });

    // Scenario 7: Concurrent or duplicate reservation attempts
    it('Scenario 7: should block duplicate reservation attempts on already reserved crossmatch', async () => {
      const mockRecord: any = {
        _id: '607f191e810c19729de86007',
        status: CrossmatchStatus.RESERVED, // Already reserved
        reservationCode: 'RES-EXISTING-001',
        bloodRequestId: 'req-107',
        patientBloodGroup: 'O+',
        requestedComponent: 'PRBC',
        selectedUnit: {
          inventoryId: 'inv-prbc-1',
          donorBloodGroup: 'O+',
          componentType: 'PRBC',
        },
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecord as any);

      await expect(
        service.reserveUnit('607f191e810c19729de86007', {}, mockAdminActor),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
