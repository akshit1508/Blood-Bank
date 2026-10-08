import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { Donation } from './schemas/donation.schema';
import { Donor } from '../donors/schemas/donor.schema';
import { DonationStatus, DonationType } from './constants/donation.constants';
import { BloodGroup, DonorStatus, Gender } from '../donors/constants/donor.constants';
import { Types } from 'mongoose';

describe('DonationsService', () => {
  let service: DonationsService;
  let mockDonationModel: any;
  let mockDonorModel: any;

  const validDonorId = '507f1f77bcf86cd799439011';
  const mockDonor = {
    _id: new Types.ObjectId(validDonorId),
    donorCode: 'DON-20261007-TEST',
    fullName: 'Alice Walker',
    gender: Gender.FEMALE,
    bloodGroup: BloodGroup.O_POSITIVE,
    phone: '+1 555-0100',
    status: DonorStatus.ACTIVE,
  };

  const sampleCreateDto = {
    donorId: validDonorId,
    donationDate: '2026-10-07T09:30:00.000Z',
    donationType: DonationType.WHOLE_BLOOD,
    quantity: 1,
    notes: 'Voluntary donation',
  };

  beforeEach(async () => {
    function MockDonationModel(dto: any) {
      this._id = new Types.ObjectId();
      this.donationCode = dto.donationCode;
      this.donorId = dto.donorId;
      this.donationDate = dto.donationDate;
      this.donationType = dto.donationType;
      this.quantity = dto.quantity;
      this.status = dto.status;
      this.notes = dto.notes;
      this.save = jest.fn().mockResolvedValue(this);
      this.populate = jest.fn().mockResolvedValue({
        ...this,
        donorId: mockDonor,
      });
    }

    MockDonationModel.exists = jest.fn().mockResolvedValue(false);
    MockDonationModel.find = jest.fn().mockReturnValue({
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
    MockDonationModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    MockDonationModel.findById = jest.fn();
    MockDonationModel.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      populate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      exec: jest.fn().mockResolvedValue(null),
    });
    MockDonationModel.findByIdAndUpdate = jest.fn();

    mockDonationModel = MockDonationModel;

    mockDonorModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDonor),
      }),
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockDonor]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
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

    service = module.get<DonationsService>(DonationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('1. create donation and donationCode generation', () => {
    it('creates donation successfully with generated donationCode, valid donor reference, and initial RECORDED status', async () => {
      const result = await service.create(sampleCreateDto);

      expect(result).toBeDefined();
      expect(result.donationCode).toMatch(/^DONATION-\d{8}-[A-Z0-9]{4}$/);
      expect(result.status).toBe(DonationStatus.RECORDED);
      expect(result.quantity).toBe(1);
      expect(result.donorId).toBeDefined();
    });

    it('throws BadRequestException when donorId is not a valid ObjectId', async () => {
      await expect(
        service.create({
          ...sampleCreateDto,
          donorId: 'invalid-id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when referenced donor does not exist', async () => {
      mockDonorModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.create(sampleCreateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when donor status is PENDING_REVIEW', async () => {
      mockDonorModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockDonor,
          status: DonorStatus.PENDING_REVIEW,
        }),
      });

      await expect(service.create(sampleCreateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when donor status is INACTIVE', async () => {
      mockDonorModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockDonor,
          status: DonorStatus.INACTIVE,
        }),
      });

      await expect(service.create(sampleCreateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('1b. donation interval and future date validation (Phase 3.5)', () => {
    it('throws BadRequestException when donation date is in the future', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await expect(
        service.create({
          ...sampleCreateDto,
          donationDate: futureDate,
        }),
      ).rejects.toThrow('Donation date cannot be in the future.');
    });

    it('throws BadRequestException when donation date is invalid', async () => {
      await expect(
        service.create({
          ...sampleCreateDto,
          donationDate: 'invalid-date-string',
        }),
      ).rejects.toThrow('Invalid donation date provided');
    });

    it('allows first donation for donor with no previous completed donations', async () => {
      mockDonationModel.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.create(sampleCreateDto);
      expect(result).toBeDefined();
      expect(result.status).toBe(DonationStatus.RECORDED);
    });

    it('rejects male donor who donated whole blood 89 days ago (90-day required interval)', async () => {
      const maleDonor = { ...mockDonor, gender: Gender.MALE };
      mockDonorModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(maleDonor),
      });

      const lastDonationDate = new Date('2026-01-01T10:00:00.000Z');
      const attemptedDate = new Date('2026-03-31T10:00:00.000Z'); // 89 days later

      mockDonationModel.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            donationDate: lastDonationDate,
            donationType: DonationType.WHOLE_BLOOD,
            status: DonationStatus.COMPLETED,
          }),
        }),
      });

      try {
        await service.create({
          ...sampleCreateDto,
          donationDate: attemptedDate.toISOString(),
        });
        fail('Expected BadRequestException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.code).toBe('DONATION_INTERVAL_NOT_COMPLETED');
        expect(res.remainingDays).toBe(1);
        expect(res.lastDonationDate).toBe('2026-01-01');
        expect(res.nextEligibleDate).toBe('2026-04-01');
      }
    });

    it('allows male donor who donated whole blood exactly 90 days ago', async () => {
      const maleDonor = { ...mockDonor, gender: Gender.MALE };
      mockDonorModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(maleDonor),
      });

      const lastDonationDate = new Date('2026-01-01T10:00:00.000Z');
      const attemptedDate = new Date('2026-04-01T10:00:00.000Z'); // exactly 90 days later

      mockDonationModel.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            donationDate: lastDonationDate,
            donationType: DonationType.WHOLE_BLOOD,
            status: DonationStatus.COMPLETED,
          }),
        }),
      });

      const result = await service.create({
        ...sampleCreateDto,
        donationDate: attemptedDate.toISOString(),
      });
      expect(result).toBeDefined();
      expect(result.status).toBe(DonationStatus.RECORDED);
    });

    it('rejects female donor who donated whole blood 119 days ago (120-day required interval)', async () => {
      const femaleDonor = { ...mockDonor, gender: Gender.FEMALE };
      mockDonorModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(femaleDonor),
      });

      const lastDonationDate = new Date('2026-01-01T10:00:00.000Z');
      const attemptedDate = new Date('2026-04-30T10:00:00.000Z'); // 119 days later

      mockDonationModel.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            donationDate: lastDonationDate,
            donationType: DonationType.WHOLE_BLOOD,
            status: DonationStatus.COMPLETED,
          }),
        }),
      });

      try {
        await service.create({
          ...sampleCreateDto,
          donationDate: attemptedDate.toISOString(),
        });
        fail('Expected BadRequestException was not thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.code).toBe('DONATION_INTERVAL_NOT_COMPLETED');
        expect(res.remainingDays).toBe(1);
        expect(res.lastDonationDate).toBe('2026-01-01');
      }
    });

    it('allows female donor who donated whole blood exactly 120 days ago', async () => {
      const femaleDonor = { ...mockDonor, gender: Gender.FEMALE };
      mockDonorModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(femaleDonor),
      });

      const lastDonationDate = new Date('2026-01-01T10:00:00.000Z');
      const attemptedDate = new Date('2026-05-01T10:00:00.000Z'); // exactly 120 days later

      mockDonationModel.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            donationDate: lastDonationDate,
            donationType: DonationType.WHOLE_BLOOD,
            status: DonationStatus.COMPLETED,
          }),
        }),
      });

      const result = await service.create({
        ...sampleCreateDto,
        donationDate: attemptedDate.toISOString(),
      });
      expect(result).toBeDefined();
      expect(result.status).toBe(DonationStatus.RECORDED);
    });

    it('queries only COMPLETED whole-blood donations for the interval check', async () => {
      mockDonationModel.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await service.create(sampleCreateDto);

      expect(mockDonationModel.findOne).toHaveBeenCalledWith({
        donorId: mockDonor._id,
        donationType: DonationType.WHOLE_BLOOD,
        status: DonationStatus.COMPLETED,
      });
    });
  });

  describe('2. findAll with pagination, filters, and search', () => {
    it('returns paginated donations list and calculates totalPages', async () => {
      const mockItems = [
        {
          donationCode: 'DONATION-20261007-ABCD',
          donorId: mockDonor,
          status: DonationStatus.RECORDED,
        },
      ];

      mockDonationModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockItems),
              }),
            }),
          }),
        }),
      });
      mockDonationModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({
        search: 'Alice',
        status: DonationStatus.RECORDED,
        bloodGroup: BloodGroup.O_POSITIVE,
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('filters donations by donorId successfully', async () => {
      const mockItems = [
        {
          donationCode: 'DONATION-20261007-ABCD',
          donorId: mockDonor,
          status: DonationStatus.RECORDED,
        },
      ];

      mockDonationModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockItems),
              }),
            }),
          }),
        }),
      });
      mockDonationModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({
        donorId: validDonorId,
      });

      expect(result.items).toHaveLength(1);
      expect(mockDonationModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          donorId: new Types.ObjectId(validDonorId),
        }),
      );
    });
  });

  describe('3. findOne donation', () => {
    it('finds donation by valid ObjectId or donationCode', async () => {
      const sampleDonation = {
        _id: new Types.ObjectId(),
        donationCode: 'DONATION-20261007-XYZ1',
        status: DonationStatus.RECORDED,
        donorId: mockDonor,
      };

      mockDonationModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sampleDonation),
        }),
      });

      const found = await service.findOne(sampleDonation._id.toHexString());
      expect(found).toBeDefined();
      expect(found.donationCode).toBe('DONATION-20261007-XYZ1');
    });

    it('throws NotFoundException when donation does not exist', async () => {
      mockDonationModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      mockDonationModel.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.findOne('507f1f77bcf86cd799439099'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. updateStatus with state transitions', () => {
    const existingDonation = {
      _id: new Types.ObjectId(validDonorId),
      donationCode: 'DONATION-20261007-TRN1',
      status: DonationStatus.RECORDED,
      donorId: mockDonor,
    };

    it('allows valid transition: RECORDED -> PROCESSING', async () => {
      mockDonationModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(existingDonation),
        }),
      });
      mockDonationModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...existingDonation,
            status: DonationStatus.PROCESSING,
          }),
        }),
      });

      const updated = await service.updateStatus(validDonorId, {
        status: DonationStatus.PROCESSING,
      });

      expect(updated.status).toBe(DonationStatus.PROCESSING);
    });

    it('allows valid transition: PROCESSING -> COMPLETED', async () => {
      const processingDonation = {
        ...existingDonation,
        status: DonationStatus.PROCESSING,
      };

      mockDonationModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(processingDonation),
        }),
      });
      mockDonationModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...processingDonation,
            status: DonationStatus.COMPLETED,
          }),
        }),
      });

      const updated = await service.updateStatus(validDonorId, {
        status: DonationStatus.COMPLETED,
      });

      expect(updated.status).toBe(DonationStatus.COMPLETED);
    });

    it('allows valid transition: RECORDED -> CANCELLED', async () => {
      mockDonationModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(existingDonation),
        }),
      });
      mockDonationModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...existingDonation,
            status: DonationStatus.CANCELLED,
          }),
        }),
      });

      const updated = await service.updateStatus(validDonorId, {
        status: DonationStatus.CANCELLED,
      });

      expect(updated.status).toBe(DonationStatus.CANCELLED);
    });

    it('rejects invalid transition: COMPLETED -> RECORDED or COMPLETED -> CANCELLED', async () => {
      const completedDonation = {
        ...existingDonation,
        status: DonationStatus.COMPLETED,
      };

      mockDonationModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(completedDonation),
        }),
      });

      await expect(
        service.updateStatus(validDonorId, {
          status: DonationStatus.RECORDED,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStatus(validDonorId, {
          status: DonationStatus.CANCELLED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid transition: CANCELLED -> COMPLETED', async () => {
      const cancelledDonation = {
        ...existingDonation,
        status: DonationStatus.CANCELLED,
      };

      mockDonationModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(cancelledDonation),
        }),
      });

      await expect(
        service.updateStatus(validDonorId, {
          status: DonationStatus.COMPLETED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns unmodified donation if same status is sent', async () => {
      mockDonationModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(existingDonation),
        }),
      });

      const result = await service.updateStatus(validDonorId, {
        status: DonationStatus.RECORDED,
      });

      expect(result.status).toBe(DonationStatus.RECORDED);
      expect(mockDonationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
