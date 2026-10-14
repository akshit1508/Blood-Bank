import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { SalaryStructuresService } from '../services/salary-structures.service';
import { CreateSalaryStructureDto } from '../dto/salary-structure.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminRole } from '../../auth/schemas/admin-user.schema';
import { CurrentAdmin } from '../../auth/decorators/current-admin.decorator';

@Roles(AdminRole.SUPER_ADMIN)
@Controller('payroll/structures')
export class SalaryStructuresController {
  constructor(
    private readonly salaryStructuresService: SalaryStructuresService,
  ) {}

  /**
   * Super Admin only: Creates or revises an employee's salary structure.
   * POST /api/payroll/structures/employee/:employeeId
   */
  @Post('employee/:employeeId')
  @HttpCode(HttpStatus.CREATED)
  async createSalaryStructure(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateSalaryStructureDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.salaryStructuresService.createSalaryStructure(
      employeeId,
      dto,
      {
        id: admin?.id || admin?._id,
        fullName: admin?.fullName || 'Super Admin',
      },
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Salary structure updated successfully',
      data,
    };
  }

  /**
   * Super Admin only: Retrieves the current active salary structure for an employee.
   * GET /api/payroll/structures/employee/:employeeId/active
   */
  @Get('employee/:employeeId/active')
  async getActiveStructure(@Param('employeeId') employeeId: string) {
    const data = await this.salaryStructuresService.getActiveStructure(employeeId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Active salary structure retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin only: Retrieves the salary structure revision history for an employee.
   * GET /api/payroll/structures/employee/:employeeId/history
   */
  @Get('employee/:employeeId/history')
  async getStructureHistory(@Param('employeeId') employeeId: string) {
    const data = await this.salaryStructuresService.getStructureHistory(employeeId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Salary structure history retrieved successfully',
      data,
    };
  }
}
