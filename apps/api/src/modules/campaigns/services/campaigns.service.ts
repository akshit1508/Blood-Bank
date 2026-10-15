import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
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
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  ReviseCampaignBudgetDto,
  QueryCampaignsDto,
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
    const linkedExpenses = await this.expenseModel
      .find({ campaignId: campaign._id, isDeleted: false })
      .sort({ expenseDate: -1 })
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
}
