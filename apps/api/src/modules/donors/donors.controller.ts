import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DonorsService } from './donors.service';
import { DonorEligibilityService } from './services/donor-eligibility.service';
import { DonorScreeningService } from './services/donor-screening.service';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorStatusDto } from './dto/update-donor-status.dto';
import { CreateDonorScreeningDto } from './dto/create-donor-screening.dto';
import { BloodGroup, DonorStatus } from './constants/donor.constants';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

@Controller('donors')
export class DonorsController {
  constructor(
    private readonly donorsService: DonorsService,
    private readonly donorEligibilityService: DonorEligibilityService,
    private readonly donorScreeningService: DonorScreeningService,
  ) {}

  /**
   * Public voluntary donor self-registration.
   * POST /api/donors
   * ACCESS: PUBLIC
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDonorDto: CreateDonorDto,
    @CurrentAdmin() admin?: any,
  ) {
    const result = await this.donorsService.create(createDonorDto, admin);
    return {
      statusCode: HttpStatus.CREATED,
      message: result.message,
      data: {
        success: result.success,
        donorCode: result.donorCode,
      },
    };
  }

  /**
   * Staff/Admin query of registered donors with filters and search.
   * GET /api/donors
   * ACCESS: INTERNAL STAFF/ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('bloodGroup') bloodGroup?: BloodGroup,
    @Query('status') status?: DonorStatus,
  ) {
    const donors = await this.donorsService.findAll({
      search,
      bloodGroup,
      status,
    });
    return {
      statusCode: HttpStatus.OK,
      data: donors,
    };
  }

  /**
   * Check donor eligibility for blood donation.
   * GET /api/donors/:id/eligibility
   * ACCESS: INTERNAL STAFF/ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get(':id/eligibility')
  async checkEligibility(
    @Param('id') id: string,
    @Query('donationDate') donationDate?: string,
    @Query('donationType') donationType?: string,
  ) {
    const result = await this.donorEligibilityService.validateEligibility(
      id,
      donationDate,
      donationType,
    );
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Record clinical pre-donation screening & examination for donor.
   * POST /api/donors/:id/screenings
   * ACCESS: INTERNAL STAFF/ADMIN (Medical Officer / Phlebotomist)
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post(':id/screenings')
  @HttpCode(HttpStatus.CREATED)
  async createScreening(
    @Param('id') id: string,
    @Body() dto: CreateDonorScreeningDto,
    @CurrentAdmin() admin: any,
  ) {
    dto.donorId = id;
    const result = await this.donorScreeningService.createScreening(dto, admin);
    return {
      statusCode: HttpStatus.CREATED,
      message: result.message,
      data: result.screening,
      autoEvaluation: result.autoEvaluation,
      donor: result.donor,
    };
  }

  /**
   * Retrieve all clinical screening records for a donor.
   * GET /api/donors/:id/screenings
   * ACCESS: INTERNAL STAFF/ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get(':id/screenings')
  async getScreenings(@Param('id') id: string) {
    const screenings = await this.donorScreeningService.findScreeningsByDonor(id);
    return {
      statusCode: HttpStatus.OK,
      data: screenings,
    };
  }

  /**
   * Retrieve today's active passing screening for donor ready for collection.
   * GET /api/donors/:id/screenings/active
   * ACCESS: INTERNAL STAFF/ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get(':id/screenings/active')
  async getActiveScreening(@Param('id') id: string) {
    const active = await this.donorScreeningService.findActiveScreeningForDonor(id);
    return {
      statusCode: HttpStatus.OK,
      data: active,
    };
  }

  /**
   * Staff/Admin retrieve a specific donor by ID or donorCode.
   * GET /api/donors/:id
   * ACCESS: INTERNAL STAFF/ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const donor = await this.donorsService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      data: donor,
    };
  }

  /**
   * Staff/Admin update donor status (ACTIVE / INACTIVE).
   * PATCH /api/donors/:id/status
   * ACCESS: INTERNAL STAFF/ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDonorStatusDto: UpdateDonorStatusDto,
    @CurrentAdmin() admin: any,
  ) {
    const updated = await this.donorsService.updateStatus(
      id,
      updateDonorStatusDto,
      admin,
    );
    return {
      statusCode: HttpStatus.OK,
      message: `Donor status updated to ${updated.status}`,
      data: updated,
    };
  }
}
