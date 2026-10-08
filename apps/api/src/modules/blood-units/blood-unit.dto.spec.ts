import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBloodUnitDto } from './dto/create-blood-unit.dto';
import { QueryBloodUnitsDto } from './dto/query-blood-units.dto';
import {
  BloodUnitComponent,
  BloodUnitStatus,
} from './constants/blood-unit.constants';
import { BloodGroup } from '../donors/constants/donor.constants';

describe('BloodUnit DTO Validation', () => {
  describe('CreateBloodUnitDto', () => {
    it('validates a complete and valid CreateBloodUnitDto successfully', async () => {
      const validPayload = {
        donationId: '507f1f77bcf86cd799439011',
        componentType: BloodUnitComponent.WHOLE_BLOOD,
        volume: 450,
        expiryDate: '2026-11-15T10:00:00.000Z',
        storageLocation: 'Fridge-1-Shelf-B',
        notes: 'Standard collection unit',
      };

      const dto = plainToInstance(CreateBloodUnitDto, validPayload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('validates a minimal CreateBloodUnitDto successfully', async () => {
      const minimalPayload = {
        donationId: '507f1f77bcf86cd799439011',
      };

      const dto = plainToInstance(CreateBloodUnitDto, minimalPayload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails validation when donationId is missing or invalid MongoId', async () => {
      const missingPayload = {};
      const dto1 = plainToInstance(CreateBloodUnitDto, missingPayload);
      const errors1 = await validate(dto1);
      expect(errors1.some((e) => e.property === 'donationId')).toBe(true);

      const invalidPayload = { donationId: 'invalid-id' };
      const dto2 = plainToInstance(CreateBloodUnitDto, invalidPayload);
      const errors2 = await validate(dto2);
      expect(errors2.some((e) => e.property === 'donationId')).toBe(true);
    });

    it('fails validation when componentType is not an allowed enum value', async () => {
      const invalidPayload = {
        donationId: '507f1f77bcf86cd799439011',
        componentType: 'INVALID_COMPONENT',
      };

      const dto = plainToInstance(CreateBloodUnitDto, invalidPayload);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'componentType')).toBe(true);
    });

    it('fails validation when volume is not positive', async () => {
      const zeroVolume = {
        donationId: '507f1f77bcf86cd799439011',
        volume: 0,
      };

      const dto = plainToInstance(CreateBloodUnitDto, zeroVolume);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'volume')).toBe(true);
    });

    it('fails validation when expiryDate is not a valid date string', async () => {
      const invalidDate = {
        donationId: '507f1f77bcf86cd799439011',
        expiryDate: 'not-a-date',
      };

      const dto = plainToInstance(CreateBloodUnitDto, invalidDate);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'expiryDate')).toBe(true);
    });
  });

  describe('QueryBloodUnitsDto', () => {
    it('validates valid filter parameters successfully', async () => {
      const validQuery = {
        status: BloodUnitStatus.TESTING,
        bloodGroup: BloodGroup.O_POSITIVE,
        componentType: BloodUnitComponent.PRBC,
        donorId: '507f1f77bcf86cd799439022',
        donationId: '507f1f77bcf86cd799439011',
        page: '1',
        limit: '20',
      };

      const dto = plainToInstance(QueryBloodUnitsDto, validQuery);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });

    it('fails validation when status or bloodGroup is invalid enum', async () => {
      const invalidQuery = {
        status: 'UNKNOWN_STATUS',
        bloodGroup: 'INVALID_BG',
      };

      const dto = plainToInstance(QueryBloodUnitsDto, invalidQuery);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
      expect(errors.some((e) => e.property === 'bloodGroup')).toBe(true);
    });
  });
});
