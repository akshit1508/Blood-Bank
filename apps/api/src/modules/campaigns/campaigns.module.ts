import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Campaign, CampaignSchema } from './schemas/campaign.schema';
import {
  CampaignBudgetRevision,
  CampaignBudgetRevisionSchema,
} from './schemas/campaign-budget-revision.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Donation, DonationSchema } from '../donations/schemas/donation.schema';
import { BloodUnit, BloodUnitSchema } from '../blood-units/schemas/blood-unit.schema';
import { BloodTesting, BloodTestingSchema } from '../testing/schemas/blood-testing.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { Donor, DonorSchema } from '../donors/schemas/donor.schema';
import { CampaignsService } from './services/campaigns.service';
import { CampaignsController } from './controllers/campaigns.controller';
import { DonorsModule } from '../donors/donors.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: CampaignBudgetRevision.name, schema: CampaignBudgetRevisionSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: BloodUnit.name, schema: BloodUnitSchema },
      { name: BloodTesting.name, schema: BloodTestingSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Donor.name, schema: DonorSchema },
    ]),
    DonorsModule,
    InventoryModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
