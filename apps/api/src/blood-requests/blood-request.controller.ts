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

@Controller('blood-requests')
export class BloodRequestController {
  constructor(private readonly bloodRequestService: BloodRequestService) {}

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
