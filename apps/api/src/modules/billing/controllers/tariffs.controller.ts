import {
  Controller,
  Get,
  Put,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { TariffsService } from '../services/tariffs.service';
import { UpdateTariffDto, BulkUpdateTariffsDto } from '../dto/tariff.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminRole } from '../../auth/schemas/admin-user.schema';
import { CurrentAdmin } from '../../auth/decorators/current-admin.decorator';

@Controller('billing/tariffs')
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  /**
   * Retrieves all active processing fee tariffs.
   * Accessible by both SUPER_ADMIN and ADMIN.
   */
  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.FINANCE_RECEPTIONIST)
  async findAll() {
    const data = await this.tariffsService.findAll();
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Updates an individual component's processing fee.
   * Strictly restricted to SUPER_ADMIN.
   */
  @Put()
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateTariff(
    @Body() dto: UpdateTariffDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.tariffsService.updateTariff(dto, {
      id: admin?.id || admin?._id,
      email: admin?.email,
      fullName: admin?.fullName,
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Processing fee tariff updated successfully',
      data,
    };
  }

  /**
   * Bulk updates multiple processing fee rates at once.
   * Strictly restricted to SUPER_ADMIN.
   */
  @Put('bulk')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkUpdate(
    @Body() dto: BulkUpdateTariffsDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.tariffsService.bulkUpdateTariffs(dto, {
      id: admin?.id || admin?._id,
      email: admin?.email,
      fullName: admin?.fullName,
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Tariffs updated successfully',
      data,
    };
  }
}
