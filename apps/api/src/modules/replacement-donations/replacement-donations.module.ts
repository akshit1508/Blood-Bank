import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ReplacementDonation,
  ReplacementDonationSchema,
} from './schemas/replacement-donation.schema';
import {
  BloodRequest,
  BloodRequestSchema,
} from '../../blood-requests/schemas/blood-request.schema';
import { Donor, DonorSchema } from '../donors/schemas/donor.schema';
import { Donation, DonationSchema } from '../donations/schemas/donation.schema';
import {
  BloodUnit,
  BloodUnitSchema,
} from '../blood-units/schemas/blood-unit.schema';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import { DonorsModule } from '../donors/donors.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ReplacementDonationsService } from './replacement-donations.service';
import { ReplacementDonationsController } from './replacement-donations.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReplacementDonation.name, schema: ReplacementDonationSchema },
      { name: BloodRequest.name, schema: BloodRequestSchema },
      { name: Donor.name, schema: DonorSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: BloodUnit.name, schema: BloodUnitSchema },
      { name: Inventory.name, schema: InventorySchema },
    ]),
    DonorsModule,
    AuditLogsModule,
  ],
  controllers: [ReplacementDonationsController],
  providers: [ReplacementDonationsService],
  exports: [ReplacementDonationsService],
})
export class ReplacementDonationsModule {}
