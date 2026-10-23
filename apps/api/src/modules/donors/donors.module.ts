import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DonorsController } from './donors.controller';
import { DonorsService } from './donors.service';
import { Donor, DonorSchema } from './schemas/donor.schema';
import { Donation, DonationSchema } from '../donations/schemas/donation.schema';
import {
  DonorScreening,
  DonorScreeningSchema,
} from './schemas/donor-screening.schema';
import { DonorEligibilityService } from './services/donor-eligibility.service';
import { DonorScreeningService } from './services/donor-screening.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Donor.name, schema: DonorSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: DonorScreening.name, schema: DonorScreeningSchema },
    ]),
  ],
  controllers: [DonorsController],
  providers: [DonorsService, DonorEligibilityService, DonorScreeningService],
  exports: [DonorsService, DonorEligibilityService, DonorScreeningService],
})
export class DonorsModule {}
