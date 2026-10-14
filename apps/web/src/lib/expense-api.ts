import { getAuthHeaders } from './auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export enum ExpenseStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ExpensePaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
}

export enum ExpenseCategory {
  MEDICAL_SUPPLIES = 'MEDICAL_SUPPLIES',
  LABORATORY_TESTING = 'LABORATORY_TESTING',
  LOGISTICS_TRANSPORT = 'LOGISTICS_TRANSPORT',
  FACILITIES_EQUIPMENT = 'FACILITIES_EQUIPMENT',
  STAFF_CAMP_MEALS = 'STAFF_CAMP_MEALS',
  ADMIN_OFFICE = 'ADMIN_OFFICE',
  UTILITIES_WASTE = 'UTILITIES_WASTE',
  OTHER = 'OTHER',
}

export enum CostCenter {
  BLOOD_BANK_OPERATIONS = 'BLOOD_BANK_OPERATIONS',
  MOBILE_DONATION_CAMPS = 'MOBILE_DONATION_CAMPS',
  LABORATORY_SERVICES = 'LABORATORY_SERVICES',
  STORAGE_COLD_CHAIN = 'STORAGE_COLD_CHAIN',
  ADMIN_OVERHEAD = 'ADMIN_OVERHEAD',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.MEDICAL_SUPPLIES]: 'Medical & Phlebotomy Supplies',
  [ExpenseCategory.LABORATORY_TESTING]: 'Laboratory Testing & Reagents',
  [ExpenseCategory.LOGISTICS_TRANSPORT]: 'Cold-Chain Transport & Logistics',
  [ExpenseCategory.FACILITIES_EQUIPMENT]: 'Facilities & Equipment Maintenance',
  [ExpenseCategory.STAFF_CAMP_MEALS]: 'Camp Refreshments & Donor Welfare',
  [ExpenseCategory.ADMIN_OFFICE]: 'Administrative & Office Consumables',
  [ExpenseCategory.UTILITIES_WASTE]: 'Utilities & Biohazard Waste Disposal',
  [ExpenseCategory.OTHER]: 'Other Operational Expenditure',
};

export const COST_CENTER_LABELS: Record<CostCenter, string> = {
  [CostCenter.BLOOD_BANK_OPERATIONS]: 'Blood Bank Central Operations',
  [CostCenter.MOBILE_DONATION_CAMPS]: 'Mobile Donation Drives',
  [CostCenter.LABORATORY_SERVICES]: 'Laboratory Screening Workstation',
  [CostCenter.STORAGE_COLD_CHAIN]: 'Cold Chain & Quarantine Storage',
  [CostCenter.ADMIN_OVERHEAD]: 'Administrative Overhead',
};

export interface ExpenseReceipt {
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface ExpenseAuditHistoryItem {
  action: string;
  fromStatus: ExpenseStatus | null;
  toStatus: ExpenseStatus;
  performedBy: string;
  performedByEmail: string;
  performedByName: string;
  notes?: string;
  timestamp: string;
}

export interface ExpenseItem {
  _id: string;
  expenseCode: string;
  title: string;
  category: ExpenseCategory;
  costCenter: CostCenter;
  expenseDate: string;
  amount: number;
  amountPaise?: number;
  paidAmount?: number;
  paidAmountPaise?: number;
  paymentStatus?: string;
  currency: string;
  vendorId?: string;
  vendorName: string;
  invoiceNumber: string;
  gstinNumber?: string;
  taxAmount?: number;
  description?: string;
  status: ExpenseStatus;
  receipt?: ExpenseReceipt;
  creatorId: string;
  creatorEmail: string;
  creatorRole: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedByEmail?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  approvalRemarks?: string;
  auditHistory: ExpenseAuditHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummaryStats {
  approvedAmount: number;
  approvedCount: number;
  submittedAmount: number;
  submittedCount: number;
  rejectedAmount: number;
  rejectedCount: number;
  draftAmount: number;
  draftCount: number;
  currency: string;
  byCategory: Record<string, number>;
}

export interface CreateExpensePayload {
  title: string;
  category: ExpenseCategory;
  costCenter: CostCenter;
  expenseDate: string;
  amount: number;
  vendorId?: string;
  vendorName: string;
  invoiceNumber: string;
  gstinNumber?: string;
  taxAmount?: number;
  description?: string;
  correctionNotes?: string;
}

export interface UpdateExpensePayload extends Partial<CreateExpensePayload> {
  correctionNotes?: string;
}

/**
 * Formats a monetary amount in Indian Rupee format (â‚¹).
 */
export function formatINR(val: number): string {
  if (isNaN(val)) return 'â‚¹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Fetch list of expenses with filters and pagination.
 */
export async function fetchExpenses(params?: {
  search?: string;
  status?: string;
  category?: string;
  costCenter?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: ExpenseItem[]; total: number; page: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.status) query.append('status', params.status);
  if (params?.category) query.append('category', params.category);
  if (params?.costCenter) query.append('costCenter', params.costCenter);
  if (params?.paymentStatus) query.append('paymentStatus', params.paymentStatus);
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  const res = await fetch(`${API_BASE_URL}/expenses?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch expenses.');
  }

  return {
    items: json.data || [],
    total: json.meta?.total || 0,
    page: json.meta?.page || 1,
    totalPages: json.meta?.totalPages || 1,
  };
}

/**
 * Fetch expense financial summary metrics.
 */
export async function fetchExpenseSummary(startDate?: string, endDate?: string): Promise<ExpenseSummaryStats> {
  const query = new URLSearchParams();
  if (startDate) query.append('startDate', startDate);
  if (endDate) query.append('endDate', endDate);

  const res = await fetch(`${API_BASE_URL}/expenses/summary?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch expense summary metrics.');
  }

  return json.data;
}

/**
 * Check for duplicate invoice number for a given vendor.
 */
export async function checkDuplicateInvoice(
  vendorName: string,
  invoiceNumber: string,
  excludeId?: string,
): Promise<{ isDuplicate: boolean; existingExpense?: any }> {
  if (!vendorName || !invoiceNumber) return { isDuplicate: false };

  const query = new URLSearchParams({ vendorName, invoiceNumber });
  if (excludeId) query.append('excludeId', excludeId);

  const res = await fetch(`${API_BASE_URL}/expenses/check-invoice?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) return { isDuplicate: false };
  return json.data;
}

/**
 * Fetch single expense by ID.
 */
export async function fetchExpenseById(id: string): Promise<ExpenseItem> {
  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Failed to fetch expense ${id}`);
  }

  return json.data;
}

/**
 * Create a new draft expense.
 */
export async function createExpense(payload: CreateExpensePayload): Promise<ExpenseItem> {
  const res = await fetch(`${API_BASE_URL}/expenses`, {
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
    throw new Error(json.message || 'Failed to create expense draft.');
  }

  return json.data;
}

/**
 * Update an existing draft or rejected expense.
 */
export async function updateExpense(id: string, payload: UpdateExpensePayload): Promise<ExpenseItem> {
  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to update expense.');
  }

  return json.data;
}

/**
 * Delete a draft expense.
 */
export async function deleteExpense(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to delete draft expense.');
  }
}

/**
 * Upload receipt document for an expense.
 */
export async function uploadExpenseReceipt(id: string, file: File): Promise<ExpenseItem> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(id)}/receipt`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to upload receipt document.');
  }

  return json.data;
}

/**
 * Remove attached receipt document from an expense.
 */
export async function removeExpenseReceipt(id: string): Promise<ExpenseItem> {
  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(id)}/receipt`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to remove receipt document.');
  }

  return json.data;
}

/**
 * Submit draft expense for review.
 */
export async function submitExpense(id: string, submissionRemarks?: string): Promise<ExpenseItem> {
  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ submissionRemarks }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to submit expense for review.');
  }

  return json.data;
}

/**
 * Resubmit rejected expense with mandatory correction remarks.
 */
export async function resubmitExpense(id: string, submissionRemarks: string): Promise<ExpenseItem> {
  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(id)}/resubmit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ submissionRemarks }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to resubmit expense.');
  }

  return json.data;
}

/**
 * Approve submitted expense (Super Admin only).
 */
export async function approveExpense(id: string, approvalRemarks?: string): Promise<ExpenseItem> {
  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ approvalRemarks }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to approve expense.');
  }

  return json.data;
}

/**
 * Reject submitted expense with mandatory reason (Super Admin only).
 */
export async function rejectExpense(id: string, rejectionReason: string): Promise<ExpenseItem> {
  const res = await fetch(`${API_BASE_URL}/expenses/${encodeURIComponent(id)}/reject`, {
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
 * URL for streaming secure private receipt document.
 */
export function getExpenseReceiptUrl(id: string): string {
  return `${API_BASE_URL}/expenses/${encodeURIComponent(id)}/receipt`;
}

/**
 * Fetch receipt blob with auth header and create an object URL for preview/download.
 */
export async function fetchExpenseReceiptBlobUrl(id: string): Promise<{ blobUrl: string; mimeType: string }> {
  const authHeaders = getAuthHeaders();
  if (!authHeaders.Authorization) {
    throw new Error('Authentication session required. Please log in.');
  }

  const res = await fetch(getExpenseReceiptUrl(id), {
    headers: {
      ...authHeaders,
    },
  });

  if (res.status === 401) {
    throw new Error('Unauthorized: Session expired or invalid authentication.');
  }
  if (res.status === 403) {
    throw new Error('Access denied: You do not have permission to view this receipt document.');
  }
  if (res.status === 404) {
    throw new Error('Receipt document not found.');
  }
  if (!res.ok) {
    throw new Error('Failed to load private receipt document.');
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, mimeType: contentType };
}

/**
 * Opens a private receipt in a new browser tab/window safely using an authenticated blob URL.
 */
export async function openExpenseReceiptInNewTab(id: string): Promise<void> {
  const { blobUrl } = await fetchExpenseReceiptBlobUrl(id);
  const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    // If popup was blocked, fallback to navigating directly to object URL or notify
    window.location.href = blobUrl;
  }
}

/**
 * Downloads a private receipt safely using an authenticated blob.
 */
export async function downloadExpenseReceipt(id: string, defaultFilename?: string): Promise<void> {
  const { blobUrl } = await fetchExpenseReceiptBlobUrl(id);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = defaultFilename || 'receipt-document';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}