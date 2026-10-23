export enum TestingStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum TestingDecision {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum TestResultStatus {
  PENDING = 'PENDING',
  PASS = 'PASS',
  FAIL = 'FAIL',
}

export interface IndividualTestResult {
  testCode: string;
  testName: string;
  result?: string;
  status: TestResultStatus;
  testedAt?: string;
  remarks?: string;
  performedBy?: string;
  performedByName?: string;
  performedByRole?: string;
}

export interface CampaignSummary {
  _id: string;
  name: string;
  campaignCode: string;
  venue?: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  targetUnits?: number;
}

export interface ExternalReceiptSummary {
  _id: string;
  receiptCode?: string;
  sourceName?: string;
  sourceType?: string;
  invoiceNumber?: string;
  referenceNumber?: string;
  receivedDate?: string;
}

export interface BloodUnitSummary {
  _id: string;
  unitCode: string;
  status: string; // 'TESTING' | 'APPROVED' | 'REJECTED'
  bloodGroup: string;
  componentType: string;
  collectionDate: string;
  expiryDate?: string;
  volume?: number;
  storageLocation?: string;
  donationId?: DonationSummary | any;
  donorId?: DonorSummary | any;
  campaignId?: CampaignSummary | string;
  campaignCode?: string;
  sourceType?: string;
  externalReceiptId?: ExternalReceiptSummary | any;
}

export interface DonationSummary {
  _id: string;
  donationCode: string;
  donationDate: string;
  donationType: string;
  status: string;
  quantity?: number;
  notes?: string;
  campaignId?: CampaignSummary | string;
  campaignCode?: string;
}

export interface DonorSummary {
  _id: string;
  donorCode: string;
  fullName: string;
  bloodGroup: string;
  gender: string;
  status: string;
  phone?: string;
}

export interface BloodTesting {
  _id: string;
  testingCode: string;
  bloodUnitId: BloodUnitSummary;
  donationId: DonationSummary;
  donorId: DonorSummary;
  campaignId?: CampaignSummary | string;
  campaignCode?: string;
  campaignName?: string;
  sourceType?: string;
  externalReceiptId?: ExternalReceiptSummary | any;
  testResults: IndividualTestResult[];
  status: TestingStatus;
  decision: TestingDecision;
  startedAt: string;
  startedBy?: string;
  startedByName?: string;
  startedByRole?: string;
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
  completedByRole?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedByRole?: string;
  verifiedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedByRole?: string;
  rejectedAt?: string;
  performedBy?: string;
  rejectionReason?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type BloodOriginType = 'campaign' | 'acquisition' | 'normal';
export type BloodOriginFilter = 'all' | BloodOriginType;

export interface ResolvedOrigin {
  type: BloodOriginType;
  label: string;
  badgeColor: string;
  icon: string;
  subtitle: string;
  referenceCode?: string;
}

export function resolveBloodUnitOrigin(item: BloodUnitSummary | BloodTesting | any): ResolvedOrigin {
  const unit = item?.bloodUnitId && typeof item.bloodUnitId === 'object' ? item.bloodUnitId : item;
  const donation = item?.donationId && typeof item.donationId === 'object' ? item.donationId : unit?.donationId;
  const extReceipt =
    item?.externalReceiptId && typeof item.externalReceiptId === 'object'
      ? item.externalReceiptId
      : unit?.externalReceiptId && typeof unit?.externalReceiptId === 'object'
      ? unit.externalReceiptId
      : null;

  const campaign =
    item?.campaignId && typeof item.campaignId === 'object'
      ? item.campaignId
      : unit?.campaignId && typeof unit?.campaignId === 'object'
      ? unit.campaignId
      : donation?.campaignId && typeof donation?.campaignId === 'object'
      ? donation.campaignId
      : null;

  const campaignCode =
    item?.campaignCode ||
    campaign?.campaignCode ||
    unit?.campaignCode ||
    donation?.campaignCode;

  const campaignName =
    item?.campaignName ||
    campaign?.name;

  const isAcquisition =
    item?.sourceType === 'EXTERNAL_RECEIPT' ||
    unit?.sourceType === 'EXTERNAL_RECEIPT' ||
    Boolean(extReceipt) ||
    Boolean(item?.externalReceiptId) ||
    Boolean(unit?.externalReceiptId);

  if (campaignCode || campaignName || campaign) {
    const venue = campaign?.venue ? ` (${campaign.venue})` : '';
    const name = campaignName || campaignCode || 'Blood Drive';
    return {
      type: 'campaign',
      label: 'Campaign Drive',
      badgeColor: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      icon: '🏕️',
      subtitle: `${name}${venue}`,
      referenceCode: campaignCode,
    };
  }

  if (isAcquisition) {
    const sourceName = extReceipt?.sourceName || 'External Consignment';
    const receiptCode = extReceipt?.receiptCode;
    return {
      type: 'acquisition',
      label: 'External Acquisition',
      badgeColor: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
      icon: '📦',
      subtitle: `${sourceName}${receiptCode ? ` (${receiptCode})` : ''}`,
      referenceCode: receiptCode,
    };
  }

  const donationCode = donation?.donationCode;
  return {
    type: 'normal',
    label: 'Normal In-House',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    icon: '🏢',
    subtitle: donationCode ? `In-House Donation (${donationCode})` : 'In-House Donation',
    referenceCode: donationCode,
  };
}

export interface PaginatedBloodTesting {
  items: BloodTesting[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateTestingInput {
  bloodUnitId: string;
  performedBy?: string;
  remarks?: string;
}

export interface UpdateTestResultInput {
  status: TestResultStatus;
  result?: string;
  testedAt?: string;
  remarks?: string;
}

export interface CompleteTestingInput {
  performedBy?: string;
  rejectionReason?: string;
  remarks?: string;
}

import { getAuthHeaders } from './auth-api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Helper to translate backend error codes to user-friendly messages.
 */
export function getFriendlyErrorMessage(err: any): string {
  const code = err?.code || err?.details?.code;
  switch (code) {
    case 'BLOOD_UNIT_NOT_FOUND':
      return 'The referenced Blood Unit was not found in the database.';
    case 'BLOOD_UNIT_NOT_IN_TESTING':
      return 'Testing can only be initiated for Blood Units currently in TESTING status.';
    case 'TESTING_RECORD_ALREADY_EXISTS':
      return 'A laboratory testing record already exists for this Blood Unit.';
    case 'TESTING_RECORD_NOT_FOUND':
      return 'The requested testing record was not found.';
    case 'TEST_NOT_FOUND':
      return 'The specified laboratory test marker was not found on this record.';
    case 'TESTING_ALREADY_COMPLETED':
      return 'This testing record has already been finalized and is locked against modifications.';
    case 'REQUIRED_TESTS_INCOMPLETE':
      return 'All required laboratory tests must be completed with conclusive results before finalizing this record.';
    case 'FUTURE_TEST_DATE':
      return 'Test execution date cannot be set in the future.';
    case 'TESTING_COMPLETION_FAILED':
      return 'Failed to finalize testing. Please check test results and try again.';
    default:
      return err?.message || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Query testing records with filtering and pagination.
 * GET /api/testing
 */
export async function fetchTestingRecords(filters?: {
  status?: string;
  decision?: string;
  bloodUnitId?: string;
  donationId?: string;
  donorId?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedBloodTesting> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.decision) params.append('decision', filters.decision);
  if (filters?.bloodUnitId) params.append('bloodUnitId', filters.bloodUnitId);
  if (filters?.donationId) params.append('donationId', filters.donationId);
  if (filters?.donorId) params.append('donorId', filters.donorId);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const url = `${API_BASE_URL}/testing${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to fetch testing records';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return {
    items: body.data || [],
    page: body.meta?.page || 1,
    limit: body.meta?.limit || 10,
    total: body.meta?.total || 0,
    totalPages: body.meta?.totalPages || 1,
  };
}

/**
 * Retrieve single testing record by MongoDB _id or testingCode.
 * GET /api/testing/:id
 */
export async function fetchTestingRecordById(
  idOrCode: string,
): Promise<BloodTesting> {
  const res = await fetch(`${API_BASE_URL}/testing/${encodeURIComponent(idOrCode)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to retrieve testing record';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Retrieve testing record for a specific Blood Unit.
 * GET /api/testing/blood-unit/:bloodUnitId
 */
export async function fetchTestingRecordByBloodUnitId(
  bloodUnitId: string,
): Promise<BloodTesting> {
  const res = await fetch(`${API_BASE_URL}/testing/blood-unit/${encodeURIComponent(bloodUnitId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to retrieve testing record for blood unit';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Initiate laboratory Testing Record for a Blood Unit in TESTING status.
 * POST /api/testing
 */
export async function createTestingRecord(
  input: CreateTestingInput,
): Promise<BloodTesting> {
  const res = await fetch(`${API_BASE_URL}/testing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to initiate testing record';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Update individual screening test outcome within an in-progress record.
 * PATCH /api/testing/:id/tests/:testCode
 */
export async function updateIndividualTestResult(
  testingId: string,
  testCode: string,
  input: UpdateTestResultInput,
): Promise<BloodTesting> {
  const res = await fetch(
    `${API_BASE_URL}/testing/${encodeURIComponent(testingId)}/tests/${encodeURIComponent(testCode)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(input),
    },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || `Failed to update test result for ${testCode}`;
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Finalize testing workflow with an overall APPROVED or REJECTED decision.
 * PATCH /api/testing/:id/complete
 */
export async function completeTestingRecord(
  testingId: string,
  input: CompleteTestingInput,
): Promise<BloodTesting> {
  const res = await fetch(`${API_BASE_URL}/testing/${encodeURIComponent(testingId)}/complete`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to finalize testing record';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Fetch candidate blood units currently in TESTING status.
 * Uses the dedicated testing-scoped endpoint /api/blood-units/awaiting-testing
 */
export async function fetchUnitsAwaitingTesting(
  limit: number = 50,
): Promise<{ items: BloodUnitSummary[]; total: number }> {
  const res = await fetch(`${API_BASE_URL}/blood-units/awaiting-testing?limit=${limit}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to fetch blood units awaiting testing';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return {
    items: body.data || [],
    total: body.meta?.total || 0,
  };
}
