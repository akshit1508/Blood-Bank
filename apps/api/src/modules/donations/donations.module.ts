import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { Donation, DonationSchema } from './schemas/donation.schema';
import { Donor, DonorSchema } from '../donors/schemas/donor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Donation.name, schema: DonationSchema },
      { name: Donor.name, schema: DonorSchema },
    ]),
  ],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}
