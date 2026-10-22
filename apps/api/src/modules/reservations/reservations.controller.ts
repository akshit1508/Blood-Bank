import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';
import { BloodIssuesService } from '../blood-issues/blood-issues.service';
import { CreateBloodIssueDto } from '../blood-issues/dto/create-blood-issue.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.FINANCE_RECEPTIONIST)
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly bloodIssuesService: BloodIssuesService,
  ) {}

  /**
   * Retrieves all reservations with optional filters.
   * GET /api/reservations
   */
  @Get()
  async findAll(@Query() query: QueryReservationsDto) {
    const data = await this.reservationsService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Retrieves single reservation by ID or reservation tracking code.
   * GET /api/reservations/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.reservationsService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Cancels an active reservation, releasing held units back to AVAILABLE inventory.
   * PATCH /api/reservations/:id/cancel
   */
  @Patch(':id/cancel')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @Body() cancelDto: CancelReservationDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.reservationsService.cancelReservation(id, cancelDto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Reservation cancelled successfully; units released back to available inventory',
      data,
    };
  }

  /**
   * Issues reserved blood units against an active reservation.
   * POST /api/reservations/:id/issue
   */
  @Post(':id/issue')
  @HttpCode(HttpStatus.CREATED)
  async issue(
    @Param('id') id: string,
    @Body() createDto: CreateBloodIssueDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.bloodIssuesService.issueReservation(id, createDto, admin);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Blood units issued successfully',
      data,
    };
  }
}
