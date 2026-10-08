import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TestingService } from './testing.service';
import { CreateTestingDto } from './dto/create-testing.dto';
import { UpdateTestResultDto } from './dto/update-test-result.dto';
import { CompleteTestingDto } from './dto/complete-testing.dto';
import { QueryTestingDto } from './dto/query-testing.dto';

/**
 * Controller for managing laboratory testing and screening records.
 *
 * NOTE: These endpoints are designated strictly for internal blood bank staff and laboratory technicians.
 * Anonymous public access is blocked. Role-based Guard enforcement (JWT + RBAC) will be applied in the Auth vertical slice.
 */
@Controller('testing')
export class TestingController {
  constructor(private readonly testingService: TestingService) {}

  /**
   * Internal laboratory creation of a Testing Record for a Blood Unit in TESTING status.
   * POST /api/testing
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createTestingDto: CreateTestingDto) {
    const testing = await this.testingService.create(createTestingDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Testing record initiated successfully',
      data: testing,
    };
  }

  /**
   * Internal laboratory query of testing records with filtering and pagination.
   * GET /api/testing
   */
  @Get()
  async findAll(@Query() query: QueryTestingDto) {
    const result = await this.testingService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Testing records retrieved successfully',
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Retrieve testing record associated with a specific Blood Unit.
   * Placed before :id parameter route to prevent route collision.
   * GET /api/testing/blood-unit/:bloodUnitId
   */
  @Get('blood-unit/:bloodUnitId')
  async findByBloodUnitId(@Param('bloodUnitId') bloodUnitId: string) {
    const testing = await this.testingService.findByBloodUnitId(bloodUnitId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Testing record for blood unit retrieved successfully',
      data: testing,
    };
  }

  /**
   * Internal laboratory retrieval of single testing record by MongoDB _id or testingCode.
   * GET /api/testing/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const testing = await this.testingService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Testing record retrieved successfully',
      data: testing,
    };
  }

  /**
   * Internal laboratory update of an individual screening test outcome.
   * PATCH /api/testing/:id/tests/:testCode
   */
  @Patch(':id/tests/:testCode')
  async updateTestResult(
    @Param('id') id: string,
    @Param('testCode') testCode: string,
    @Body() updateDto: UpdateTestResultDto,
  ) {
    const updated = await this.testingService.updateTestResult(
      id,
      testCode,
      updateDto,
    );
    return {
      statusCode: HttpStatus.OK,
      message: `Test result for '${testCode}' updated successfully`,
      data: updated,
    };
  }

  /**
   * Finalize the testing workflow with an overall APPROVED or REJECTED outcome.
   * Automatically synchronizes Blood Unit status to APPROVED or REJECTED.
   * PATCH /api/testing/:id/complete
   */
  @Patch(':id/complete')
  async completeTesting(
    @Param('id') id: string,
    @Body() completeDto: CompleteTestingDto,
  ) {
    const completed = await this.testingService.completeTesting(
      id,
      completeDto,
    );
    return {
      statusCode: HttpStatus.OK,
      message: `Testing finalized successfully with decision '${completed.decision}'`,
      data: completed,
    };
  }
}
