import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { DiscardInventoryDto } from './dto/discard-inventory.dto';

/**
 * Controller for managing operational inventory.
 *
 * NOTE: These endpoints represent internal blood bank operations.
 * Public anonymous blood availability will be safely aggregated in Phase 5C.
 */
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Internal operation: Create an inventory record from an APPROVED blood unit.
   * POST /api/inventory/from-blood-unit/:bloodUnitId
   */
  @Post('from-blood-unit/:bloodUnitId')
  @HttpCode(HttpStatus.CREATED)
  async createFromBloodUnit(@Param('bloodUnitId') bloodUnitId: string) {
    const item = await this.inventoryService.createFromBloodUnit(bloodUnitId);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Blood unit added to available inventory successfully',
      data: item,
    };
  }

  /**
   * Internal operation: Aggregate real inventory summary metrics.
   * Placed before :id parameter route to prevent route collision.
   * GET /api/inventory/summary
   */
  @Get('summary')
  async getSummary() {
    const summary = await this.inventoryService.getSummary();
    return {
      statusCode: HttpStatus.OK,
      message: 'Inventory summary retrieved successfully',
      data: summary,
    };
  }

  /**
   * Internal operation: Evaluate physical expiry dates of all AVAILABLE inventory units.
   * Transitions units past expiryDate to EXPIRED.
   * POST /api/inventory/evaluate-expiry
   */
  @Post('evaluate-expiry')
  @HttpCode(HttpStatus.OK)
  async evaluateExpiry() {
    const result = await this.inventoryService.evaluateExpiry();
    return {
      statusCode: HttpStatus.OK,
      message: `Expiry evaluation completed. ${result.expiredCount} unit(s) transitioned to EXPIRED.`,
      data: result,
    };
  }

  /**
   * Internal operation: Retrieve inventory record by physical Blood Unit ID.
   * Placed before :id parameter route to prevent route collision.
   * GET /api/inventory/blood-unit/:bloodUnitId
   */
  @Get('blood-unit/:bloodUnitId')
  async findByBloodUnitId(@Param('bloodUnitId') bloodUnitId: string) {
    const item = await this.inventoryService.findByBloodUnitId(bloodUnitId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Inventory record for blood unit retrieved successfully',
      data: item,
    };
  }

  /**
   * Internal operation: Query inventory records with filtering and pagination.
   * GET /api/inventory
   */
  @Get()
  async findAll(@Query() query: QueryInventoryDto) {
    const result = await this.inventoryService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Inventory records retrieved successfully',
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
   * Internal operation: Retrieve lifecycle history for an inventory item.
   * GET /api/inventory/:id/history
   */
  @Get(':id/history')
  async getHistory(@Param('id') id: string) {
    const history = await this.inventoryService.getHistory(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Inventory lifecycle history retrieved successfully',
      data: history,
    };
  }

  /**
   * Internal operation: Discard an inventory item with a required reason.
   * PATCH /api/inventory/:id/discard
   */
  @Patch(':id/discard')
  async discardItem(
    @Param('id') id: string,
    @Body() dto: DiscardInventoryDto,
  ) {
    const item = await this.inventoryService.discardItem(id, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Inventory unit discarded successfully',
      data: item,
    };
  }

  /**
   * Fallback POST alias for discard operation.
   * POST /api/inventory/:id/discard
   */
  @Post(':id/discard')
  @HttpCode(HttpStatus.OK)
  async discardItemPost(
    @Param('id') id: string,
    @Body() dto: DiscardInventoryDto,
  ) {
    const item = await this.inventoryService.discardItem(id, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Inventory unit discarded successfully',
      data: item,
    };
  }

  /**
   * Internal operation: Retrieve single inventory record by MongoDB _id.
   * GET /api/inventory/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const item = await this.inventoryService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Inventory record retrieved successfully',
      data: item,
    };
  }
}
