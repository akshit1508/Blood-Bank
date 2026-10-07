import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BloodRequestController } from './blood-request.controller';
import { BloodRequestService } from './blood-request.service';
import {
  BloodRequest,
  BloodRequestSchema,
} from './schemas/blood-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BloodRequest.name, schema: BloodRequestSchema },
    ]),
  ],
  controllers: [BloodRequestController],
  providers: [BloodRequestService],
  exports: [BloodRequestService],
})
export class BloodRequestModule {}
