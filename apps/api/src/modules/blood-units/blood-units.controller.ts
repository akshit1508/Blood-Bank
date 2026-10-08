import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BloodUnitsService } from './blood-units.service';
import { CreateBloodUnitDto } from './dto/create-blood-unit.dto';
import { QueryBloodUnitsDto } from './dto/query-blood-units.dto';

/**
 * Controller for managing physical blood units.
 *
 * NOTE: These endpoints are designated strictly for internal blood bank staff and laboratory technicians.
 * Public access is prohibited. Full JWT + RBAC authorization guards will be applied in the Auth vertical slice.
 */
@Controller('blood-units')
export class BloodUnitsController {
  constructor(private readonly bloodUnitsService: BloodUnitsService) {}

  /**
   * Internal staff creation of a Blood Unit from a COMPLETED donation.
   * POST /api/blood-units
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createBloodUnitDto: CreateBloodUnitDto) {
    const bloodUnit = await this.bloodUnitsService.create(createBloodUnitDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Blood unit created successfully and queued for testing',
      data: bloodUnit,
    };
  }

  /**
   * Internal staff query of blood units with filtering and pagination.
   * GET /api/blood-units
   */
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
   * Placed before :id parameter route to prevent route collision.
   * GET /api/blood-units/donation/:donationId
   */
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
   * GET /api/blood-units/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const bloodUnit = await this.bloodUnitsService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood unit retrieved successfully',
      data: bloodUnit,
    };
  }
}
