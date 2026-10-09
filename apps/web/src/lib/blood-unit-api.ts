export enum BloodUnitStatus {
  TESTING = 'TESTING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum BloodUnitComponent {
  WHOLE_BLOOD = 'WHOLE_BLOOD',
  PRBC = 'PRBC',
  FFP = 'FFP',
  PLATELETS = 'PLATELETS',
}

export interface BloodUnitDonorSummary {
  _id: string;
  donorCode: string;
  fullName: string;
  bloodGroup: string;
  gender: string;
  status: string;
  phone?: string;
}

export interface BloodUnitDonationSummary {
  _id: string;
  donationCode: string;
  donationDate: string;
  donationType: string;
  status: string;
  quantity?: number;
  notes?: string;
}

export interface BloodUnit {
  _id: string;
  unitCode: string;
  donationId: BloodUnitDonationSummary | string;
  donorId: BloodUnitDonorSummary | string;
  bloodGroup: string;
  componentType: BloodUnitComponent | string;
  collectionDate: string;
  expiryDate?: string;
  volume?: number;
  status: BloodUnitStatus;
  storageLocation?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBloodUnitInput {
  donationId: string;
  componentType?: BloodUnitComponent | string;
  expiryDate?: string;
  volume?: number;
  storageLocation?: string;
  notes?: string;
}

export interface PaginatedBloodUnits {
  items: BloodUnit[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Creates an individual physical Blood Unit from a valid COMPLETED donation.
 * Authoritative fields (donorId, bloodGroup, collectionDate) are derived on backend.
 * POST /api/blood-units
 */
export async function createBloodUnit(
  input: CreateBloodUnitInput,
): Promise<BloodUnit> {
  const res = await fetch(`${API_BASE_URL}/blood-units`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to create blood unit';
    const err: any = new Error(errorMsg);
    err.code = body.code || body.error;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Retrieve the Blood Unit produced from a specific donation.
 * GET /api/blood-units/donation/:donationId
 */
export async function fetchBloodUnitByDonationId(
  donationId: string,
): Promise<BloodUnit | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/blood-units/donation/${encodeURIComponent(donationId)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
    );

    if (res.status === 404) {
      return null;
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return null;
    }

    return body.data || null;
  } catch {
    return null;
  }
}

/**
 * Query blood units with filters and pagination.
 * GET /api/blood-units
 */
export async function fetchBloodUnits(filters?: {
  status?: string;
  bloodGroup?: string;
  componentType?: string;
  donorId?: string;
  donationId?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedBloodUnits> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.bloodGroup) params.append('bloodGroup', filters.bloodGroup);
  if (filters?.componentType)
    params.append('componentType', filters.componentType);
  if (filters?.donorId) params.append('donorId', filters.donorId);
  if (filters?.donationId) params.append('donationId', filters.donationId);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const url = `${API_BASE_URL}/blood-units${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to fetch blood units';
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
 * Retrieve single blood unit by MongoDB _id or unitCode.
 * GET /api/blood-units/:id
 */
export async function fetchBloodUnitById(idOrCode: string): Promise<BloodUnit> {
  const res = await fetch(
    `${API_BASE_URL}/blood-units/${encodeURIComponent(idOrCode)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to retrieve blood unit';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}
