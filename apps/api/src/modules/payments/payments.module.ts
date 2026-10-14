import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import {
  BloodAcquisition,
  BloodAcquisitionSchema,
} from '../blood-acquisitions/schemas/blood-acquisition.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: BloodAcquisition.name, schema: BloodAcquisitionSchema },
    ]),
    AuthModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
