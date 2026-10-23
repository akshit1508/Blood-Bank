import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { Donation, DonationSchema } from './schemas/donation.schema';
import { Donor, DonorSchema } from '../donors/schemas/donor.schema';
import {
  DonorScreening,
  DonorScreeningSchema,
} from '../donors/schemas/donor-screening.schema';
import {
  BloodUnit,
  BloodUnitSchema,
} from '../blood-units/schemas/blood-unit.schema';
import {
  BloodTesting,
  BloodTestingSchema,
} from '../testing/schemas/blood-testing.schema';
import { DonorsModule } from '../donors/donors.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Donation.name, schema: DonationSchema },
      { name: Donor.name, schema: DonorSchema },
      { name: DonorScreening.name, schema: DonorScreeningSchema },
      { name: BloodUnit.name, schema: BloodUnitSchema },
      { name: BloodTesting.name, schema: BloodTestingSchema },
    ]),
    DonorsModule,
    InventoryModule,
  ],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}
