import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DonorsController } from './donors.controller';
import { DonorsService } from './donors.service';
import { Donor, DonorSchema } from './schemas/donor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Donor.name, schema: DonorSchema }]),
  ],
  controllers: [DonorsController],
  providers: [DonorsService],
  exports: [DonorsService],
})
export class DonorsModule {}
