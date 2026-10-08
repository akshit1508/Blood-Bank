import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { TestingService } from './testing.service';
import { BloodTesting } from './schemas/blood-testing.schema';
import { BloodUnit } from '../blood-units/schemas/blood-unit.schema';
import {
  REQUIRED_BLOOD_TESTS,
  TestResultStatus,
  TestingDecision,
  TestingStatus,
} from './constants/testing.constants';
import { BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';
import { Types } from 'mongoose';

describe('TestingService', () => {
  let service: TestingService;
  let mockBloodTestingModel: any;
  let mockBloodUnitModel: any;

  const validBloodUnitId = '507f1f77bcf86cd799439011';
  const validDonationId = '507f1f77bcf86cd799439022';
  const validDonorId = '507f1f77bcf86cd799439033';
  const validTestingId = '507f1f77bcf86cd799439044';

  const mockBloodUnit = {
    _id: new Types.ObjectId(validBloodUnitId),
    unitCode: 'UNIT-20261008-0001',
    donationId: new Types.ObjectId(validDonationId),
    donorId: new Types.ObjectId(validDonorId),
    status: BloodUnitStatus.TESTING,
  };

  const sampleCreateDto = {
    bloodUnitId: validBloodUnitId,
    performedBy: 'Tech Sarah',
    remarks: 'Routine pre-transfusion safety screening',
  };

  beforeEach(async () => {
    function MockBloodTestingModel(dto: any) {
      this._id = new Types.ObjectId(validTestingId);
      this.testingCode = dto.testingCode;
      this.bloodUnitId = dto.bloodUnitId;
      this.donationId = dto.donationId;
      this.donorId = dto.donorId;
      this.testResults = dto.testResults ? [...dto.testResults] : [];
      this.status = dto.status;
      this.decision = dto.decision;
      this.startedAt = dto.startedAt || new Date();
      this.completedAt = dto.completedAt;
      this.performedBy = dto.performedBy;
      this.rejectionReason = dto.rejectionReason;
      this.remarks = dto.remarks;
      this.save = jest.fn().mockResolvedValue(this);
      this.populate = jest.fn().mockResolvedValue({
        ...this,
        bloodUnitId: mockBloodUnit,
      });
    }

    MockBloodTestingModel.exists = jest.fn().mockResolvedValue(false);
    MockBloodTestingModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });
    MockBloodTestingModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    MockBloodTestingModel.findById = jest.fn();
    MockBloodTestingModel.findOne = jest.fn();
    mockBloodTestingModel = MockBloodTestingModel;

    mockBloodUnitModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBloodUnit),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockBloodUnit,
          status: BloodUnitStatus.APPROVED,
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestingService,
        {
          provide: getModelToken(BloodTesting.name),
          useValue: mockBloodTestingModel,
        },
        {
          provide: getModelToken(BloodUnit.name),
          useValue: mockBloodUnitModel,
        },
      ],
    }).compile();

    service = module.get<TestingService>(TestingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('1. create testing record (Phase 4B)', () => {
    it('creates Testing Record from a TESTING Blood Unit with IN_PROGRESS status and initialized required tests', async () => {
      mockBloodTestingModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.create(sampleCreateDto);

      expect(result).toBeDefined();
      expect(result.testingCode).toMatch(/^TEST-\d{8}-[A-Z0-9]{4}$/);
      expect(result.status).toBe(TestingStatus.IN_PROGRESS);
      expect(result.decision).toBe(TestingDecision.PENDING);
      expect(result.testResults).toHaveLength(REQUIRED_BLOOD_TESTS.length);
      expect(
        result.testResults.every((t) => t.status === TestResultStatus.PENDING),
      ).toBe(true);
      expect(result.bloodUnitId).toBeDefined();
      expect(result.donationId).toEqual(mockBloodUnit.donationId);
      expect(result.donorId).toEqual(mockBloodUnit.donorId);
    });

    it('throws BadRequestException when bloodUnitId is not a valid ObjectId', async () => {
      await expect(
        service.create({
          bloodUnitId: 'invalid-id-format',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when Blood Unit does not exist', async () => {
      mockBloodUnitModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.create(sampleCreateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when Blood Unit status is APPROVED', async () => {
      mockBloodUnitModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockBloodUnit,
          status: BloodUnitStatus.APPROVED,
        }),
      });

      try {
        await service.create(sampleCreateDto);
        fail('Expected BadRequestException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({
          code: 'BLOOD_UNIT_NOT_IN_TESTING',
        });
      }
    });

    it('throws BadRequestException when Blood Unit status is REJECTED', async () => {
      mockBloodUnitModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockBloodUnit,
          status: BloodUnitStatus.REJECTED,
        }),
      });

      try {
        await service.create(sampleCreateDto);
        fail('Expected BadRequestException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({
          code: 'BLOOD_UNIT_NOT_IN_TESTING',
        });
      }
    });

    it('throws ConflictException when a testing record already exists for the Blood Unit', async () => {
      mockBloodTestingModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          testingCode: 'TEST-20261008-EXIST',
        }),
      });

      try {
        await service.create(sampleCreateDto);
        fail('Expected ConflictException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: 'TESTING_RECORD_ALREADY_EXISTS',
        });
      }
    });

    it('throws ConflictException on MongoDB duplicate key error (code 11000)', async () => {
      mockBloodTestingModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      function FailingMockTesting(dto: any) {
        this.save = jest.fn().mockRejectedValue({ code: 11000 });
      }
      FailingMockTesting.exists = jest.fn().mockResolvedValue(false);
      FailingMockTesting.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TestingService,
          {
            provide: getModelToken(BloodTesting.name),
            useValue: FailingMockTesting,
          },
          {
            provide: getModelToken(BloodUnit.name),
            useValue: mockBloodUnitModel,
          },
        ],
      }).compile();

      const failingService = module.get<TestingService>(TestingService);

      try {
        await failingService.create(sampleCreateDto);
        fail('Expected ConflictException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: 'TESTING_RECORD_ALREADY_EXISTS',
        });
      }
    });
  });

  describe('2. updateTestResult', () => {
    const existingTestingRecord: any = {
      _id: new Types.ObjectId(validTestingId),
      testingCode: 'TEST-20261008-ABCD',
      status: TestingStatus.IN_PROGRESS,
      decision: TestingDecision.PENDING,
      testResults: [
        {
          testCode: 'HIV',
          testName: 'Human Immunodeficiency Virus (HIV-1/2)',
          status: TestResultStatus.PENDING,
        },
        {
          testCode: 'HBV',
          testName: 'Hepatitis B Surface Antigen (HBsAg)',
          status: TestResultStatus.PENDING,
        },
      ],
      save: jest.fn().mockResolvedValue(this),
      populate: jest.fn().mockResolvedValue(this),
    };

    it('updates individual test result successfully', async () => {
      const recordCopy = {
        ...existingTestingRecord,
        testResults: existingTestingRecord.testResults.map((t: any) => ({ ...t })),
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        populate: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(recordCopy),
      });

      const result = await service.updateTestResult(validTestingId, 'HIV', {
        status: TestResultStatus.PASS,
        result: 'NON_REACTIVE',
        remarks: 'ELISA negative',
      });

      expect(result).toBeDefined();
      const updatedHiv = recordCopy.testResults.find((t: any) => t.testCode === 'HIV');
      expect(updatedHiv?.status).toBe(TestResultStatus.PASS);
      expect(updatedHiv?.result).toBe('NON_REACTIVE');
      expect(updatedHiv?.remarks).toBe('ELISA negative');
      expect(updatedHiv?.testedAt).toBeDefined();
    });

    it('throws NotFoundException when testCode is not part of the record', async () => {
      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingTestingRecord),
      });

      await expect(
        service.updateTestResult(validTestingId, 'UNKNOWN_TEST', {
          status: TestResultStatus.PASS,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when testing record is already COMPLETED', async () => {
      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...existingTestingRecord,
          status: TestingStatus.COMPLETED,
        }),
      });

      try {
        await service.updateTestResult(validTestingId, 'HIV', {
          status: TestResultStatus.PASS,
        });
        fail('Expected BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({
          code: 'TESTING_ALREADY_COMPLETED',
        });
      }
    });

    it('throws BadRequestException when testedAt is in the future', async () => {
      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingTestingRecord),
      });

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await expect(
        service.updateTestResult(validTestingId, 'HIV', {
          status: TestResultStatus.PASS,
          testedAt: futureDate,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. completeTesting', () => {
    it('throws BadRequestException when any required test is still PENDING', async () => {
      const recordWithPending = {
        _id: new Types.ObjectId(validTestingId),
        status: TestingStatus.IN_PROGRESS,
        bloodUnitId: new Types.ObjectId(validBloodUnitId),
        testResults: [
          { testCode: 'HIV', status: TestResultStatus.PASS },
          { testCode: 'HBV', status: TestResultStatus.PENDING },
        ],
      };

      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(recordWithPending),
      });

      try {
        await service.completeTesting(validTestingId, {});
        fail('Expected BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({
          code: 'REQUIRED_TESTS_INCOMPLETE',
        });
      }
    });

    it('finalizes testing with APPROVED when all required tests pass and updates BloodUnit to APPROVED', async () => {
      const allPassRecord: any = {
        _id: new Types.ObjectId(validTestingId),
        status: TestingStatus.IN_PROGRESS,
        bloodUnitId: new Types.ObjectId(validBloodUnitId),
        testResults: [
          { testCode: 'HIV', status: TestResultStatus.PASS },
          { testCode: 'HBV', status: TestResultStatus.PASS },
        ],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        populate: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(allPassRecord),
      });

      const result = await service.completeTesting(validTestingId, {
        performedBy: 'Dr. Watson',
        remarks: 'All 5 serological markers non-reactive',
      });

      expect(result.status).toBe(TestingStatus.COMPLETED);
      expect(result.decision).toBe(TestingDecision.APPROVED);
      expect(result.completedAt).toBeDefined();

      expect(mockBloodUnitModel.findByIdAndUpdate).toHaveBeenCalledWith(
        allPassRecord.bloodUnitId,
        { status: BloodUnitStatus.APPROVED },
        { new: true },
      );
    });

    it('finalizes testing with REJECTED when any required test fails and updates BloodUnit to REJECTED', async () => {
      const failRecord: any = {
        _id: new Types.ObjectId(validTestingId),
        status: TestingStatus.IN_PROGRESS,
        bloodUnitId: new Types.ObjectId(validBloodUnitId),
        testResults: [
          { testCode: 'HIV', status: TestResultStatus.PASS },
          { testCode: 'HBV', status: TestResultStatus.FAIL },
        ],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        populate: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(failRecord),
      });

      const result = await service.completeTesting(validTestingId, {
        performedBy: 'Dr. Watson',
      });

      expect(result.status).toBe(TestingStatus.COMPLETED);
      expect(result.decision).toBe(TestingDecision.REJECTED);
      expect(result.rejectionReason).toContain('HBV');

      expect(mockBloodUnitModel.findByIdAndUpdate).toHaveBeenCalledWith(
        failRecord.bloodUnitId,
        { status: BloodUnitStatus.REJECTED },
        { new: true },
      );
    });

    it('throws BadRequestException when attempting to complete already finalized record', async () => {
      const completedRecord = {
        _id: new Types.ObjectId(validTestingId),
        status: TestingStatus.COMPLETED,
        decision: TestingDecision.APPROVED,
      };

      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(completedRecord),
      });

      await expect(service.completeTesting(validTestingId, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('4. queries and detail lookups', () => {
    it('returns paginated testing records', async () => {
      const mockItems = [
        {
          testingCode: 'TEST-20261008-0001',
          status: TestingStatus.IN_PROGRESS,
          decision: TestingDecision.PENDING,
        },
      ];

      mockBloodTestingModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockItems),
              }),
            }),
          }),
        }),
      });
      mockBloodTestingModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters testing records by status, decision, bloodUnitId', async () => {
      mockBloodTestingModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      mockBloodTestingModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({
        status: TestingStatus.IN_PROGRESS,
        decision: TestingDecision.PENDING,
        bloodUnitId: validBloodUnitId,
      });

      expect(mockBloodTestingModel.find).toHaveBeenCalledWith({
        status: TestingStatus.IN_PROGRESS,
        decision: TestingDecision.PENDING,
        bloodUnitId: new Types.ObjectId(validBloodUnitId),
      });
    });

    it('finds testing record by ObjectId', async () => {
      const sample = {
        _id: new Types.ObjectId(validTestingId),
        testingCode: 'TEST-20261008-0001',
      };

      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sample),
        }),
      });

      const result = await service.findOne(validTestingId);
      expect(result.testingCode).toBe('TEST-20261008-0001');
    });

    it('finds testing record by testingCode', async () => {
      const sample = {
        _id: new Types.ObjectId(validTestingId),
        testingCode: 'TEST-20261008-0001',
      };

      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      mockBloodTestingModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sample),
        }),
      });

      const result = await service.findOne('TEST-20261008-0001');
      expect(result.testingCode).toBe('TEST-20261008-0001');
    });

    it('finds testing record by bloodUnitId', async () => {
      const sample = {
        _id: new Types.ObjectId(validTestingId),
        bloodUnitId: new Types.ObjectId(validBloodUnitId),
        testingCode: 'TEST-20261008-0001',
      };

      mockBloodTestingModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sample),
        }),
      });

      const result = await service.findByBloodUnitId(validBloodUnitId);
      expect(result.testingCode).toBe('TEST-20261008-0001');
    });

    it('throws NotFoundException when record is not found by ID', async () => {
      mockBloodTestingModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      mockBloodTestingModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.findOne('TEST-NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
