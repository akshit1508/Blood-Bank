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
import { BloodRequestService } from './blood-request.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { UpdateBloodRequestStatusDto } from './dto/update-blood-request-status.dto';
import { BloodRequestStatus } from './blood-request.constants';
import { ReservationsService } from '../modules/reservations/reservations.service';
import { CreateReservationDto } from '../modules/reservations/dto/create-reservation.dto';
import { BloodIssuesService } from '../modules/blood-issues/blood-issues.service';

@Controller('blood-requests')
export class BloodRequestController {
  constructor(
    private readonly bloodRequestService: BloodRequestService,
    private readonly reservationsService: ReservationsService,
    private readonly bloodIssuesService: BloodIssuesService,
  ) {}

  /**
   * Public or staff submission of a new blood request.
   * POST /api/blood-requests
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createBloodRequestDto: CreateBloodRequestDto) {
    const result = await this.bloodRequestService.create(createBloodRequestDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Blood request registered successfully',
      data: result,
    };
  }

  /**
   * Retrieves all blood requests, optionally filtered by status or blood group.
   * GET /api/blood-requests
   */
  @Get()
  async findAll(
    @Query('status') status?: BloodRequestStatus,
    @Query('bloodGroup') bloodGroup?: string,
  ) {
    const requests = await this.bloodRequestService.findAll({
      status,
      bloodGroup,
    });
    return {
      statusCode: HttpStatus.OK,
      data: requests,
    };
  }

  /**
   * Retrieves matching available inventory units for a blood request (Phase 6A).
   * GET /api/blood-requests/:id/matches
   */
  @Get(':id/matches')
  async getMatches(@Param('id') id: string) {
    const result = await this.bloodRequestService.getMatches(id);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Reserves specified AVAILABLE inventory units for an APPROVED blood request.
   * POST /api/blood-requests/:id/reservations
   */
  @Post(':id/reservations')
  @HttpCode(HttpStatus.CREATED)
  async createReservation(
    @Param('id') id: string,
    @Body() createDto: CreateReservationDto,
  ) {
    const result = await this.reservationsService.createReservation(
      id,
      createDto,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Blood units reserved successfully',
      data: result,
    };
  }

  /**
   * Retrieves active and historical reservations for a blood request.
   * GET /api/blood-requests/:id/reservations
   */
  @Get(':id/reservations')
  async getReservations(@Param('id') id: string) {
    const result = await this.reservationsService.findByBloodRequestId(id);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Retrieves all blood issue records for a blood request (Phase 6C).
   * GET /api/blood-requests/:id/issues
   */
  @Get(':id/issues')
  async getIssues(@Param('id') id: string) {
    const result = await this.bloodIssuesService.findByRequestId(id);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Retrieves a single blood request by MongoDB ID or public requestCode.
   * GET /api/blood-requests/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const request = await this.bloodRequestService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      data: request,
    };
  }

  /**
   * Updates the status of a blood request following the state machine rules.
   * PATCH /api/blood-requests/:id/status
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateBloodRequestStatusDto,
  ) {
    const updated = await this.bloodRequestService.updateStatus(
      id,
      updateStatusDto,
    );
    return {
      statusCode: HttpStatus.OK,
      message: `Blood request status updated to ${updated.status}`,
      data: updated,
    };
  }
}
