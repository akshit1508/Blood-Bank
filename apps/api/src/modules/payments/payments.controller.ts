import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, CancelPaymentDto, QueryPaymentsDto } from './dto/payment.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Super Admin operation: Record disbursement with atomic concurrency control and persistent idempotency.
   * POST /api/payments
   */
  @Post()
  @Roles(AdminRole.SUPER_ADMIN)
  async recordPayment(@Body() dto: CreatePaymentDto, @Req() req: any) {
    return this.paymentsService.recordPayment(dto, req.user);
  }

  /**
   * Super Admin operation: Aggregated report of all approved expenses with unpaid balances ($B > 0).
   * GET /api/payments/outstanding-dues
   */
  @Get('outstanding-dues')
  @Roles(AdminRole.SUPER_ADMIN)
  async getOutstandingDues() {
    return this.paymentsService.getOutstandingDues();
  }

  /**
   * Super Admin operation: Lists payments with pagination and filters.
   * GET /api/payments
   */
  @Get()
  @Roles(AdminRole.SUPER_ADMIN)
  async findAll(@Query() query: QueryPaymentsDto) {
    return this.paymentsService.findAll(query);
  }

  /**
   * Super Admin operation: Single disbursement details with linked expense summary.
   * GET /api/payments/:id
   */
  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  async findOne(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }

  /**
   * Super Admin operation: Atomically cancels a payment with mandatory reason and rolls back the expense balance.
   * POST /api/payments/:id/cancel
   */
  @Post(':id/cancel')
  @Roles(AdminRole.SUPER_ADMIN)
  async cancelPayment(
    @Param('id') id: string,
    @Body() dto: CancelPaymentDto,
    @Req() req: any,
  ) {
    return this.paymentsService.cancelPayment(id, dto, req.user);
  }
}
