import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ExpiryRulesService } from '../services/expiry-rules.service';
import {
  UpdateExpiryRuleDto,
  BulkUpdateExpiryRulesDto,
} from '../dto/expiry-rule.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminRole } from '../../auth/schemas/admin-user.schema';
import { CurrentAdmin } from '../../auth/decorators/current-admin.decorator';

@Controller('inventory-expiry-rules')
export class ExpiryRulesController {
  constructor(private readonly expiryRulesService: ExpiryRulesService) {}

  /**
   * Retrieves all blood unit component expiry rules.
   * Accessible by Super Admin, Admin, and Lab Technician.
   */
  @Get()
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.LAB_TECHNICIAN,
    AdminRole.FINANCE_RECEPTIONIST,
  )
  async findAll() {
    const data = await this.expiryRulesService.findAll();
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Updates an individual blood component's shelf-life expiry rule.
   * Strictly restricted to SUPER_ADMIN.
   */
  @Put()
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateRule(
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
      message: `Shelf life rule for ${dto.componentType} updated to ${dto.shelfLifeDays} days.`,
      data,
    };
  }

  /**
   * Bulk updates multiple blood component expiry rules.
   * Strictly restricted to SUPER_ADMIN.
   */
  @Put('bulk')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkUpdate(
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
      message: 'All shelf life expiry rules updated successfully.',
      data,
    };
  }

  /**
   * Super Admin recalculation action: Backfills and evaluates expiry dates
   * for existing blood units across the inventory.
   */
  @Post('recalculate')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async recalculateExistingUnits(@CurrentAdmin() admin: any) {
    const actor = {
      id: admin?.id || admin?._id,
      email: admin?.email,
      fullName: admin?.fullName || 'Super Administrator',
      role: admin?.role || 'SUPER_ADMIN',
    };
    const result = await this.expiryRulesService.recalculateExistingUnits(actor);
    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }
}
