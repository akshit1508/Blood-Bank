const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export enum InventoryStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  ISSUED = 'ISSUED',
  EXPIRED = 'EXPIRED',
  DISCARDED = 'DISCARDED',
}

export interface InventoryHistoryItem {
  _id: string;
  inventoryId: string;
  fromStatus: InventoryStatus | null;
  toStatus: InventoryStatus;
  reason?: string;
  changedAt: string;
}

export interface InventoryItem {
  _id: string;
  status: InventoryStatus;
  discardReason?: string | null;
  discardedAt?: string | null;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  createdAt: string;
  updatedAt: string;
  bloodUnit: {
    _id: string;
    unitCode: string;
    bloodGroup: string;
    componentType: string;
    collectionDate: string;
    expiryDate?: string;
    volume?: number;
    storageLocation?: string;
    status: string;
  };
  donation: {
    _id: string;
    donationCode: string;
    donationDate: string;
    donationType: string;
    status: string;
  };
  donor: {
    _id: string;
    donorCode: string;
    bloodGroup: string;
  };
  testing: {
    _id: string;
    testingCode: string;
    decision: string;
    status: string;
    completedAt?: string;
  } | null;
  history?: InventoryHistoryItem[];
}

export interface InventorySummary {
  totalAvailable: number;
  expiringSoon: number;
  expired: number;
  discarded: number;
  byBloodGroup: Record<string, number>;
  byComponentType: Record<string, number>;
}

export interface PaginatedInventory {
  items: InventoryItem[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Translates backend domain error codes to friendly admin messages.
 */
export function getFriendlyInventoryErrorMessage(err: any): string {
  const code = err?.code || err?.details?.code;
  switch (code) {
    case 'BLOOD_UNIT_NOT_FOUND':
      return 'The referenced physical Blood Unit was not found in the database.';
    case 'BLOOD_UNIT_NOT_APPROVED_FOR_INVENTORY':
      return 'Only APPROVED Blood Units with confirmed laboratory clearance may enter operational inventory.';
    case 'INVENTORY_RECORD_ALREADY_EXISTS':
      return 'An inventory record already exists for this physical Blood Unit.';
    case 'INVENTORY_RECORD_NOT_FOUND':
      return 'The requested inventory record was not found.';
    case 'INVENTORY_ALREADY_DISCARDED':
      return 'This inventory unit has already been discarded.';
    case 'DISCARD_REASON_REQUIRED':
      return 'A non-empty discard reason is required to discard an inventory unit.';
    case 'INVALID_BLOOD_UNIT_REFERENCE':
      return 'Invalid Blood Unit reference identifier format.';
    case 'INVALID_INVENTORY_REFERENCE':
      return 'Invalid Inventory reference identifier format.';
    default:
      return (
        err?.message ||
        'An unexpected error occurred while communicating with the inventory service.'
      );
  }
}

/**
 * Query inventory records with filtering and pagination.
 * GET /api/inventory
 */
export async function fetchInventory(filters?: {
  status?: string;
  expiringSoon?: boolean;
  bloodGroup?: string;
  componentType?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedInventory> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.expiringSoon) params.append('expiringSoon', 'true');
  if (filters?.bloodGroup) params.append('bloodGroup', filters.bloodGroup);
  if (filters?.componentType) params.append('componentType', filters.componentType);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const url = `${API_BASE_URL}/inventory${params.toString() ? `?${params.toString()}` : ''}`;
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
      : body.message || 'Failed to fetch inventory records';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return {
    items: body.data || [],
    total: body.meta?.total || 0,
    page: body.meta?.page || 1,
    totalPages: body.meta?.totalPages || 1,
  };
}

/**
 * Fetch a single inventory record by MongoDB _id (including lifecycle history).
 * GET /api/inventory/:id
 */
export async function fetchInventoryById(id: string): Promise<InventoryItem> {
  const res = await fetch(`${API_BASE_URL}/inventory/${encodeURIComponent(id)}`, {
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
      : body.message || `Failed to fetch inventory record '${id}'`;
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Fetch the inventory record associated with a physical Blood Unit.
 * GET /api/inventory/blood-unit/:bloodUnitId
 */
export async function fetchInventoryByBloodUnitId(
  bloodUnitId: string,
): Promise<InventoryItem> {
  const res = await fetch(
    `${API_BASE_URL}/inventory/blood-unit/${encodeURIComponent(bloodUnitId)}`,
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
      : body.message || 'Failed to fetch inventory record for blood unit';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Creates an operational inventory record from an APPROVED Blood Unit.
 * POST /api/inventory/from-blood-unit/:bloodUnitId
 */
export async function createInventoryFromBloodUnit(
  bloodUnitId: string,
): Promise<InventoryItem> {
  const res = await fetch(
    `${API_BASE_URL}/inventory/from-blood-unit/${encodeURIComponent(bloodUnitId)}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to add blood unit to inventory';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Aggregates real operational inventory summary metrics with expiry awareness.
 * GET /api/inventory/summary
 */
export async function fetchInventorySummary(): Promise<InventorySummary> {
  const res = await fetch(`${API_BASE_URL}/inventory/summary`, {
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
      : body.message || 'Failed to fetch inventory summary';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Discards an operational inventory item with a mandatory reason.
 * PATCH /api/inventory/:id/discard
 */
export async function discardInventoryItem(
  id: string,
  reason: string,
): Promise<InventoryItem> {
  const res = await fetch(`${API_BASE_URL}/inventory/${encodeURIComponent(id)}/discard`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || `Failed to discard inventory unit '${id}'`;
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Triggers batch evaluation of physical unit expiry dates against current timestamp.
 * POST /api/inventory/evaluate-expiry
 */
export async function evaluateInventoryExpiry(): Promise<{
  evaluatedCount: number;
  expiredCount: number;
}> {
  const res = await fetch(`${API_BASE_URL}/inventory/evaluate-expiry`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to evaluate inventory expiry dates';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Fetches lifecycle audit history for an inventory item.
 * GET /api/inventory/:id/history
 */
export async function fetchInventoryHistory(
  id: string,
): Promise<InventoryHistoryItem[]> {
  const res = await fetch(
    `${API_BASE_URL}/inventory/${encodeURIComponent(id)}/history`,
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
      : body.message || 'Failed to fetch inventory lifecycle history';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data || [];
}
