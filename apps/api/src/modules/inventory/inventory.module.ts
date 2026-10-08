import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryController } from './inventory.controller';
import { PublicBloodAvailabilityController } from './public-blood-availability.controller';
import { InventoryService } from './inventory.service';
import { Inventory, InventorySchema } from './schemas/inventory.schema';
import {
  InventoryHistory,
  InventoryHistorySchema,
} from './schemas/inventory-history.schema';
import {
  BloodUnit,
  BloodUnitSchema,
} from '../blood-units/schemas/blood-unit.schema';
import {
  BloodTesting,
  BloodTestingSchema,
} from '../testing/schemas/blood-testing.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inventory.name, schema: InventorySchema },
      { name: InventoryHistory.name, schema: InventoryHistorySchema },
      { name: BloodUnit.name, schema: BloodUnitSchema },
      { name: BloodTesting.name, schema: BloodTestingSchema },
    ]),
  ],
  controllers: [InventoryController, PublicBloodAvailabilityController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
