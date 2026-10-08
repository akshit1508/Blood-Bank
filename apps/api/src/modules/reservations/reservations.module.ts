import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import {
  Reservation,
  ReservationSchema,
} from './schemas/reservation.schema';
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
import { BloodIssuesModule } from '../blood-issues/blood-issues.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reservation.name, schema: ReservationSchema },
      { name: BloodRequest.name, schema: BloodRequestSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: InventoryHistory.name, schema: InventoryHistorySchema },
      { name: BloodUnit.name, schema: BloodUnitSchema },
    ]),
    BloodIssuesModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
