import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorStatusDto } from './dto/update-donor-status.dto';
import { BloodGroup, DonorStatus, Gender } from './constants/donor.constants';

describe('Donor DTO Validation', () => {
  it('validates a complete and valid CreateDonorDto successfully', async () => {
    const validPayload = {
      fullName: 'Emma Watson',
      gender: Gender.FEMALE,
      bloodGroup: BloodGroup.A_POSITIVE,
      phone: '+1 555-0144',
      email: 'emma@example.com',
      dateOfBirth: '1995-04-15',
      address: '123 Pine St',
      city: 'Riverside',
      emergencyContact: {
        name: 'Alex Watson',
        phone: '+1 555-0199',
      },
    };

    const dto = plainToInstance(CreateDonorDto, validPayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when fullName is missing', async () => {
    const invalidPayload = {
      gender: Gender.FEMALE,
      bloodGroup: BloodGroup.A_POSITIVE,
      phone: '+1 555-0144',
    };

    const dto = plainToInstance(CreateDonorDto, invalidPayload);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((err) => err.property === 'fullName')).toBe(true);
  });

  it('fails validation when phone is missing', async () => {
    const invalidPayload = {
      fullName: 'Emma Watson',
      gender: Gender.FEMALE,
      bloodGroup: BloodGroup.A_POSITIVE,
    };

    const dto = plainToInstance(CreateDonorDto, invalidPayload);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((err) => err.property === 'phone')).toBe(true);
  });

  it('fails validation when bloodGroup is invalid', async () => {
    const invalidPayload = {
      fullName: 'Emma Watson',
      gender: Gender.FEMALE,
      bloodGroup: 'INVALID_GROUP' as any,
      phone: '+1 555-0144',
    };

    const dto = plainToInstance(CreateDonorDto, invalidPayload);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((err) => err.property === 'bloodGroup')).toBe(true);
  });

  it('fails validation when email format is invalid', async () => {
    const invalidPayload = {
      fullName: 'Emma Watson',
      gender: Gender.FEMALE,
      bloodGroup: BloodGroup.O_POSITIVE,
      phone: '+1 555-0144',
      email: 'not-an-email',
    };

    const dto = plainToInstance(CreateDonorDto, invalidPayload);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((err) => err.property === 'email')).toBe(true);
  });

  it('validates UpdateDonorStatusDto with valid and invalid values', async () => {
    for (const st of [DonorStatus.PENDING_REVIEW, DonorStatus.ACTIVE, DonorStatus.INACTIVE]) {
      const validDto = plainToInstance(UpdateDonorStatusDto, { status: st });
      const validErrors = await validate(validDto);
      expect(validErrors.length).toBe(0);
    }

    const invalidDto = plainToInstance(UpdateDonorStatusDto, {
      status: 'NON_EXISTENT_STATUS' as any,
    });
    const invalidErrors = await validate(invalidDto);
    expect(invalidErrors.length).toBeGreaterThan(0);
  });
});
