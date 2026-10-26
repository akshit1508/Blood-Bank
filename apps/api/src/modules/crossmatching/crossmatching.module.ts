import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CrossmatchRecord,
  CrossmatchRecordSchema,
} from './schemas/crossmatch-record.schema';
import {
  BloodRequest,
  BloodRequestSchema,
} from '../../blood-requests/schemas/blood-request.schema';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import {
  BloodUnit,
  BloodUnitSchema,
} from '../blood-units/schemas/blood-unit.schema';
import { CrossmatchingService } from './crossmatching.service';
import { CrossmatchingController } from './crossmatching.controller';
import { ReservationsModule } from '../reservations/reservations.module';
import { BloodIssuesModule } from '../blood-issues/blood-issues.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CrossmatchRecord.name, schema: CrossmatchRecordSchema },
      { name: BloodRequest.name, schema: BloodRequestSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: BloodUnit.name, schema: BloodUnitSchema },
    ]),
    ReservationsModule,
    BloodIssuesModule,
    AuditLogsModule,
  ],
  controllers: [CrossmatchingController],
  providers: [CrossmatchingService],
  exports: [CrossmatchingService],
})
export class CrossmatchingModule {}
