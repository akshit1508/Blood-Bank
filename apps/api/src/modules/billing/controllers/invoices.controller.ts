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
import { InvoicesService } from '../services/invoices.service';
import { GenerateInvoiceDto, CancelInvoiceDto } from '../dto/invoice.dto';
import { ApplyWaiverDto } from '../dto/waiver.dto';
import { QueryInvoicesDto } from '../dto/query-billing.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminRole } from '../../auth/schemas/admin-user.schema';
import { CurrentAdmin } from '../../auth/decorators/current-admin.decorator';

@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.FINANCE_RECEPTIONIST)
@Controller('billing/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * Generates a billing invoice for a completed blood issue.
   * POST /api/billing/invoices/issue/:issueId
   */
  @Post('issue/:issueId')
  @HttpCode(HttpStatus.CREATED)
  async generateInvoice(
    @Param('issueId') issueId: string,
    @Body() dto: GenerateInvoiceDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.invoicesService.generateInvoice(issueId, dto, {
      id: admin?.id || admin?._id,
      email: admin?.email,
      fullName: admin?.fullName,
      role: admin?.role,
    });
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Invoice generated successfully',
      data,
    };
  }

  /**
   * Retrieves all invoices with optional status, date, and search filters.
   * GET /api/billing/invoices
   */
  @Get()
  async findAll(@Query() query: QueryInvoicesDto) {
    const result = await this.invoicesService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }

  /**
   * Retrieves invoice linked to a specific blood issue.
   * GET /api/billing/invoices/by-issue/:issueId
   */
  @Get('by-issue/:issueId')
  async findByIssueId(@Param('issueId') issueId: string) {
    const data = await this.invoicesService.findByIssueId(issueId);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Retrieves all invoices for a specific blood request.
   * GET /api/billing/invoices/by-request/:requestId
   */
  @Get('by-request/:requestId')
  async findByRequestId(@Param('requestId') requestId: string) {
    const data = await this.invoicesService.findByRequestId(requestId);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Retrieves all completed blood issues that have not yet been billed.
   * GET /api/billing/invoices/unbilled-issues
   */
  @Get('unbilled-issues')
  async findUnbilledIssues() {
    const data = await this.invoicesService.findUnbilledIssues();
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Retrieves a single invoice by ID or invoiceNumber.
   * GET /api/billing/invoices/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.invoicesService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Applies an authorized waiver / fee exemption to an invoice.
   * POST /api/billing/invoices/:id/waiver
   */
  @Post(':id/waiver')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async applyWaiver(
    @Param('id') id: string,
    @Body() dto: ApplyWaiverDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.invoicesService.applyWaiver(id, dto, {
      id: admin?.id || admin?._id,
      email: admin?.email,
      fullName: admin?.fullName,
      role: admin?.role,
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Waiver applied successfully',
      data,
    };
  }

  /**
   * Cancels an invoice. Restricted to SUPER_ADMIN.
   * POST /api/billing/invoices/:id/cancel
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelInvoice(
    @Param('id') id: string,
    @Body() dto: CancelInvoiceDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.invoicesService.cancelInvoice(id, dto, {
      id: admin?.id || admin?._id,
      email: admin?.email,
      fullName: admin?.fullName,
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Invoice cancelled successfully',
      data,
    };
  }
}
