import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BloodIssuesService } from './blood-issues.service';
import { BloodIssuesController } from './blood-issues.controller';
import { BloodIssue, BloodIssueSchema } from './schemas/blood-issue.schema';
import {
  Reservation,
  ReservationSchema,
} from '../reservations/schemas/reservation.schema';
import {
  BloodRequest,
  BloodRequestSchema,
} from '../../blood-requests/schemas/blood-request.schema';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import {
  InventoryHistory,
  InventoryHistorySchema,
} from '../inventory/schemas/inventory-history.schema';
import {
  BloodUnit,
  BloodUnitSchema,
} from '../blood-units/schemas/blood-unit.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BloodIssue.name, schema: BloodIssueSchema },
      { name: Reservation.name, schema: ReservationSchema },
      { name: BloodRequest.name, schema: BloodRequestSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: InventoryHistory.name, schema: InventoryHistorySchema },
      { name: BloodUnit.name, schema: BloodUnitSchema },
    ]),
  ],
  controllers: [BloodIssuesController],
  providers: [BloodIssuesService],
  exports: [BloodIssuesService],
})
export class BloodIssuesModule {}
