import { getAuthHeaders } from './auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export enum PaymentMethod {
  UPI = 'UPI',
  NEFT = 'NEFT',
  RTGS = 'RTGS',
  IMPS = 'IMPS',
  CHEQUE = 'CHEQUE',
  CASH = 'CASH',
}

export enum PaymentStatus {
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.UPI]: 'UPI (Unified Payments Interface)',
  [PaymentMethod.NEFT]: 'NEFT (National Electronic Funds Transfer)',
  [PaymentMethod.RTGS]: 'RTGS (Real Time Gross Settlement)',
  [PaymentMethod.IMPS]: 'IMPS (Immediate Payment Service)',
  [PaymentMethod.CHEQUE]: 'Cheque / Demand Draft',
  [PaymentMethod.CASH]: 'Cash Voucher',
};

export interface Payment {
  _id: string;
  expenseId: string;
  vendorId: string;
  vendorName: string;
  amountPaise: number;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  paymentDate: string;
  notes?: string;
  status: PaymentStatus;
  idempotencyKey: string;
  createdByName: string;
  createdByRole?: string;
  cancelledByName?: string;
  cancelledByRole?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  expense?: {
    expenseCode: string;
    title: string;
    amount: number;
    paidAmount: number;
    paymentStatus: string;
    invoiceNumber: string;
    expenseDate: string;
  };
}

export interface CreatePaymentInput {
  expenseId: string;
  vendorId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  paymentDate: string; // YYYY-MM-DD
  notes?: string;
  idempotencyKey: string;
}

export interface OutstandingCreditor {
  vendorId: string | null;
  vendorName: string;
  isLinked: boolean;
  totalInvoicedInr: number;
  totalInvoicedPaise: number;
  totalPaidInr: number;
  totalPaidPaise: number;
  outstandingInr: number;
  outstandingPaise: number;
  expenseCount: number;
  expenses: Array<{
    _id: string;
    expenseCode: string;
    title: string;
    category: string;
    invoiceNumber: string;
    expenseDate: string;
    amount: number;
    paidAmount: number;
    outstandingAmount: number;
    paymentStatus: string;
    status?: string;
    acquisitionId?: string;
    vendorId?: string;
    vendorName: string;
    ageDays?: number;
    agingBucket?: string;
  }>;
}

export interface OutstandingDuesReport {
  summary: {
    totalOutstandingInr: number;
    totalOutstandingPaise: number;
    totalInvoicedInr: number;
    totalInvoicedPaise: number;
    totalPaidInr: number;
    totalPaidPaise: number;
    pendingExpensesCount: number;
    creditorsCount: number;
    aging?: {
      under30DaysInr: number;
      days31To60Inr: number;
      days61To90Inr: number;
      over90DaysInr: number;
    };
  };
  creditors: OutstandingCreditor[];
}

/**
 * Fetches paginated disbursements list (Super Admin only).
 */
export async function fetchPayments(query?: {
  vendorId?: string;
  expenseId?: string;
  paymentMethod?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ payments: Payment[]; pagination: any }> {
  const params = new URLSearchParams();
  if (query?.vendorId) params.append('vendorId', query.vendorId);
  if (query?.expenseId) params.append('expenseId', query.expenseId);
  if (query?.paymentMethod) params.append('paymentMethod', query.paymentMethod);
  if (query?.status) params.append('status', query.status);
  if (query?.startDate) params.append('startDate', query.startDate);
  if (query?.endDate) params.append('endDate', query.endDate);
  if (query?.page) params.append('page', query.page.toString());
  if (query?.limit) params.append('limit', query.limit.toString());

  const res = await fetch(`${API_BASE_URL}/payments?${params.toString()}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch payments');
  }

  return res.json();
}

/**
 * Fetches single disbursement details (Super Admin only).
 */
export async function fetchPaymentById(id: string): Promise<Payment> {
  const res = await fetch(`${API_BASE_URL}/payments/${id}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch payment details');
  }

  return res.json();
}

/**
 * Records disbursement with atomic concurrency control and persistent idempotency (Super Admin only).
 */
export async function recordPayment(data: CreatePaymentInput): Promise<Payment> {
  const res = await fetch(`${API_BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to record payment');
  }

  return res.json();
}

/**
 * Atomically cancels a disbursement with mandatory reason (Super Admin only).
 */
export async function cancelPayment(id: string, reason: string): Promise<Payment> {
  const res = await fetch(`${API_BASE_URL}/payments/${id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to cancel payment');
  }

  return res.json();
}

/**
 * Fetches outstanding liabilities summary grouped by vendor (Super Admin only).
 */
export async function fetchOutstandingDues(): Promise<OutstandingDuesReport> {
  const res = await fetch(`${API_BASE_URL}/payments/outstanding-dues`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch outstanding dues');
  }

  return res.json();
}

/**
 * Links a registered vendor profile to a historical or unlinked expense (Super Admin only).
 */
export async function linkExpenseVendor(expenseId: string, vendorId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/expenses/${expenseId}/link-vendor`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ vendorId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to link vendor to expense');
  }

  return res.json();
}
