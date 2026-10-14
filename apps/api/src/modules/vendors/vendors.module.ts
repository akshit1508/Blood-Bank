import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { Vendor, VendorSchema } from './schemas/vendor.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import {
  BloodAcquisition,
  BloodAcquisitionSchema,
} from '../blood-acquisitions/schemas/blood-acquisition.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vendor.name, schema: VendorSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: BloodAcquisition.name, schema: BloodAcquisitionSchema },
    ]),
    AuthModule,
  ],
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
