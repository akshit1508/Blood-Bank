import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationStatusDto } from './dto/update-donation-status.dto';
import { DonationStatus, DonationType } from './constants/donation.constants';

describe('Donation DTO Validation', () => {
  it('validates a complete and valid CreateDonationDto successfully', async () => {
    const validPayload = {
      donorId: '507f1f77bcf86cd799439011',
      donationDate: '2026-10-07T10:00:00.000Z',
      donationType: DonationType.WHOLE_BLOOD,
      quantity: 1,
      notes: 'Standard whole blood collection at main centre',
    };

    const dto = plainToInstance(CreateDonationDto, validPayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when donorId is missing or not a valid MongoId', async () => {
    const missingDonorId = {
      donationDate: '2026-10-07T10:00:00.000Z',
      quantity: 1,
    };

    const dto1 = plainToInstance(CreateDonationDto, missingDonorId);
    const errors1 = await validate(dto1);
    expect(errors1.some((e) => e.property === 'donorId')).toBe(true);

    const invalidMongoId = {
      donorId: 'invalid-id-string',
      donationDate: '2026-10-07T10:00:00.000Z',
      quantity: 1,
    };

    const dto2 = plainToInstance(CreateDonationDto, invalidMongoId);
    const errors2 = await validate(dto2);
    expect(errors2.some((e) => e.property === 'donorId')).toBe(true);
  });

  it('fails validation when donationDate is missing or invalid', async () => {
    const invalidDate = {
      donorId: '507f1f77bcf86cd799439011',
      donationDate: 'not-a-date',
      quantity: 1,
    };

    const dto = plainToInstance(CreateDonationDto, invalidDate);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'donationDate')).toBe(true);
  });

  it('fails validation when quantity is missing or invalid', async () => {
    const zeroQuantity = {
      donorId: '507f1f77bcf86cd799439011',
      donationDate: '2026-10-07T10:00:00.000Z',
      quantity: 0,
    };

    const dto = plainToInstance(CreateDonationDto, zeroQuantity);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });

  it('fails validation when donationType is invalid', async () => {
    const invalidType = {
      donorId: '507f1f77bcf86cd799439011',
      donationDate: '2026-10-07T10:00:00.000Z',
      donationType: 'SYNTHETIC_BLOOD' as any,
      quantity: 1,
    };

    const dto = plainToInstance(CreateDonationDto, invalidType);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'donationType')).toBe(true);
  });

  it('validates UpdateDonationStatusDto with valid and invalid values', async () => {
    const validDto = plainToInstance(UpdateDonationStatusDto, {
      status: DonationStatus.PROCESSING,
    });
    const validErrors = await validate(validDto);
    expect(validErrors.length).toBe(0);

    const invalidDto = plainToInstance(UpdateDonationStatusDto, {
      status: 'INVALID_STATUS' as any,
    });
    const invalidErrors = await validate(invalidDto);
    expect(invalidErrors.length).toBeGreaterThan(0);
  });
});
