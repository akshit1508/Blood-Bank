import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BloodRequestController } from './blood-request.controller';
import { BloodRequestService } from './blood-request.service';
import {
  BloodRequest,
  BloodRequestSchema,
} from './schemas/blood-request.schema';
import { InventoryModule } from '../modules/inventory/inventory.module';
import { ReservationsModule } from '../modules/reservations/reservations.module';
import { BloodIssuesModule } from '../modules/blood-issues/blood-issues.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BloodRequest.name, schema: BloodRequestSchema },
    ]),
    InventoryModule,
    ReservationsModule,
    BloodIssuesModule,
  ],
  controllers: [BloodRequestController],
  providers: [BloodRequestService],
  exports: [BloodRequestService],
})
export class BloodRequestModule {}
