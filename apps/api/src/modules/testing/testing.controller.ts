import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TestingService } from './testing.service';
import { CreateTestingDto } from './dto/create-testing.dto';
import { UpdateTestResultDto } from './dto/update-test-result.dto';
import { CompleteTestingDto } from './dto/complete-testing.dto';
import { QueryTestingDto } from './dto/query-testing.dto';
import { RecordBloodGroupingDto } from './dto/record-blood-grouping.dto';
import { AuthorizeTestingDto } from './dto/authorize-testing.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

/**
 * Controller for managing laboratory testing and screening records.
 */
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN)
@Controller('testing')
export class TestingController {
  constructor(private readonly testingService: TestingService) {}

  /**
   * Internal laboratory creation of a Testing Record for a Blood Unit in TESTING status.
   * POST /api/testing
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createTestingDto: CreateTestingDto,
    @CurrentAdmin() admin: any,
  ) {
    const testing = await this.testingService.create(createTestingDto, admin);
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
  async findAll(@Query() query: QueryTestingDto, @Req() req: any) {
    query.callerRole = req.admin?.role || req.user?.role;
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
  async findByBloodUnitId(@Param('bloodUnitId') bloodUnitId: string, @Req() req: any) {
    const callerRole = req.admin?.role || req.user?.role;
    const testing = await this.testingService.findByBloodUnitId(bloodUnitId, callerRole);
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
  async findOne(@Param('id') id: string, @Req() req: any) {
    const callerRole = req.admin?.role || req.user?.role;
    const testing = await this.testingService.findOne(id, callerRole);
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
    @CurrentAdmin() admin: any,
  ) {
    const updated = await this.testingService.updateTestResult(
      id,
      testCode,
      updateDto,
      admin,
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
    @CurrentAdmin() admin: any,
  ) {
    const completed = await this.testingService.completeTesting(
      id,
      completeDto,
      admin,
    );
    return {
      statusCode: HttpStatus.OK,
      message: `Testing finalized successfully with decision '${completed.decision}'`,
      data: completed,
    };
  }

  /**
   * Internal laboratory recording of forward and reverse ABO/Rh blood grouping.
   * PATCH /api/testing/:id/blood-grouping
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN)
  @Patch(':id/blood-grouping')
  async recordBloodGrouping(
    @Param('id') id: string,
    @Body() dto: RecordBloodGroupingDto,
    @CurrentAdmin() admin: any,
  ) {
    const updated = await this.testingService.recordBloodGrouping(
      id,
      dto,
      admin,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood grouping recorded and verified successfully',
      data: updated,
    };
  }

  /**
   * Laboratory supervisor or authorized technician release of cleared blood unit to inventory.
   * POST /api/testing/:id/authorize-release
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN)
  @Post(':id/authorize-release')
  @HttpCode(HttpStatus.OK)
  async authorizeRelease(
    @Param('id') id: string,
    @Body() dto: AuthorizeTestingDto,
    @CurrentAdmin() admin: any,
  ) {
    const authorized = await this.testingService.authorizeTestingRelease(
      id,
      dto,
      admin,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood unit laboratory release authorized successfully',
      data: authorized,
    };
  }
}
