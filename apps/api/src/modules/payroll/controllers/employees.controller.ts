import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { EmployeesService } from '../services/employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  QueryEmployeesDto,
} from '../dto/employee.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminRole } from '../../auth/schemas/admin-user.schema';
import { CurrentAdmin } from '../../auth/decorators/current-admin.decorator';
import { EmployeeStatus } from '../constants/payroll.constants';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  /**
   * Super Admin only: Creates a new employee profile.
   * POST /api/employees
   */
  @Post()
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.employeesService.createEmployee(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Employee created successfully',
      data,
    };
  }

  /**
   * Lists employees. Super Admin sees complete financial details; Standard Admin receives sanitized directory.
   * GET /api/employees
   */
  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async listEmployees(
    @Query() query: QueryEmployeesDto,
    @CurrentAdmin() admin: any,
  ) {
    const isSuperAdmin = admin?.role === AdminRole.SUPER_ADMIN;
    const data = await this.employeesService.listEmployees(query, isSuperAdmin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Employees retrieved successfully',
      data,
    };
  }

  /**
   * Retrieves single employee. Super Admin sees complete details; Standard Admin receives sanitized profile.
   * GET /api/employees/:id
   */
  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async getEmployeeById(
    @Param('id') id: string,
    @CurrentAdmin() admin: any,
  ) {
    const isSuperAdmin = admin?.role === AdminRole.SUPER_ADMIN;
    const data = await this.employeesService.getEmployeeById(id, isSuperAdmin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Employee details retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin only: Updates an employee profile.
   * PUT /api/employees/:id
   */
  @Put(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  async updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const data = await this.employeesService.updateEmployee(id, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Employee updated successfully',
      data,
    };
  }

  /**
   * Super Admin only: Marks an employee as resigned/terminated.
   * POST /api/employees/:id/terminate
   */
  @Post(':id/terminate')
  @Roles(AdminRole.SUPER_ADMIN)
  async terminateEmployee(
    @Param('id') id: string,
    @Body() body: { status: EmployeeStatus; dateOfLeaving: string; notes?: string },
  ) {
    const data = await this.employeesService.terminateEmployee(
      id,
      body.status,
      body.dateOfLeaving,
      body.notes,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Employee status updated successfully',
      data,
    };
  }
}
