import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VolunteersService } from './volunteers.service';
import {
  PublicRegisterVolunteerDto,
  AdminCreateVolunteerDto,
  VerifyVolunteerDto,
  AssignVolunteerToCampaignDto,
  RegisterAndAssignCampaignVolunteerDto,
  UpdateVolunteerAttendanceDto,
  QueryVolunteersDto,
} from './dto/volunteer.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}

  /**
   * Public voluntary registration form submission.
   * POST /api/volunteers/public-register
   * ACCESS: PUBLIC
   */
  @Public()
  @Post('public-register')
  @HttpCode(HttpStatus.CREATED)
  async publicRegister(@Body() dto: PublicRegisterVolunteerDto) {
    const result = await this.volunteersService.publicRegister(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: result.message,
      data: result,
    };
  }

  /**
   * Staff/Admin query of all volunteers with filters and counts.
   * GET /api/volunteers
   * ACCESS: SUPER_ADMIN, ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get()
  async listVolunteers(@Query() query: QueryVolunteersDto) {
    const result = await this.volunteersService.listVolunteers(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Volunteers retrieved successfully.',
      data: result,
    };
  }

  /**
   * Pending volunteers count for admin notification badge.
   * GET /api/volunteers/pending-count
   * ACCESS: SUPER_ADMIN, ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get('pending-count')
  async getPendingCount() {
    const result = await this.volunteersService.getPendingCount();
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Manual admin creation of an active volunteer.
   * POST /api/volunteers
   * ACCESS: SUPER_ADMIN, ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async adminCreateVolunteer(@Body() dto: AdminCreateVolunteerDto, @Req() req: any) {
    const user = req.user || req.admin;
    const result = await this.volunteersService.adminCreateVolunteer(dto, user);
    return {
      statusCode: HttpStatus.CREATED,
      message: result.message,
      data: result,
    };
  }

  /**
   * Fetches volunteer details by ID with campaign participation history.
   * GET /api/volunteers/:id
   * ACCESS: SUPER_ADMIN, ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get(':id')
  async getVolunteerById(@Param('id') id: string): Promise<any> {
    const volunteer = await this.volunteersService.getVolunteerById(id);
    return {
      statusCode: HttpStatus.OK,
      data: volunteer,
    };
  }

  /**
   * Admin verification endpoint (Approve or Reject candidate application).
   * PATCH /api/volunteers/:id/verify
   * ACCESS: SUPER_ADMIN, ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch(':id/verify')
  async verifyVolunteer(
    @Param('id') id: string,
    @Body() dto: VerifyVolunteerDto,
    @Req() req: any,
  ) {
    const user = req.user || req.admin;
    const result = await this.volunteersService.verifyVolunteer(id, dto, user);
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
      data: result,
    };
  }

  // =========================================================================
  // CAMPAIGN VOLUNTEERS & ATTENDANCE ENDPOINTS
  // =========================================================================

  /**
   * Retrieves volunteer roster and attendance summary for a campaign.
   * GET /api/volunteers/campaign/:campaignId
   * ACCESS: SUPER_ADMIN, ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get('campaign/:campaignId')
  async getCampaignVolunteers(@Param('campaignId') campaignId: string) {
    const result = await this.volunteersService.getCampaignVolunteers(campaignId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Campaign volunteers retrieved successfully.',
      data: result,
    };
  }

  /**
   * Assigns an approved volunteer to a campaign.
   * POST /api/volunteers/campaign/:campaignId/assign
   * ACCESS: SUPER_ADMIN, ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post('campaign/:campaignId/assign')
  @HttpCode(HttpStatus.CREATED)
  async assignVolunteerToCampaign(
    @Param('campaignId') campaignId: string,
    @Body() dto: AssignVolunteerToCampaignDto,
    @Req() req: any,
  ) {
    const user = req.user || req.admin;
    const result = await this.volunteersService.assignVolunteerToCampaign(campaignId, dto, user);
    return {
      statusCode: HttpStatus.CREATED,
      message: result.message,
      data: result,
    };
  }

  /**
   * Registers a new volunteer on the campaign page and assigns them to the campaign.
   * POST /api/volunteers/campaign/:campaignId/register-and-assign
   * ACCESS: SUPER_ADMIN, ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post('campaign/:campaignId/register-and-assign')
  @HttpCode(HttpStatus.CREATED)
  async registerAndAssignCampaignVolunteer(
    @Param('campaignId') campaignId: string,
    @Body() dto: RegisterAndAssignCampaignVolunteerDto,
    @Req() req: any,
  ) {
    const user = req.user || req.admin;
    const result = await this.volunteersService.registerAndAssignCampaignVolunteer(
      campaignId,
      dto,
      user,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: result.message,
      data: result,
    };
  }

  /**
   * Marks volunteer attendance (PRESENT / ABSENT) in a campaign drive.
   * PATCH /api/volunteers/campaign/:campaignId/attendance/:assignmentId
   * ACCESS: SUPER_ADMIN, ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch('campaign/:campaignId/attendance/:assignmentId')
  async updateVolunteerAttendance(
    @Param('campaignId') campaignId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateVolunteerAttendanceDto,
    @Req() req: any,
  ) {
    const user = req.user || req.admin;
    const result = await this.volunteersService.updateVolunteerAttendance(
      campaignId,
      assignmentId,
      dto,
      user,
    );
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
      data: result,
    };
  }

  /**
   * Removes a volunteer assignment from a campaign.
   * DELETE /api/volunteers/campaign/:campaignId/assignment/:assignmentId
   * ACCESS: SUPER_ADMIN, ADMIN
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Delete('campaign/:campaignId/assignment/:assignmentId')
  async removeVolunteerFromCampaign(
    @Param('campaignId') campaignId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    const result = await this.volunteersService.removeVolunteerFromCampaign(
      campaignId,
      assignmentId,
    );
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }
}
