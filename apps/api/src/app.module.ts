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
    BloodRequestModule,
    DonorsModule,
    DonationsModule,
    BloodUnitsModule,
    TestingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
