import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBloodRequestDto } from '../blood-requests/dto/create-blood-request.dto';
import { UpdateBloodRequestStatusDto } from '../blood-requests/dto/update-blood-request-status.dto';
import {
  BloodComponent,
  BloodGroup,
  BloodRequestStatus,
  RequestPriority,
} from '../blood-requests/blood-request.constants';

describe('Blood Request DTO Validation', () => {
  it('passes validation with a complete and valid CreateBloodRequestDto', async () => {
    const validPayload = {
      patient: {
        name: 'Sarah Connor',
        age: 35,
        gender: 'FEMALE',
      },
      bloodGroup: BloodGroup.A_POSITIVE,
      componentType: BloodComponent.WHOLE_BLOOD,
      unitsRequested: 1,
      hospitalName: 'St. Jude General Hospital',
      doctorName: 'Dr. Michael Chen',
      priority: RequestPriority.URGENT,
      contactPerson: {
        name: 'John Connor',
        phone: '+1 555-0182',
        relationship: 'Son',
      },
      requiredDate: '2026-10-15',
    };

    const dto = plainToInstance(CreateBloodRequestDto, validPayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when required patient details are missing', async () => {
    const invalidPayload = {
      bloodGroup: BloodGroup.A_POSITIVE,
      componentType: BloodComponent.WHOLE_BLOOD,
      unitsRequested: 1,
      hospitalName: 'St. Jude General Hospital',
      doctorName: 'Dr. Michael Chen',
      priority: RequestPriority.URGENT,
      contactPerson: {
        name: 'John Connor',
        phone: '+1 555-0182',
        relationship: 'Son',
      },
      requiredDate: '2026-10-15',
    };

    const dto = plainToInstance(CreateBloodRequestDto, invalidPayload);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((err) => err.property === 'patient')).toBe(true);
  });

  it('fails validation when bloodGroup has an invalid value', async () => {
    const invalidPayload = {
      patient: { name: 'Sarah', age: 35, gender: 'FEMALE' },
      bloodGroup: 'INVALID_GROUP' as any,
      componentType: BloodComponent.WHOLE_BLOOD,
      unitsRequested: 1,
      hospitalName: 'St. Jude General Hospital',
      doctorName: 'Dr. Michael Chen',
      priority: RequestPriority.ROUTINE,
      contactPerson: {
        name: 'John',
        phone: '+1 555-0182',
        relationship: 'Son',
      },
      requiredDate: '2026-10-15',
    };

    const dto = plainToInstance(CreateBloodRequestDto, invalidPayload);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((err) => err.property === 'bloodGroup')).toBe(true);
  });

  it('fails validation when unitsRequested is less than 1', async () => {
    const invalidPayload = {
      patient: { name: 'Sarah', age: 35, gender: 'FEMALE' },
      bloodGroup: BloodGroup.O_NEGATIVE,
      componentType: BloodComponent.PRBC,
      unitsRequested: 0,
      hospitalName: 'St. Jude General Hospital',
      doctorName: 'Dr. Michael Chen',
      priority: RequestPriority.ROUTINE,
      contactPerson: {
        name: 'John',
        phone: '+1 555-0182',
        relationship: 'Son',
      },
      requiredDate: '2026-10-15',
    };

    const dto = plainToInstance(CreateBloodRequestDto, invalidPayload);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((err) => err.property === 'unitsRequested')).toBe(true);
  });

  it('validates UpdateBloodRequestStatusDto properly', async () => {
    const validStatusDto = plainToInstance(UpdateBloodRequestStatusDto, {
      status: BloodRequestStatus.VERIFIED,
      statusReason: 'Lab verification complete',
    });
    const validErrors = await validate(validStatusDto);
    expect(validErrors.length).toBe(0);

    const invalidStatusDto = plainToInstance(UpdateBloodRequestStatusDto, {
      status: 'NON_EXISTENT_STATUS',
    });
    const invalidErrors = await validate(invalidStatusDto);
    expect(invalidErrors.length).toBeGreaterThan(0);
  });
});
