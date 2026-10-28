import { getAuthHeaders } from './auth-api';

export enum ReplacementTrackingStatus {
  DONOR_ASSOCIATED = 'DONOR_ASSOCIATED',
  DONATION_SCHEDULED = 'DONATION_SCHEDULED',
  DONATION_IN_PROGRESS = 'DONATION_IN_PROGRESS',
  DONATION_COLLECTED = 'DONATION_COLLECTED',
  TESTING_PENDING = 'TESTING_PENDING',
  RELEASED_TO_INVENTORY = 'RELEASED_TO_INVENTORY',
  DONATION_DEFERRED_OR_REJECTED = 'DONATION_DEFERRED_OR_REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ReplacementDonorRelationship {
  FAMILY = 'FAMILY',
  FRIEND = 'FRIEND',
  COLLEAGUE = 'COLLEAGUE',
  VOLUNTEER_REPLACEMENT = 'VOLUNTEER_REPLACEMENT',
  OTHER = 'OTHER',
}

export interface ReplacementTimelineEvent {
  event: string;
  status: ReplacementTrackingStatus;
  description: string;
  actorId?: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
}

export interface ReplacementDonation {
  _id: string;
  trackingCode: string;
  bloodRequestId: string;
  requestCode: string;
  patientName: string;
  patientBloodGroup: string;
  patientPhone?: string;
  donorId: string;
  donorCode: string;
  donorName: string;
  donorBloodGroup: string;
  donorPhone?: string;
  relationshipToPatient: ReplacementDonorRelationship;
  donationId?: string;
  donationCode?: string;
  bloodUnitId?: string;
  unitCode?: string;
  crossmatchId?: string;
  crossmatchStatus?: string;
  issuedBloodUnitId?: string;
  issuedUnitCode?: string;
  bloodIssueId?: string;
  issueCode?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  paymentStatus?: string;
  invoiceTotalAmount?: number;
  invoiceWaiverAmount?: number;
  invoicePaidAmount?: number;
  invoiceBalanceDue?: number;
  status: ReplacementTrackingStatus;
  notes?: string;
  cancellationReason?: string;
  timeline: ReplacementTimelineEvent[];
  createdById?: string;
  createdByName?: string;
  createdByRole?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReplacementMetrics {
  totalCases: number;
  activeCases: number;
  associatedDonors: number;
  donationsInProgress: number;
  donationsCollected: number;
  releasedDonations: number;
  deferredOrRejected: number;
  cancelledCases: number;
}

export interface PaginatedReplacementDonations {
  items: ReplacementDonation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateReplacementInput {
  bloodRequestId: string;
  donorId?: string;
  relationshipToPatient: ReplacementDonorRelationship;
  notes?: string;
  newDonor?: {
    fullName: string;
    phone: string;
    email?: string;
    bloodGroup: string;
    gender: string;
    dateOfBirth: string;
    city?: string;
    state?: string;
    postalCode?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };
}

export interface AssociateDonorInput {
  donorId: string;
  relationshipToPatient?: ReplacementDonorRelationship;
  notes?: string;
}

export interface LinkDonationInput {
  donationId: string;
  notes?: string;
}

export interface CancelTrackingInput {
  cancellationReason: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Fetch replacement dashboard summary metrics.
 */
export async function fetchReplacementMetrics(): Promise<ReplacementMetrics> {
  const res = await fetch(`${API_BASE_URL}/replacement-donations/metrics`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to fetch replacement metrics');
  }
  return body.data;
}

/**
 * Query paginated replacement donation cases.
 */
export async function fetchReplacementDonations(filters?: {
  bloodRequestId?: string;
  donorId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedReplacementDonations> {
  const params = new URLSearchParams();
  if (filters?.bloodRequestId) params.append('bloodRequestId', filters.bloodRequestId);
  if (filters?.donorId) params.append('donorId', filters.donorId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const res = await fetch(
    `${API_BASE_URL}/replacement-donations?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      cache: 'no-store',
    },
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to fetch replacement donations');
  }

  return {
    items: body.data || [],
    total: body.meta?.total || 0,
    page: body.meta?.page || 1,
    limit: body.meta?.limit || 10,
    totalPages: body.meta?.totalPages || 1,
  };
}

/**
 * Fetch single replacement tracking record by ID.
 */
export async function fetchReplacementDonationById(
  id: string,
): Promise<ReplacementDonation> {
  const res = await fetch(`${API_BASE_URL}/replacement-donations/${id}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to fetch replacement record');
  }
  return body.data;
}

/**
 * Fetch all replacement tracking cases for a specific blood request.
 */
export async function fetchReplacementDonationsByRequest(
  bloodRequestId: string,
): Promise<ReplacementDonation[]> {
  const res = await fetch(
    `${API_BASE_URL}/replacement-donations/by-request/${bloodRequestId}`,
    {
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      cache: 'no-store',
    },
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to fetch request replacements');
  }
  return body.data || [];
}

/**
 * Create a new replacement tracking case.
 */
export async function createReplacementCase(
  input: CreateReplacementInput,
): Promise<ReplacementDonation> {
  const res = await fetch(`${API_BASE_URL}/replacement-donations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to create replacement tracking case';
    throw new Error(errorMsg);
  }
  return body.data;
}

/**
 * Associate or update donor on tracking case.
 */
export async function associateDonorToReplacement(
  id: string,
  input: AssociateDonorInput,
): Promise<ReplacementDonation> {
  const res = await fetch(`${API_BASE_URL}/replacement-donations/${id}/donor`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to associate donor');
  }
  return body.data;
}

/**
 * Link physical donation to tracking case.
 */
export async function linkDonationToReplacement(
  id: string,
  input: LinkDonationInput,
): Promise<ReplacementDonation> {
  const res = await fetch(
    `${API_BASE_URL}/replacement-donations/${id}/link-donation`,
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

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to link donation');
  }
  return body.data;
}

/**
 * Sync dynamic status from underlying donation & blood unit.
 */
export async function syncReplacementStatus(
  id: string,
): Promise<ReplacementDonation> {
  const res = await fetch(`${API_BASE_URL}/replacement-donations/${id}/sync`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to sync replacement status');
  }
  return body.data;
}

/**
 * Cancel replacement tracking case.
 */
export async function cancelReplacementCase(
  id: string,
  input: CancelTrackingInput,
): Promise<ReplacementDonation> {
  const res = await fetch(`${API_BASE_URL}/replacement-donations/${id}/cancel`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to cancel replacement case');
  }
  return body.data;
}

/**
 * Update tracking notes.
 */
export async function updateReplacementNotes(
  id: string,
  notes: string,
): Promise<ReplacementDonation> {
  const res = await fetch(`${API_BASE_URL}/replacement-donations/${id}/notes`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ notes }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to update notes');
  }
  return body.data;
}

export interface ReplacementWorkflowTrace {
  trackingCode: string;
  createdAt?: string;
  status: ReplacementTrackingStatus;
  relativeDonation: {
    donorId?: string;
    donorCode?: string;
    donorName?: string;
    donorBloodGroup?: string;
    relationshipToPatient?: ReplacementDonorRelationship;
    donationId?: string;
    donationCode?: string;
    donationStatus: string;
    bloodUnitId?: string;
    unitCode?: string;
    unitStatus: string;
    isReleasedToInventory: boolean;
  };
  patientRequest: {
    bloodRequestId?: string;
    requestCode?: string;
    patientName?: string;
    patientBloodGroup?: string;
    requestedComponent: string;
    unitsRequested: number;
    requestStatus: string;
  };
  crossmatching: {
    crossmatchId?: string;
    crossmatchCode?: string;
    status: string;
    compatibilityResult: string;
    selectedInventoryUnit?: string;
    selectedUnitBloodGroup?: string;
    isAuthorized: boolean;
  };
  bloodIssue: {
    bloodIssueId?: string;
    issueCode?: string;
    status: string;
    issuedAt?: string;
    issuedUnits: Array<{
      bloodUnitId?: string;
      unitCode?: string;
      bloodGroup?: string;
      componentType?: string;
      volume?: number;
      status?: string;
    }>;
  };
  payment: {
    invoiceId?: string;
    invoiceNumber?: string;
    status: string;
    subtotal: number;
    waiverTotal: number;
    paidAmount: number;
    balanceDue: number;
  };
  separationNotice: string;
  timeline: ReplacementTimelineEvent[];
}

/**
 * Fetch 5-stage complete replacement-to-blood-issue workflow trace.
 */
export async function fetchReplacementWorkflowTrace(
  id: string,
): Promise<ReplacementWorkflowTrace> {
  const res = await fetch(`${API_BASE_URL}/replacement-donations/${id}/workflow`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to fetch replacement workflow trace');
  }
  return body.data;
}
