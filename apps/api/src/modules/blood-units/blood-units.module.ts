import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BloodUnitsController } from './blood-units.controller';
import { BloodUnitsService } from './blood-units.service';
import { BloodUnit, BloodUnitSchema } from './schemas/blood-unit.schema';
import { Donation, DonationSchema } from '../donations/schemas/donation.schema';
import { Donor, DonorSchema } from '../donors/schemas/donor.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BloodUnit.name, schema: BloodUnitSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: Donor.name, schema: DonorSchema },
      { name: Inventory.name, schema: InventorySchema },
    ]),
    forwardRef(() => InventoryModule),
  ],
  controllers: [BloodUnitsController],
  providers: [BloodUnitsService],
  exports: [BloodUnitsService],
})
export class BloodUnitsModule {}
