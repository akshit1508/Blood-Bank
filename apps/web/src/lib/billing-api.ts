import { getAuthHeaders } from './auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PARTIALLY_COLLECTED = 'PARTIALLY_COLLECTED',
  PAID = 'PAID',
  WAIVED = 'WAIVED',
  CANCELLED = 'CANCELLED',
}

export enum CollectionPaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
  NEFT_RTGS = 'NEFT_RTGS',
  HOSPITAL_CREDIT = 'HOSPITAL_CREDIT',
}

export const COLLECTION_PAYMENT_METHOD_LABELS: Record<CollectionPaymentMethod, string> = {
  [CollectionPaymentMethod.CASH]: 'Cash',
  [CollectionPaymentMethod.UPI]: 'UPI / QR Code',
  [CollectionPaymentMethod.CARD]: 'Credit / Debit Card',
  [CollectionPaymentMethod.NEFT_RTGS]: 'NEFT / RTGS Bank Transfer',
  [CollectionPaymentMethod.HOSPITAL_CREDIT]: 'Hospital Institutional Credit Account',
};

export enum WaiverCategory {
  BPL_CARDHOLDER = 'BPL_CARDHOLDER',
  THALASSEMIA_HEMOPHILIA = 'THALASSEMIA_HEMOPHILIA',
  GOVERNMENT_SCHEME = 'GOVERNMENT_SCHEME',
  REPLACEMENT_DONOR = 'REPLACEMENT_DONOR',
  EMERGENCY_INDIGENT = 'EMERGENCY_INDIGENT',
  DISCRETIONARY_ADMIN = 'DISCRETIONARY_ADMIN',
  OTHER = 'OTHER',
}

export const WAIVER_CATEGORY_LABELS: Record<WaiverCategory, string> = {
  [WaiverCategory.BPL_CARDHOLDER]: 'Below Poverty Line (BPL Cardholder)',
  [WaiverCategory.THALASSEMIA_HEMOPHILIA]: 'Thalassemia / Hemophilia / Sickle Cell',
  [WaiverCategory.GOVERNMENT_SCHEME]: 'Government Scheme (Ayushman Bharat / State)',
  [WaiverCategory.REPLACEMENT_DONOR]: 'Replacement Donor Credit',
  [WaiverCategory.EMERGENCY_INDIGENT]: 'Emergency Indigent Patient Exemption',
  [WaiverCategory.DISCRETIONARY_ADMIN]: 'Discretionary Administrative Waiver',
  [WaiverCategory.OTHER]: 'Other Authorized Exemption',
};

export interface TariffItem {
  _id: string;
  componentType: string;
  processingFeePaise: number;
  processingFee: number;
  crossmatchFeePaise: number;
  crossmatchFee: number;
  description?: string;
  isActive: boolean;
  updatedAt?: string;
  updatedByName?: string;
}

export interface InvoiceLineItem {
  inventoryId: string;
  bloodUnitId: string;
  unitCode: string;
  bloodGroup: string;
  componentType: string;
  baseProcessingFeePaise: number;
  baseProcessingFee: number;
  crossmatchFeePaise: number;
  crossmatchFee: number;
  lineTotalPaise: number;
  lineTotal: number;
}

export interface InvoiceWaiver {
  category: WaiverCategory;
  reason: string;
  amountPaise: number;
  amount: number;
  authorizedByName: string;
  authorizedByRole: string;
  appliedAt: string;
  documentRef?: string;
}

export interface PatientBillingDetails {
  name: string;
  age: number;
  gender: string;
  phone?: string;
  hospitalCaseNumber?: string;
}

export interface BloodIssueInvoice {
  _id: string;
  invoiceNumber: string;
  issueId: string;
  issueCode: string;
  bloodRequestId: string;
  requestCode: string;
  patient: PatientBillingDetails;
  hospitalName: string;
  doctorName: string;
  items: InvoiceLineItem[];
  subtotalPaise: number;
  subtotal: number;
  waiverPaise: number;
  waiverAmount: number;
  netPayablePaise: number;
  netPayable: number;
  collectedPaise: number;
  collectedAmount: number;
  outstandingPaise: number;
  outstandingAmount: number;
  status: InvoiceStatus;
  waivers: InvoiceWaiver[];
  invoiceDate: string;
  billedByName: string;
  billedByRole?: string;
  notes?: string;
  cancelledAt?: string;
  cancelledByName?: string;
  cancelledByRole?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BloodIssueCollection {
  _id: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  amountPaise: number;
  amount: number;
  paymentMethod: CollectionPaymentMethod;
  referenceNumber: string;
  paymentDate: string;
  idempotencyKey: string;
  collectedByName: string;
  collectedByRole?: string;
  notes?: string;
  isReversed: boolean;
  reversedAt?: string;
  reversedByName?: string;
  reversedByRole?: string;
  reversalReason?: string;
  createdAt: string;
}

export interface DailyRegisterData {
  date: string;
  totalCount: number;
  totalCollectionsPaise: number;
  totalCollectionsAmount: number;
  byMethod: Record<
    CollectionPaymentMethod,
    { count: number; totalPaise: number; totalAmount: number }
  >;
  transactions: Array<{
    _id: string;
    receiptNumber: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: CollectionPaymentMethod;
    referenceNumber: string;
    paymentDate: string;
    collectedByName: string;
  }>;
}

export interface RevenueSummaryData {
  totalInvoicesCount: number;
  pendingCount: number;
  partialCount: number;
  paidCount: number;
  waivedCount: number;
  totalInvoicedPaise: number;
  totalInvoicedAmount: number;
  totalWaivedPaise: number;
  totalWaivedAmount: number;
  totalCollectedPaise: number;
  totalCollectedAmount: number;
  totalOutstandingPaise: number;
  totalOutstandingAmount: number;
  todayCollectionsAmount: number;
  todayCollectionsCount: number;
}

export interface InvoicesResponse {
  data: BloodIssueInvoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CollectionsResponse {
  data: BloodIssueCollection[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Format INR utility for frontend display
export function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);
}

// ------------------- API CALLS -------------------

export async function fetchTariffs(): Promise<TariffItem[]> {
  const res = await fetch(`${API_BASE_URL}/billing/tariffs`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch tariffs');
  }
  const json = await res.json();
  return json.data;
}

export async function updateTariff(data: {
  componentType: string;
  processingFee: number;
  crossmatchFee?: number;
  description?: string;
}): Promise<TariffItem> {
  const res = await fetch(`${API_BASE_URL}/billing/tariffs`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to update tariff');
  }
  const json = await res.json();
  return json.data;
}

export async function generateInvoice(
  issueId: string,
  options?: { applyCrossmatchFee?: boolean; notes?: string },
): Promise<BloodIssueInvoice> {
  const res = await fetch(`${API_BASE_URL}/billing/invoices/issue/${issueId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(options || {}),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to generate invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function fetchUnbilledIssues(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/billing/invoices/unbilled-issues`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch unbilled issues');
  }
  const json = await res.json();
  return json.data || [];
}

export async function fetchInvoices(params?: {
  status?: string;
  hospitalName?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<InvoicesResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.hospitalName) query.set('hospitalName', params.hospitalName);
  if (params?.search) query.set('search', params.search);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());

  const res = await fetch(`${API_BASE_URL}/billing/invoices?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch invoices');
  }
  return res.json();
}

export async function fetchInvoiceById(id: string): Promise<BloodIssueInvoice> {
  const res = await fetch(`${API_BASE_URL}/billing/invoices/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function fetchInvoiceByIssue(issueId: string): Promise<BloodIssueInvoice | null> {
  const res = await fetch(`${API_BASE_URL}/billing/invoices/by-issue/${issueId}`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch invoice for issue');
  }
  const json = await res.json();
  return json.data;
}

export async function applyWaiver(
  invoiceId: string,
  data: {
    category: WaiverCategory;
    reason: string;
    amount?: number;
    isFullWaiver?: boolean;
    documentRef?: string;
  },
): Promise<BloodIssueInvoice> {
  const res = await fetch(`${API_BASE_URL}/billing/invoices/${invoiceId}/waiver`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to apply waiver');
  }
  const json = await res.json();
  return json.data;
}

export async function cancelInvoice(
  invoiceId: string,
  reason: string,
): Promise<BloodIssueInvoice> {
  const res = await fetch(`${API_BASE_URL}/billing/invoices/${invoiceId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to cancel invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function recordCollection(
  invoiceId: string,
  data: {
    amount: number;
    paymentMethod: CollectionPaymentMethod;
    referenceNumber: string;
    idempotencyKey?: string;
    notes?: string;
    paymentDate?: string;
  },
): Promise<BloodIssueCollection> {
  const payload = {
    ...data,
    idempotencyKey: data.idempotencyKey || `COL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
  };

  const res = await fetch(`${API_BASE_URL}/billing/collections/${invoiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to record payment collection');
  }
  const json = await res.json();
  return json.data;
}

export async function fetchCollections(params?: {
  paymentMethod?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<CollectionsResponse> {
  const query = new URLSearchParams();
  if (params?.paymentMethod && params.paymentMethod !== 'all') query.set('paymentMethod', params.paymentMethod);
  if (params?.invoiceId) query.set('invoiceId', params.invoiceId);
  if (params?.invoiceNumber) query.set('invoiceNumber', params.invoiceNumber);
  if (params?.search) query.set('search', params.search);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());

  const res = await fetch(`${API_BASE_URL}/billing/collections?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch collections');
  }
  return res.json();
}

export async function fetchCollectionsByInvoice(invoiceId: string): Promise<BloodIssueCollection[]> {
  const res = await fetch(`${API_BASE_URL}/billing/collections/by-invoice/${invoiceId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch invoice collections');
  }
  const json = await res.json();
  return json.data;
}

export async function fetchDailyRegister(date?: string): Promise<DailyRegisterData> {
  const query = date ? `?date=${date}` : '';
  const res = await fetch(`${API_BASE_URL}/billing/reports/daily-register${query}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch daily register');
  }
  const json = await res.json();
  return json.data;
}

export async function fetchRevenueSummary(): Promise<RevenueSummaryData> {
  const res = await fetch(`${API_BASE_URL}/billing/reports/summary`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch revenue summary');
  }
  const json = await res.json();
  return json.data;
}
