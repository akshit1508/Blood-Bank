import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinancialControlCenterController } from './financial-control-center.controller';
import { FinancialControlCenterService } from './services/financial-control-center.service';
import { FinancialExportService } from './services/financial-export.service';
import {
  BloodIssueInvoice,
  BloodIssueInvoiceSchema,
} from '../billing/schemas/blood-issue-invoice.schema';
import {
  BloodIssueCollection,
  BloodIssueCollectionSchema,
} from '../billing/schemas/blood-issue-collection.schema';
import {
  Expense,
  ExpenseSchema,
} from '../expenses/schemas/expense.schema';
import {
  Payment,
  PaymentSchema,
} from '../payments/schemas/payment.schema';
import {
  BloodAcquisition,
  BloodAcquisitionSchema,
} from '../blood-acquisitions/schemas/blood-acquisition.schema';
import {
  MonthlyPayrollRun,
  MonthlyPayrollRunSchema,
} from '../payroll/schemas/monthly-payroll-run.schema';
import {
  SalaryDisbursement,
  SalaryDisbursementSchema,
} from '../payroll/schemas/salary-disbursement.schema';
import {
  Campaign,
  CampaignSchema,
} from '../campaigns/schemas/campaign.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BloodIssueInvoice.name, schema: BloodIssueInvoiceSchema },
      { name: BloodIssueCollection.name, schema: BloodIssueCollectionSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: BloodAcquisition.name, schema: BloodAcquisitionSchema },
      { name: MonthlyPayrollRun.name, schema: MonthlyPayrollRunSchema },
      { name: SalaryDisbursement.name, schema: SalaryDisbursementSchema },
      { name: Campaign.name, schema: CampaignSchema },
    ]),
  ],
  controllers: [FinancialControlCenterController],
  providers: [
    FinancialControlCenterService,
    FinancialExportService,
  ],
  exports: [
    FinancialControlCenterService,
    FinancialExportService,
  ],
})
export class FinancialControlCenterModule {}
