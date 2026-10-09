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
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorStatusDto } from './dto/update-donor-status.dto';
import { BloodGroup, DonorStatus } from './constants/donor.constants';

@Controller('donors')
export class DonorsController {
  constructor(private readonly donorsService: DonorsService) {}

  /**
   * Public voluntary donor self-registration.
   * POST /api/donors
   * ACCESS: PUBLIC
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDonorDto: CreateDonorDto) {
    const result = await this.donorsService.create(createDonorDto);
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
   * ACCESS: INTERNAL STAFF/ADMIN (Pending Auth Guard implementation)
   */
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
   * Staff/Admin retrieve a specific donor by ID or donorCode.
   * GET /api/donors/:id
   * ACCESS: INTERNAL STAFF/ADMIN (Pending Auth Guard implementation)
   */
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
   * ACCESS: INTERNAL STAFF/ADMIN (Pending Auth Guard implementation)
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDonorStatusDto: UpdateDonorStatusDto,
  ) {
    const updated = await this.donorsService.updateStatus(
      id,
      updateDonorStatusDto,
    );
    return {
      statusCode: HttpStatus.OK,
      message: `Donor status updated to ${updated.status}`,
      data: updated,
    };
  }
}


