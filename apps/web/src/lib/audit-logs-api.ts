import { getAuthHeaders } from './auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export enum AuditActionType {
  // Donors
  DONOR_REGISTERED = 'DONOR_REGISTERED',
  DONOR_STATUS_UPDATED = 'DONOR_STATUS_UPDATED',
  DONOR_VERIFIED = 'DONOR_VERIFIED',

  // Donations
  DONATION_RECORDED = 'DONATION_RECORDED',
  DONATION_STATUS_CHANGED = 'DONATION_STATUS_CHANGED',
  DONATION_CANCELLED = 'DONATION_CANCELLED',

  // Blood Units & Acquisition
  BLOOD_UNIT_CREATED = 'BLOOD_UNIT_CREATED',
  BLOOD_UNIT_STATUS_CHANGED = 'BLOOD_UNIT_STATUS_CHANGED',
  ACQUISITION_CREATED = 'ACQUISITION_CREATED',
  ACQUISITION_CLEARANCE_AUTHORIZED = 'ACQUISITION_CLEARANCE_AUTHORIZED',
  ACQUISITION_ADJUSTMENT_RECORDED = 'ACQUISITION_ADJUSTMENT_RECORDED',

  // Inventory
  INVENTORY_INTAKE_COMPLETED = 'INVENTORY_INTAKE_COMPLETED',
  INVENTORY_STATUS_CHANGED = 'INVENTORY_STATUS_CHANGED',
  INVENTORY_DISCARDED = 'INVENTORY_DISCARDED',

  // Laboratory Testing
  TEST_RESULT_RECORDED = 'TEST_RESULT_RECORDED',
  TESTING_APPROVED = 'TESTING_APPROVED',
  TESTING_REJECTED = 'TESTING_REJECTED',

  // Blood Requests & Issues
  BLOOD_REQUEST_CREATED = 'BLOOD_REQUEST_CREATED',
  BLOOD_REQUEST_VERIFIED = 'BLOOD_REQUEST_VERIFIED',
  BLOOD_REQUEST_APPROVED = 'BLOOD_REQUEST_APPROVED',
  BLOOD_REQUEST_REJECTED = 'BLOOD_REQUEST_REJECTED',
  BLOOD_RESERVED = 'BLOOD_RESERVED',
  RESERVATION_CANCELLED = 'RESERVATION_CANCELLED',
  BLOOD_ISSUED = 'BLOOD_ISSUED',
  BLOOD_ISSUE_REVERSED = 'BLOOD_ISSUE_REVERSED',

  // Billing & Collections
  INVOICE_GENERATED = 'INVOICE_GENERATED',
  INVOICE_WAIVER_APPLIED = 'INVOICE_WAIVER_APPLIED',
  INVOICE_CANCELLED = 'INVOICE_CANCELLED',
  PAYMENT_COLLECTED = 'PAYMENT_COLLECTED',
  COLLECTION_REVERSED = 'COLLECTION_REVERSED',

  // Expenses & Disbursements
  EXPENSE_CREATED = 'EXPENSE_CREATED',
  EXPENSE_SUBMITTED = 'EXPENSE_SUBMITTED',
  EXPENSE_APPROVED = 'EXPENSE_APPROVED',
  EXPENSE_REJECTED = 'EXPENSE_REJECTED',
  EXPENSE_CANCELLED = 'EXPENSE_CANCELLED',
  DISBURSEMENT_RECORDED = 'DISBURSEMENT_RECORDED',
  DISBURSEMENT_CANCELLED = 'DISBURSEMENT_CANCELLED',

  // Campaigns & Budgets
  CAMPAIGN_CREATED = 'CAMPAIGN_CREATED',
  BUDGET_REVISED = 'BUDGET_REVISED',

  // Payroll
  PAYROLL_GENERATED = 'PAYROLL_GENERATED',
  PAYROLL_APPROVED = 'PAYROLL_APPROVED',
  SALARY_DISBURSED = 'SALARY_DISBURSED',
}

export enum AuditEntityType {
  DONOR = 'Donor',
  DONATION = 'Donation',
  BLOOD_UNIT = 'BloodUnit',
  BLOOD_ACQUISITION = 'BloodAcquisition',
  INVENTORY = 'Inventory',
  BLOOD_TESTING = 'BloodTesting',
  BLOOD_REQUEST = 'BloodRequest',
  RESERVATION = 'Reservation',
  BLOOD_ISSUE = 'BloodIssue',
  INVOICE = 'BloodIssueInvoice',
  COLLECTION = 'BloodIssueCollection',
  EXPENSE = 'Expense',
  PAYMENT = 'Payment',
  CAMPAIGN = 'Campaign',
  PAYROLL = 'MonthlyPayrollRun',
  SALARY_DISBURSEMENT = 'SalaryDisbursement',
}

export interface AuditLogEntry {
  _id: string;
  eventId: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  entityIdentifier?: string;
  description: string;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueryAuditLogParams {
  actorId?: string;
  actorRole?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  skip?: number;
}

export interface AuditLogsResponse {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  skip: number;
}

export interface StaffActivitySummary {
  actorId: string;
  totalEvents: number;
  recentEvents: AuditLogEntry[];
  actionBreakdown: Record<string, number>;
}

/**
 * Fetch central immutable audit logs with multi-dimensional filtering.
 */
export async function fetchAuditLogs(params?: QueryAuditLogParams): Promise<AuditLogsResponse> {
  const query = new URLSearchParams();
  if (params?.actorId) query.set('actorId', params.actorId);
  if (params?.actorRole) query.set('actorRole', params.actorRole);
  if (params?.action) query.set('action', params.action);
  if (params?.entityType) query.set('entityType', params.entityType);
  if (params?.entityId) query.set('entityId', params.entityId);
  if (params?.search) query.set('search', params.search);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.skip) query.set('skip', String(params.skip));

  const qs = query.toString();
  const url = `${API_BASE_URL}/audit-logs${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch audit logs.');
  }

  return json.data;
}

/**
 * Fetch immutable audit trail for a specific entity record.
 */
export async function fetchEntityAuditLogs(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
  const res = await fetch(
    `${API_BASE_URL}/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
    },
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch entity audit trail.');
  }

  return json.data;
}

/**
 * Fetch activity summary and breakdown for a specific staff user.
 */
export async function fetchStaffActivitySummary(actorId: string): Promise<StaffActivitySummary> {
  const res = await fetch(`${API_BASE_URL}/audit-logs/staff/${encodeURIComponent(actorId)}/summary`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch staff activity summary.');
  }

  return json.data;
}
