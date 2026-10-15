import { getAuthHeaders } from './auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export enum CampaignStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  [CampaignStatus.PLANNED]: 'Planned',
  [CampaignStatus.ACTIVE]: 'Active (Ongoing)',
  [CampaignStatus.COMPLETED]: 'Completed',
  [CampaignStatus.CANCELLED]: 'Cancelled',
};

export const CAMPAIGN_STATUS_BADGE_COLORS: Record<CampaignStatus, { bg: string; text: string; border: string }> = {
  [CampaignStatus.PLANNED]: { bg: '#1e293b', text: '#94a3b8', border: '#334155' },
  [CampaignStatus.ACTIVE]: { bg: '#064e3b', text: '#34d399', border: '#059669' },
  [CampaignStatus.COMPLETED]: { bg: '#172554', text: '#60a5fa', border: '#2563eb' },
  [CampaignStatus.CANCELLED]: { bg: '#450a0a', text: '#f87171', border: '#dc2626' },
};

export enum ExpenseCategory {
  STAFF_CAMP_MEALS = 'STAFF_CAMP_MEALS',
  LOGISTICS_TRANSPORT = 'LOGISTICS_TRANSPORT',
  MEDICAL_SUPPLIES = 'MEDICAL_SUPPLIES',
  FACILITIES_EQUIPMENT = 'FACILITIES_EQUIPMENT',
  LABORATORY_TESTING = 'LABORATORY_TESTING',
  ADMIN_OFFICE = 'ADMIN_OFFICE',
  UTILITIES_WASTE = 'UTILITIES_WASTE',
  OTHER = 'OTHER',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.STAFF_CAMP_MEALS]: 'Camp Refreshments & Donor Welfare',
  [ExpenseCategory.LOGISTICS_TRANSPORT]: 'Cold-Chain Transport & Logistics',
  [ExpenseCategory.MEDICAL_SUPPLIES]: 'Medical & Phlebotomy Supplies',
  [ExpenseCategory.FACILITIES_EQUIPMENT]: 'Facilities, Tents & Sound Equipment',
  [ExpenseCategory.LABORATORY_TESTING]: 'Laboratory Testing & Reagents',
  [ExpenseCategory.ADMIN_OFFICE]: 'Administrative & Outreach Banners',
  [ExpenseCategory.UTILITIES_WASTE]: 'Utilities & Biohazard Waste Disposal',
  [ExpenseCategory.OTHER]: 'Other Operational Expenditure',
};

export interface CampaignItem {
  _id: string;
  campaignCode: string;
  name: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  targetDonations: number;
  initialBudgetPaise: number;
  approvedBudgetPaise: number;
  approvedBudget: number;
  currency: string;
  budgetVersion: number;
  budgetRevisionCount: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  actualExpenditure?: number;
  remainingBudget?: number;
  completedDonationsCount?: number;
  costPerCompletedDonation?: number | null;
  utilizationPercentage?: number;
}

export interface CampaignBudgetRevisionItem {
  _id: string;
  campaignId: string;
  revisionNumber: number;
  previousBudgetPaise: number;
  newBudgetPaise: number;
  deltaPaise: number;
  previousBudget: number;
  newBudget: number;
  delta: number;
  reason: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  timestamp: string;
}

export interface ExpenseCategoryBreakdownItem {
  category: string;
  categoryLabel: string;
  amountPaise: number;
  amount: number;
  count: number;
  percentageOfExpenditure: number;
}

export interface CampaignFinancials {
  campaign: {
    _id: string;
    campaignCode: string;
    name: string;
    venue: string;
    city: string;
    status: CampaignStatus;
    startDate: string;
    endDate: string;
    targetDonations: number;
    budgetVersion: number;
    budgetRevisionCount: number;
    initialBudget: number;
  };
  budgetMetrics: {
    approvedBudget: number;
    approvedBudgetPaise: number;
    actualExpenditure: number;
    actualExpenditurePaise: number;
    cashDisbursed: number;
    cashDisbursedPaise: number;
    pendingDisbursement: number;
    pendingDisbursementPaise: number;
    remainingBudget: number;
    remainingBudgetPaise: number;
    utilizationPercentage: number;
    isOverBudget: boolean;
    overspending: number;
    overspendingPaise: number;
    currency: string;
  };
  pipelineMetrics: {
    submittedExpensesCount: number;
    submittedExpensesAmount: number;
  };
  collectionMetrics: {
    targetDonations: number;
    completedDonations: number;
    totalDonationsRecorded: number;
    achievementPercentage: number;
    costPerCompletedDonation: number | null;
    costPerCompletedDonationPaise: number | null;
  };
  categoryBreakdown: ExpenseCategoryBreakdownItem[];
  expenseCounts: {
    totalLinked: number;
    approved: number;
    submitted: number;
    draft: number;
    rejected: number;
    cancelled: number;
  };
  linkedExpenses: Array<{
    _id: string;
    expenseCode: string;
    voucherNumber: string;
    title: string;
    category: string;
    amount: number;
    amountPaise: number;
    paidAmount?: number;
    paidAmountPaise?: number;
    status: string;
    paymentStatus?: string;
    expenseDate: string;
    vendorName?: string;
    invoiceNumber?: string;
    description?: string;
    creatorName?: string;
    receipt?: {
      fileId: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      uploadedAt: string;
    };
  }>;
}

export interface CreateCampaignPayload {
  name: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string;
  targetDonations: number;
  initialBudget?: number;
  description?: string;
}

export interface UpdateCampaignPayload {
  name?: string;
  venue?: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  status?: CampaignStatus;
  targetDonations?: number;
  description?: string;
}

export interface ReviseBudgetPayload {
  newBudget: number;
  reason: string;
  budgetVersion: number;
}

export interface CreateCampaignExpensePayload {
  title: string;
  category: ExpenseCategory;
  amount: number;
  invoiceNumber: string;
  vendorName: string;
  expenseDate: string;
  description?: string;
  taxAmount?: number;
  gstinNumber?: string;
  receiptFile?: File | null;
}

/**
 * Fetch list of campaigns with operational and budget metrics.
 */
export async function fetchCampaigns(query?: {
  status?: string;
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  campaigns: CampaignItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.city) params.set('city', query.city);
  if (query?.search) params.set('search', query.search);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/campaigns${qs}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch campaigns list.');
  }

  const list: CampaignItem[] = Array.isArray(json.data)
    ? json.data
    : Array.isArray(json.data?.campaigns)
    ? json.data.campaigns
    : [];

  return {
    campaigns: list,
    total: json.meta?.total ?? list.length,
    page: json.meta?.page ?? 1,
    limit: json.meta?.limit ?? list.length,
    totalPages: json.meta?.totalPages ?? 1,
  };
}

/**
 * Fetch a single campaign by ID.
 */
export async function fetchCampaignById(id: string): Promise<CampaignItem> {
  const res = await fetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Failed to fetch campaign ${id}`);
  }

  return json.data;
}

/**
 * Schedule a new blood donation campaign.
 */
export async function createCampaign(payload: CreateCampaignPayload): Promise<CampaignItem> {
  const res = await fetch(`${API_BASE_URL}/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to schedule campaign.');
  }

  return json.data;
}

/**
 * Update general campaign details or status.
 */
export async function updateCampaign(id: string, payload: UpdateCampaignPayload): Promise<CampaignItem> {
  const res = await fetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Failed to update campaign ${id}`);
  }

  return json.data;
}

/**
 * Super Admin exclusive: Revise campaign approved budget with audit and OCC check.
 */
export async function reviseCampaignBudget(
  id: string,
  payload: ReviseBudgetPayload,
): Promise<{ campaign: CampaignItem; revision: CampaignBudgetRevisionItem }> {
  const res = await fetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(id)}/revise-budget`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to revise campaign budget.');
  }

  return json.data;
}

/**
 * Fetch budget revision audit timeline for a campaign.
 */
export async function fetchCampaignBudgetRevisions(id: string): Promise<CampaignBudgetRevisionItem[]> {
  const res = await fetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(id)}/budget-revisions`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch budget revision history.');
  }

  return json.data;
}

/**
 * Super Admin exclusive: Fetch full financial command center report for a campaign.
 */
export async function fetchCampaignFinancials(id: string): Promise<CampaignFinancials> {
  const res = await fetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(id)}/financials`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch campaign financials.');
  }

  return json.data;
}

/**
 * Link an approved expense to a campaign.
 */
export async function linkExpenseToCampaign(campaignId: string, expenseId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/link-expense`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ expenseId }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to link expense to campaign.');
  }

  return json.data;
}

/**
 * Unlink an expense from a campaign.
 */
export async function unlinkExpenseFromCampaign(campaignId: string, expenseId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/expenses/${encodeURIComponent(expenseId)}/unlink`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to unlink expense from campaign.');
  }

  return json.data;
}

/**
 * Create a new expenditure directly for a campaign with invoice details and optional receipt file.
 */
export async function createCampaignExpenditure(
  campaignId: string,
  payload: CreateCampaignExpensePayload,
): Promise<any> {
  // 1. Create the expense draft linked to this campaign
  const expenseRes = await fetch(`${API_BASE_URL}/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      title: payload.title.trim(),
      category: payload.category,
      costCenter: 'MOBILE_DONATION_CAMPS',
      amount: Number(payload.amount),
      vendorName: payload.vendorName.trim(),
      invoiceNumber: payload.invoiceNumber.trim(),
      expenseDate: payload.expenseDate,
      description: payload.description?.trim() || undefined,
      taxAmount: payload.taxAmount ? Number(payload.taxAmount) : 0,
      gstinNumber: payload.gstinNumber?.trim() || undefined,
      campaignId,
    }),
  });

  const expenseJson = await expenseRes.json();
  if (!expenseRes.ok) {
    throw new Error(expenseJson.message || 'Failed to record campaign expenditure.');
  }

  const createdExpense = expenseJson.data;

  // 2. If receipt file was attached, upload it
  if (payload.receiptFile) {
    const formData = new FormData();
    formData.append('file', payload.receiptFile);

    const uploadRes = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(createdExpense._id)}/receipt`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: formData,
    });

    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadJson.message || 'Expense created, but invoice document upload failed.');
    }
  }

  // 3. Automatically submit the expense for Super Admin review
  try {
    const submitRes = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(createdExpense._id)}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        submissionRemarks: `Campaign expense logged with invoice #${payload.invoiceNumber}`,
      }),
    });

    const submitJson = await submitRes.json();
    if (submitRes.ok && submitJson.data) {
      return submitJson.data;
    }
  } catch {
    // If auto-submit fails, the draft still exists and can be reviewed
  }

  return createdExpense;
}

/**
 * Approve a submitted campaign expense (Super Admin only).
 */
export async function approveCampaignExpense(expenseId: string, approvalRemarks?: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(expenseId)}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      approvalRemarks: approvalRemarks || 'Approved for campaign execution and budget accounting',
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to approve expense.');
  }

  return json.data;
}

/**
 * Reject a submitted campaign expense (Super Admin only).
 */
export async function rejectCampaignExpense(expenseId: string, rejectionReason: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(expenseId)}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ rejectionReason }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to reject expense.');
  }

  return json.data;
}

/**
 * Fetch approved expenses available for linking.
 */
export async function fetchAvailableExpensesForLinking(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/expenses?status=APPROVED&limit=100`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) return [];
  const items = json.data?.expenses || json.data || [];
  return items.filter((exp: any) => !exp.campaignId);
}

/**
 * Return secure direct stream URL for an expense receipt document.
 */
export function getReceiptStreamUrl(expenseId: string): string {
  return `${API_BASE_URL}/expenses/${encodeURIComponent(expenseId)}/receipt`;
}
