import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReceptionistController } from './receptionist.controller';
import { ReceptionistService } from './receptionist.service';
import {
  BloodIssue,
  BloodIssueSchema,
} from '../blood-issues/schemas/blood-issue.schema';
import {
  BloodIssueInvoice,
  BloodIssueInvoiceSchema,
} from '../billing/schemas/blood-issue-invoice.schema';
import {
  BloodIssueCollection,
  BloodIssueCollectionSchema,
} from '../billing/schemas/blood-issue-collection.schema';
import {
  BloodRequest,
  BloodRequestSchema,
} from '../../blood-requests/schemas/blood-request.schema';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BloodIssue.name, schema: BloodIssueSchema },
      { name: BloodIssueInvoice.name, schema: BloodIssueInvoiceSchema },
      { name: BloodIssueCollection.name, schema: BloodIssueCollectionSchema },
      { name: BloodRequest.name, schema: BloodRequestSchema },
      { name: Inventory.name, schema: InventorySchema },
    ]),
  ],
  controllers: [ReceptionistController],
  providers: [ReceptionistService],
  exports: [ReceptionistService],
})
export class ReceptionistModule {}
