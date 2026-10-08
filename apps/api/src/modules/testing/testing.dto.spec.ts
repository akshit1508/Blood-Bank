import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTestingDto } from './dto/create-testing.dto';
import { UpdateTestResultDto } from './dto/update-test-result.dto';
import { CompleteTestingDto } from './dto/complete-testing.dto';
import { QueryTestingDto } from './dto/query-testing.dto';
import {
  TestResultStatus,
  TestingDecision,
  TestingStatus,
} from './constants/testing.constants';

describe('Testing DTO Validation', () => {
  describe('CreateTestingDto', () => {
    it('validates a valid CreateTestingDto successfully', async () => {
      const payload = {
        bloodUnitId: '507f1f77bcf86cd799439011',
        performedBy: 'Tech Alice',
        remarks: 'Sample remarks',
      };

      const dto = plainToInstance(CreateTestingDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when bloodUnitId is missing or invalid MongoId', async () => {
      const missingPayload = {};
      const dto1 = plainToInstance(CreateTestingDto, missingPayload);
      const errors1 = await validate(dto1);
      expect(errors1.some((e) => e.property === 'bloodUnitId')).toBe(true);

      const invalidPayload = { bloodUnitId: 'not-an-id' };
      const dto2 = plainToInstance(CreateTestingDto, invalidPayload);
      const errors2 = await validate(dto2);
      expect(errors2.some((e) => e.property === 'bloodUnitId')).toBe(true);
    });
  });

  describe('UpdateTestResultDto', () => {
    it('validates a valid UpdateTestResultDto successfully', async () => {
      const payload = {
        status: TestResultStatus.PASS,
        result: 'NON_REACTIVE',
        testedAt: '2026-10-08T11:00:00.000Z',
        remarks: 'ELISA valid',
      };

      const dto = plainToInstance(UpdateTestResultDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when status is missing or invalid enum', async () => {
      const missingStatus = {
        result: 'NEGATIVE',
      };
      const dto1 = plainToInstance(UpdateTestResultDto, missingStatus);
      const errors1 = await validate(dto1);
      expect(errors1.some((e) => e.property === 'status')).toBe(true);

      const invalidStatus = {
        status: 'MAYBE',
      };
      const dto2 = plainToInstance(UpdateTestResultDto, invalidStatus);
      const errors2 = await validate(dto2);
      expect(errors2.some((e) => e.property === 'status')).toBe(true);
    });

    it('fails when testedAt is not a valid date string', async () => {
      const payload = {
        status: TestResultStatus.PASS,
        testedAt: 'not-a-date',
      };
      const dto = plainToInstance(UpdateTestResultDto, payload);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'testedAt')).toBe(true);
    });
  });

  describe('CompleteTestingDto', () => {
    it('validates valid CompleteTestingDto', async () => {
      const payload = {
        performedBy: 'Dr. Jane',
        rejectionReason: 'Serology reactive',
        remarks: 'Final sign-off',
      };

      const dto = plainToInstance(CompleteTestingDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('QueryTestingDto', () => {
    it('validates valid QueryTestingDto with string numbers', async () => {
      const query = {
        status: TestingStatus.IN_PROGRESS,
        decision: TestingDecision.PENDING,
        bloodUnitId: '507f1f77bcf86cd799439011',
        page: '1',
        limit: '15',
      };

      const dto = plainToInstance(QueryTestingDto, query);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(15);
    });

    it('fails when status or decision is invalid', async () => {
      const query = {
        status: 'INVALID_STATUS',
        decision: 'INVALID_DECISION',
      };

      const dto = plainToInstance(QueryTestingDto, query);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
      expect(errors.some((e) => e.property === 'decision')).toBe(true);
    });
  });
});
