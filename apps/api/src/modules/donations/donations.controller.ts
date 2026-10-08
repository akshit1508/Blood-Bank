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
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationStatusDto } from './dto/update-donation-status.dto';
import {
  DonationStatus,
  DonationType,
} from './constants/donation.constants';
import { BloodGroup } from '../donors/constants/donor.constants';

@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  /**
   * Internal staff recording of a blood donation.
   * POST /api/donations
   * ACCESS: INTERNAL STAFF/ADMIN (Pending Auth Guard implementation)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDonationDto: CreateDonationDto) {
    const donation = await this.donationsService.create(createDonationDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Blood donation recorded successfully',
      data: donation,
    };
  }

  /**
   * Internal staff query of donations with search, filters, and pagination.
   * GET /api/donations
   * ACCESS: INTERNAL STAFF/ADMIN (Pending Auth Guard implementation)
   */
  @Get()
  async findAll(
    @Query('donorId') donorId?: string,
    @Query('search') search?: string,
    @Query('status') status?: DonationStatus,
    @Query('bloodGroup') bloodGroup?: BloodGroup,
    @Query('donationType') donationType?: DonationType,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.donationsService.findAll({
      donorId,
      search,
      status,
      bloodGroup,
      donationType,
      page,
      limit,
    });
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Internal staff retrieval of a single donation by ID or donationCode.
   * GET /api/donations/:id
   * ACCESS: INTERNAL STAFF/ADMIN (Pending Auth Guard implementation)
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const donation = await this.donationsService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      data: donation,
    };
  }

  /**
   * Internal staff update of donation status with state machine validation.
   * PATCH /api/donations/:id/status
   * ACCESS: INTERNAL STAFF/ADMIN (Pending Auth Guard implementation)
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDonationStatusDto: UpdateDonationStatusDto,
  ) {
    const updated = await this.donationsService.updateStatus(
      id,
      updateDonationStatusDto,
    );
    return {
      statusCode: HttpStatus.OK,
      message: `Donation status updated to ${updated.status}`,
      data: updated,
    };
  }
}
