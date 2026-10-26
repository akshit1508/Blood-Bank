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
import { CrossmatchingService } from './crossmatching.service';
import { CreateCrossmatchDto } from './dto/create-crossmatch.dto';
import { VerifySampleDto } from './dto/verify-sample.dto';
import { SelectUnitDto } from './dto/select-unit.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { ReviewAuthorizationDto } from './dto/review-authorization.dto';
import { ReserveCrossmatchDto } from './dto/reserve-crossmatch.dto';
import { IssueCrossmatchDto } from './dto/issue-crossmatch.dto';
import { CancelCrossmatchDto } from './dto/cancel-crossmatch.dto';
import { RepeatCrossmatchDto } from './dto/repeat-crossmatch.dto';
import { QueryCrossmatchesDto } from './dto/query-crossmatches.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN)
@Controller('crossmatches')
export class CrossmatchingController {
  constructor(private readonly crossmatchingService: CrossmatchingService) {}

  /**
   * Initiates a new Crossmatch process linked to an existing Blood Request.
   * POST /api/crossmatches
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCrossmatchDto,
    @CurrentAdmin() admin: any,
  ) {
    const result = await this.crossmatchingService.create(dto, admin);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Crossmatch initiated successfully',
      data: result,
    };
  }

  /**
   * Retrieves dashboard metrics backed by the database.
   * GET /api/crossmatches/dashboard-metrics
   */
  @Get('dashboard-metrics')
  async getDashboardMetrics() {
    const metrics = await this.crossmatchingService.getDashboardMetrics();
    return {
      statusCode: HttpStatus.OK,
      data: metrics,
    };
  }

  /**
   * Searchable, filterable, paginated crossmatching queue.
   * GET /api/crossmatches
   */
  @Get()
  async findAll(@Query() query: QueryCrossmatchesDto) {
    const result = await this.crossmatchingService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Evaluates candidate inventory units and ABO/RhD compatibility.
   * GET /api/crossmatches/:id/eligible-units
   */
  @Get(':id/eligible-units')
  async getEligibleUnits(@Param('id') id: string) {
    const result = await this.crossmatchingService.getEligibleUnits(id);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Retrieves full details and timeline of a crossmatch record.
   * GET /api/crossmatches/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.crossmatchingService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Step 2: Patient Sample Verification.
   * PATCH /api/crossmatches/:id/sample-verification
   */
  @Patch(':id/sample-verification')
  async verifySample(
    @Param('id') id: string,
    @Body() dto: VerifySampleDto,
    @CurrentAdmin() admin: any,
  ) {
    const result = await this.crossmatchingService.verifySample(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: `Sample verification recorded (${result.status})`,
      data: result,
    };
  }

  /**
   * Step 3: Candidate Unit Selection.
   * POST /api/crossmatches/:id/select-unit
   */
  @Post(':id/select-unit')
  @HttpCode(HttpStatus.OK)
  async selectUnit(
    @Param('id') id: string,
    @Body() dto: SelectUnitDto,
    @CurrentAdmin() admin: any,
  ) {
    const result = await this.crossmatchingService.selectUnit(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: `Unit ${result.selectedUnit?.unitCode} selected for crossmatch`,
      data: result,
    };
  }

  /**
   * Step 4: Record Physical Laboratory Test Result.
   * POST /api/crossmatches/:id/results
   */
  @Post(':id/results')
  @HttpCode(HttpStatus.OK)
  async recordResult(
    @Param('id') id: string,
    @Body() dto: RecordResultDto,
    @CurrentAdmin() admin: any,
  ) {
    const result = await this.crossmatchingService.recordResult(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: `Crossmatch result recorded: ${dto.crossmatchResult}`,
      data: result,
    };
  }

  /**
   * Step 5: Independent Review and Clinical Authorization.
   * POST /api/crossmatches/:id/review
   * Restricted to SUPER_ADMIN and ADMIN (or independent supervisor)
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  async reviewAndAuthorize(
    @Param('id') id: string,
    @Body() dto: ReviewAuthorizationDto,
    @CurrentAdmin() admin: any,
  ) {
    const result = await this.crossmatchingService.reviewAndAuthorize(
      id,
      dto,
      admin,
    );
    return {
      statusCode: HttpStatus.OK,
      message: `Review authorization recorded: ${dto.reviewDecision}`,
      data: result,
    };
  }

  /**
   * Step 6A: Reserve Authorized Compatible Blood Unit.
   * POST /api/crossmatches/:id/reserve
   * Restricted to SUPER_ADMIN and ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post(':id/reserve')
  @HttpCode(HttpStatus.CREATED)
  async reserveUnit(
    @Param('id') id: string,
    @Body() dto: ReserveCrossmatchDto,
    @CurrentAdmin() admin: any,
  ) {
    const result = await this.crossmatchingService.reserveUnit(id, dto, admin);
    return {
      statusCode: HttpStatus.CREATED,
      message: `Crossmatched unit reserved successfully (Reservation: ${result.reservationCode})`,
      data: result,
    };
  }

  /**
   * Step 6B: Issue Reserved Crossmatched Unit.
   * POST /api/crossmatches/:id/issue
   * Restricted to SUPER_ADMIN and ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post(':id/issue')
  @HttpCode(HttpStatus.OK)
  async issueUnit(
    @Param('id') id: string,
    @Body() dto: IssueCrossmatchDto,
    @CurrentAdmin() admin: any,
  ) {
    const result = await this.crossmatchingService.issueUnit(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: `Crossmatched unit issued successfully (Issue Code: ${result.issueCode})`,
      data: result,
    };
  }

  /**
   * Cancel Crossmatch.
   * POST /api/crossmatches/:id/cancel
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelCrossmatchDto,
    @CurrentAdmin() admin: any,
  ) {
    const result = await this.crossmatchingService.cancel(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: `Crossmatch cancelled`,
      data: result,
    };
  }

  /**
   * Order Repeat Crossmatch.
   * POST /api/crossmatches/:id/repeat
   */
  @Post(':id/repeat')
  @HttpCode(HttpStatus.CREATED)
  async orderRepeat(
    @Param('id') id: string,
    @Body() dto: RepeatCrossmatchDto,
    @CurrentAdmin() admin: any,
  ) {
    const result = await this.crossmatchingService.orderRepeat(id, dto, admin);
    return {
      statusCode: HttpStatus.CREATED,
      message: `Repeat crossmatch ordered (${result.crossmatchCode})`,
      data: result,
    };
  }
}
