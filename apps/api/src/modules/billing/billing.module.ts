import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BloodIssueTariff,
  BloodIssueTariffSchema,
} from './schemas/blood-issue-tariff.schema';
import {
  BloodIssueInvoice,
  BloodIssueInvoiceSchema,
} from './schemas/blood-issue-invoice.schema';
import {
  BloodIssueCollection,
  BloodIssueCollectionSchema,
} from './schemas/blood-issue-collection.schema';
import {
  BloodIssue,
  BloodIssueSchema,
} from '../blood-issues/schemas/blood-issue.schema';
import {
  BloodRequest,
  BloodRequestSchema,
} from '../../blood-requests/schemas/blood-request.schema';
import { TariffsService } from './services/tariffs.service';
import { InvoicesService } from './services/invoices.service';
import { CollectionsService } from './services/collections.service';
import { BillingReportsService } from './services/billing-reports.service';
import { TariffsController } from './controllers/tariffs.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { CollectionsController } from './controllers/collections.controller';
import { BillingReportsController } from './controllers/billing-reports.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BloodIssueTariff.name, schema: BloodIssueTariffSchema },
      { name: BloodIssueInvoice.name, schema: BloodIssueInvoiceSchema },
      { name: BloodIssueCollection.name, schema: BloodIssueCollectionSchema },
      { name: BloodIssue.name, schema: BloodIssueSchema },
      { name: BloodRequest.name, schema: BloodRequestSchema },
    ]),
  ],
  controllers: [
    TariffsController,
    InvoicesController,
    CollectionsController,
    BillingReportsController,
  ],
  providers: [
    TariffsService,
    InvoicesService,
    CollectionsService,
    BillingReportsService,
  ],
  exports: [
    TariffsService,
    InvoicesService,
    CollectionsService,
    BillingReportsService,
  ],
})
export class BillingModule {}
