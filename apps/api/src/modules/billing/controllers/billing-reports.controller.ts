import {
  Controller,
  Get,
  Query,
  HttpStatus,
} from '@nestjs/common';
import { BillingReportsService } from '../services/billing-reports.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminRole } from '../../auth/schemas/admin-user.schema';

@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.FINANCE_RECEPTIONIST)
@Controller('billing/reports')
export class BillingReportsController {
  constructor(private readonly reportsService: BillingReportsService) {}

  /**
   * Retrieves the Daily Day-End Cashier Register.
   * GET /api/billing/reports/daily-register?date=YYYY-MM-DD
   */
  @Get('daily-register')
  async getDailyRegister(@Query('date') date?: string) {
    const data = await this.reportsService.getDailyRegister(date);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Retrieves overall billing summary metrics.
   * GET /api/billing/reports/summary
   */
  @Get('summary')
  async getSummary() {
    const data = await this.reportsService.getRevenueSummary();
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }
}
