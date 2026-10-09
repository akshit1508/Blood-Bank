import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BloodRequestModule } from './blood-requests/blood-request.module';
import { DonorsModule } from './modules/donors/donors.module';
import { DonationsModule } from './modules/donations/donations.module';
import { BloodUnitsModule } from './modules/blood-units/blood-units.module';
import { TestingModule } from './modules/testing/testing.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { BloodIssuesModule } from './modules/blood-issues/blood-issues.module';
import { BloodAcquisitionsModule } from './modules/blood-acquisitions/blood-acquisitions.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    BloodRequestModule,
    DonorsModule,
    DonationsModule,
    BloodUnitsModule,
    TestingModule,
    InventoryModule,
    ReservationsModule,
    BloodIssuesModule,
    BloodAcquisitionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
