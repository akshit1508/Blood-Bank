import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { BloodIssuesService } from './blood-issues.service';
import { CreateBloodIssueDto } from './dto/create-blood-issue.dto';
import { QueryBloodIssuesDto } from './dto/query-blood-issues.dto';

@Controller('blood-issues')
export class BloodIssuesController {
  constructor(private readonly bloodIssuesService: BloodIssuesService) {}

  /**
   * Retrieves all blood issue records.
   * GET /api/blood-issues
   */
  @Get()
  async findAll(@Query() query: QueryBloodIssuesDto) {
    const data = await this.bloodIssuesService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Retrieves all blood issue records for a specific blood request.
   * GET /api/blood-issues/by-request/:requestId
   */
  @Get('by-request/:requestId')
  async findByRequestId(@Param('requestId') requestId: string) {
    const data = await this.bloodIssuesService.findByRequestId(requestId);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Retrieves a single blood issue record by ID or issueCode.
   * GET /api/blood-issues/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.bloodIssuesService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Issues reserved blood units against a reservation.
   * POST /api/blood-issues/reservation/:reservationId
   */
  @Post('reservation/:reservationId')
  @HttpCode(HttpStatus.CREATED)
  async issueReservation(
    @Param('reservationId') reservationId: string,
    @Body() createDto: CreateBloodIssueDto,
  ) {
    const data = await this.bloodIssuesService.issueReservation(
      reservationId,
      createDto,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Blood units issued successfully',
      data,
    };
  }
}
