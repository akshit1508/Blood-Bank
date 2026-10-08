import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { BloodUnitsService } from './blood-units.service';
import { BloodUnit } from './schemas/blood-unit.schema';
import { Donation } from '../donations/schemas/donation.schema';
import { Donor } from '../donors/schemas/donor.schema';
import {
  BloodUnitComponent,
  BloodUnitStatus,
} from './constants/blood-unit.constants';
import { DonationStatus, DonationType } from '../donations/constants/donation.constants';
import { BloodGroup, DonorStatus, Gender } from '../donors/constants/donor.constants';
import { Types } from 'mongoose';

describe('BloodUnitsService', () => {
  let service: BloodUnitsService;
  let mockBloodUnitModel: any;
  let mockDonationModel: any;
  let mockDonorModel: any;

  const validDonationId = '507f1f77bcf86cd799439011';
  const validDonorId = '507f1f77bcf86cd799439022';

  const mockDonor = {
    _id: new Types.ObjectId(validDonorId),
    donorCode: 'DON-20261008-ABCD',
    fullName: 'Robert Fox',
    gender: Gender.MALE,
    bloodGroup: BloodGroup.O_POSITIVE,
    status: DonorStatus.ACTIVE,
  };

  const mockCompletedDonation = {
    _id: new Types.ObjectId(validDonationId),
    donationCode: 'DONATION-20261008-0012',
    donorId: new Types.ObjectId(validDonorId),
    donationDate: new Date('2026-10-07T10:00:00.000Z'),
    donationType: DonationType.WHOLE_BLOOD,
    status: DonationStatus.COMPLETED,
  };

  const sampleCreateDto = {
    donationId: validDonationId,
  };

  beforeEach(async () => {
    function MockBloodUnitModel(dto: any) {
      this._id = new Types.ObjectId();
      this.unitCode = dto.unitCode;
      this.donationId = dto.donationId;
      this.donorId = dto.donorId;
      this.bloodGroup = dto.bloodGroup;
      this.componentType = dto.componentType;
      this.collectionDate = dto.collectionDate;
      this.expiryDate = dto.expiryDate;
      this.volume = dto.volume;
      this.status = dto.status;
      this.storageLocation = dto.storageLocation;
      this.notes = dto.notes;
      this.save = jest.fn().mockResolvedValue(this);
      this.populate = jest.fn().mockResolvedValue({
        ...this,
        donorId: mockDonor,
        donationId: mockCompletedDonation,
      });
    }

    MockBloodUnitModel.exists = jest.fn().mockResolvedValue(false);
    MockBloodUnitModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });
    MockBloodUnitModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    MockBloodUnitModel.findById = jest.fn();
    MockBloodUnitModel.findOne = jest.fn();
    mockBloodUnitModel = MockBloodUnitModel;

    mockDonationModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCompletedDonation),
      }),
      findOne: jest.fn(),
    };

    mockDonorModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDonor),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloodUnitsService,
        {
          provide: getModelToken(BloodUnit.name),
          useValue: mockBloodUnitModel,
        },
        {
          provide: getModelToken(Donation.name),
          useValue: mockDonationModel,
        },
        {
          provide: getModelToken(Donor.name),
          useValue: mockDonorModel,
        },
      ],
    }).compile();

    service = module.get<BloodUnitsService>(BloodUnitsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('1. create blood unit (Phase 4A)', () => {
    it('creates Blood Unit successfully from COMPLETED donation with status TESTING and generated unitCode', async () => {
      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.create(sampleCreateDto);

      expect(result).toBeDefined();
      expect(result.unitCode).toMatch(/^UNIT-\d{8}-[A-Z0-9]{4}$/);
      expect(result.status).toBe(BloodUnitStatus.TESTING);
      expect(result.bloodGroup).toBe(BloodGroup.O_POSITIVE);
      expect(result.componentType).toBe(BloodUnitComponent.WHOLE_BLOOD);
      expect(result.collectionDate).toEqual(mockCompletedDonation.donationDate);
      expect(result.donorId).toBeDefined();
      expect(result.donationId).toBeDefined();
    });

    it('creates Blood Unit with optional fields (volume, expiryDate, storageLocation, notes)', async () => {
      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const expiry = new Date('2026-11-15T10:00:00.000Z').toISOString();
      const result = await service.create({
        donationId: validDonationId,
        componentType: BloodUnitComponent.PRBC,
        volume: 350,
        expiryDate: expiry,
        storageLocation: 'Shelf-A-Rack-2',
        notes: 'Clinical intake standard volume',
      });

      expect(result).toBeDefined();
      expect(result.componentType).toBe(BloodUnitComponent.PRBC);
      expect(result.volume).toBe(350);
      expect(result.storageLocation).toBe('Shelf-A-Rack-2');
      expect(result.notes).toBe('Clinical intake standard volume');
    });

    it('throws BadRequestException when donationId is not a valid ObjectId', async () => {
      await expect(
        service.create({
          donationId: 'invalid-object-id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when donation does not exist', async () => {
      mockDonationModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.create(sampleCreateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when donation status is RECORDED', async () => {
      mockDonationModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockCompletedDonation,
          status: DonationStatus.RECORDED,
        }),
      });

      try {
        await service.create(sampleCreateDto);
        fail('Expected BadRequestException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({
          code: 'DONATION_NOT_COMPLETED',
        });
      }
    });

    it('throws BadRequestException when donation status is PROCESSING', async () => {
      mockDonationModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockCompletedDonation,
          status: DonationStatus.PROCESSING,
        }),
      });

      try {
        await service.create(sampleCreateDto);
        fail('Expected BadRequestException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({
          code: 'DONATION_NOT_COMPLETED',
        });
      }
    });

    it('throws BadRequestException when donation status is CANCELLED', async () => {
      mockDonationModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockCompletedDonation,
          status: DonationStatus.CANCELLED,
        }),
      });

      try {
        await service.create(sampleCreateDto);
        fail('Expected BadRequestException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({
          code: 'DONATION_NOT_COMPLETED',
        });
      }
    });

    it('throws ConflictException when a Blood Unit already exists for the donation', async () => {
      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          unitCode: 'UNIT-20261008-EXIST',
        }),
      });

      try {
        await service.create(sampleCreateDto);
        fail('Expected ConflictException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: 'BLOOD_UNIT_ALREADY_EXISTS',
        });
      }
    });

    it('throws ConflictException on MongoDB duplicate key error (code 11000)', async () => {
      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      function FailingMockModel(dto: any) {
        this.save = jest.fn().mockRejectedValue({ code: 11000 });
      }
      FailingMockModel.exists = jest.fn().mockResolvedValue(false);
      FailingMockModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BloodUnitsService,
          {
            provide: getModelToken(BloodUnit.name),
            useValue: FailingMockModel,
          },
          {
            provide: getModelToken(Donation.name),
            useValue: mockDonationModel,
          },
          {
            provide: getModelToken(Donor.name),
            useValue: mockDonorModel,
          },
        ],
      }).compile();

      const failingService = module.get<BloodUnitsService>(BloodUnitsService);

      try {
        await failingService.create(sampleCreateDto);
        fail('Expected ConflictException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: 'BLOOD_UNIT_ALREADY_EXISTS',
        });
      }
    });

    it('throws NotFoundException when donor associated with donation cannot be found', async () => {
      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockDonorModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.create(sampleCreateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when collectionDate is in the future (> now + 120s)', async () => {
      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      mockDonationModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockCompletedDonation,
          donationDate: futureDate,
        }),
      });

      await expect(service.create(sampleCreateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when expiryDate is before or equal to collectionDate', async () => {
      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const pastExpiry = new Date('2026-10-05T00:00:00.000Z').toISOString();
      await expect(
        service.create({
          donationId: validDonationId,
          expiryDate: pastExpiry,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. findAll with filters and pagination', () => {
    it('returns paginated list of blood units and computes totalPages', async () => {
      const mockUnits = [
        {
          unitCode: 'UNIT-20261008-0001',
          status: BloodUnitStatus.TESTING,
          bloodGroup: BloodGroup.O_POSITIVE,
          componentType: BloodUnitComponent.WHOLE_BLOOD,
        },
      ];

      mockBloodUnitModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockUnits),
              }),
            }),
          }),
        }),
      });
      mockBloodUnitModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.page).toBe(1);
    });

    it('applies filters: status, bloodGroup, componentType, donorId, donationId', async () => {
      mockBloodUnitModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      mockBloodUnitModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({
        status: BloodUnitStatus.TESTING,
        bloodGroup: BloodGroup.O_POSITIVE,
        componentType: BloodUnitComponent.WHOLE_BLOOD,
        donorId: validDonorId,
        donationId: validDonationId,
      });

      expect(mockBloodUnitModel.find).toHaveBeenCalledWith({
        status: BloodUnitStatus.TESTING,
        bloodGroup: BloodGroup.O_POSITIVE,
        componentType: BloodUnitComponent.WHOLE_BLOOD,
        donorId: new Types.ObjectId(validDonorId),
        donationId: new Types.ObjectId(validDonationId),
      });
    });
  });

  describe('3. findOne blood unit', () => {
    it('finds blood unit by valid ObjectId', async () => {
      const sampleUnit = {
        _id: new Types.ObjectId(),
        unitCode: 'UNIT-20261008-0001',
        status: BloodUnitStatus.TESTING,
      };

      mockBloodUnitModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sampleUnit),
        }),
      });

      const result = await service.findOne(validDonationId);
      expect(result).toBeDefined();
      expect(result.unitCode).toBe('UNIT-20261008-0001');
    });

    it('finds blood unit by human-readable unitCode', async () => {
      const sampleUnit = {
        _id: new Types.ObjectId(),
        unitCode: 'UNIT-20261008-XYZ1',
        status: BloodUnitStatus.TESTING,
      };

      mockBloodUnitModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sampleUnit),
        }),
      });

      const result = await service.findOne('UNIT-20261008-XYZ1');
      expect(result).toBeDefined();
      expect(result.unitCode).toBe('UNIT-20261008-XYZ1');
    });

    it('throws NotFoundException when blood unit does not exist', async () => {
      mockBloodUnitModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.findOne('UNIT-NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('4. findByDonationId', () => {
    it('throws BadRequestException for invalid donationId format', async () => {
      await expect(service.findByDonationId('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns blood unit when found by donationId', async () => {
      const sampleUnit = {
        _id: new Types.ObjectId(),
        unitCode: 'UNIT-20261008-0001',
        donationId: new Types.ObjectId(validDonationId),
        status: BloodUnitStatus.TESTING,
      };

      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sampleUnit),
        }),
      });

      const result = await service.findByDonationId(validDonationId);
      expect(result).toBeDefined();
      expect(result!.unitCode).toBe('UNIT-20261008-0001');
      expect(mockBloodUnitModel.findOne).toHaveBeenCalledWith({
        donationId: new Types.ObjectId(validDonationId),
      });
    });

    it('throws NotFoundException when no blood unit exists for donation', async () => {
      mockBloodUnitModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.findByDonationId(validDonationId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
