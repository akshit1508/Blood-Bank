import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Campaign, CampaignSchema } from './schemas/campaign.schema';
import {
  CampaignBudgetRevision,
  CampaignBudgetRevisionSchema,
} from './schemas/campaign-budget-revision.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Donation, DonationSchema } from '../donations/schemas/donation.schema';
import { CampaignsService } from './services/campaigns.service';
import { CampaignsController } from './controllers/campaigns.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: CampaignBudgetRevision.name, schema: CampaignBudgetRevisionSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Donation.name, schema: DonationSchema },
    ]),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
