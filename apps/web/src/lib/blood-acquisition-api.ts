import { BloodGroup } from './donor-api';
import { getAuthHeaders } from './auth-api';

export enum ExternalSourceType {
  BLOOD_BANK = 'BLOOD_BANK',
  HOSPITAL = 'HOSPITAL',
  BLOOD_ORGANIZATION = 'BLOOD_ORGANIZATION',
  GOVERNMENT_BLOOD_CENTRE = 'GOVERNMENT_BLOOD_CENTRE',
  OTHER = 'OTHER',
}

export const EXTERNAL_SOURCE_TYPE_LABELS: Record<ExternalSourceType, string> = {
  [ExternalSourceType.BLOOD_BANK]: 'Blood Bank',
  [ExternalSourceType.HOSPITAL]: 'Hospital',
  [ExternalSourceType.BLOOD_ORGANIZATION]: 'Blood Collection Org',
  [ExternalSourceType.GOVERNMENT_BLOOD_CENTRE]: 'Govt Blood Centre',
  [ExternalSourceType.OTHER]: 'Other Authorized Source',
};

export enum BloodAcquisitionStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
}

export interface BloodAcquisitionItemInput {
  bloodGroup: BloodGroup | string;
  componentType: string;
  invoicedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity?: number;
  pendingInspectionQuantity?: number;
  unitCost?: number;
  testingRequired: boolean;
  volumePerUnit?: number;
  expiryDate?: string;
  storageLocation?: string;
  rejectionReason?: string;
  itemNotes?: string;
}

export interface CreateBloodAcquisitionInput {
  sourceType: ExternalSourceType;
  sourceName: string;
  invoiceNumber?: string;
  referenceNumber?: string;
  receivedDate: string;
  notes?: string;
  vendorId?: string;
  transportCharges?: number;
  clearanceCertificateNumber?: string;
  sourceTestingCertified?: boolean;
  reconciliationNotes?: string;
  items: BloodAcquisitionItemInput[];
}

export interface BloodAcquisitionItem {
  _id: string;
  bloodGroup: string;
  componentType: string;
  invoicedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  quantity: number;
  unitCost: number;
  unitCostPaise: number;
  totalCostPaise: number;
  testingRequired: boolean;
  volumePerUnit?: number;
  expiryDate?: string;
  storageLocation?: string;
  rejectionReason?: string;
  itemNotes?: string;
}

export interface BloodAcquisitionAdjustment {
  _id?: string;
  adjustmentType: 'CREDIT_NOTE' | 'SUPPLIER_REFUND';
  amountPaise: number;
  amount: number;
  reason: string;
  creditNoteReference: string;
  supportingDocumentKey?: string;
  approvedByName?: string;
  approvedAt: string;
  notes?: string;
}

export interface AcquisitionFinancialSummary {
  totalPayablePaise: number;
  totalPayable: number;
  totalAdjustmentsPaise: number;
  totalAdjustments: number;
  effectiveNetLiabilityPaise: number;
  effectiveNetLiability: number;
  paidAmountPaise: number;
  paidAmount: number;
  outstandingBalancePaise: number;
  outstandingBalance: number;
  supplierRefundReceivablePaise: number;
  supplierRefundReceivable: number;
  paymentStatus: string;
  expenseStatus?: string;
  expenseCode?: string;
  expenseId?: string;
}

export interface BloodAcquisitionReceipt {
  _id: string;
  receiptCode: string;
  idempotencyKey?: string;
  sourceType: ExternalSourceType;
  sourceName: string;
  invoiceNumber?: string;
  referenceNumber?: string;
  receivedDate: string;
  notes?: string;
  status: BloodAcquisitionStatus;
  totalUnitsGenerated: number;
  items: BloodAcquisitionItem[];
  vendorId?: string;
  expenseId?: string;
  acquisitionCostPaise?: number;
  transportChargesPaise?: number;
  totalPayablePaise: number;
  totalPayable: number;
  clearanceCertificateNumber?: string;
  sourceTestingCertified?: boolean;
  clearanceAuthorizedByName?: string;
  clearanceAuthorizationDate?: string;
  invoiceDocumentKey?: string;
  invoiceDocumentUrl?: string;
  clearanceCertificateKey?: string;
  clearanceCertificateUrl?: string;
  hasDiscrepancy: boolean;
  reconciliationNotes?: string;
  adjustments?: BloodAcquisitionAdjustment[];
  financials?: AcquisitionFinancialSummary;
  unitsSummary?: {
    total: number;
    testing: number;
    approved: number;
    rejected: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BloodAcquisitionDetail extends BloodAcquisitionReceipt {
  stats?: {
    totalUnits: number;
    testing: number;
    approved: number;
    rejected: number;
    inInventory: number;
  };
  financials?: AcquisitionFinancialSummary;
  expense?: any;
}

export interface AcquiredUnitTraceability {
  _id: string;
  unitCode: string;
  bloodGroup: string;
  componentType: string;
  collectionDate: string;
  expiryDate?: string;
  volume?: number;
  storageLocation?: string;
  status: string; // TESTING | APPROVED | REJECTED
  testing: {
    _id: string;
    testingCode: string;
    status: string;
    decision: string;
  } | null;
  inventory: {
    _id: string;
    status: string;
  } | null;
}

export interface AcquisitionSummaryStats {
  totalReceipts: number;
  totalUnitsReceived: number;
  directToInventory: number;
  pendingTesting: number;
}

export interface PaginatedBloodAcquisitions {
  items: BloodAcquisitionReceipt[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RecordAcquisitionAdjustmentInput {
  adjustmentType: 'CREDIT_NOTE' | 'SUPPLIER_REFUND';
  amount: number;
  reason: string;
  creditNoteReference: string;
  notes?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Creates an external blood receipt with bulk items, costing, and clearance details.
 */
export async function createBloodAcquisition(
  input: CreateBloodAcquisitionInput,
  idempotencyKey?: string,
): Promise<{
  receipt: BloodAcquisitionReceipt;
  totalUnitsCreated: number;
  directInventoryCount: number;
  pendingTestingCount: number;
  expense?: any;
  isIdempotentReplay?: boolean;
}> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...getAuthHeaders(),
  };

  if (idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey;
  }

  const res = await fetch(`${API_BASE_URL}/blood-acquisitions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to create blood acquisition receipt';
    const err: any = new Error(errorMsg);
    err.code = body.code || body.error;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Retrieves paginated list of blood acquisition receipts.
 */
export async function fetchBloodAcquisitions(filters?: {
  sourceType?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedBloodAcquisitions> {
  const params = new URLSearchParams();
  if (filters?.sourceType) params.append('sourceType', filters.sourceType);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const url = `${API_BASE_URL}/blood-acquisitions${params.toString() ? `?${params.toString()}` : ''}`;
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
    throw new Error(body.message || 'Failed to fetch blood acquisitions');
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
 * Retrieves single receipt detail.
 */
export async function fetchBloodAcquisitionById(
  id: string,
): Promise<BloodAcquisitionDetail> {
  const res = await fetch(`${API_BASE_URL}/blood-acquisitions/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || 'Failed to fetch blood acquisition details');
  }

  return body.data;
}

/**
 * Retrieves blood units generated from a receipt.
 */
export async function fetchBloodAcquisitionUnits(
  id: string,
): Promise<AcquiredUnitTraceability[]> {
  const res = await fetch(
    `${API_BASE_URL}/blood-acquisitions/${encodeURIComponent(id)}/units`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      cache: 'no-store',
    },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || 'Failed to fetch blood units for receipt');
  }

  return body.data || [];
}

/**
 * Records a supplier credit note or refund adjustment against an acquisition receipt.
 */
export async function recordAcquisitionAdjustment(
  id: string,
  input: RecordAcquisitionAdjustmentInput,
): Promise<BloodAcquisitionDetail> {
  const res = await fetch(`${API_BASE_URL}/blood-acquisitions/${encodeURIComponent(id)}/adjustments`, {
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
      : body.message || 'Failed to record credit adjustment';
    const err: any = new Error(errorMsg);
    err.code = body.code || body.error;
    throw err;
  }

  return body.data;
}

/**
 * Uploads an invoice document file for an acquisition receipt.
 */
export async function uploadAcquisitionInvoice(
  id: string,
  file: File,
): Promise<BloodAcquisitionReceipt> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/blood-acquisitions/${encodeURIComponent(id)}/invoice`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || 'Failed to upload acquisition invoice');
  }

  return body.data;
}

/**
 * Uploads a clearance certificate file for an acquisition receipt.
 */
export async function uploadAcquisitionCertificate(
  id: string,
  file: File,
): Promise<BloodAcquisitionReceipt> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/blood-acquisitions/${encodeURIComponent(id)}/certificate`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || 'Failed to upload clearance certificate');
  }

  return body.data;
}

/**
 * Retrieves KPI summary stats.
 */
export async function fetchBloodAcquisitionSummary(): Promise<AcquisitionSummaryStats> {
  const res = await fetch(`${API_BASE_URL}/blood-acquisitions/summary`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || 'Failed to fetch acquisition summary');
  }

  return body.data;
}
