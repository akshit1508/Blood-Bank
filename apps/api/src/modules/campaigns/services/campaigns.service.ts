import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Campaign, CampaignDocument } from '../schemas/campaign.schema';
import {
  CampaignBudgetRevision,
  CampaignBudgetRevisionDocument,
} from '../schemas/campaign-budget-revision.schema';
import { Expense, ExpenseDocument } from '../../expenses/schemas/expense.schema';
import { Donation, DonationDocument } from '../../donations/schemas/donation.schema';
import { BloodUnit, BloodUnitDocument } from '../../blood-units/schemas/blood-unit.schema';
import { BloodTesting, BloodTestingDocument } from '../../testing/schemas/blood-testing.schema';
import { Inventory, InventoryDocument } from '../../inventory/schemas/inventory.schema';
import { Donor, DonorDocument } from '../../donors/schemas/donor.schema';
import { BloodUnitStatus, BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';
import { BloodGroup } from '../../donors/constants/donor.constants';
import {
  TestingDecision,
  TestingStatus,
  TestResultStatus,
} from '../../testing/constants/testing.constants';
import { InventoryStatus } from '../../inventory/constants/inventory.constants';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  ReviseCampaignBudgetDto,
  QueryCampaignsDto,
  RecordCampaignDonationDto,
  UpdateCampaignUnitTestingDecisionDto,
} from '../dto/campaign.dto';
import {
  CampaignStatus,
  ALLOWED_CAMPAIGN_STATUS_TRANSITIONS,
} from '../constants/campaign.constants';
import {
  ExpenseStatus,
  ExpenseAuditEventType,
  EXPENSE_CATEGORY_LABELS,
  ExpenseCategory,
} from '../../expenses/constants/expense.constants';
import { DonationStatus } from '../../donations/constants/donation.constants';
import { CurrencyUtil } from '../../../common/utils/currency.util';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import {
  AuditActionType,
  AuditEntityType,
} from '../../audit-logs/constants/audit-log.constants';
import { DonorEligibilityService } from '../../donors/services/donor-eligibility.service';
import { ExpiryRulesService } from '../../inventory/services/expiry-rules.service';
import {
  MIN_WHOLE_BLOOD_DONOR_AGE,
  MAX_WHOLE_BLOOD_DONOR_AGE,
  calculateCompletedAge,
} from '../../../common/constants/eligibility.constants';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(CampaignBudgetRevision.name)
    private readonly revisionModel: Model<CampaignBudgetRevisionDocument>,
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
    @Optional()
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel?: Model<BloodUnitDocument>,
    @Optional()
    @InjectModel(BloodTesting.name)
    private readonly bloodTestingModel?: Model<BloodTestingDocument>,
    @Optional()
    @InjectModel(Inventory.name)
    private readonly inventoryModel?: Model<InventoryDocument>,
    @Optional()
    @InjectModel(Donor.name)
    private readonly donorModel?: Model<DonorDocument>,
    @Optional()
    private readonly auditLogsService?: AuditLogsService,
    @Optional()
    private readonly donorEligibilityService?: DonorEligibilityService,
    @Optional()
    private readonly expiryRulesService?: ExpiryRulesService,
  ) {}

  /**
   * Generates a unique human-readable campaign code.
   * Format: CAMP-YYYYMM-XXXX (e.g. CAMP-202610-8A1F)
   */
  private async generateCampaignCode(): Promise<string> {
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    let code = '';
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 20) {
      attempts++;
      const randomHex = Math.random().toString(16).substring(2, 6).toUpperCase();
      code = `CAMP-${yearMonth}-${randomHex}`;
      const found = await this.campaignModel.findOne({ campaignCode: code }).lean().exec();
      if (!found) {
        exists = false;
      }
    }
    return code;
  }

  /**
   * Creates a new blood donation campaign.
   */
  async createCampaign(
    dto: CreateCampaignDto,
    adminUser: { id: string; fullName: string; email: string; role: string },
  ): Promise<CampaignDocument> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start or end date provided.');
    }
    if (startDate > endDate) {
      throw new BadRequestException('Campaign start date cannot be after end date.');
    }

    const initialBudgetPaise = dto.initialBudget
      ? CurrencyUtil.toPaise(dto.initialBudget)
      : 0;
    const initialBudget = CurrencyUtil.toInr(initialBudgetPaise);

    const campaignCode = await this.generateCampaignCode();

    const campaign = new this.campaignModel({
      campaignCode,
      name: dto.name.trim(),
      venue: dto.venue.trim(),
      city: dto.city.trim(),
      startDate,
      endDate,
      status: CampaignStatus.PLANNED,
      targetDonations: dto.targetDonations || 0,
      initialBudgetPaise,
      approvedBudgetPaise: initialBudgetPaise,
      approvedBudget: initialBudget,
      currency: 'INR',
      budgetRevisionCount: initialBudgetPaise > 0 ? 1 : 0,
      budgetVersion: 1,
      createdBy: new Types.ObjectId(adminUser.id),
      createdByName: adminUser.fullName,
      createdByRole: adminUser.role,
      budgetApprovedBy: new Types.ObjectId(adminUser.id),
      budgetApprovedByName: adminUser.fullName,
      budgetApprovedAt: new Date(),
      description: dto.description?.trim() || undefined,
    });

    const savedCampaign = await campaign.save();

    // If initial budget > 0 was provided at creation, record baseline revision #1
    if (initialBudgetPaise > 0) {
      const initialRevision = new this.revisionModel({
        campaignId: savedCampaign._id,
        revisionNumber: 1,
        previousBudgetPaise: 0,
        newBudgetPaise: initialBudgetPaise,
        deltaPaise: initialBudgetPaise,
        previousBudget: 0,
        newBudget: initialBudget,
        delta: initialBudget,
        reason: 'Initial approved campaign budget baseline',
        actorId: new Types.ObjectId(adminUser.id),
        actorName: adminUser.fullName,
        actorEmail: adminUser.email,
        actorRole: adminUser.role,
        timestamp: new Date(),
      });
      await initialRevision.save();
    }

    this.auditLogsService?.logEvent({
      action: AuditActionType.CAMPAIGN_CREATED,
      entityType: AuditEntityType.CAMPAIGN,
      entityId: savedCampaign._id.toString(),
      entityIdentifier: savedCampaign.campaignCode,
      actorId: adminUser.id,
      actorName: adminUser.fullName,
      actorEmail: adminUser.email,
      actorRole: adminUser.role,
      description: `Campaign ${savedCampaign.campaignCode} (${savedCampaign.name}) created with initial budget ₹${savedCampaign.approvedBudget}`,
      afterState: {
        campaignCode: savedCampaign.campaignCode,
        name: savedCampaign.name,
        approvedBudget: savedCampaign.approvedBudget,
        status: savedCampaign.status,
      },
    }).catch(() => null);

    return savedCampaign;
  }

  /**
   * Updates an existing campaign's operational details or status.
   */
  async updateCampaign(
    id: string,
    dto: UpdateCampaignDto,
  ): Promise<CampaignDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid campaign ID format.');
    }

    const campaign = await this.campaignModel.findById(id).exec();
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${id}' not found.`);
    }

    if (dto.status && dto.status !== campaign.status) {
      const allowedTransitions = ALLOWED_CAMPAIGN_STATUS_TRANSITIONS[campaign.status];
      if (!allowedTransitions.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid status transition from ${campaign.status} to ${dto.status}.`,
        );
      }
      campaign.status = dto.status;
    }

    if (dto.name) campaign.name = dto.name.trim();
    if (dto.venue) campaign.venue = dto.venue.trim();
    if (dto.city) campaign.city = dto.city.trim();
    if (dto.targetDonations !== undefined) campaign.targetDonations = dto.targetDonations;
    if (dto.description !== undefined) campaign.description = dto.description.trim() || undefined;

    if (dto.startDate || dto.endDate) {
      const newStart = dto.startDate ? new Date(dto.startDate) : campaign.startDate;
      const newEnd = dto.endDate ? new Date(dto.endDate) : campaign.endDate;
      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        throw new BadRequestException('Invalid start or end date provided.');
      }
      if (newStart > newEnd) {
        throw new BadRequestException('Campaign start date cannot be after end date.');
      }
      campaign.startDate = newStart;
      campaign.endDate = newEnd;
    }

    return await campaign.save();
  }

  /**
   * Revises a campaign's approved budget with optimistic locking and immutable revision logging.
   */
  async reviseCampaignBudget(
    id: string,
    dto: ReviseCampaignBudgetDto,
    adminUser: { id: string; fullName: string; email: string; role: string },
  ): Promise<{ campaign: CampaignDocument; revision: CampaignBudgetRevisionDocument }> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid campaign ID format.');
    }

    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('A valid revision justification reason is required.');
    }

    const newBudgetPaise = CurrencyUtil.toPaise(dto.newBudget);
    const newBudget = CurrencyUtil.toInr(newBudgetPaise);

    const campaign = await this.campaignModel.findById(id).exec();
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${id}' not found.`);
    }

    if (campaign.status === CampaignStatus.CANCELLED) {
      throw new BadRequestException('Cannot revise budget for a cancelled campaign.');
    }

    // Optimistic Concurrency Control Check
    if (campaign.budgetVersion !== dto.budgetVersion) {
      throw new ConflictException(
        'Concurrent budget revision detected. The campaign budget was modified by another administrator. Please refresh before saving.',
      );
    }

    const previousBudgetPaise = campaign.approvedBudgetPaise;
    const previousBudget = campaign.approvedBudget;
    const deltaPaise = newBudgetPaise - previousBudgetPaise;
    const delta = CurrencyUtil.toSignedInr(deltaPaise);
    const revisionNumber = campaign.budgetRevisionCount + 1;

    // Atomic update incrementing version and revision count
    const updatedCampaign = await this.campaignModel.findOneAndUpdate(
      { _id: campaign._id, budgetVersion: dto.budgetVersion },
      {
        $set: {
          approvedBudgetPaise: newBudgetPaise,
          approvedBudget: newBudget,
          budgetApprovedBy: new Types.ObjectId(adminUser.id),
          budgetApprovedByName: adminUser.fullName,
          budgetApprovedAt: new Date(),
        },
        $inc: {
          budgetRevisionCount: 1,
          budgetVersion: 1,
        },
      },
      { new: true },
    );

    if (!updatedCampaign) {
      throw new ConflictException(
        'Failed to apply budget revision due to a concurrent write collision. Please reload.',
      );
    }

    // Record immutable audit history
    const revision = new this.revisionModel({
      campaignId: campaign._id,
      revisionNumber,
      previousBudgetPaise,
      newBudgetPaise,
      deltaPaise,
      previousBudget,
      newBudget,
      delta,
      reason: dto.reason.trim(),
      actorId: new Types.ObjectId(adminUser.id),
      actorName: adminUser.fullName,
      actorEmail: adminUser.email,
      actorRole: adminUser.role,
      timestamp: new Date(),
    });

    const savedRevision = await revision.save();

    this.auditLogsService?.logEvent({
      action: AuditActionType.BUDGET_REVISED,
      entityType: AuditEntityType.CAMPAIGN,
      entityId: campaign._id.toString(),
      entityIdentifier: campaign.campaignCode,
      actorId: adminUser.id,
      actorName: adminUser.fullName,
      actorEmail: adminUser.email,
      actorRole: adminUser.role,
      description: `Campaign ${campaign.campaignCode} budget revised from ₹${previousBudget} to ₹${newBudget} (delta: ₹${delta}). Reason: ${dto.reason.trim()}`,
      beforeState: { approvedBudget: previousBudget, approvedBudgetPaise: previousBudgetPaise },
      afterState: { approvedBudget: newBudget, approvedBudgetPaise: newBudgetPaise, reason: dto.reason.trim() },
    }).catch(() => null);

    return { campaign: updatedCampaign, revision: savedRevision };
  }

  /**
   * Links an existing expense to a campaign.
   */
  async linkExpenseToCampaign(
    campaignId: string,
    expenseId: string,
    adminUser: { id: string; fullName: string; email: string },
  ): Promise<ExpenseDocument> {
    if (!isValidObjectId(campaignId) || !isValidObjectId(expenseId)) {
      throw new BadRequestException('Invalid ID format for campaign or expense.');
    }

    const [campaign, expense] = await Promise.all([
      this.campaignModel.findById(campaignId).exec(),
      this.expenseModel.findById(expenseId).exec(),
    ]);

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${campaignId}' not found.`);
    }
    if (!expense) {
      throw new NotFoundException(`Expense with ID '${expenseId}' not found.`);
    }

    // Duplicate linking guard
    if (expense.campaignId) {
      if (expense.campaignId.toString() === campaign._id.toString()) {
        throw new ConflictException(
          `Expense is already linked to this campaign (${campaign.campaignCode}).`,
        );
      }
      throw new ConflictException(
        `Expense is already linked to another campaign. Unlink it first before associating with a new campaign.`,
      );
    }

    expense.campaignId = campaign._id;
    expense.campaignCode = campaign.campaignCode;

    if (!expense.auditHistory) {
      expense.auditHistory = [];
    }

    expense.auditHistory.push({
      action: ExpenseAuditEventType.UPDATED,
      fromStatus: expense.status,
      toStatus: expense.status,
      performedBy: new Types.ObjectId(adminUser.id),
      performedByEmail: adminUser.email,
      performedByName: adminUser.fullName,
      notes: `Linked expense to Campaign ${campaign.campaignCode} (${campaign.name})`,
      timestamp: new Date(),
    });

    return await expense.save();
  }

  /**
   * Unlinks an expense from a campaign.
   */
  async unlinkExpenseFromCampaign(
    campaignId: string,
    expenseId: string,
    adminUser: { id: string; fullName: string; email: string },
  ): Promise<ExpenseDocument> {
    if (!isValidObjectId(campaignId) || !isValidObjectId(expenseId)) {
      throw new BadRequestException('Invalid ID format for campaign or expense.');
    }

    const expense = await this.expenseModel.findById(expenseId).exec();
    if (!expense) {
      throw new NotFoundException(`Expense with ID '${expenseId}' not found.`);
    }

    if (!expense.campaignId || expense.campaignId.toString() !== campaignId.toString()) {
      throw new BadRequestException('Expense is not currently linked to this campaign.');
    }

    const oldCode = expense.campaignCode;
    expense.campaignId = undefined;
    expense.campaignCode = undefined;

    if (!expense.auditHistory) {
      expense.auditHistory = [];
    }

    expense.auditHistory.push({
      action: ExpenseAuditEventType.UPDATED,
      fromStatus: expense.status,
      toStatus: expense.status,
      performedBy: new Types.ObjectId(adminUser.id),
      performedByEmail: adminUser.email,
      performedByName: adminUser.fullName,
      notes: `Unlinked expense from Campaign ${oldCode || campaignId}`,
      timestamp: new Date(),
    });

    return await expense.save();
  }

  /**
   * Retrieves complete budget vs actuals, category breakdown, and ROI metrics for a campaign.
   */
  async getCampaignFinancials(campaignId: string): Promise<any> {
    if (!isValidObjectId(campaignId)) {
      throw new BadRequestException('Invalid campaign ID format.');
    }

    const campaign = await this.campaignModel.findById(campaignId).lean().exec();
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${campaignId}' not found.`);
    }

    // 1. Fetch linked expenses
    const campaignObjId = isValidObjectId(campaign._id) ? new Types.ObjectId(campaign._id.toString()) : campaign._id;
    const linkedExpenses = await this.expenseModel
      .find({
        $or: [
          { campaignId: campaignObjId },
          { campaignId: campaign._id.toString() },
          { campaignCode: campaign.campaignCode },
        ],
        isDeleted: false,
      })
      .sort({ expenseDate: -1, createdAt: -1 })
      .lean()
      .exec();

    // 2. Filter approved liabilities vs pipeline
    const approvedExpenses = linkedExpenses.filter(
      (e) => e.status === ExpenseStatus.APPROVED,
    );
    const submittedExpenses = linkedExpenses.filter(
      (e) => e.status === ExpenseStatus.SUBMITTED,
    );
    const draftExpenses = linkedExpenses.filter(
      (e) => e.status === ExpenseStatus.DRAFT,
    );
    const rejectedExpenses = linkedExpenses.filter(
      (e) => e.status === ExpenseStatus.REJECTED,
    );
    const cancelledExpenses = linkedExpenses.filter(
      (e) => e.status === ExpenseStatus.CANCELLED,
    );

    // 3. Precise integer paise aggregations
    const approvedBudgetPaise = campaign.approvedBudgetPaise || 0;
    const approvedBudget = CurrencyUtil.toInr(approvedBudgetPaise);

    let actualExpenditurePaise = 0;
    let cashDisbursedPaise = 0;

    for (const exp of approvedExpenses) {
      const expPaise = exp.amountPaise !== undefined
        ? exp.amountPaise
        : Math.round((exp.amount || 0) * 100);
      actualExpenditurePaise += expPaise;

      const paidPaise = exp.paidAmountPaise !== undefined
        ? exp.paidAmountPaise
        : Math.round((exp.paidAmount || 0) * 100);
      cashDisbursedPaise += paidPaise;
    }

    const actualExpenditure = CurrencyUtil.toInr(actualExpenditurePaise);
    const cashDisbursed = CurrencyUtil.toInr(cashDisbursedPaise);
    const pendingDisbursementPaise = Math.max(0, actualExpenditurePaise - cashDisbursedPaise);
    const pendingDisbursement = CurrencyUtil.toInr(pendingDisbursementPaise);

    const remainingBudgetPaise = approvedBudgetPaise - actualExpenditurePaise;
    const remainingBudget = CurrencyUtil.toSignedInr(remainingBudgetPaise);

    const utilizationPercentage = approvedBudgetPaise > 0
      ? Math.round((actualExpenditurePaise / approvedBudgetPaise) * 10000) / 100
      : (actualExpenditurePaise > 0 ? 100 : 0);

    const overspendingPaise = Math.max(0, actualExpenditurePaise - approvedBudgetPaise);
    const overspending = CurrencyUtil.toInr(overspendingPaise);
    const isOverBudget = actualExpenditurePaise > approvedBudgetPaise;

    // 4. Category breakdown
    const categoryMap = new Map<string, { paise: number; count: number }>();
    for (const exp of approvedExpenses) {
      const cat = exp.category;
      const current = categoryMap.get(cat) || { paise: 0, count: 0 };
      const expPaise = exp.amountPaise !== undefined
        ? exp.amountPaise
        : Math.round((exp.amount || 0) * 100);
      current.paise += expPaise;
      current.count += 1;
      categoryMap.set(cat, current);
    }

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([cat, val]) => ({
      category: cat as ExpenseCategory,
      categoryLabel: EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat,
      amountPaise: val.paise,
      amount: CurrencyUtil.toInr(val.paise),
      count: val.count,
      percentageOfExpenditure: actualExpenditurePaise > 0
        ? Math.round((val.paise / actualExpenditurePaise) * 10000) / 100
        : 0,
    })).sort((a, b) => b.amountPaise - a.amountPaise);

    // 5. Completed Donations & Cost Per Donation
    const completedDonationsCount = await this.donationModel.countDocuments({
      campaignId: campaign._id,
      status: DonationStatus.COMPLETED,
    });
    const totalDonationsRecorded = await this.donationModel.countDocuments({
      campaignId: campaign._id,
    });

    const costPerCompletedDonationPaise = completedDonationsCount > 0
      ? Math.round(actualExpenditurePaise / completedDonationsCount)
      : null;
    const costPerCompletedDonation = costPerCompletedDonationPaise !== null
      ? CurrencyUtil.toInr(costPerCompletedDonationPaise)
      : null;

    // Pipeline (submitted) amounts
    let pipelinePaise = 0;
    for (const exp of submittedExpenses) {
      pipelinePaise += exp.amountPaise !== undefined
        ? exp.amountPaise
        : Math.round((exp.amount || 0) * 100);
    }

    return {
      campaign: {
        _id: campaign._id,
        campaignCode: campaign.campaignCode,
        name: campaign.name,
        venue: campaign.venue,
        city: campaign.city,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        targetDonations: campaign.targetDonations,
        budgetVersion: campaign.budgetVersion,
        budgetRevisionCount: campaign.budgetRevisionCount,
        initialBudget: CurrencyUtil.toInr(campaign.initialBudgetPaise || 0),
      },
      budgetMetrics: {
        approvedBudget,
        approvedBudgetPaise,
        actualExpenditure,
        actualExpenditurePaise,
        cashDisbursed,
        cashDisbursedPaise,
        pendingDisbursement,
        pendingDisbursementPaise,
        remainingBudget,
        remainingBudgetPaise,
        utilizationPercentage,
        overspending,
        overspendingPaise,
        isOverBudget,
        currency: 'INR',
      },
      pipelineMetrics: {
        submittedExpensesCount: submittedExpenses.length,
        submittedExpensesAmount: CurrencyUtil.toInr(pipelinePaise),
      },
      collectionMetrics: {
        targetDonations: campaign.targetDonations,
        completedDonations: completedDonationsCount,
        totalDonationsRecorded,
        achievementPercentage: campaign.targetDonations > 0
          ? Math.round((completedDonationsCount / campaign.targetDonations) * 10000) / 100
          : 0,
        costPerCompletedDonation,
        costPerCompletedDonationPaise,
      },
      categoryBreakdown,
      expenseCounts: {
        totalLinked: linkedExpenses.length,
        approved: approvedExpenses.length,
        submitted: submittedExpenses.length,
        draft: draftExpenses.length,
        rejected: rejectedExpenses.length,
        cancelled: cancelledExpenses.length,
      },
      linkedExpenses,
    };
  }

  /**
   * Lists campaigns with optional filters and attached budget summaries.
   */
  async listCampaigns(query: QueryCampaignsDto): Promise<any[]> {
    const filter: any = {};

    if (query.status) filter.status = query.status;
    if (query.city) filter.city = new RegExp(query.city.trim(), 'i');

    if (query.startDate) {
      filter.startDate = { $gte: new Date(query.startDate) };
    }
    if (query.endDate) {
      filter.endDate = { $lte: new Date(query.endDate) };
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { campaignCode: searchRegex },
        { venue: searchRegex },
        { city: searchRegex },
      ];
    }

    const campaigns = await this.campaignModel
      .find(filter)
      .sort({ startDate: -1 })
      .lean()
      .exec();

    // Attach active expenditure and donation counts
    const campaignIds = campaigns.map((c) => c._id);

    const [approvedExpenses, completedDonations] = await Promise.all([
      this.expenseModel
        .find({
          campaignId: { $in: campaignIds },
          status: ExpenseStatus.APPROVED,
          isDeleted: false,
        })
        .lean()
        .exec(),
      this.donationModel
        .find({
          campaignId: { $in: campaignIds },
          status: DonationStatus.COMPLETED,
        })
        .lean()
        .exec(),
    ]);

    const expenditureMap = new Map<string, number>();
    for (const exp of approvedExpenses) {
      if (exp.campaignId) {
        const idStr = exp.campaignId.toString();
        const paise = exp.amountPaise !== undefined
          ? exp.amountPaise
          : Math.round((exp.amount || 0) * 100);
        expenditureMap.set(idStr, (expenditureMap.get(idStr) || 0) + paise);
      }
    }

    const donationCountMap = new Map<string, number>();
    for (const don of completedDonations) {
      if (don.campaignId) {
        const idStr = don.campaignId.toString();
        donationCountMap.set(idStr, (donationCountMap.get(idStr) || 0) + 1);
      }
    }

    return campaigns.map((c) => {
      const idStr = c._id.toString();
      const actualExpenditurePaise = expenditureMap.get(idStr) || 0;
      const actualExpenditure = CurrencyUtil.toInr(actualExpenditurePaise);
      const approvedBudgetPaise = c.approvedBudgetPaise || 0;
      const remainingBudgetPaise = approvedBudgetPaise - actualExpenditurePaise;
      const remainingBudget = CurrencyUtil.toSignedInr(remainingBudgetPaise);
      const completedDonationsCount = donationCountMap.get(idStr) || 0;
      const costPerDonationPaise = completedDonationsCount > 0
        ? Math.round(actualExpenditurePaise / completedDonationsCount)
        : null;

      return {
        ...c,
        actualExpenditure,
        actualExpenditurePaise,
        remainingBudget,
        remainingBudgetPaise,
        completedDonationsCount,
        costPerCompletedDonation: costPerDonationPaise !== null
          ? CurrencyUtil.toInr(costPerDonationPaise)
          : null,
        utilizationPercentage: approvedBudgetPaise > 0
          ? Math.round((actualExpenditurePaise / approvedBudgetPaise) * 10000) / 100
          : (actualExpenditurePaise > 0 ? 100 : 0),
      };
    });
  }

  /**
   * Retrieves single campaign by ID.
   */
  async getCampaignById(id: string): Promise<CampaignDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid campaign ID format.');
    }
    const campaign = await this.campaignModel.findById(id).exec();
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${id}' not found.`);
    }
    return campaign;
  }

  /**
   * Retrieves budget revision history for a campaign.
   */
  async getCampaignBudgetRevisions(campaignId: string): Promise<CampaignBudgetRevision[]> {
    if (!isValidObjectId(campaignId)) {
      throw new BadRequestException('Invalid campaign ID format.');
    }
    return await this.revisionModel
      .find({ campaignId: new Types.ObjectId(campaignId) })
      .sort({ revisionNumber: -1 })
      .lean()
      .exec();
  }

  /**
   * Generates a unique unit code.
   */
  private generateUnitCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `UNIT-${datePart}-${randomPart}`;
  }

  /**
   * Retrieves blood units collected during this campaign, testing pipeline outcomes,
   * safe blood units remaining, and central inventory intake status.
   */
  async getCampaignBloodUnits(campaignId: string) {
    if (!isValidObjectId(campaignId)) {
      throw new BadRequestException('Invalid campaign ID format.');
    }

    const campaign = await this.campaignModel.findById(campaignId).exec();
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${campaignId}' not found.`);
    }

    // 1. Find all donations linked to this campaign
    const donations = await this.donationModel
      .find({
        $or: [
          { campaignId: campaign._id },
          { campaignCode: campaign.campaignCode },
        ],
      })
      .populate('donorId', 'donorCode fullName bloodGroup gender phone')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const donationIds = donations.map((d: any) => d._id);

    // 2. Find blood units corresponding to these donations
    let bloodUnits: any[] = [];
    if (this.bloodUnitModel && donationIds.length > 0) {
      bloodUnits = await this.bloodUnitModel
        .find({ donationId: { $in: donationIds } })
        .populate('donorId', 'donorCode fullName bloodGroup')
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      // If any COMPLETED donations do not yet have a physical blood unit created, create them now
      const existingDonationIds = new Set(bloodUnits.map((u: any) => u.donationId?.toString()));
      for (const don of donations) {
        if (
          don.status === DonationStatus.COMPLETED &&
          !existingDonationIds.has(don._id.toString())
        ) {
          try {
            const unitCode = this.generateUnitCode();
            const donorObj = don.donorId as any;
            const bloodGroup = donorObj?.bloodGroup || 'O_POSITIVE';
            const newUnit = new this.bloodUnitModel({
              unitCode,
              donationId: don._id,
              donorId: donorObj?._id || donorObj,
              bloodGroup,
              componentType: 'WHOLE_BLOOD',
              collectionDate: don.donationDate || new Date(),
              expiryDate: new Date((don.donationDate ? new Date(don.donationDate).getTime() : Date.now()) + 35 * 24 * 60 * 60 * 1000),
              status: BloodUnitStatus.TESTING,
            });
            const savedUnit = await newUnit.save();
            bloodUnits.push(savedUnit.toObject ? savedUnit.toObject() : savedUnit);
            existingDonationIds.add(don._id.toString());
          } catch {
            // Silently continue if concurrent creation occurred
          }
        }
      }
    }

    const unitIds = bloodUnits.map((u: any) => u._id);

    // 3. Find testing records for these blood units
    let testings: any[] = [];
    if (this.bloodTestingModel && unitIds.length > 0) {
      testings = await this.bloodTestingModel
        .find({ bloodUnitId: { $in: unitIds } })
        .lean()
        .exec();
    }
    const testingMap = new Map<string, any>();
    for (const t of testings) {
      testingMap.set(t.bloodUnitId.toString(), t);
    }

    // 4. Find inventory records for these blood units
    let inventories: any[] = [];
    if (this.inventoryModel && unitIds.length > 0) {
      inventories = await this.inventoryModel
        .find({ bloodUnitId: { $in: unitIds } })
        .lean()
        .exec();
    }
    const inventoryMap = new Map<string, any>();
    for (const inv of inventories) {
      inventoryMap.set(inv.bloodUnitId.toString(), inv);
    }

    let totalUnitsCollected = bloodUnits.length;
    let testingPassed = 0; // Remaining safe units after testing
    let testingFailed = 0; // Contaminated / rejected units discarded
    let testingInProgress = 0; // Pending or in-testing
    let inInventoryCount = 0; // Successfully added to inventory

    const groupCounts: Record<string, number> = {};

    const detailedUnits = bloodUnits.map((unit: any) => {
      const testing = testingMap.get(unit._id.toString());
      const inventory = inventoryMap.get(unit._id.toString());

      const bg = unit.bloodGroup || 'UNKNOWN';
      groupCounts[bg] = (groupCounts[bg] || 0) + 1;

      let testStatus = 'PENDING';
      let testDecision = 'PENDING';

      if (testing) {
        testStatus = testing.status;
        testDecision = testing.decision;
      } else if (unit.status === BloodUnitStatus.APPROVED) {
        testStatus = 'COMPLETED';
        testDecision = 'APPROVED';
      } else if (unit.status === BloodUnitStatus.REJECTED) {
        testStatus = 'COMPLETED';
        testDecision = 'REJECTED';
      }

      if (testDecision === 'APPROVED') {
        testingPassed++;
      } else if (testDecision === 'REJECTED') {
        testingFailed++;
      } else {
        testingInProgress++;
      }

      const isInInventory = !!inventory && inventory.status === InventoryStatus.AVAILABLE;
      if (isInInventory) {
        inInventoryCount++;
      }

      const donation = donations.find((d: any) => d._id.toString() === unit.donationId?.toString());

      return {
        _id: unit._id.toString(),
        unitCode: unit.unitCode,
        bloodGroup: unit.bloodGroup,
        componentType: unit.componentType,
        collectionDate: unit.collectionDate,
        expiryDate: unit.expiryDate,
        volume: unit.volume,
        storageLocation: unit.storageLocation,
        donationId: unit.donationId?.toString(),
        donationCode: donation?.donationCode || 'N/A',
        donorName: (unit.donorId as any)?.fullName || (donation?.donorId as any)?.fullName || 'Anonymous Donor',
        donorCode: (unit.donorId as any)?.donorCode || (donation?.donorId as any)?.donorCode || 'N/A',
        testingStatus: testStatus,
        testingDecision: testDecision,
        testingCode: testing?.testingCode,
        isInInventory,
        inventoryStatus: inventory ? inventory.status : null,
        inventoryId: inventory ? inventory._id.toString() : null,
      };
    });

    const safeYieldRate = totalUnitsCollected > 0
      ? Math.round((testingPassed / totalUnitsCollected) * 1000) / 10
      : 0;

    return {
      campaign: {
        _id: campaign._id.toString(),
        campaignCode: campaign.campaignCode,
        name: campaign.name,
        targetDonations: campaign.targetDonations,
      },
      summary: {
        totalDonations: donations.length,
        totalUnitsCollected,
        testingPassed, // "how many got remaining"
        testingFailed,
        testingInProgress,
        inInventoryCount, // "added to inventory with their unit code"
        safeYieldRate,
        bloodGroupBreakdown: groupCounts,
      },
      units: detailedUnits,
    };
  }

  /**
   * Intakes all laboratory-approved blood units from this campaign into Central Inventory with their unit codes.
   */
  async intakePassedUnitsToInventory(
    campaignId: string,
    adminUser?: { id: string; fullName: string; role: string; email?: string },
  ) {
    if (!isValidObjectId(campaignId)) {
      throw new BadRequestException('Invalid campaign ID format.');
    }

    const campaign = await this.campaignModel.findById(campaignId).exec();
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${campaignId}' not found.`);
    }

    if (!this.bloodUnitModel || !this.inventoryModel) {
      throw new BadRequestException('Inventory models are not available.');
    }

    // 1. Get donations
    const donations = await this.donationModel
      .find({
        $or: [
          { campaignId: campaign._id },
          { campaignCode: campaign.campaignCode },
        ],
      })
      .lean()
      .exec();

    const donationIds = donations.map((d: any) => d._id);

    // 2. Get approved blood units
    const approvedUnits = await this.bloodUnitModel
      .find({
        donationId: { $in: donationIds },
        status: BloodUnitStatus.APPROVED,
      })
      .exec();

    let newlyIntaken = 0;
    const intakenCodes: string[] = [];
    const now = new Date();

    for (const unit of approvedUnits) {
      // Safety Gate 1: Check expiration at intake point
      if (unit.expiryDate && new Date(unit.expiryDate) < now) {
        continue;
      }

      // Safety Gate 2: Verify certified laboratory testing completion
      if (this.bloodTestingModel) {
        const testing = await this.bloodTestingModel.findOne({ bloodUnitId: unit._id }).exec();
        if (
          !testing ||
          testing.status !== TestingStatus.COMPLETED ||
          testing.decision !== TestingDecision.APPROVED
        ) {
          continue;
        }
      }

      const existing = await this.inventoryModel.findOne({ bloodUnitId: unit._id }).exec();
      if (!existing) {
        await this.inventoryModel.create({
          bloodUnitId: unit._id,
          status: InventoryStatus.AVAILABLE,
          receivedBy: adminUser ? new Types.ObjectId(adminUser.id) : undefined,
          receivedByName: adminUser?.fullName || 'Campaign Staff',
          receivedByRole: adminUser?.role || 'ADMIN',
        });
        newlyIntaken++;
        intakenCodes.push(unit.unitCode);

        if (adminUser) {
          this.auditLogsService?.logEvent({
            action: AuditActionType.INVENTORY_INTAKE_COMPLETED,
            entityType: AuditEntityType.INVENTORY,
            entityId: unit._id.toString(),
            entityIdentifier: unit.unitCode,
            actorId: adminUser.id,
            actorName: adminUser.fullName,
            actorEmail: adminUser.email,
            actorRole: adminUser.role,
            description: `Blood unit ${unit.unitCode} enrolled into central inventory from campaign ${campaign.campaignCode}`,
            afterState: { status: InventoryStatus.AVAILABLE, campaignCode: campaign.campaignCode },
          }).catch(() => null);
        }
      }
    }

    const totalInInventory = await this.inventoryModel.countDocuments({
      bloodUnitId: { $in: approvedUnits.map((u: any) => u._id) },
      status: InventoryStatus.AVAILABLE,
    });

    return {
      campaignId: campaign._id.toString(),
      campaignCode: campaign.campaignCode,
      newlyIntakenCount: newlyIntaken,
      intakenUnitCodes: intakenCodes,
      totalApprovedUnits: approvedUnits.length,
      totalInInventory,
      message: newlyIntaken > 0
        ? `Successfully enrolled ${newlyIntaken} approved blood unit(s) into Central Inventory with their unit codes.`
        : 'All approved blood units from this campaign are already enrolled in Central Inventory.',
    };
  }

  private normalizeBloodGroup(raw?: string): BloodGroup {
    if (!raw) return BloodGroup.O_POSITIVE;
    const trimmed = raw.trim().toUpperCase();
    const map: Record<string, BloodGroup> = {
      'A+': BloodGroup.A_POSITIVE,
      'A_POSITIVE': BloodGroup.A_POSITIVE,
      'A-': BloodGroup.A_NEGATIVE,
      'A_NEGATIVE': BloodGroup.A_NEGATIVE,
      'B+': BloodGroup.B_POSITIVE,
      'B_POSITIVE': BloodGroup.B_POSITIVE,
      'B-': BloodGroup.B_NEGATIVE,
      'B_NEGATIVE': BloodGroup.B_NEGATIVE,
      'AB+': BloodGroup.AB_POSITIVE,
      'AB_POSITIVE': BloodGroup.AB_POSITIVE,
      'AB-': BloodGroup.AB_NEGATIVE,
      'AB_NEGATIVE': BloodGroup.AB_NEGATIVE,
      'O+': BloodGroup.O_POSITIVE,
      'O_POSITIVE': BloodGroup.O_POSITIVE,
      'O-': BloodGroup.O_NEGATIVE,
      'O_NEGATIVE': BloodGroup.O_NEGATIVE,
    };
    return map[trimmed] || (trimmed as BloodGroup);
  }

  private normalizeComponentType(raw?: string): BloodUnitComponent {
    if (!raw) return BloodUnitComponent.WHOLE_BLOOD;
    const trimmed = raw.trim().toUpperCase();
    const map: Record<string, BloodUnitComponent> = {
      'WHOLE_BLOOD': BloodUnitComponent.WHOLE_BLOOD,
      'PRBC': BloodUnitComponent.PRBC,
      'RED_BLOOD_CELLS': BloodUnitComponent.PRBC,
      'PACKED_RED_BLOOD_CELLS': BloodUnitComponent.PRBC,
      'FFP': BloodUnitComponent.FFP,
      'PLASMA': BloodUnitComponent.FFP,
      'FRESH_FROZEN_PLASMA': BloodUnitComponent.FFP,
      'PLATELETS': BloodUnitComponent.PLATELETS,
    };
    return map[trimmed] || BloodUnitComponent.WHOLE_BLOOD;
  }

  /**
   * Records a blood donation and physical blood unit directly for a campaign drive.
   * Auto-issues unique unitCode, creates or links donor, and initializes lab testing pipeline.
   */
  async recordCampaignDonation(
    campaignId: string,
    dto: RecordCampaignDonationDto,
    adminUser?: { id: string; fullName: string; role: string; email?: string },
  ) {
    if (!isValidObjectId(campaignId)) {
      throw new BadRequestException('Invalid campaign ID format.');
    }

    const campaign = await this.campaignModel.findById(campaignId).exec();
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${campaignId}' not found.`);
    }

    // 1. Resolve Donor & Enforce Authoritative Eligibility
    let donor: any = null;
    const now = new Date();
    const donationDate = dto.donationDate ? new Date(dto.donationDate) : now;
    const resolvedDonationType = dto.donationType || 'WHOLE_BLOOD';

    if (dto.donorId) {
      if (!isValidObjectId(dto.donorId)) {
        throw new BadRequestException('Invalid donor ID format.');
      }
      if (this.donorModel) {
        donor = await this.donorModel.findById(dto.donorId).exec();
      }
      if (!donor) {
        throw new NotFoundException(`Donor with ID '${dto.donorId}' not found.`);
      }

      // Enforce shared eligibility rules (status, age, interval, duplicate same day)
      if (this.donorEligibilityService) {
        await this.donorEligibilityService.validateEligibility(
          donor,
          donationDate,
          resolvedDonationType,
        );
      } else {
        if (donor.status === 'PENDING_REVIEW' || donor.status === 'INACTIVE') {
          throw new BadRequestException(`Donor status '${donor.status}' is not eligible to donate.`);
        }
      }
    } else if (dto.donorFullName && dto.donorBloodGroup && dto.donorPhone) {
      if (!this.donorModel) {
        throw new BadRequestException('Donor model is not available.');
      }
      const bloodGroup = this.normalizeBloodGroup(dto.donorBloodGroup);
      // Check existing by phone
      donor = await this.donorModel.findOne({ phone: dto.donorPhone.trim() }).exec();
      if (!donor) {
        // Validate age if dateOfBirth provided
        const dobStr = (dto as any).donorDateOfBirth;
        if (dobStr) {
          const age = calculateCompletedAge(dobStr, donationDate);
          if (age < MIN_WHOLE_BLOOD_DONOR_AGE) {
            throw new BadRequestException({
              message: `Donor must be at least ${MIN_WHOLE_BLOOD_DONOR_AGE} years old to donate blood (current age: ${age}).`,
              code: 'DONOR_UNDERAGE',
            });
          }
          if (age > MAX_WHOLE_BLOOD_DONOR_AGE) {
            throw new BadRequestException({
              message: `Donor exceeds the maximum permissible age of ${MAX_WHOLE_BLOOD_DONOR_AGE} years (current age: ${age}).`,
              code: 'DONOR_OVERAGE',
            });
          }
        }

        const randCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        donor = new this.donorModel({
          donorCode: `DNR-${randCode}`,
          fullName: dto.donorFullName.trim(),
          bloodGroup: bloodGroup,
          gender: dto.donorGender || 'MALE',
          dateOfBirth: dobStr ? new Date(dobStr) : undefined,
          phone: dto.donorPhone.trim(),
          email: dto.donorEmail?.trim().toLowerCase() || undefined,
          status: 'ACTIVE',
          registeredBy: adminUser ? new Types.ObjectId(adminUser.id) : undefined,
          registeredByName: adminUser?.fullName || 'Campaign Staff',
          registeredByRole: adminUser?.role || 'ADMIN',
        });
        donor = await donor.save();
      }

      // Enforce eligibility on donor record
      if (this.donorEligibilityService) {
        await this.donorEligibilityService.validateEligibility(
          donor,
          donationDate,
          resolvedDonationType,
        );
      }
    } else {
      throw new BadRequestException(
        'Please select an existing registered donor or enter campaign donor details (Name, Blood Group, Phone).',
      );
    }

    // 2. Create Donation
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const donationCode = `DONATION-${datePart}-${randPart}`;

    const bagBarcode = dto.bagBarcode || `BAG-${datePart}-${randPart}`;
    const resolvedBagType = dto.bagType || 'SINGLE_350ML';
    const isBagProblem =
      dto.bagIntegrity === 'LEAKING' ||
      dto.bagIntegrity === 'CLOTTED' ||
      dto.bagIntegrity === 'DEFECTIVE';

    const donation = new this.donationModel({
      donationCode,
      donorId: donor._id,
      campaignId: campaign._id,
      campaignCode: campaign.campaignCode,
      donationDate,
      donationType: resolvedDonationType,
      quantity: dto.quantity || 1,
      status: isBagProblem ? DonationStatus.CANCELLED : DonationStatus.COMPLETED,
      notes: dto.notes?.trim() || undefined,
      bagBarcode,
      bagType: resolvedBagType,
      bagIntegrity: dto.bagIntegrity || 'INTACT',
      adverseReaction: dto.adverseReaction || 'NONE',
      collectedVolumeMl: dto.volume || (resolvedBagType.includes('450') ? 450 : 350),
      collectionLocation: `Campaign: ${campaign.name} (${campaign.venue})`,
      recordedBy: adminUser ? new Types.ObjectId(adminUser.id) : undefined,
      recordedByName: adminUser?.fullName || 'Campaign Staff',
      recordedByRole: adminUser?.role || 'ADMIN',
    });
    const savedDonation = await donation.save();

    // 3. Create Blood Unit with unique unitCode
    // SAFETY INVARIANT: Creating a donation or rapid screening CANNOT release a blood unit.
    // Unit status begins strictly as TESTING (or REJECTED if bag contaminated/leaked).
    if (!this.bloodUnitModel) {
      throw new BadRequestException('BloodUnit model is not available.');
    }

    const unitCode = this.generateUnitCode();
    let unitStatus = BloodUnitStatus.TESTING;
    if (dto.immediateScreeningDecision === 'REJECTED' || isBagProblem) {
      unitStatus = BloodUnitStatus.REJECTED;
    }

    const resolvedBloodGroup = this.normalizeBloodGroup(donor.bloodGroup || dto.donorBloodGroup);
    const resolvedComponentType = this.normalizeComponentType(dto.componentType);

    // Dynamic shelf-life calculation via central ExpiryRulesService
    let calculatedExpiryDate: Date;
    if (this.expiryRulesService) {
      calculatedExpiryDate = await this.expiryRulesService.calculateExpiryDate(
        donationDate,
        resolvedComponentType as any,
      );
    } else {
      const shelfDays =
        resolvedComponentType === 'PLATELETS'
          ? 5
          : resolvedComponentType === 'FFP'
            ? 365
            : resolvedComponentType === 'PRBC'
              ? 42
              : 35;
      calculatedExpiryDate = new Date(
        donationDate.getTime() + shelfDays * 24 * 60 * 60 * 1000,
      );
    }

    const bloodUnit = new this.bloodUnitModel({
      unitCode,
      donationId: savedDonation._id,
      donorId: donor._id,
      campaignId: campaign._id,
      campaignCode: campaign.campaignCode,
      bloodGroup: resolvedBloodGroup,
      componentType: resolvedComponentType,
      volume: dto.volume || (resolvedBagType.includes('450') ? 450 : 350),
      collectionDate: donationDate,
      expiryDate: calculatedExpiryDate,
      bagBarcode,
      bagType: resolvedBagType,
      bagIntegrity: dto.bagIntegrity || 'INTACT',
      storageLocation: dto.storageLocation || 'MOBILE_CAMP_TRANSPORT_COOLER',
      status: unitStatus,
      createdBy: adminUser ? new Types.ObjectId(adminUser.id) : undefined,
      createdByName: adminUser?.fullName || 'Campaign Staff',
      createdByRole: adminUser?.role || 'ADMIN',
    });
    const savedUnit = await bloodUnit.save();

    // 4. Initialize Blood Testing Record in Lab Pipeline
    // SAFETY INVARIANT: Rapid screening does not substitute for certified lab testing.
    let savedTesting: any = null;
    if (this.bloodTestingModel) {
      const testCode = `TEST-${datePart}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const isRejected = dto.immediateScreeningDecision === 'REJECTED' || isBagProblem;

      const initialTestResults = [
        { testCode: 'HIV', testName: 'HIV 1 & 2 Antibody / Antigen Screen' },
        { testCode: 'HBV', testName: 'Hepatitis B Surface Antigen (HBsAg)' },
        { testCode: 'HCV', testName: 'Hepatitis C Antibody Screen (Anti-HCV)' },
        { testCode: 'SYPHILIS', testName: 'Syphilis Serology (VDRL / RPR / TPHA)' },
        { testCode: 'MALARIA', testName: 'Malaria Antigen / Smear Screen' },
      ].map((def) => ({
        testCode: def.testCode,
        testName: def.testName,
        status: isRejected ? TestResultStatus.FAIL : TestResultStatus.PENDING,
        testedAt: isRejected ? now : undefined,
      }));

      const testingRecord = new this.bloodTestingModel({
        testingCode: testCode,
        bloodUnitId: savedUnit._id,
        donationId: savedDonation._id,
        donorId: donor._id,
        campaignId: campaign._id,
        campaignCode: campaign.campaignCode,
        testResults: initialTestResults,
        status: isRejected ? TestingStatus.COMPLETED : TestingStatus.IN_PROGRESS,
        decision: isRejected ? TestingDecision.REJECTED : TestingDecision.PENDING,
        startedAt: now,
        startedBy: adminUser ? new Types.ObjectId(adminUser.id) : undefined,
        startedByName: adminUser?.fullName || 'Campaign Staff',
        startedByRole: adminUser?.role || 'ADMIN',
        completedAt: isRejected ? now : undefined,
        rejectionReason: isRejected
          ? 'Failed on-site physical/clinical screening at campaign'
          : undefined,
        remarks: isRejected
          ? 'Contaminated / rejected screening at campaign'
          : 'Enrolled in central laboratory testing pipeline',
      });
      savedTesting = await testingRecord.save();
    }

    if (adminUser) {
      this.auditLogsService?.logEvent({
        action: AuditActionType.DONATION_RECORDED,
        entityType: AuditEntityType.DONATION,
        entityId: savedDonation._id.toString(),
        entityIdentifier: savedDonation.donationCode,
        actorId: adminUser.id,
        actorName: adminUser.fullName,
        actorEmail: adminUser.email,
        actorRole: adminUser.role,
        description: `Campaign donation ${savedDonation.donationCode} recorded for campaign ${campaign.campaignCode}. Unit ${unitCode} issued.`,
        afterState: { donationCode: savedDonation.donationCode, unitCode, campaignCode: campaign.campaignCode },
      }).catch(() => null);
    }

    return {
      message: `Blood donation successfully logged for campaign ${campaign.campaignCode}. Unit ${unitCode} issued.`,
      donation: savedDonation,
      unit: savedUnit,
      donor: {
        _id: donor._id,
        donorCode: donor.donorCode,
        fullName: donor.fullName,
        bloodGroup: donor.bloodGroup,
        phone: donor.phone,
      },
      testing: savedTesting,
    };
  }

  /**
   * Updates testing screening decision for a blood unit in this campaign.
   */
  async updateCampaignUnitTestingDecision(
    campaignId: string,
    unitId: string,
    dto: UpdateCampaignUnitTestingDecisionDto,
  ) {
    if (!isValidObjectId(campaignId) || !isValidObjectId(unitId)) {
      throw new BadRequestException('Invalid campaign or unit ID format.');
    }

    if (!this.bloodUnitModel) {
      throw new BadRequestException('BloodUnit model is not available.');
    }

    const bloodUnit = await this.bloodUnitModel.findById(unitId).exec();
    if (!bloodUnit) {
      throw new NotFoundException(`Blood unit with ID '${unitId}' not found.`);
    }

    // Safety Invariant (Phase 1): Cannot approve a unit without verified laboratory screening completion
    if (dto.decision === 'APPROVED') {
      let testing = this.bloodTestingModel
        ? await this.bloodTestingModel.findOne({ bloodUnitId: bloodUnit._id }).exec()
        : null;

      const hasPendingTests =
        !testing ||
        !testing.testResults ||
        testing.testResults.length === 0 ||
        testing.testResults.some((t: any) => t.status === TestResultStatus.PENDING);

      if (hasPendingTests) {
        throw new BadRequestException({
          message: `Cannot release blood unit '${bloodUnit.unitCode}' without certified laboratory testing. All mandatory tests (HIV, HBV, HCV, Syphilis, Malaria) must be performed and verified in the Laboratory module.`,
          code: 'LABORATORY_TESTING_REQUIRED',
        });
      }

      const hasFailedTests =
        testing.testResults.some((t: any) => t.status === TestResultStatus.FAIL);

      if (hasFailedTests) {
        throw new BadRequestException({
          message: `Cannot approve blood unit '${bloodUnit.unitCode}': one or more mandatory screening tests are reactive/failed.`,
          code: 'CANNOT_APPROVE_REACTIVE_UNIT',
        });
      }
    }

    const targetStatus = dto.decision === 'APPROVED' ? BloodUnitStatus.APPROVED : BloodUnitStatus.REJECTED;
    bloodUnit.status = targetStatus;
    await bloodUnit.save();

    // Update testing record if present
    let updatedTesting: any = null;
    if (this.bloodTestingModel) {
      let testing = await this.bloodTestingModel.findOne({ bloodUnitId: bloodUnit._id }).exec();
      const now = new Date();
      if (!testing) {
        const testCode = `TEST-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        testing = new this.bloodTestingModel({
          testingCode: testCode,
          bloodUnitId: bloodUnit._id,
          donationId: bloodUnit.donationId,
          donorId: bloodUnit.donorId,
          startedAt: now,
        });
      }

      testing.status = TestingStatus.COMPLETED;
      testing.decision = dto.decision === 'APPROVED' ? TestingDecision.APPROVED : TestingDecision.REJECTED;
      testing.completedAt = now;
      if (dto.performedBy) testing.performedBy = dto.performedBy;
      if (dto.remarks) testing.remarks = dto.remarks;
      if (dto.decision === 'REJECTED') {
        testing.rejectionReason = dto.remarks || 'Contaminated / Positive screen (Discarded)';
        if (testing.testResults && testing.testResults.length > 0) {
          testing.testResults = testing.testResults.map((t: any) => ({
            ...t,
            status: TestResultStatus.FAIL,
            testedAt: now,
          }));
        }
      }

      updatedTesting = await testing.save();
    }

    return {
      message: dto.decision === 'APPROVED'
        ? `Blood unit ${bloodUnit.unitCode} passed laboratory screening and is safe for inventory intake.`
        : `Blood unit ${bloodUnit.unitCode} marked as failed / contaminated and discarded.`,
      unit: bloodUnit,
      testing: updatedTesting,
    };
  }
}
