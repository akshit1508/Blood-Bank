import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BloodUnitsService } from './blood-units.service';
import { CreateBloodUnitDto } from './dto/create-blood-unit.dto';
import { QueryBloodUnitsDto } from './dto/query-blood-units.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

/**
 * Controller for managing physical blood units.
 */
@Controller('blood-units')
export class BloodUnitsController {
  constructor(private readonly bloodUnitsService: BloodUnitsService) {}

  /**
   * Internal staff creation of a Blood Unit from a COMPLETED donation.
   * POST /api/blood-units
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createBloodUnitDto: CreateBloodUnitDto,
    @CurrentAdmin() admin: any,
  ) {
    const bloodUnit = await this.bloodUnitsService.create(createBloodUnitDto, admin);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Blood unit created successfully and queued for testing',
      data: bloodUnit,
    };
  }

  /**
   * Dedicated testing scope endpoint: Retrieves blood units in TESTING status.
   * Accessible to LAB_TECHNICIAN, ADMIN, SUPER_ADMIN.
   * GET /api/blood-units/awaiting-testing
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN)
  @Get('awaiting-testing')
  async findAwaitingTesting(@Query('limit') limit?: number) {
    const result = await this.bloodUnitsService.findAwaitingTesting(limit);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood units awaiting laboratory testing retrieved successfully',
      data: result.items,
      meta: {
        total: result.total,
      },
    };
  }

  /**
   * Internal staff query of blood units with filtering and pagination.
   * Restricted strictly to SUPER_ADMIN and ADMIN (general inventory view).
   * GET /api/blood-units
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get()
  async findAll(@Query() query: QueryBloodUnitsDto) {
    const result = await this.bloodUnitsService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood units retrieved successfully',
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
   * Internal staff retrieval of blood unit produced from a specific donation.
   * Restricted strictly to SUPER_ADMIN and ADMIN.
   * GET /api/blood-units/donation/:donationId
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get('donation/:donationId')
  async findByDonationId(@Param('donationId') donationId: string) {
    const bloodUnit = await this.bloodUnitsService.findByDonationId(donationId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood unit for donation retrieved successfully',
      data: bloodUnit,
    };
  }

  /**
   * Internal staff retrieval of single blood unit by MongoDB _id or unitCode.
   * Accessible to LAB_TECHNICIAN only if unit is in TESTING status (sanitized).
   * GET /api/blood-units/:id
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const callerRole = req.admin?.role || req.user?.role;
    const bloodUnit = await this.bloodUnitsService.findOne(id, callerRole);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood unit retrieved successfully',
      data: bloodUnit,
    };
  }
}
