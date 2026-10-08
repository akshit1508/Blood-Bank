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
import { BloodAcquisitionsService } from './blood-acquisitions.service';
import { CreateBloodAcquisitionDto } from './dto/create-blood-acquisition.dto';
import { QueryBloodAcquisitionsDto } from './dto/query-blood-acquisitions.dto';

/**
 * Controller for managing External Blood Acquisitions / Receipts.
 *
 * NOTE: These endpoints are strictly internal for authorized blood bank administrative
 * and laboratory staff. Public access is prohibited. Full JWT + RBAC guards will be
 * attached when authentication slice is enforced.
 */
@Controller('blood-acquisitions')
export class BloodAcquisitionsController {
  constructor(
    private readonly bloodAcquisitionsService: BloodAcquisitionsService,
  ) {}

  /**
   * Records a new external blood receipt event with bulk entries,
   * generates individual Blood Units, and adds pre-cleared units to inventory.
   * POST /api/blood-acquisitions
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateBloodAcquisitionDto) {
    const result = await this.bloodAcquisitionsService.create(createDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: `External blood receipt '${result.receipt.receiptCode}' registered successfully with ${result.totalUnitsCreated} units created.`,
      data: result,
    };
  }

  /**
   * Retrieves summary metrics for acquisition dashboard stat cards.
   * GET /api/blood-acquisitions/summary
   */
  @Get('summary')
  async getSummary() {
    const stats = await this.bloodAcquisitionsService.getSummary();
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood acquisition summary retrieved successfully',
      data: stats,
    };
  }

  /**
   * Lists external receipts with filtering and pagination.
   * GET /api/blood-acquisitions
   */
  @Get()
  async findAll(@Query() query: QueryBloodAcquisitionsDto) {
    const result = await this.bloodAcquisitionsService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood acquisition receipts retrieved successfully',
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
   * Retrieves a single receipt by ID or human-readable receiptCode.
   * GET /api/blood-acquisitions/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const receipt = await this.bloodAcquisitionsService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood acquisition receipt details retrieved successfully',
      data: receipt,
    };
  }

  /**
   * Retrieves all individual Blood Units generated from a specific receipt.
   * GET /api/blood-acquisitions/:id/units
   */
  @Get(':id/units')
  async findUnits(@Param('id') id: string) {
    const units = await this.bloodAcquisitionsService.findUnitsByReceiptId(id);
    return {
      statusCode: HttpStatus.OK,
      message: `Blood units for receipt retrieved successfully (${units.length} units)`,
      data: units,
    };
  }
}
