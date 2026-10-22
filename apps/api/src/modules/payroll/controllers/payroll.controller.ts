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
import { PayrollService } from '../services/payroll.service';
import {
  GeneratePayrollRunDto,
  ApprovePayrollRunDto,
  DisburseSalarySlipDto,
  BatchDisbursePayrollDto,
  QueryPayrollRunsDto,
  DirectPayEmployeeDto,
  QueryPayrollRosterDto,
} from '../dto/payroll-run.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminRole } from '../../auth/schemas/admin-user.schema';
import { CurrentAdmin } from '../../auth/decorators/current-admin.decorator';

@Roles(AdminRole.SUPER_ADMIN)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /**
   * Super Admin only: Retrieves payroll dashboard overview metrics.
   * GET /api/payroll/summary
   */
  @Get('summary')
  async getPayrollSummary() {
    const data = await this.payrollService.getPayrollSummary();
    return {
      statusCode: HttpStatus.OK,
      message: 'Payroll summary retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin only: Consolidated dashboard roster with employees, defined salary, and payout status.
   * GET /api/payroll/dashboard-roster
   */
  @Get('dashboard-roster')
  async getDashboardRoster(@Query() query: QueryPayrollRosterDto) {
    const data = await this.payrollService.getDashboardRoster(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Payroll roster retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin only: Generates a monthly payroll run for period (YYYY-MM).
   * POST /api/payroll/runs
   */
  @Post('runs')
  @HttpCode(HttpStatus.CREATED)
  async generateMonthlyPayroll(
    @Body() dto: GeneratePayrollRunDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.payrollService.generateMonthlyPayroll(dto, {
      id: admin?.id || admin?._id,
      fullName: admin?.fullName || 'Super Admin',
      email: admin?.email,
      role: admin?.role,
    });
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Monthly payroll run generated successfully',
      data,
    };
  }

  /**
   * Super Admin only: Lists monthly payroll runs.
   * GET /api/payroll/runs
   */
  @Get('runs')
  async listPayrollRuns(@Query() query: QueryPayrollRunsDto) {
    const data = await this.payrollService.listPayrollRuns(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Payroll runs retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin only: Retrieves a single monthly payroll run by ID.
   * GET /api/payroll/runs/:id
   */
  @Get('runs/:id')
  async getPayrollRunById(@Param('id') id: string) {
    const data = await this.payrollService.getPayrollRunById(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Payroll run details retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin only: Approves a DRAFT payroll run for disbursement.
   * POST /api/payroll/runs/:id/approve
   */
  @Post('runs/:id/approve')
  async approvePayrollRun(
    @Param('id') id: string,
    @Body() dto: ApprovePayrollRunDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.payrollService.approvePayrollRun(id, dto, {
      id: admin?.id || admin?._id,
      fullName: admin?.fullName || 'Super Admin',
      email: admin?.email,
      role: admin?.role,
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Payroll run approved successfully',
      data,
    };
  }

  /**
   * Super Admin only: Batch disburses all pending slips in an approved payroll run.
   * POST /api/payroll/runs/:id/batch-disburse
   */
  @Post('runs/:id/batch-disburse')
  async batchDisburseRun(
    @Param('id') id: string,
    @Body() dto: BatchDisbursePayrollDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.payrollService.batchDisburseRun(id, dto, {
      id: admin?.id || admin?._id,
      fullName: admin?.fullName || 'Super Admin',
      email: admin?.email,
      role: admin?.role,
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Batch disbursement completed successfully',
      data,
    };
  }

  /**
   * Super Admin only: Lists all individual salary slips for a payroll run.
   * GET /api/payroll/runs/:id/slips
   */
  @Get('runs/:id/slips')
  async getSalarySlipsForRun(@Param('id') id: string) {
    const data = await this.payrollService.getSalarySlipsForRun(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Salary slips retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin only: Retrieves a single salary slip by ID.
   * GET /api/payroll/slips/:slipId
   */
  @Get('slips/:slipId')
  async getSalarySlipById(@Param('slipId') slipId: string) {
    const data = await this.payrollService.getSalarySlipById(slipId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Salary slip retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin only: Disburses payment for an individual salary slip.
   * POST /api/payroll/slips/:slipId/disburse
   */
  @Post('slips/:slipId/disburse')
  async disburseSalarySlip(
    @Param('slipId') slipId: string,
    @Body() dto: DisburseSalarySlipDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.payrollService.disburseSalarySlip(slipId, dto, {
      id: admin?.id || admin?._id,
      fullName: admin?.fullName || 'Super Admin',
      email: admin?.email,
      role: admin?.role,
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Salary disbursed successfully',
      data,
    };
  }

  /**
   * Super Admin only: Retrieves disbursement history for a salary slip.
   * GET /api/payroll/slips/:slipId/disbursements
   */
  @Get('slips/:slipId/disbursements')
  async getDisbursementsForSlip(@Param('slipId') slipId: string) {
    const data = await this.payrollService.getDisbursementsForSlip(slipId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Salary disbursements retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin only: Directly pays an employee's salary for the month from the main dashboard.
   * POST /api/payroll/employees/:employeeId/pay
   */
  @Post('employees/:employeeId/pay')
  async directPayEmployee(
    @Param('employeeId') employeeId: string,
    @Body() dto: DirectPayEmployeeDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.payrollService.directPayEmployee(employeeId, dto, {
      id: admin?.id || admin?._id,
      fullName: admin?.fullName || 'Super Admin',
      email: admin?.email,
      role: admin?.role,
    });
    return {
      statusCode: HttpStatus.OK,
      message: data.message,
      data,
    };
  }
}
