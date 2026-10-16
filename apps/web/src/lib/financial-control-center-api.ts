import { getAuthHeaders } from './auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export enum FinancialPeriodPreset {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = '7days',
  LAST_15_DAYS = '15days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_FINANCIAL_YEAR = 'this_fy',
  CUSTOM = 'custom',
}

export enum FinancialTransactionType {
  BLOOD_ISSUE_INVOICE = 'BLOOD_ISSUE_INVOICE',
  BLOOD_ISSUE_COLLECTION = 'BLOOD_ISSUE_COLLECTION',
  EXPENSE_LIABILITY = 'EXPENSE_LIABILITY',
  EXPENSE_PAYMENT = 'EXPENSE_PAYMENT',
  PAYROLL_ACCRUAL = 'PAYROLL_ACCRUAL',
  PAYROLL_DISBURSEMENT = 'PAYROLL_DISBURSEMENT',
  BLOOD_ACQUISITION_COST = 'BLOOD_ACQUISITION_COST',
  SUPPLIER_CREDIT_NOTE = 'SUPPLIER_CREDIT_NOTE',
  SUPPLIER_REFUND = 'SUPPLIER_REFUND',
  INVOICE_WAIVER = 'INVOICE_WAIVER',
}

export enum FinancialTransactionDirection {
  INFLOW = 'INFLOW',
  OUTFLOW = 'OUTFLOW',
  ACCRUAL = 'ACCRUAL',
  ADJUSTMENT = 'ADJUSTMENT',
}

export interface KpiMetric {
  paise: number;
  inr: number;
  label: string;
  description: string;
  [key: string]: any;
}

export interface CategoryBreakdownItem {
  category: string;
  label: string;
  amountPaise: number;
  amountInr: number;
  count: number;
}

export interface PaymentMethodBreakdownItem {
  method: string;
  label: string;
  amountPaise: number;
  amountInr: number;
  count: number;
}

export interface FinancialKpiData {
  period: {
    preset: FinancialPeriodPreset;
    presetName: string;
    startDate: string;
    endDate: string;
  };
  kpis: {
    actualMoneyReceived: KpiMetric;
    recognizedExpenditure: KpiMetric;
    actualCashOutflows: KpiMetric;
    outstandingPayables: KpiMetric;
    outstandingReceivables: KpiMetric;
    bloodAcquisitionCost: KpiMetric;
    campaignExpenditure: KpiMetric;
    payrollExpense: KpiMetric;
    totalInvoicedGross: KpiMetric;
    totalCollectionsReceived: KpiMetric;
  };
  expenseCategoryBreakdown: CategoryBreakdownItem[];
  paymentMethodBreakdown: PaymentMethodBreakdownItem[];
  receivablesVsPayables: {
    receivablesPaise: number;
    receivablesInr: number;
    payablesPaise: number;
    payablesInr: number;
    netWorkingPositionPaise: number;
    netWorkingPositionInr: number;
  };
}

export interface FinancialLedgerItem {
  id: string;
  date: string;
  reference: string;
  type: FinancialTransactionType;
  typeLabel: string;
  direction: FinancialTransactionDirection;
  category: string;
  description: string;
  amountPaise: number;
  amountInr: number;
  paymentMethod?: string;
  status: string;
  sourceLink?: string;
}

export interface FinancialLedgerResponse {
  items: FinancialLedgerItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  period: {
    preset: string;
    startDate: string;
    endDate: string;
  };
}

export interface FinancialTrendPoint {
  date: string;
  inflowPaise: number;
  inflowInr: number;
  outflowPaise: number;
  outflowInr: number;
  netPaise: number;
  netInr: number;
}

export interface FinancialTrendsResponse {
  period: {
    preset: string;
    startDate: string;
    endDate: string;
  };
  points: FinancialTrendPoint[];
}

export interface QueryLedgerParams {
  period?: FinancialPeriodPreset;
  startDate?: string;
  endDate?: string;
  type?: FinancialTransactionType;
  direction?: FinancialTransactionDirection;
  search?: string;
  page?: number;
  limit?: number;
}

export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Retrieves the comprehensive financial KPI summary for the selected period.
 */
export async function fetchFinancialKpiSummary(
  period?: FinancialPeriodPreset,
  startDate?: string,
  endDate?: string,
): Promise<FinancialKpiData> {
  const params = new URLSearchParams();
  if (period) params.append('period', period);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const res = await fetch(`${API_BASE_URL}/financial-control-center/kpi?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch financial KPIs: HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Retrieves the paginated, searchable Central Financial Transaction Ledger.
 */
export async function fetchFinancialLedger(
  params: QueryLedgerParams,
): Promise<FinancialLedgerResponse> {
  const query = new URLSearchParams();

  if (params.period) query.append('period', params.period);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.type) query.append('type', params.type);
  if (params.direction) query.append('direction', params.direction);
  if (params.search) query.append('search', params.search);
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));

  const res = await fetch(`${API_BASE_URL}/financial-control-center/ledger?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch financial ledger: HTTP ${res.status}`);
  }

  const json = await res.json();
  return {
    items: json.data,
    total: json.meta.total,
    page: json.meta.page,
    limit: json.meta.limit,
    totalPages: json.meta.totalPages,
    period: json.meta.period,
  };
}

/**
 * Retrieves timeline trends for charting.
 */
export async function fetchFinancialTrends(
  period?: FinancialPeriodPreset,
  startDate?: string,
  endDate?: string,
): Promise<FinancialTrendsResponse> {
  const params = new URLSearchParams();
  if (period) params.append('period', period);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const res = await fetch(`${API_BASE_URL}/financial-control-center/trends?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch financial trends: HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Downloads the formula-sanitized CSV export.
 */
export async function downloadFinancialCsv(params: QueryLedgerParams): Promise<void> {
  const query = new URLSearchParams();

  if (params.period) query.append('period', params.period);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.type) query.append('type', params.type);
  if (params.direction) query.append('direction', params.direction);
  if (params.search) query.append('search', params.search);

  const res = await fetch(`${API_BASE_URL}/financial-control-center/export/csv?${query.toString()}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to export CSV: HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Financial_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Super Admin: Purges all financial transactional records for fresh testing.
 */
export async function purgeAllFinancialData(): Promise<{
  expenses: number;
  payments: number;
  bloodIssueInvoices: number;
  bloodIssueCollections: number;
  monthlyPayrollRuns: number;
  salarySlips: number;
  salaryDisbursements: number;
}> {
  const res = await fetch(`${API_BASE_URL}/financial-control-center/purge-all-data`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
      Accept: 'application/json',
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || `Failed to purge financial data: HTTP ${res.status}`);
  }

  return json.data;
}

