import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ExpiryRulesService } from './services/expiry-rules.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { DiscardInventoryDto } from './dto/discard-inventory.dto';
import {
  UpdateExpiryRuleDto,
  BulkUpdateExpiryRulesDto,
} from './dto/expiry-rule.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

/**
 * Controller for managing operational inventory.
 */
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.FINANCE_RECEPTIONIST)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly expiryRulesService: ExpiryRulesService,
  ) {}

  /**
   * Internal operation: Create an inventory record from an APPROVED blood unit.
   * POST /api/inventory/from-blood-unit/:bloodUnitId
   */
  @Post('from-blood-unit/:bloodUnitId')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createFromBloodUnit(
    @Param('bloodUnitId') bloodUnitId: string,
    @CurrentAdmin() admin: any,
  ) {
    const item = await this.inventoryService.createFromBloodUnit(bloodUnitId, admin);
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
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
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
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async discardItem(
    @Param('id') id: string,
    @Body() dto: DiscardInventoryDto,
    @CurrentAdmin() admin: any,
  ) {
    const item = await this.inventoryService.discardItem(id, dto, admin);
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
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async discardItemPost(
    @Param('id') id: string,
    @Body() dto: DiscardInventoryDto,
    @CurrentAdmin() admin: any,
  ) {
    const item = await this.inventoryService.discardItem(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Inventory unit discarded successfully',
      data: item,
    };
  }

  /**
   * Internal operation: Retrieve all component expiry rules.
   * Placed before :id parameter route to prevent route collision.
   * GET /api/inventory/expiry-rules
   */
  @Get('expiry-rules')
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.LAB_TECHNICIAN,
    AdminRole.FINANCE_RECEPTIONIST,
  )
  async getExpiryRules() {
    const data = await this.expiryRulesService.findAll();
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Updates single blood component expiry rule.
   * PUT /api/inventory/expiry-rules
   */
  @Put('expiry-rules')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateExpiryRule(
    @Body() dto: UpdateExpiryRuleDto,
    @CurrentAdmin() admin: any,
  ) {
    const actor = {
      id: admin?.id || admin?._id,
      email: admin?.email,
      fullName: admin?.fullName || 'Super Administrator',
      role: admin?.role || 'SUPER_ADMIN',
    };
    const data = await this.expiryRulesService.update(dto, actor);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood component expiry rule updated successfully',
      data,
    };
  }

  /**
   * Bulk updates blood component expiry rules.
   * PUT /api/inventory/expiry-rules/bulk
   */
  @Put('expiry-rules/bulk')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkUpdateExpiryRules(
    @Body() dto: BulkUpdateExpiryRulesDto,
    @CurrentAdmin() admin: any,
  ) {
    const actor = {
      id: admin?.id || admin?._id,
      email: admin?.email,
      fullName: admin?.fullName || 'Super Administrator',
      role: admin?.role || 'SUPER_ADMIN',
    };
    const data = await this.expiryRulesService.bulkUpdate(dto, actor);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood component expiry rules bulk-updated successfully',
      data,
    };
  }

  /**
   * Recalculates expiry dates for existing inventory units.
   * POST /api/inventory/expiry-rules/recalculate
   */
  @Post('expiry-rules/recalculate')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async recalculateInventoryExpiries() {
    const result = await this.expiryRulesService.recalculateExistingUnits();
    return {
      statusCode: HttpStatus.OK,
      message: `Recalculation complete. Updated ${result.updatedCount} blood units.`,
      updatedCount: result.updatedCount,
    };
  }

  /**
   * Internal operation: Retrieve single inventory record by MongoDB _id.
   * GET /api/inventory/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (id === 'expiry-rules') {
      const data = await this.expiryRulesService.findAll();
      return {
        statusCode: HttpStatus.OK,
        data,
      };
    }
    const item = await this.inventoryService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Inventory record retrieved successfully',
      data: item,
    };
  }
}
