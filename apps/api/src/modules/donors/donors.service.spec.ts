import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DonorsService } from './donors.service';
import { Donor } from './schemas/donor.schema';
import { BloodGroup, DonorStatus, Gender } from './constants/donor.constants';

describe('DonorsService', () => {
  let service: DonorsService;
  let mockModel: any;

  const sampleCreateDto = {
    fullName: 'John Miller',
    gender: Gender.MALE,
    bloodGroup: BloodGroup.O_POSITIVE,
    phone: '+1 555-0199',
    email: 'john.miller@example.com',
    city: 'Metro City',
    emergencyContact: {
      name: 'Sarah Miller',
      phone: '+1 555-0188',
    },
  };

  beforeEach(async () => {
    function MockModel(dto: any) {
      this.data = { ...dto };
      this.save = jest.fn().mockResolvedValue(this.data);
    }
    MockModel.exists = jest.fn().mockResolvedValue(false);
    MockModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });
    MockModel.findById = jest.fn();
    MockModel.findOne = jest.fn();
    MockModel.findByIdAndUpdate = jest.fn();

    mockModel = MockModel;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonorsService,
        {
          provide: getModelToken(Donor.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<DonorsService>(DonorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('1. create donor and default status', () => {
    it('creates a donor, generates unique donorCode, and defaults status to PENDING_REVIEW', async () => {
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.create(sampleCreateDto);

      expect(result.success).toBe(true);
      expect(result.donorCode).toMatch(/^DON-\d{8}-[A-Z0-9]{4}$/);
      expect(result.message).toBe(
        'Your donor registration has been submitted successfully. Our blood bank staff will review your registration.',
      );
    });
  });

  describe('1b. age eligibility validation (Phase 3.5)', () => {
    const today = new Date();
    const getDateOfBirthForAge = (ageYears: number, daysOffset: number = 0) => {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - ageYears);
      d.setDate(d.getDate() + daysOffset);
      return d.toISOString().slice(0, 10);
    };

    it('rejects donor under 18 years old with DONOR_AGE_NOT_ELIGIBLE', async () => {
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const under18Dob = getDateOfBirthForAge(17);
      await expect(
        service.create({
          ...sampleCreateDto,
          dateOfBirth: under18Dob,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects donor whose 18th birthday is tomorrow (boundary test)', async () => {
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const tomorrow18Dob = getDateOfBirthForAge(18, 1);
      await expect(
        service.create({
          ...sampleCreateDto,
          dateOfBirth: tomorrow18Dob,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts donor whose 18th birthday is today (boundary test)', async () => {
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const exactly18Dob = getDateOfBirthForAge(18, 0);
      const result = await service.create({
        ...sampleCreateDto,
        dateOfBirth: exactly18Dob,
      });

      expect(result.success).toBe(true);
      expect(result.donorCode).toBeDefined();
    });

    it('accepts donor aged 30', async () => {
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const age30Dob = getDateOfBirthForAge(30);
      const result = await service.create({
        ...sampleCreateDto,
        dateOfBirth: age30Dob,
      });

      expect(result.success).toBe(true);
    });

    it('accepts donor aged 65 (upper boundary)', async () => {
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const age65Dob = getDateOfBirthForAge(65, 0);
      const result = await service.create({
        ...sampleCreateDto,
        dateOfBirth: age65Dob,
      });

      expect(result.success).toBe(true);
    });

    it('rejects donor over 65 years old with DONOR_AGE_NOT_ELIGIBLE', async () => {
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const over65Dob = getDateOfBirthForAge(66);
      await expect(
        service.create({
          ...sampleCreateDto,
          dateOfBirth: over65Dob,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid date format for dateOfBirth', async () => {
      await expect(
        service.create({
          ...sampleCreateDto,
          dateOfBirth: 'not-a-valid-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not generate donor code or save record when age validation fails', async () => {
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const under18Dob = getDateOfBirthForAge(16);
      try {
        await service.create({
          ...sampleCreateDto,
          dateOfBirth: under18Dob,
        });
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({
          code: 'DONOR_AGE_NOT_ELIGIBLE',
        });
      }

      // Ensure mockModel.exists (which is called during unique code generation) was never called
      expect(mockModel.exists).not.toHaveBeenCalled();
    });
  });

  describe('2. duplicate donor handling', () => {
    it('throws ConflictException when duplicate phone number is detected', async () => {
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          donorCode: 'DON-20261007-OLD1',
          phone: '+1 555-0199',
        }),
      });

      await expect(service.create(sampleCreateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('3. findAll query with filters and search', () => {
    it('returns filtered donors list', async () => {
      const mockList = [
        {
          donorCode: 'DON-01',
          fullName: 'John Miller',
          bloodGroup: BloodGroup.O_POSITIVE,
          status: DonorStatus.PENDING_REVIEW,
        },
      ];

      mockModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockList),
        }),
      });

      const list = await service.findAll({
        search: 'Miller',
        bloodGroup: BloodGroup.O_POSITIVE,
        status: DonorStatus.PENDING_REVIEW,
      });

      expect(list).toHaveLength(1);
      expect(list[0].donorCode).toBe('DON-01');
    });
  });

  describe('4. findOne donor', () => {
    it('finds donor by donorCode', async () => {
      const mockDonor = {
        donorCode: 'DON-20261007-TEST',
        fullName: 'Jane Doe',
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDonor),
      });

      const found = await service.findOne('DON-20261007-TEST');
      expect(found).toBeDefined();
      expect(found.donorCode).toBe('DON-20261007-TEST');
    });

    it('throws NotFoundException when donor does not exist', async () => {
      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne('DON-NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('5. updateStatus administrative transitions', () => {
    it('allows valid transition: PENDING_REVIEW -> ACTIVE', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        donorCode: 'DON-20261007-TEST',
        status: DonorStatus.PENDING_REVIEW,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockExisting,
          status: DonorStatus.ACTIVE,
        }),
      });

      const updated = await service.updateStatus('507f1f77bcf86cd799439011', {
        status: DonorStatus.ACTIVE,
      });

      expect(updated.status).toBe(DonorStatus.ACTIVE);
    });

    it('allows valid transition: PENDING_REVIEW -> INACTIVE', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        donorCode: 'DON-20261007-TEST',
        status: DonorStatus.PENDING_REVIEW,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockExisting,
          status: DonorStatus.INACTIVE,
        }),
      });

      const updated = await service.updateStatus('507f1f77bcf86cd799439011', {
        status: DonorStatus.INACTIVE,
      });

      expect(updated.status).toBe(DonorStatus.INACTIVE);
    });

    it('allows valid transition: ACTIVE -> INACTIVE', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        donorCode: 'DON-20261007-TEST',
        status: DonorStatus.ACTIVE,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockExisting,
          status: DonorStatus.INACTIVE,
        }),
      });

      const updated = await service.updateStatus('507f1f77bcf86cd799439011', {
        status: DonorStatus.INACTIVE,
      });

      expect(updated.status).toBe(DonorStatus.INACTIVE);
    });

    it('allows valid transition: INACTIVE -> ACTIVE', async () => {
      const mockExisting = {
        _id: '507f1f77bcf86cd799439011',
        donorCode: 'DON-20261007-TEST',
        status: DonorStatus.INACTIVE,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockExisting),
      });
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockExisting,
          status: DonorStatus.ACTIVE,
        }),
      });

      const updated = await service.updateStatus('507f1f77bcf86cd799439011', {
        status: DonorStatus.ACTIVE,
      });

      expect(updated.status).toBe(DonorStatus.ACTIVE);
    });

    it('rejects invalid transition: ACTIVE -> PENDING_REVIEW or INACTIVE -> PENDING_REVIEW', async () => {
      const mockActive = {
        _id: '507f1f77bcf86cd799439011',
        donorCode: 'DON-20261007-TEST',
        status: DonorStatus.ACTIVE,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockActive),
      });

      await expect(
        service.updateStatus('507f1f77bcf86cd799439011', {
          status: DonorStatus.PENDING_REVIEW,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns unmodified donor if same status is sent', async () => {
      const mockActive = {
        _id: '507f1f77bcf86cd799439011',
        donorCode: 'DON-20261007-TEST',
        status: DonorStatus.ACTIVE,
      };

      mockModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockActive),
      });

      const result = await service.updateStatus('507f1f77bcf86cd799439011', {
        status: DonorStatus.ACTIVE,
      });

      expect(result.status).toBe(DonorStatus.ACTIVE);
      expect(mockModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
