import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
    ]),
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, StorageService],
  exports: [ExpensesService, StorageService],
})
export class ExpensesModule {}
