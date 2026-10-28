import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReplacementDonationsService } from './replacement-donations.service';
import {
  CreateReplacementTrackingDto,
  AssociateDonorDto,
  LinkDonationDto,
  CancelReplacementTrackingDto,
  UpdateReplacementTrackingNotesDto,
  QueryReplacementDonationsDto,
} from './dto/replacement-donation.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

@Roles(
  AdminRole.SUPER_ADMIN,
  AdminRole.ADMIN,
  AdminRole.FINANCE_RECEPTIONIST,
  AdminRole.LAB_TECHNICIAN,
)
@Controller('replacement-donations')
export class ReplacementDonationsController {
  constructor(
    private readonly replacementService: ReplacementDonationsService,
  ) {}

  /**
   * Get database-backed metrics for replacement dashboard.
   * GET /api/replacement-donations/metrics
   */
  @Get('metrics')
  async getMetrics() {
    const metrics = await this.replacementService.getDashboardMetrics();
    return {
      statusCode: HttpStatus.OK,
      data: metrics,
    };
  }

  /**
   * Get replacement tracking records for a specific Blood Request.
   * GET /api/replacement-donations/by-request/:bloodRequestId
   */
  @Get('by-request/:bloodRequestId')
  async findByBloodRequest(@Param('bloodRequestId') bloodRequestId: string) {
    const items = await this.replacementService.findByBloodRequestId(
      bloodRequestId,
    );
    return {
      statusCode: HttpStatus.OK,
      data: items,
    };
  }

  /**
   * Create new Replacement Donation tracking case.
   * POST /api/replacement-donations
   */
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.FINANCE_RECEPTIONIST,
  )
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateReplacementTrackingDto,
    @CurrentAdmin() admin: any,
  ) {
    const record = await this.replacementService.createTrackingCase(dto, admin);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Replacement tracking case created successfully',
      data: record,
    };
  }

  /**
   * Query replacement donation tracking records with filters & pagination.
   * GET /api/replacement-donations
   */
  @Get()
  async findAll(@Query() query: QueryReplacementDonationsDto) {
    const result = await this.replacementService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Get a single replacement tracking case by ID.
   * GET /api/replacement-donations/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const record = await this.replacementService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      data: record,
    };
  }

  /**
   * Get complete 5-stage traced workflow summary for replacement case.
   * GET /api/replacement-donations/:id/workflow
   */
  @Get(':id/workflow')
  async getWorkflowTrace(@Param('id') id: string) {
    const trace = await this.replacementService.getWorkflowTrace(id);
    return {
      statusCode: HttpStatus.OK,
      data: trace,
    };
  }

  /**
   * Associate or change donor on an existing tracking case.
   * PATCH /api/replacement-donations/:id/donor
   */
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.FINANCE_RECEPTIONIST,
  )
  @Patch(':id/donor')
  async associateDonor(
    @Param('id') id: string,
    @Body() dto: AssociateDonorDto,
    @CurrentAdmin() admin: any,
  ) {
    const record = await this.replacementService.associateDonor(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Donor associated successfully',
      data: record,
    };
  }

  /**
   * Link physical donation record to this replacement tracking case.
   * PATCH /api/replacement-donations/:id/link-donation
   */
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.FINANCE_RECEPTIONIST,
  )
  @Patch(':id/link-donation')
  async linkDonation(
    @Param('id') id: string,
    @Body() dto: LinkDonationDto,
    @CurrentAdmin() admin: any,
  ) {
    const record = await this.replacementService.linkDonation(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Donation linked successfully to replacement tracking case',
      data: record,
    };
  }

  /**
   * Sync dynamic status from underlying donation & blood unit records.
   * POST /api/replacement-donations/:id/sync
   */
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.FINANCE_RECEPTIONIST,
    AdminRole.LAB_TECHNICIAN,
  )
  @Post(':id/sync')
  async syncStatus(@Param('id') id: string, @CurrentAdmin() admin: any) {
    const record = await this.replacementService.syncStatus(id, admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Replacement tracking status synchronized successfully',
      data: record,
    };
  }

  /**
   * Cancel replacement tracking case.
   * PATCH /api/replacement-donations/:id/cancel
   */
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.FINANCE_RECEPTIONIST,
  )
  @Patch(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelReplacementTrackingDto,
    @CurrentAdmin() admin: any,
  ) {
    const record = await this.replacementService.cancel(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Replacement tracking case cancelled',
      data: record,
    };
  }

  /**
   * Update internal tracking notes.
   * PATCH /api/replacement-donations/:id/notes
   */
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.FINANCE_RECEPTIONIST,
  )
  @Patch(':id/notes')
  async updateNotes(
    @Param('id') id: string,
    @Body() dto: UpdateReplacementTrackingNotesDto,
    @CurrentAdmin() admin: any,
  ) {
    const record = await this.replacementService.updateNotes(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Tracking notes updated successfully',
      data: record,
    };
  }
}
