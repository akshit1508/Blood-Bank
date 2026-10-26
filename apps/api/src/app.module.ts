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
import { BillingModule } from './modules/billing/billing.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { FinancialControlCenterModule } from './modules/financial-control-center/financial-control-center.module';
import { VolunteersModule } from './modules/volunteers/volunteers.module';
import { ReceptionistModule } from './modules/receptionist/receptionist.module';
import { CrossmatchingModule } from './modules/crossmatching/crossmatching.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminAuthGuard } from './modules/auth/guards/admin-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

async function resolveMongoUri(configService: ConfigService): Promise<string> {
  const configuredUri = configService.get<string>('MONGODB_URI');

  if (!configuredUri || !configuredUri.trim()) {
    const message =
      `[Database] Fatal: MONGODB_URI environment variable is missing or empty. ` +
      `Please configure MONGODB_URI in your environment or .env file with your persistent MongoDB Atlas connection string. ` +
      `The application will not switch to temporary or in-memory storage.`;
    console.error(message);
    throw new Error(message);
  }

  const sanitizedUri = configuredUri.replace(/:[^:]*@/, ':****@');

  try {
    const mongoose = await import('mongoose');
    const testConn = await mongoose.createConnection(configuredUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    }).asPromise();
    await testConn.close();
    console.log(
      `[Database] Successfully verified persistent MongoDB Atlas database connection to: ${sanitizedUri}`,
    );
    return configuredUri;
  } catch (err: any) {
    const message =
      `[Database] Fatal: Unable to connect to persistent database at ${sanitizedUri}: ${err.message}. ` +
      `Please verify your network connection, Atlas IP Access List / Network Access whitelist, and credentials. ` +
      `The application will not switch to temporary or in-memory storage to prevent data loss.`;
    console.error(message);
    throw new Error(message);
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env', '../../.env', '.env.local'],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: await resolveMongoUri(configService),
      }),
      inject: [ConfigService],
    }),
    AuditLogsModule,
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
    BillingModule,
    PayrollModule,
    CampaignsModule,
    FinancialControlCenterModule,
    VolunteersModule,
    ReceptionistModule,
    CrossmatchingModule,
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
