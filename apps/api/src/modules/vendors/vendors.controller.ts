import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  /**
   * Narrow projection for Admin and Super Admin expense creation forms.
   * Returns only [{ _id, name, category }]. Strictly zero bank or balance data.
   */
  @Get('active-options')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async getActiveOptions() {
    return this.vendorsService.getActiveOptions();
  }

  /**
   * Registers a new vendor profile (Super Admin only).
   */
  @Post()
  @Roles(AdminRole.SUPER_ADMIN)
  async create(@Body() dto: CreateVendorDto, @Req() req: any) {
    return this.vendorsService.create(dto, req.user);
  }

  /**
   * Lists vendors for directory management with masked bank details (Super Admin only).
   */
  @Get()
  @Roles(AdminRole.SUPER_ADMIN)
  async findAll(@Query() query: { category?: string; search?: string; isActive?: string }) {
    return this.vendorsService.findAll(query);
  }

  /**
   * Retrieves complete vendor profile including unmasked bank details (Super Admin only).
   */
  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  async findOne(@Param('id') id: string) {
    return this.vendorsService.findById(id);
  }

  /**
   * Updates vendor profile (Super Admin only).
   */
  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @Req() req: any,
  ) {
    return this.vendorsService.update(id, dto, req.user);
  }

  /**
   * Retrieves full chronological financial statement and running balance (Super Admin only).
   */
  @Get(':id/ledger')
  @Roles(AdminRole.SUPER_ADMIN)
  async getLedger(@Param('id') id: string) {
    return this.vendorsService.getLedger(id);
  }
}
