import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestingController } from './testing.controller';
import { TestingService } from './testing.service';
import {
  BloodTesting,
  BloodTestingSchema,
} from './schemas/blood-testing.schema';
import {
  BloodUnit,
  BloodUnitSchema,
} from '../blood-units/schemas/blood-unit.schema';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BloodTesting.name, schema: BloodTestingSchema },
      { name: BloodUnit.name, schema: BloodUnitSchema },
      { name: Inventory.name, schema: InventorySchema },
    ]),
  ],
  controllers: [TestingController],
  providers: [TestingService],
  exports: [TestingService],
})
export class TestingModule {}
