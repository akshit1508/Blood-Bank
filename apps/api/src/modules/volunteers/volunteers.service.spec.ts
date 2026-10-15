import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';
import { Volunteer } from './schemas/volunteer.schema';
import { CampaignVolunteer } from './schemas/campaign-volunteer.schema';
import { Campaign } from '../campaigns/schemas/campaign.schema';
import {
  VolunteerStatus,
  VolunteerAttendanceStatus,
  VolunteerRole,
  VolunteerAvailability,
} from './constants/volunteer.constants';

describe('VolunteersService', () => {
  let service: VolunteersService;
  let volunteerModel: any;
  let campaignVolunteerModel: any;
  let campaignModel: any;

  const validVolId = '507f1f77bcf86cd799439011';
  const validCampId = '507f191e810c19729de860ea';

  const mockVolunteer: any = {
    _id: validVolId,
    volunteerCode: 'VOL-202610-A1B2',
    fullName: 'Jane Volunteer',
    phone: '9876543210',
    email: 'jane@example.com',
    bloodGroup: 'O+',
    city: 'Mumbai',
    status: VolunteerStatus.PENDING,
    preferredRole: VolunteerRole.DONOR_CARE,
    availability: VolunteerAvailability.WEEKENDS,
    attendedCampaignsCount: 0,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
  };

  const mockCampaign: any = {
    _id: validCampId,
    campaignCode: 'CMP-202610-001',
    name: 'City Youth Blood Drive',
  };

  const mockCampaignVolunteer: any = {
    _id: '507f1f77bcf86cd799439099',
    campaignId: validCampId,
    volunteerId: validVolId,
    role: VolunteerRole.DONOR_CARE,
    attendanceStatus: VolunteerAttendanceStatus.PENDING,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
  };

  class MockVolunteerModel {
    constructor(private data: any) {
      Object.assign(this, data);
    }
    save = jest.fn().mockResolvedValue(this);
    static countDocuments = jest.fn().mockResolvedValue(0);
    static findOne = jest.fn();
    static findById = jest.fn();
    static findByIdAndUpdate = jest.fn().mockResolvedValue({});
    static find = jest.fn();
    static updateOne = jest.fn();
  }

  class MockCampaignVolunteerModel {
    constructor(private data: any) {
      Object.assign(this, data);
    }
    save = jest.fn().mockResolvedValue(this);
    static findById = jest.fn();
    static findByIdAndDelete = jest.fn();
    static findOne = jest.fn();
    static find = jest.fn();
    static deleteOne = jest.fn();
  }

  class MockCampaignModel {
    static findById = jest.fn();
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        {
          provide: getModelToken(Volunteer.name),
          useValue: MockVolunteerModel,
        },
        {
          provide: getModelToken(CampaignVolunteer.name),
          useValue: MockCampaignVolunteerModel,
        },
        {
          provide: getModelToken(Campaign.name),
          useValue: MockCampaignModel,
        },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
    volunteerModel = module.get(getModelToken(Volunteer.name));
    campaignVolunteerModel = module.get(getModelToken(CampaignVolunteer.name));
    campaignModel = module.get(getModelToken(Campaign.name));
    jest.clearAllMocks();
  });

  describe('publicRegister', () => {
    it('should register a new volunteer with PENDING status and unique code', async () => {
      volunteerModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.publicRegister({
        fullName: 'Jane Volunteer',
        phone: '9876543210',
        email: 'jane@example.com',
        bloodGroup: 'O+',
        city: 'Mumbai',
        preferredRole: VolunteerRole.DONOR_CARE,
        availability: VolunteerAvailability.WEEKENDS,
      });

      expect(result).toBeDefined();
      expect(result.status).toEqual(VolunteerStatus.PENDING);
      expect(result.volunteerCode).toContain('VOL-');
    });

    it('should handle already registered volunteer gracefully', async () => {
      volunteerModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockVolunteer),
      });

      const result = await service.publicRegister({
        fullName: 'Jane Again',
        phone: '9876543210',
        city: 'Mumbai',
      });

      expect(result.status).toEqual(VolunteerStatus.PENDING);
      expect(result.volunteerCode).toEqual(mockVolunteer.volunteerCode);
      expect(result.message).toContain('already submitted');
    });
  });

  describe('verifyVolunteer', () => {
    it('should approve a volunteer and update status', async () => {
      const vol = { ...mockVolunteer, save: jest.fn().mockResolvedValue(true) };
      volunteerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(vol),
      });

      const updated = await service.verifyVolunteer(
        validVolId,
        { status: VolunteerStatus.APPROVED, adminNotes: 'Verified phone and identity' },
        { fullName: 'Admin User', role: 'ADMIN' },
      );

      expect(vol.status).toEqual(VolunteerStatus.APPROVED);
      expect(vol.verifiedBy).toEqual('Admin User');
      expect(vol.verifiedAt).toBeDefined();
    });

    it('should throw NotFoundException if volunteer does not exist', async () => {
      volunteerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.verifyVolunteer(
          validVolId,
          { status: VolunteerStatus.APPROVED },
          { fullName: 'Admin User' },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignVolunteerToCampaign', () => {
    it('should assign an approved volunteer to a campaign', async () => {
      const approvedVol = { ...mockVolunteer, status: VolunteerStatus.APPROVED };
      campaignModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCampaign),
      });
      volunteerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(approvedVol),
      });
      campaignVolunteerModel.findOne.mockResolvedValue(null);

      const res = await service.assignVolunteerToCampaign(
        validCampId,
        {
          volunteerId: validVolId,
          role: VolunteerRole.REGISTRATION_DESK,
        },
        { fullName: 'Camp Admin' },
      );

      expect(res).toBeDefined();
      expect(res.assignment).toBeDefined();
      expect(res.message).toContain('successfully assigned');
    });

    it('should throw ConflictException if volunteer is already assigned', async () => {
      const approvedVol = { ...mockVolunteer, status: VolunteerStatus.APPROVED };
      campaignModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCampaign),
      });
      volunteerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(approvedVol),
      });
      campaignVolunteerModel.findOne.mockResolvedValue(mockCampaignVolunteer);

      await expect(
        service.assignVolunteerToCampaign(
          validCampId,
          {
            volunteerId: validVolId,
          },
          { fullName: 'Camp Admin' },
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateVolunteerAttendance', () => {
    it('should mark volunteer present and increment attendance count', async () => {
      const cvRecord = {
        ...mockCampaignVolunteer,
        attendanceStatus: VolunteerAttendanceStatus.PENDING,
        volunteerName: 'Jane Volunteer',
        save: jest.fn().mockResolvedValue(true),
      };

      campaignVolunteerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(cvRecord),
      });

      const result = await service.updateVolunteerAttendance(
        validCampId,
        mockCampaignVolunteer._id,
        {
          attendanceStatus: VolunteerAttendanceStatus.PRESENT,
          notes: 'Active and helpful',
        },
        { fullName: 'Camp Coordinator' },
      );

      expect(cvRecord.attendanceStatus).toEqual(VolunteerAttendanceStatus.PRESENT);
      expect(cvRecord.attendanceMarkedBy).toEqual('Camp Coordinator');
      expect(volunteerModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validVolId,
        { $inc: { attendedCampaignsCount: 1 } },
      );
    });
  });
});
