import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Volunteer, VolunteerDocument } from './schemas/volunteer.schema';
import {
  CampaignVolunteer,
  CampaignVolunteerDocument,
} from './schemas/campaign-volunteer.schema';
import { Campaign, CampaignDocument } from '../campaigns/schemas/campaign.schema';
import {
  VolunteerStatus,
  VolunteerAttendanceStatus,
} from './constants/volunteer.constants';
import {
  PublicRegisterVolunteerDto,
  AdminCreateVolunteerDto,
  VerifyVolunteerDto,
  AssignVolunteerToCampaignDto,
  RegisterAndAssignCampaignVolunteerDto,
  UpdateVolunteerAttendanceDto,
  QueryVolunteersDto,
} from './dto/volunteer.dto';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectModel(Volunteer.name)
    private readonly volunteerModel: Model<VolunteerDocument>,
    @InjectModel(CampaignVolunteer.name)
    private readonly campaignVolunteerModel: Model<CampaignVolunteerDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
  ) {}

  /**
   * Generates a unique human-readable volunteer code.
   * Format: VOL-YYYYMM-XXXX (e.g. VOL-202610-8A1F)
   */
  private async generateVolunteerCode(): Promise<string> {
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    let code = '';
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 20) {
      attempts++;
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `VOL-${yearMonth}-${rand}`;
      const found = await this.volunteerModel.findOne({ volunteerCode: code }).lean();
      if (!found) {
        exists = false;
      }
    }
    return code;
  }

  /**
   * Public voluntary self-registration by an interested candidate.
   * Creates record in PENDING status for admin review.
   */
  async publicRegister(dto: PublicRegisterVolunteerDto) {
    const cleanPhone = dto.phone.trim();
    const existing = await this.volunteerModel.findOne({ phone: cleanPhone, isDeleted: false }).exec();

    if (existing) {
      if (existing.status === VolunteerStatus.PENDING) {
        return {
          message: 'You have already submitted a volunteer application. It is currently under review by our admin team.',
          volunteerCode: existing.volunteerCode,
          status: existing.status,
        };
      }
      if (existing.status === VolunteerStatus.APPROVED) {
        return {
          message: 'You are already registered and active as an approved volunteer with our Blood Bank network!',
          volunteerCode: existing.volunteerCode,
          status: existing.status,
        };
      }
    }

    const volunteerCode = await this.generateVolunteerCode();
    const volunteer = new this.volunteerModel({
      volunteerCode,
      fullName: dto.fullName.trim(),
      phone: cleanPhone,
      email: dto.email?.trim().toLowerCase() || undefined,
      bloodGroup: dto.bloodGroup?.trim().toUpperCase() || undefined,
      gender: dto.gender || 'OTHER',
      city: dto.city.trim(),
      address: dto.address?.trim() || undefined,
      occupation: dto.occupation?.trim() || undefined,
      availability: dto.availability,
      skills: dto.skills?.trim() || undefined,
      preferredRole: dto.preferredRole,
      status: VolunteerStatus.PENDING,
      registeredVia: 'PUBLIC_PORTAL',
    });

    const saved = await volunteer.save();

    return {
      message: 'Thank you for volunteering! Your application has been submitted and is queued for verification by our coordination team.',
      volunteerCode: saved.volunteerCode,
      status: saved.status,
      volunteer: saved,
    };
  }

  /**
   * Staff/Admin query of volunteers with tab status filtering, search, and summary counts.
   */
  async listVolunteers(query: QueryVolunteersDto) {
    const filter: any = { isDeleted: false };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.city) {
      filter.city = new RegExp(query.city.trim(), 'i');
    }

    if (query.bloodGroup) {
      filter.bloodGroup = query.bloodGroup.trim().toUpperCase();
    }

    if (query.search) {
      const q = query.search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { fullName: regex },
        { volunteerCode: regex },
        { phone: regex },
        { email: regex },
        { city: regex },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [volunteers, total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      this.volunteerModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.volunteerModel.countDocuments(filter).exec(),
      this.volunteerModel.countDocuments({ status: VolunteerStatus.PENDING, isDeleted: false }).exec(),
      this.volunteerModel.countDocuments({ status: VolunteerStatus.APPROVED, isDeleted: false }).exec(),
      this.volunteerModel.countDocuments({ status: VolunteerStatus.REJECTED, isDeleted: false }).exec(),
    ]);

    return {
      volunteers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      counts: {
        total,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    };
  }

  /**
   * Count of pending volunteer applications for admin sidebar badge.
   */
  async getPendingCount(): Promise<{ pendingCount: number }> {
    const pendingCount = await this.volunteerModel.countDocuments({
      status: VolunteerStatus.PENDING,
      isDeleted: false,
    });
    return { pendingCount };
  }

  /**
   * Fetches volunteer by ID.
   */
  async getVolunteerById(id: string): Promise<any> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid volunteer ID format.');
    }
    const volunteer = await this.volunteerModel.findById(id).lean().exec();
    if (!volunteer || volunteer.isDeleted) {
      throw new NotFoundException(`Volunteer with ID '${id}' not found.`);
    }

    // Attach participation history with campaign details
    const participations = await this.campaignVolunteerModel
      .find({ volunteerId: volunteer._id })
      .populate('campaignId', 'name campaignCode venue city startDate endDate status')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      ...volunteer,
      participations,
    };
  }

  /**
   * Admin manual registration of an approved volunteer.
   */
  async adminCreateVolunteer(dto: AdminCreateVolunteerDto, adminUser: any) {
    const cleanPhone = dto.phone.trim();
    const existing = await this.volunteerModel.findOne({ phone: cleanPhone, isDeleted: false }).exec();

    if (existing) {
      throw new ConflictException(
        `A volunteer with phone '${cleanPhone}' is already registered (${existing.volunteerCode}).`,
      );
    }

    const volunteerCode = await this.generateVolunteerCode();
    const volunteer = new this.volunteerModel({
      volunteerCode,
      fullName: dto.fullName.trim(),
      phone: cleanPhone,
      email: dto.email?.trim().toLowerCase() || undefined,
      bloodGroup: dto.bloodGroup?.trim().toUpperCase() || undefined,
      gender: dto.gender || 'OTHER',
      city: dto.city.trim(),
      address: dto.address?.trim() || undefined,
      occupation: dto.occupation?.trim() || undefined,
      availability: dto.availability,
      skills: dto.skills?.trim() || undefined,
      preferredRole: dto.preferredRole,
      status: dto.status || VolunteerStatus.APPROVED,
      adminNotes: dto.adminNotes?.trim() || undefined,
      registeredVia: 'ADMIN_MANUAL',
      verifiedAt: new Date(),
      verifiedBy: adminUser?.fullName || adminUser?.username || 'Staff Admin',
    });

    const saved = await volunteer.save();
    return {
      message: `Volunteer ${saved.fullName} registered successfully with code ${saved.volunteerCode}.`,
      volunteer: saved,
    };
  }

  /**
   * Admin verification endpoint: Approve or reject candidate application.
   */
  async verifyVolunteer(id: string, dto: VerifyVolunteerDto, adminUser: any) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid volunteer ID format.');
    }
    const volunteer = await this.volunteerModel.findById(id).exec();
    if (!volunteer || volunteer.isDeleted) {
      throw new NotFoundException(`Volunteer with ID '${id}' not found.`);
    }

    volunteer.status = dto.status;
    if (dto.adminNotes) {
      volunteer.adminNotes = dto.adminNotes.trim();
    }
    if (dto.rejectionReason) {
      volunteer.rejectionReason = dto.rejectionReason.trim();
    }

    if (dto.status === VolunteerStatus.APPROVED) {
      volunteer.verifiedAt = new Date();
      volunteer.verifiedBy = adminUser?.fullName || adminUser?.username || 'Staff Admin';
    }

    const updated = await volunteer.save();
    const actionLabel = dto.status === VolunteerStatus.APPROVED ? 'approved and added to active roster' : 'rejected';
    return {
      message: `Volunteer ${updated.fullName} (${updated.volunteerCode}) has been ${actionLabel}.`,
      volunteer: updated,
    };
  }

  // =========================================================================
  // CAMPAIGN VOLUNTEER ASSIGNMENT & ATTENDANCE MANAGEMENT
  // =========================================================================

  /**
   * Lists all volunteers assigned to a campaign drive with attendance breakdown.
   */
  async getCampaignVolunteers(campaignId: string) {
    if (!isValidObjectId(campaignId)) {
      throw new BadRequestException('Invalid campaign ID format.');
    }

    const campaign = await this.campaignModel.findById(campaignId).lean().exec();
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${campaignId}' not found.`);
    }

    const assignments = await this.campaignVolunteerModel
      .find({ campaignId: campaign._id })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const presentCount = assignments.filter((a) => a.attendanceStatus === VolunteerAttendanceStatus.PRESENT).length;
    const absentCount = assignments.filter((a) => a.attendanceStatus === VolunteerAttendanceStatus.ABSENT).length;
    const pendingCount = assignments.filter((a) => a.attendanceStatus === VolunteerAttendanceStatus.PENDING).length;

    return {
      campaign: {
        _id: campaign._id,
        name: campaign.name,
        campaignCode: campaign.campaignCode,
        venue: campaign.venue,
        city: campaign.city,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        status: campaign.status,
      },
      summary: {
        totalAssigned: assignments.length,
        present: presentCount,
        absent: absentCount,
        pending: pendingCount,
      },
      volunteers: assignments,
    };
  }

  /**
   * Assigns an existing approved volunteer to a campaign drive.
   */
  async assignVolunteerToCampaign(
    campaignId: string,
    dto: AssignVolunteerToCampaignDto,
    adminUser: any,
  ) {
    if (!isValidObjectId(campaignId) || !isValidObjectId(dto.volunteerId)) {
      throw new BadRequestException('Invalid campaign ID or volunteer ID format.');
    }

    const [campaign, volunteer] = await Promise.all([
      this.campaignModel.findById(campaignId).exec(),
      this.volunteerModel.findById(dto.volunteerId).exec(),
    ]);

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${campaignId}' not found.`);
    }
    if (!volunteer || volunteer.isDeleted) {
      throw new NotFoundException(`Volunteer with ID '${dto.volunteerId}' not found.`);
    }

    // Check if already assigned
    const existing = await this.campaignVolunteerModel.findOne({
      campaignId: campaign._id,
      volunteerId: volunteer._id,
    });

    if (existing) {
      throw new ConflictException(
        `Volunteer ${volunteer.fullName} is already assigned to campaign ${campaign.campaignCode}.`,
      );
    }

    const assignment = new this.campaignVolunteerModel({
      campaignId: campaign._id,
      campaignCode: campaign.campaignCode,
      volunteerId: volunteer._id,
      volunteerCode: volunteer.volunteerCode,
      volunteerName: volunteer.fullName,
      volunteerPhone: volunteer.phone,
      volunteerBloodGroup: volunteer.bloodGroup,
      role: dto.role || volunteer.preferredRole || 'GENERAL',
      attendanceStatus: VolunteerAttendanceStatus.PENDING,
      notes: dto.notes?.trim() || undefined,
    });

    const saved = await assignment.save();

    // Increment volunteer's assigned count
    await this.volunteerModel.findByIdAndUpdate(volunteer._id, {
      $inc: { assignedCampaignsCount: 1 },
    });

    return {
      message: `Volunteer ${volunteer.fullName} successfully assigned to ${campaign.name} (${campaign.campaignCode}).`,
      assignment: saved,
    };
  }

  /**
   * Registers a new volunteer directly on the campaign page AND assigns them to the campaign in one step.
   */
  async registerAndAssignCampaignVolunteer(
    campaignId: string,
    dto: RegisterAndAssignCampaignVolunteerDto,
    adminUser: any,
  ) {
    if (!isValidObjectId(campaignId)) {
      throw new BadRequestException('Invalid campaign ID format.');
    }

    const campaign = await this.campaignModel.findById(campaignId).exec();
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${campaignId}' not found.`);
    }

    const cleanPhone = dto.phone.trim();
    let volunteer = await this.volunteerModel.findOne({ phone: cleanPhone, isDeleted: false }).exec();

    if (!volunteer) {
      const volunteerCode = await this.generateVolunteerCode();
      volunteer = new this.volunteerModel({
        volunteerCode,
        fullName: dto.fullName.trim(),
        phone: cleanPhone,
        email: dto.email?.trim().toLowerCase() || undefined,
        bloodGroup: dto.bloodGroup?.trim().toUpperCase() || undefined,
        gender: dto.gender || 'OTHER',
        city: dto.city.trim(),
        preferredRole: dto.role || 'GENERAL',
        status: VolunteerStatus.APPROVED,
        registeredVia: 'CAMPAIGN_DIRECT',
        verifiedAt: new Date(),
        verifiedBy: adminUser?.fullName || adminUser?.username || 'Camp Admin',
      });
      volunteer = await volunteer.save();
    }

    // Check if already assigned to this campaign
    const existing = await this.campaignVolunteerModel.findOne({
      campaignId: campaign._id,
      volunteerId: volunteer._id,
    });

    if (existing) {
      return {
        message: `Volunteer ${volunteer.fullName} is already assigned to this campaign.`,
        assignment: existing,
        volunteer,
      };
    }

    const assignment = new this.campaignVolunteerModel({
      campaignId: campaign._id,
      campaignCode: campaign.campaignCode,
      volunteerId: volunteer._id,
      volunteerCode: volunteer.volunteerCode,
      volunteerName: volunteer.fullName,
      volunteerPhone: volunteer.phone,
      volunteerBloodGroup: volunteer.bloodGroup,
      role: dto.role || 'GENERAL',
      attendanceStatus: VolunteerAttendanceStatus.PENDING,
      notes: dto.notes?.trim() || undefined,
    });

    const saved = await assignment.save();

    await this.volunteerModel.findByIdAndUpdate(volunteer._id, {
      $inc: { assignedCampaignsCount: 1 },
    });

    return {
      message: `Volunteer ${volunteer.fullName} registered and assigned to campaign ${campaign.campaignCode}.`,
      assignment: saved,
      volunteer,
    };
  }

  /**
   * Updates attendance status (PRESENT / ABSENT / PENDING) for a volunteer in a campaign drive.
   */
  async updateVolunteerAttendance(
    campaignId: string,
    assignmentId: string,
    dto: UpdateVolunteerAttendanceDto,
    adminUser: any,
  ) {
    if (!isValidObjectId(campaignId) || !isValidObjectId(assignmentId)) {
      throw new BadRequestException('Invalid campaign ID or assignment ID format.');
    }

    const assignment = await this.campaignVolunteerModel.findById(assignmentId).exec();

    if (!assignment || assignment.campaignId.toString() !== campaignId.toString()) {
      throw new NotFoundException(`Campaign volunteer assignment '${assignmentId}' not found.`);
    }

    const previousStatus = assignment.attendanceStatus;
    const nextStatus = dto.attendanceStatus;

    assignment.attendanceStatus = nextStatus;
    assignment.attendanceMarkedAt = new Date();
    assignment.attendanceMarkedBy = adminUser?.fullName || adminUser?.username || 'Staff Admin';
    if (dto.notes !== undefined) {
      assignment.notes = dto.notes.trim() || undefined;
    }

    const updated = await assignment.save();

    // Adjust volunteer's attendedCampaignsCount delta
    if (previousStatus !== VolunteerAttendanceStatus.PRESENT && nextStatus === VolunteerAttendanceStatus.PRESENT) {
      await this.volunteerModel.findByIdAndUpdate(assignment.volunteerId, {
        $inc: { attendedCampaignsCount: 1 },
      });
    } else if (previousStatus === VolunteerAttendanceStatus.PRESENT && nextStatus !== VolunteerAttendanceStatus.PRESENT) {
      await this.volunteerModel.findByIdAndUpdate(assignment.volunteerId, {
        $inc: { attendedCampaignsCount: -1 },
      });
    }

    return {
      message: `Volunteer ${assignment.volunteerName} attendance updated to ${nextStatus}.`,
      assignment: updated,
    };
  }

  /**
   * Removes a volunteer assignment from a campaign drive.
   */
  async removeVolunteerFromCampaign(campaignId: string, assignmentId: string) {
    if (!isValidObjectId(campaignId) || !isValidObjectId(assignmentId)) {
      throw new BadRequestException('Invalid campaign ID or assignment ID format.');
    }

    const assignment = await this.campaignVolunteerModel.findById(assignmentId).exec();

    if (!assignment || assignment.campaignId.toString() !== campaignId.toString()) {
      throw new NotFoundException(`Campaign volunteer assignment '${assignmentId}' not found.`);
    }

    await this.campaignVolunteerModel.findByIdAndDelete(assignmentId).exec();

    if (!assignment) {
      throw new NotFoundException(`Campaign volunteer assignment '${assignmentId}' not found.`);
    }

    const decDelta: any = { assignedCampaignsCount: -1 };
    if (assignment.attendanceStatus === VolunteerAttendanceStatus.PRESENT) {
      decDelta.attendedCampaignsCount = -1;
    }

    await this.volunteerModel.findByIdAndUpdate(assignment.volunteerId, {
      $inc: decDelta,
    });

    return {
      message: `Volunteer ${assignment.volunteerName} unassigned from campaign.`,
    };
  }
}
