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
import { CollectionsService } from '../services/collections.service';
import { RecordCollectionDto } from '../dto/collection.dto';
import { QueryCollectionsDto } from '../dto/query-billing.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminRole } from '../../auth/schemas/admin-user.schema';
import { CurrentAdmin } from '../../auth/decorators/current-admin.decorator';

@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.FINANCE_RECEPTIONIST)
@Controller('billing/collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  /**
   * Records a payment collection against an invoice.
   * POST /api/billing/invoices/:invoiceId/collections
   */
  @Post(':invoiceId')
  @HttpCode(HttpStatus.CREATED)
  async recordCollection(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: RecordCollectionDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.collectionsService.recordCollection(invoiceId, dto, {
      id: admin?.id || admin?._id,
      email: admin?.email,
      fullName: admin?.fullName,
      role: admin?.role,
    });
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Payment collection recorded successfully',
      data,
    };
  }

  /**
   * Retrieves collection receipts with optional filters.
   * GET /api/billing/collections
   */
  @Get()
  async findAll(@Query() query: QueryCollectionsDto) {
    const result = await this.collectionsService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }

  /**
   * Retrieves collections recorded for a specific invoice.
   * GET /api/billing/collections/by-invoice/:invoiceId
   */
  @Get('by-invoice/:invoiceId')
  async findByInvoiceId(@Param('invoiceId') invoiceId: string) {
    const data = await this.collectionsService.findByInvoiceId(invoiceId);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Retrieves a single collection receipt by ID or receiptNumber.
   * GET /api/billing/collections/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.collectionsService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }
}
