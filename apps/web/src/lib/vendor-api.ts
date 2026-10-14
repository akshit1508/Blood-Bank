import { getAuthHeaders } from './auth-api';
import { ExpenseCategory } from './expense-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface VendorBankDetails {
  bankName: string;
  accountNumber: string;
  maskedAccountNumber?: string;
  ifscCode: string;
  branchName?: string;
}

export interface VendorAuditHistoryItem {
  action: string;
  performedByName: string;
  performedByEmail: string;
  notes?: string;
  timestamp: string;
}

export interface Vendor {
  _id: string;
  name: string;
  category: ExpenseCategory;
  contactPerson: string;
  email?: string;
  phone: string;
  gstinNumber?: string;
  panNumber?: string;
  bankDetails?: VendorBankDetails;
  isActive: boolean;
  notes?: string;
  auditHistory?: VendorAuditHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ActiveVendorOption {
  _id: string;
  name: string;
  category: string;
}

export interface CreateVendorInput {
  name: string;
  category: ExpenseCategory;
  contactPerson: string;
  email?: string;
  phone: string;
  gstinNumber?: string;
  panNumber?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branchName?: string;
  };
  notes?: string;
}

export interface UpdateVendorInput {
  name?: string;
  category?: ExpenseCategory;
  contactPerson?: string;
  email?: string;
  phone?: string;
  gstinNumber?: string;
  panNumber?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branchName?: string;
  };
  isActive?: boolean;
  notes?: string;
}

export interface VendorLedgerItem {
  date: string;
  type: 'INVOICE' | 'DISBURSEMENT' | 'DISBURSEMENT_CANCELLED';
  reference: string;
  code: string;
  title: string;
  debitInr: number;
  creditInr: number;
  balanceInr: number;
  status?: string;
  notes?: string;
}

export interface VendorLedger {
  vendor: {
    _id: string;
    name: string;
    category: string;
    contactPerson: string;
    phone: string;
    email?: string;
    gstinNumber?: string;
    panNumber?: string;
    bankDetails?: VendorBankDetails;
  };
  summary: {
    totalInvoicedInr: number;
    totalInvoicedPaise: number;
    totalPaidInr: number;
    totalPaidPaise: number;
    outstandingBalanceInr: number;
    outstandingBalancePaise: number;
    invoicesCount: number;
    disbursementsCount: number;
  };
  items: VendorLedgerItem[];
}

/**
 * Narrow vendor selector for Admin and Super Admin expense creation forms.
 * Returns only [{ _id, name, category }]. Strictly zero banking details.
 */
export async function fetchActiveVendorOptions(): Promise<ActiveVendorOption[]> {
  const res = await fetch(`${API_BASE_URL}/vendors/active-options`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch active vendor options');
  }

  return res.json();
}

/**
 * Fetches vendor directory list (Super Admin only).
 */
export async function fetchVendors(query?: {
  category?: string;
  search?: string;
  isActive?: string;
}): Promise<Vendor[]> {
  const params = new URLSearchParams();
  if (query?.category) params.append('category', query.category);
  if (query?.search) params.append('search', query.search);
  if (query?.isActive !== undefined && query?.isActive !== '') {
    params.append('isActive', query.isActive);
  }

  const res = await fetch(`${API_BASE_URL}/vendors?${params.toString()}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch vendors');
  }

  return res.json();
}

/**
 * Fetches single vendor with full unmasked bank details (Super Admin only).
 */
export async function fetchVendorById(id: string): Promise<Vendor> {
  const res = await fetch(`${API_BASE_URL}/vendors/${id}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch vendor details');
  }

  return res.json();
}

/**
 * Creates a new vendor profile (Super Admin only).
 */
export async function createVendor(data: CreateVendorInput): Promise<Vendor> {
  const res = await fetch(`${API_BASE_URL}/vendors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to register vendor');
  }

  return res.json();
}

/**
 * Updates vendor profile (Super Admin only).
 */
export async function updateVendor(id: string, data: UpdateVendorInput): Promise<Vendor> {
  const res = await fetch(`${API_BASE_URL}/vendors/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to update vendor');
  }

  return res.json();
}

/**
 * Fetches vendor ledger statement (Super Admin only).
 */
export async function fetchVendorLedger(id: string): Promise<VendorLedger> {
  const res = await fetch(`${API_BASE_URL}/vendors/${id}/ledger`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch vendor ledger');
  }

  return res.json();
}
