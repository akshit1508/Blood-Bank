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
import {
  BloodAcquisition,
  BloodAcquisitionSchema,
} from '../blood-acquisitions/schemas/blood-acquisition.schema';
import {
  BloodUnitExpiryRule,
  BloodUnitExpiryRuleSchema,
} from './schemas/blood-unit-expiry-rule.schema';
import { ExpiryRulesService } from './services/expiry-rules.service';
import { ExpiryRulesController } from './controllers/expiry-rules.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inventory.name, schema: InventorySchema },
      { name: InventoryHistory.name, schema: InventoryHistorySchema },
      { name: BloodUnit.name, schema: BloodUnitSchema },
      { name: BloodTesting.name, schema: BloodTestingSchema },
      { name: BloodAcquisition.name, schema: BloodAcquisitionSchema },
      { name: BloodUnitExpiryRule.name, schema: BloodUnitExpiryRuleSchema },
    ]),
  ],
  controllers: [
    InventoryController,
    PublicBloodAvailabilityController,
    ExpiryRulesController,
  ],
  providers: [InventoryService, ExpiryRulesService],
  exports: [InventoryService, ExpiryRulesService],
})
export class InventoryModule {}
