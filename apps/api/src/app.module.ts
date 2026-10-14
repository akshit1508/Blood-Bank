import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { ExpensesModule } from './modules/expenses/expenses.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminAuthGuard } from './modules/auth/guards/admin-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env', '../../.env', '.env.local'],
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
    ExpensesModule,
    VendorsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Authentication Guard - Executes FIRST: Rejects unauthenticated requests unless marked @Public()
    {
      provide: APP_GUARD,
      useClass: AdminAuthGuard,
    },
    // Global Role Authorization Guard - Executes SECOND: Rejects authenticated users without required @Roles()
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
