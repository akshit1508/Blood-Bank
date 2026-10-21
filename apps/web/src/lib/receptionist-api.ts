import { getAuthHeaders } from './auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export type ReceptionistPeriod =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_15_days'
  | 'last_30_days'
  | 'this_month'
  | 'previous_month'
  | 'custom';

export interface ReceptionistDashboardQuery {
  period?: ReceptionistPeriod;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface ReceptionistDashboardResponse {
  dateRange: {
    startDate: string;
    endDate: string;
    period: ReceptionistPeriod;
  };
  summary: {
    totalBloodIssues: number;
    totalUnitsIssued: number;
    totalInvoicesGenerated: number;
    totalInvoiceAmount: number;
    totalPaymentsCollected: number;
    totalCashCollected: number;
    totalDigitalCollected: number;
    totalOutstanding: number;
    pendingTransactionsCount: number;
    unitsByComponent: Record<string, number>;
    unitsByBloodGroup: Record<string, number>;
    paymentMethodBreakdown: Record<string, { count: number; amount: number }>;
  };
  charts: {
    issuesOverTime: Array<{ date: string; issues: number; units: number }>;
    collectionsOverTime: Array<{ date: string; amount: number; cash: number; digital: number }>;
    paymentMethodDistribution: Array<{ method: string; amount: number; count: number }>;
    componentDistribution: Array<{ component: string; units: number }>;
    dailyActivity: Array<{ date: string; issues: number; collections: number; cash: number; digital: number }>;
  };
  recentTransactions: Array<{
    transactionNumber: string;
    receiptNumber: string | null;
    invoiceNumber: string;
    invoiceId: string;
    issueId?: string;
    issueCode?: string;
    bloodRequestId?: string;
    requestCode?: string;
    patient: {
      name: string;
      age: number;
      gender: string;
      phone?: string;
      hospitalCaseNumber?: string;
    };
    hospitalName: string;
    doctorName: string;
    bloodGroup: string;
    componentType: string;
    quantity: number;
    issueDate: string;
    invoiceAmount: number;
    amountCollected: number;
    outstandingAmount: number;
    paymentStatus: string;
    issueStatus: string;
  }>;
}

export interface PatientSearchResult {
  patientKey: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  hospitalName: string;
  doctorName: string;
  hospitalCaseNumber: string;
  bloodGroup: string;
  lastRequestCode: string;
  lastRequestId: string;
  lastRequestDate: string;
  lastStatus: string;
  totalRequests: number;
  recentRequests: Array<{
    id: string;
    requestCode: string;
    bloodGroup: string;
    componentType: string;
    unitsRequested: number;
    status: string;
    createdAt: string;
  }>;
}

/**
 * Fetch Receptionist Dashboard analytics & summary.
 */
export async function fetchReceptionistDashboard(
  query: ReceptionistDashboardQuery = {},
): Promise<ReceptionistDashboardResponse> {
  const q = new URLSearchParams();
  if (query.period) q.set('period', query.period);
  if (query.startDate) q.set('startDate', query.startDate);
  if (query.endDate) q.set('endDate', query.endDate);
  if (query.limit) q.set('limit', String(query.limit));

  const res = await fetch(`${API_BASE_URL}/receptionist/dashboard?${q.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch receptionist dashboard metrics.');
  }
  return json.data;
}

/**
 * Search patients across existing blood requests.
 */
export async function searchPatients(q: string): Promise<PatientSearchResult[]> {
  const query = new URLSearchParams({ q });
  const res = await fetch(`${API_BASE_URL}/receptionist/patients/search?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to search patients.');
  }
  return json.data || [];
}

/**
 * Attach a supporting document to a blood request.
 */
export async function attachSupportingDocument(
  requestId: string,
  payload: {
    documentType: string;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    notes?: string;
  },
) {
  const res = await fetch(`${API_BASE_URL}/receptionist/requests/${encodeURIComponent(requestId)}/documents`, {
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
    throw new Error(json.message || 'Failed to attach supporting document.');
  }
  return json.data;
}

/**
 * Mark patient documents verified or rejected.
 */
export async function verifySupportingDocuments(
  requestId: string,
  payload: {
    status: 'VERIFIED' | 'REJECTED';
    notes?: string;
  },
) {
  const res = await fetch(`${API_BASE_URL}/receptionist/requests/${encodeURIComponent(requestId)}/verify-documents`, {
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
    throw new Error(json.message || 'Failed to verify documents.');
  }
  return json.data;
}

/**
 * Fetch real-time operational blood stock summary.
 */
export async function fetchBloodAvailabilitySummary() {
  const res = await fetch(`${API_BASE_URL}/inventory/summary`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch blood availability summary.');
  }
  return json.data;
}

/**
 * Fetch real-time available inventory list with optional filters.
 */
export async function fetchAvailableInventory(params?: {
  bloodGroup?: string;
  componentType?: string;
  status?: string;
  limit?: number;
}) {
  const q = new URLSearchParams();
  q.set('status', params?.status || 'AVAILABLE');
  if (params?.bloodGroup && params.bloodGroup !== 'ALL') q.set('bloodGroup', params.bloodGroup);
  if (params?.componentType && params.componentType !== 'ALL') q.set('componentType', params.componentType);
  if (params?.limit) q.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE_URL}/inventory?${q.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to query inventory stock.');
  }
  return json.data || [];
}

/**
 * Fetch blood requests for the receptionist desk.
 */
export async function fetchReceptionistBloodRequests(status?: string, bloodGroup?: string) {
  const q = new URLSearchParams();
  if (status && status !== 'ALL') q.set('status', status);
  if (bloodGroup && bloodGroup !== 'ALL') q.set('bloodGroup', bloodGroup);

  const res = await fetch(`${API_BASE_URL}/blood-requests?${q.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch blood requests.');
  }
  return json.data || [];
}

/**
 * Create a new blood request (Patient check-in & request submission).
 */
export async function createBloodRequest(payload: any) {
  const res = await fetch(`${API_BASE_URL}/blood-requests`, {
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
    const errorMsg = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    throw new Error(errorMsg || 'Failed to create blood request.');
  }
  return json.data;
}

/**
 * Issues blood against an approved reservation.
 */
export async function issueBloodFromReservation(reservationId: string, payload?: any) {
  const res = await fetch(`${API_BASE_URL}/blood-issues/reservation/${encodeURIComponent(reservationId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to issue reserved blood units.');
  }
  return json.data;
}

/**
 * Generates an invoice for a completed blood issue.
 */
export async function generateInvoiceForIssue(issueId: string, payload?: any) {
  const res = await fetch(`${API_BASE_URL}/billing/invoices/issue/${encodeURIComponent(issueId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to generate invoice.');
  }
  return json.data;
}

/**
 * Records a payment collection against an invoice.
 */
export async function recordCollectionPayment(
  invoiceId: string,
  payload: {
    amount: number;
    paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'HOSPITAL_CREDIT';
    referenceNumber: string;
    idempotencyKey?: string;
    notes?: string;
  },
) {
  const res = await fetch(`${API_BASE_URL}/billing/collections/${encodeURIComponent(invoiceId)}`, {
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
    const errorMsg = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    throw new Error(errorMsg || 'Failed to record payment collection.');
  }
  return json.data;
}

/**
 * Fetch billing invoices.
 */
export async function fetchInvoices(params?: {
  status?: string;
  search?: string;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.status && params.status !== 'ALL') q.set('status', params.status);
  if (params?.search) q.set('search', params.search);
  if (params?.limit) q.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE_URL}/billing/invoices?${q.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch invoices.');
  }
  return json.data || [];
}

/**
 * Fetch collection receipts.
 */
export async function fetchCollections(params?: {
  paymentMethod?: string;
  search?: string;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.paymentMethod && params.paymentMethod !== 'ALL') q.set('paymentMethod', params.paymentMethod);
  if (params?.search) q.set('search', params.search);
  if (params?.limit) q.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE_URL}/billing/collections?${q.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch collections.');
  }
  return json.data || [];
}

/**
 * Fetch single collection receipt by ID.
 */
export async function fetchReceiptById(receiptId: string) {
  const res = await fetch(`${API_BASE_URL}/billing/collections/${encodeURIComponent(receiptId)}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch payment receipt.');
  }
  return json.data;
}

/**
 * Fetch active fee tariffs.
 */
export async function fetchActiveTariffs() {
  const res = await fetch(`${API_BASE_URL}/billing/tariffs`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch tariffs.');
  }
  return json.data || [];
}

/**
 * Fetch daily register cashier shift report.
 */
export async function fetchDailyRegisterReport(
  params?:
    | string
    | {
        date?: string;
        period?: ReceptionistPeriod;
        startDate?: string;
        endDate?: string;
      },
) {
  const q = new URLSearchParams();
  if (typeof params === 'string') {
    if (params) q.set('date', params);
  } else if (params) {
    if (params.date) q.set('date', params.date);
    if (params.period) q.set('period', params.period);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
  }

  const res = await fetch(`${API_BASE_URL}/billing/reports/daily-register?${q.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch cashier register.');
  }
  return json.data;
}

/**
 * Fetch matching available inventory for a blood request.
 */
export async function fetchMatchesForRequest(requestId: string) {
  const res = await fetch(`${API_BASE_URL}/blood-requests/${encodeURIComponent(requestId)}/matches`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to find matching inventory.');
  }
  return json.data;
}

/**
 * Reserve inventory units for a blood request.
 */
export async function createReservationForRequest(requestId: string, inventoryIds: string[]) {
  const res = await fetch(`${API_BASE_URL}/blood-requests/${encodeURIComponent(requestId)}/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ inventoryIds }),
  });

  const json = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    throw new Error(errorMsg || 'Failed to reserve blood units.');
  }
  return json.data;
}

/**
 * Fetch reservations for a blood request.
 */
export async function fetchReservationsForRequest(requestId: string) {
  const res = await fetch(`${API_BASE_URL}/blood-requests/${encodeURIComponent(requestId)}/reservations`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch reservations.');
  }
  return json.data || [];
}

/**
 * Fetch blood issues for a blood request.
 */
export async function fetchIssuesForRequest(requestId: string) {
  const res = await fetch(`${API_BASE_URL}/blood-requests/${encodeURIComponent(requestId)}/issues`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch blood issues.');
  }
  return json.data || [];
}

/**
 * Fetch a single blood request by ID.
 */
export async function fetchSingleBloodRequest(requestId: string) {
  const res = await fetch(`${API_BASE_URL}/blood-requests/${encodeURIComponent(requestId)}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch blood request.');
  }
  return json.data;
}

