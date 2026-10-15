import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Volunteer, VolunteerSchema } from './schemas/volunteer.schema';
import {
  CampaignVolunteer,
  CampaignVolunteerSchema,
} from './schemas/campaign-volunteer.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Volunteer.name, schema: VolunteerSchema },
      { name: CampaignVolunteer.name, schema: CampaignVolunteerSchema },
      { name: Campaign.name, schema: CampaignSchema },
    ]),
  ],
  controllers: [VolunteersController],
  providers: [VolunteersService],
  exports: [VolunteersService],
})
export class VolunteersModule {}
