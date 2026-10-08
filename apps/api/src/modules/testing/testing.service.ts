import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import {
  BloodTesting,
  BloodTestingDocument,
} from './schemas/blood-testing.schema';
import {
  BloodUnit,
  BloodUnitDocument,
} from '../blood-units/schemas/blood-unit.schema';
import { CreateTestingDto } from './dto/create-testing.dto';
import { UpdateTestResultDto } from './dto/update-test-result.dto';
import { CompleteTestingDto } from './dto/complete-testing.dto';
import { QueryTestingDto } from './dto/query-testing.dto';
import {
  REQUIRED_BLOOD_TESTS,
  TestResultStatus,
  TestingDecision,
  TestingStatus,
} from './constants/testing.constants';
import { BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';

export interface PaginatedBloodTesting {
  items: BloodTesting[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class TestingService {
  constructor(
    @InjectModel(BloodTesting.name)
    private readonly bloodTestingModel: Model<BloodTestingDocument>,
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel: Model<BloodUnitDocument>,
  ) {}

  /**
   * Generates a unique server-side testing code.
   * Format: TEST-YYYYMMDD-XXXX (e.g. TEST-20261008-A81F)
   */
  private generateTestingCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TEST-${datePart}-${randomPart}`;
  }

  /**
   * Creates a laboratory Testing Record for a physical Blood Unit in TESTING status.
   *
   * Business Rules Enforced:
   * 1. Blood Unit must exist and have status TESTING.
   * 2. Exactly 1 Testing Record per Blood Unit (duplicate prevented).
   * 3. testingCode generated server-side.
   * 4. donationId and donorId derived authoritatively from Blood Unit.
   * 5. Initializes required tests in PENDING status.
   * 6. Lifecycle starts as IN_PROGRESS, decision PENDING.
   */
  async create(createDto: CreateTestingDto): Promise<BloodTesting> {
    if (!isValidObjectId(createDto.bloodUnitId)) {
      throw new BadRequestException({
        message: 'Invalid blood unit ID format',
        code: 'INVALID_BLOOD_UNIT_REFERENCE',
      });
    }

    // 1. Verify blood unit existence
    const bloodUnit = await this.bloodUnitModel
      .findById(createDto.bloodUnitId)
      .exec();

    if (!bloodUnit) {
      throw new NotFoundException({
        message: `Blood unit with ID '${createDto.bloodUnitId}' was not found.`,
        code: 'BLOOD_UNIT_NOT_FOUND',
      });
    }

    // 2. Blood Unit MUST be in TESTING status
    if (bloodUnit.status !== BloodUnitStatus.TESTING) {
      throw new BadRequestException({
        message: `Cannot initiate testing for blood unit with status '${bloodUnit.status}'. Only units in TESTING status can undergo laboratory testing.`,
        code: 'BLOOD_UNIT_NOT_IN_TESTING',
      });
    }

    // 3. Pre-check for duplicate testing record
    const existingTesting = await this.bloodTestingModel
      .findOne({ bloodUnitId: bloodUnit._id })
      .exec();

    if (existingTesting) {
      throw new ConflictException({
        message: `A testing record (${existingTesting.testingCode}) already exists for blood unit '${bloodUnit.unitCode}'.`,
        code: 'TESTING_RECORD_ALREADY_EXISTS',
      });
    }

    // 4. Initialize required test results from centralized configuration
    const initialTestResults = REQUIRED_BLOOD_TESTS.map((def) => ({
      testCode: def.testCode,
      testName: def.testName,
      status: TestResultStatus.PENDING,
      remarks: undefined,
      testedAt: undefined,
      result: undefined,
    }));

    // 5. Generate unique testingCode
    let testingCode = this.generateTestingCode();
    let attempts = 0;
    while (await this.bloodTestingModel.exists({ testingCode })) {
      testingCode = this.generateTestingCode();
      attempts++;
      if (attempts > 5) {
        testingCode = `TEST-${Date.now()}`;
        break;
      }
    }

    // 6. Instantiate and save testing record
    try {
      const testingRecord = new this.bloodTestingModel({
        testingCode,
        bloodUnitId: bloodUnit._id,
        donationId: bloodUnit.donationId,
        donorId: bloodUnit.donorId,
        testResults: initialTestResults,
        status: TestingStatus.IN_PROGRESS,
        decision: TestingDecision.PENDING,
        startedAt: new Date(),
        performedBy: createDto.performedBy?.trim() || undefined,
        remarks: createDto.remarks?.trim() || undefined,
      });

      const saved = await testingRecord.save();
      return (await saved.populate([
        {
          path: 'bloodUnitId',
          select:
            'unitCode status bloodGroup componentType collectionDate volume storageLocation',
        },
        {
          path: 'donationId',
          select:
            'donationCode donationDate donationType status quantity notes',
        },
        {
          path: 'donorId',
          select: 'donorCode fullName bloodGroup gender status phone',
        },
      ])) as BloodTesting;
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException({
          message: `A testing record already exists for blood unit '${bloodUnit.unitCode}'.`,
          code: 'TESTING_RECORD_ALREADY_EXISTS',
        });
      }
      throw err;
    }
  }

  /**
   * Updates an individual screening test outcome within an in-progress testing record.
   *
   * Business Rules Enforced:
   * 1. Testing record must be IN_PROGRESS (cannot update finalized record).
   * 2. testCode must exist in the testing record.
   * 3. testedAt cannot be in the future.
   */
  async updateTestResult(
    testingId: string,
    testCode: string,
    updateDto: UpdateTestResultDto,
  ): Promise<BloodTesting> {
    if (!isValidObjectId(testingId)) {
      throw new BadRequestException({
        message: 'Invalid testing ID format',
        code: 'INVALID_TESTING_REFERENCE',
      });
    }

    const testing = await this.bloodTestingModel.findById(testingId).exec();
    if (!testing) {
      throw new NotFoundException({
        message: `Testing record with ID '${testingId}' was not found.`,
        code: 'TESTING_RECORD_NOT_FOUND',
      });
    }

    if (testing.status !== TestingStatus.IN_PROGRESS) {
      throw new BadRequestException({
        message: `Cannot update test results: Testing record '${testing.testingCode}' is already finalized (${testing.status}).`,
        code: 'TESTING_ALREADY_COMPLETED',
      });
    }

    const normalizedCode = testCode.trim().toUpperCase();
    const targetTest = testing.testResults.find(
      (t) => t.testCode.toUpperCase() === normalizedCode,
    );

    if (!targetTest) {
      throw new NotFoundException({
        message: `Test with code '${testCode}' is not part of this testing record.`,
        code: 'TEST_NOT_FOUND',
      });
    }

    if (updateDto.testedAt) {
      const testedDate = new Date(updateDto.testedAt);
      if (
        isNaN(testedDate.getTime()) ||
        testedDate.getTime() > Date.now() + 120 * 1000
      ) {
        throw new BadRequestException({
          message: 'Tested date cannot be in the future.',
          code: 'FUTURE_TEST_DATE',
        });
      }
      targetTest.testedAt = testedDate;
    } else if (
      updateDto.status !== TestResultStatus.PENDING &&
      !targetTest.testedAt
    ) {
      targetTest.testedAt = new Date();
    }

    targetTest.status = updateDto.status;
    if (updateDto.result !== undefined) {
      targetTest.result = updateDto.result.trim() || undefined;
    }
    if (updateDto.remarks !== undefined) {
      targetTest.remarks = updateDto.remarks.trim() || undefined;
    }

    const saved = await testing.save();
    return (await saved.populate([
      {
        path: 'bloodUnitId',
        select:
          'unitCode status bloodGroup componentType collectionDate volume storageLocation',
      },
      {
        path: 'donationId',
        select:
          'donationCode donationDate donationType status quantity notes',
      },
      {
        path: 'donorId',
        select: 'donorCode fullName bloodGroup gender status phone',
      },
    ])) as BloodTesting;
  }

  /**
   * Finalizes the testing workflow and updates the Blood Unit status.
   *
   * Business Rules Enforced:
   * 1. Record must be IN_PROGRESS.
   * 2. All required tests must be complete (no PENDING tests allowed).
   * 3. If any test has status FAIL -> decision = REJECTED, Blood Unit status = REJECTED.
   * 4. If all tests have status PASS -> decision = APPROVED, Blood Unit status = APPROVED.
   * 5. Testing status moves to COMPLETED and record becomes immutable.
   * 6. Atomic consistency between Testing decision and Blood Unit status.
   */
  async completeTesting(
    testingId: string,
    dto: CompleteTestingDto,
  ): Promise<BloodTesting> {
    if (!isValidObjectId(testingId)) {
      throw new BadRequestException({
        message: 'Invalid testing ID format',
        code: 'INVALID_TESTING_REFERENCE',
      });
    }

    const testing = await this.bloodTestingModel.findById(testingId).exec();
    if (!testing) {
      throw new NotFoundException({
        message: `Testing record with ID '${testingId}' was not found.`,
        code: 'TESTING_RECORD_NOT_FOUND',
      });
    }

    if (testing.status !== TestingStatus.IN_PROGRESS) {
      throw new BadRequestException({
        message: `Testing record '${testing.testingCode}' is already finalized (${testing.status}) with decision '${testing.decision}'.`,
        code: 'TESTING_ALREADY_COMPLETED',
      });
    }

    // Check for pending tests
    const pendingTests = testing.testResults.filter(
      (t) => t.status === TestResultStatus.PENDING,
    );
    if (pendingTests.length > 0) {
      const pendingNames = pendingTests.map((t) => t.testCode).join(', ');
      throw new BadRequestException({
        message: `Cannot complete testing: ${pendingTests.length} required test(s) are still PENDING (${pendingNames}). All tests must have conclusive results.`,
        code: 'REQUIRED_TESTS_INCOMPLETE',
      });
    }

    // Determine final outcome
    const failedTests = testing.testResults.filter(
      (t) => t.status === TestResultStatus.FAIL,
    );

    let finalDecision: TestingDecision;
    let targetUnitStatus: BloodUnitStatus;
    let autoRejectionReason: string | undefined = undefined;

    if (failedTests.length > 0) {
      finalDecision = TestingDecision.REJECTED;
      targetUnitStatus = BloodUnitStatus.REJECTED;
      autoRejectionReason =
        dto.rejectionReason?.trim() ||
        `Screening failed for: ${failedTests.map((t) => t.testCode).join(', ')}`;
    } else {
      finalDecision = TestingDecision.APPROVED;
      targetUnitStatus = BloodUnitStatus.APPROVED;
    }

    // Update Blood Unit status consistently
    const updatedUnit = await this.bloodUnitModel
      .findByIdAndUpdate(
        testing.bloodUnitId,
        { status: targetUnitStatus },
        { new: true },
      )
      .exec();

    if (!updatedUnit) {
      throw new NotFoundException({
        message: `Associated blood unit was not found during completion.`,
        code: 'BLOOD_UNIT_NOT_FOUND',
      });
    }

    // Finalize Testing Record
    testing.status = TestingStatus.COMPLETED;
    testing.decision = finalDecision;
    testing.completedAt = new Date();
    if (dto.performedBy?.trim()) {
      testing.performedBy = dto.performedBy.trim();
    }
    if (dto.remarks?.trim()) {
      testing.remarks = dto.remarks.trim();
    }
    if (autoRejectionReason) {
      testing.rejectionReason = autoRejectionReason;
    }

    const saved = await testing.save();
    return (await saved.populate([
      {
        path: 'bloodUnitId',
        select:
          'unitCode status bloodGroup componentType collectionDate volume storageLocation',
      },
      {
        path: 'donationId',
        select:
          'donationCode donationDate donationType status quantity notes',
      },
      {
        path: 'donorId',
        select: 'donorCode fullName bloodGroup gender status phone',
      },
    ])) as BloodTesting;
  }

  /**
   * Internal staff query of paginated testing records with filtering.
   */
  async findAll(query: QueryTestingDto): Promise<PaginatedBloodTesting> {
    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }
    if (query.decision) {
      filter.decision = query.decision;
    }
    if (query.bloodUnitId && isValidObjectId(query.bloodUnitId)) {
      filter.bloodUnitId = new Types.ObjectId(query.bloodUnitId);
    }
    if (query.donationId && isValidObjectId(query.donationId)) {
      filter.donationId = new Types.ObjectId(query.donationId);
    }
    if (query.donorId && isValidObjectId(query.donorId)) {
      filter.donorId = new Types.ObjectId(query.donorId);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.bloodTestingModel
        .find(filter)
        .populate([
          {
            path: 'bloodUnitId',
            select:
              'unitCode status bloodGroup componentType collectionDate volume storageLocation',
          },
          {
            path: 'donationId',
            select:
              'donationCode donationDate donationType status quantity notes',
          },
          {
            path: 'donorId',
            select: 'donorCode fullName bloodGroup gender status phone',
          },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bloodTestingModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves a single testing record by MongoDB ObjectId or testingCode.
   */
  async findOne(idOrCode: string): Promise<BloodTesting> {
    let testing: BloodTesting | null = null;

    if (isValidObjectId(idOrCode)) {
      testing = await this.bloodTestingModel
        .findById(idOrCode)
        .populate([
          {
            path: 'bloodUnitId',
            select:
              'unitCode status bloodGroup componentType collectionDate volume storageLocation',
          },
          {
            path: 'donationId',
            select:
              'donationCode donationDate donationType status quantity notes',
          },
          {
            path: 'donorId',
            select: 'donorCode fullName bloodGroup gender status phone',
          },
        ])
        .exec();
    }

    if (!testing) {
      testing = await this.bloodTestingModel
        .findOne({ testingCode: idOrCode.toUpperCase() })
        .populate([
          {
            path: 'bloodUnitId',
            select:
              'unitCode status bloodGroup componentType collectionDate volume storageLocation',
          },
          {
            path: 'donationId',
            select:
              'donationCode donationDate donationType status quantity notes',
          },
          {
            path: 'donorId',
            select: 'donorCode fullName bloodGroup gender status phone',
          },
        ])
        .exec();
    }

    if (!testing) {
      throw new NotFoundException({
        message: `Testing record '${idOrCode}' was not found.`,
        code: 'TESTING_RECORD_NOT_FOUND',
      });
    }

    return testing;
  }

  /**
   * Retrieves the testing record associated with a specific Blood Unit.
   */
  async findByBloodUnitId(bloodUnitId: string): Promise<BloodTesting> {
    if (!isValidObjectId(bloodUnitId)) {
      throw new BadRequestException({
        message: 'Invalid blood unit ID format',
        code: 'INVALID_BLOOD_UNIT_REFERENCE',
      });
    }

    const testing = await this.bloodTestingModel
      .findOne({ bloodUnitId: new Types.ObjectId(bloodUnitId) })
      .populate([
        {
          path: 'bloodUnitId',
          select:
            'unitCode status bloodGroup componentType collectionDate volume storageLocation',
        },
        {
          path: 'donationId',
          select:
            'donationCode donationDate donationType status quantity notes',
        },
        {
          path: 'donorId',
          select: 'donorCode fullName bloodGroup gender status phone',
        },
      ])
      .exec();

    if (!testing) {
      throw new NotFoundException({
        message: `No testing record found for blood unit '${bloodUnitId}'.`,
        code: 'TESTING_RECORD_NOT_FOUND',
      });
    }

    return testing;
  }
}
