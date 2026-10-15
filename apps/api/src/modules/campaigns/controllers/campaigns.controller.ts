import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CampaignsService } from '../services/campaigns.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  ReviseCampaignBudgetDto,
  LinkExpenseDto,
  QueryCampaignsDto,
} from '../dto/campaign.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../../auth/decorators/current-admin.decorator';
import { AdminRole } from '../../auth/schemas/admin-user.schema';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  /**
   * Schedules a new blood donation campaign.
   * POST /api/campaigns
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCampaignDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.campaignsService.createCampaign(dto, {
      id: admin.id || admin._id,
      fullName: admin.fullName || 'Admin Officer',
      email: admin.email || 'admin@bloodbank.org',
      role: admin.role,
    });
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Blood donation campaign scheduled successfully',
      data,
    };
  }

  /**
   * Lists campaigns with budget summaries and filter criteria.
   * GET /api/campaigns
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get()
  async list(@Query() query: QueryCampaignsDto) {
    const data = await this.campaignsService.listCampaigns(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Campaigns retrieved successfully',
      data,
    };
  }

  /**
   * Retrieves single campaign by ID.
   * GET /api/campaigns/:id
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get(':id')
  async getById(@Param('id') id: string) {
    const data = await this.campaignsService.getCampaignById(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Campaign details retrieved successfully',
      data,
    };
  }

  /**
   * Updates an existing campaign's operational details or status.
   * PUT /api/campaigns/:id
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const data = await this.campaignsService.updateCampaign(id, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Campaign updated successfully',
      data,
    };
  }

  /**
   * Revises a campaign's approved budget.
   * Restricted strictly to SUPER_ADMIN authority.
   * POST /api/campaigns/:id/budget-revisions
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Post(':id/budget-revisions')
  @HttpCode(HttpStatus.OK)
  async reviseBudget(
    @Param('id') id: string,
    @Body() dto: ReviseCampaignBudgetDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.campaignsService.reviseCampaignBudget(id, dto, {
      id: admin.id || admin._id,
      fullName: admin.fullName || 'Super Administrator',
      email: admin.email || 'superadmin@bloodbank.org',
      role: admin.role,
    });
    return {
      statusCode: HttpStatus.OK,
      message: 'Campaign approved budget revised successfully',
      data,
    };
  }

  /**
   * Retrieves complete budget revision history for a campaign.
   * Restricted strictly to SUPER_ADMIN authority.
   * GET /api/campaigns/:id/budget-revisions
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Get(':id/budget-revisions')
  async getRevisions(@Param('id') id: string) {
    const data = await this.campaignsService.getCampaignBudgetRevisions(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Campaign budget revision history retrieved successfully',
      data,
    };
  }

  /**
   * Retrieves complete budget vs actuals, category breakdown, and cost per completed donation ROI.
   * Restricted strictly to SUPER_ADMIN authority.
   * GET /api/campaigns/:id/financials
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Get(':id/financials')
  async getFinancials(@Param('id') id: string) {
    const data = await this.campaignsService.getCampaignFinancials(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Campaign financial analysis and ROI retrieved successfully',
      data,
    };
  }

  /**
   * Links an existing expense to a campaign.
   * POST /api/campaigns/:id/link-expense
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post(':id/link-expense')
  @HttpCode(HttpStatus.OK)
  async linkExpense(
    @Param('id') id: string,
    @Body() dto: LinkExpenseDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.campaignsService.linkExpenseToCampaign(
      id,
      dto.expenseId,
      {
        id: admin.id || admin._id,
        fullName: admin.fullName || 'Admin Officer',
        email: admin.email || 'admin@bloodbank.org',
      },
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Expense successfully linked to campaign',
      data,
    };
  }

  /**
   * Unlinks an expense from a campaign.
   * POST /api/campaigns/:id/unlink-expense
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post(':id/unlink-expense')
  @HttpCode(HttpStatus.OK)
  async unlinkExpense(
    @Param('id') id: string,
    @Body() dto: LinkExpenseDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.campaignsService.unlinkExpenseFromCampaign(
      id,
      dto.expenseId,
      {
        id: admin.id || admin._id,
        fullName: admin.fullName || 'Admin Officer',
        email: admin.email || 'admin@bloodbank.org',
      },
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Expense unlinked from campaign',
      data,
    };
  }
}
