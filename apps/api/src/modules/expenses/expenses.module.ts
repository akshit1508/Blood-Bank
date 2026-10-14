import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { StorageService } from './storage/storage.service';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, StorageService],
  exports: [ExpensesService, StorageService],
})
export class ExpensesModule {}
