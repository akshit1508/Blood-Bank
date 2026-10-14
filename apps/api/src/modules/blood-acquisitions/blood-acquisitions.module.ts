import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BloodAcquisitionsController } from './blood-acquisitions.controller';
import { BloodAcquisitionsService } from './blood-acquisitions.service';
import {
  BloodAcquisition,
  BloodAcquisitionSchema,
} from './schemas/blood-acquisition.schema';
import {
  BloodUnit,
  BloodUnitSchema,
} from '../blood-units/schemas/blood-unit.schema';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import {
  BloodTesting,
  BloodTestingSchema,
} from '../testing/schemas/blood-testing.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { InventoryModule } from '../inventory/inventory.module';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BloodAcquisition.name, schema: BloodAcquisitionSchema },
      { name: BloodUnit.name, schema: BloodUnitSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: BloodTesting.name, schema: BloodTestingSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
    InventoryModule,
    ExpensesModule,
  ],
  controllers: [BloodAcquisitionsController],
  providers: [BloodAcquisitionsService],
  exports: [BloodAcquisitionsService],
})
export class BloodAcquisitionsModule {}
