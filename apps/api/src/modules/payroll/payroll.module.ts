import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from './schemas/employee.schema';
import {
  SalaryStructure,
  SalaryStructureSchema,
} from './schemas/salary-structure.schema';
import {
  MonthlyPayrollRun,
  MonthlyPayrollRunSchema,
} from './schemas/monthly-payroll-run.schema';
import { SalarySlip, SalarySlipSchema } from './schemas/salary-slip.schema';
import {
  SalaryDisbursement,
  SalaryDisbursementSchema,
} from './schemas/salary-disbursement.schema';
import { EmployeesService } from './services/employees.service';
import { SalaryStructuresService } from './services/salary-structures.service';
import { PayrollService } from './services/payroll.service';
import { EmployeesController } from './controllers/employees.controller';
import { SalaryStructuresController } from './controllers/salary-structures.controller';
import { PayrollController } from './controllers/payroll.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
      { name: SalaryStructure.name, schema: SalaryStructureSchema },
      { name: MonthlyPayrollRun.name, schema: MonthlyPayrollRunSchema },
      { name: SalarySlip.name, schema: SalarySlipSchema },
      { name: SalaryDisbursement.name, schema: SalaryDisbursementSchema },
    ]),
  ],
  controllers: [
    EmployeesController,
    SalaryStructuresController,
    PayrollController,
  ],
  providers: [
    EmployeesService,
    SalaryStructuresService,
    PayrollService,
  ],
  exports: [
    EmployeesService,
    SalaryStructuresService,
    PayrollService,
  ],
})
export class PayrollModule {}
