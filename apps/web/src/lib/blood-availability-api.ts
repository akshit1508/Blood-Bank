const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface PublicBloodComponentAvailability {
  componentType: string;
  availableUnits: number;
  availability: 'AVAILABLE' | 'NOT_AVAILABLE';
}

export interface PublicBloodGroupAvailability {
  bloodGroup: string;
  totalUnits: number;
  availability: 'AVAILABLE' | 'NOT_AVAILABLE';
  components: PublicBloodComponentAvailability[];
}

export interface PublicBloodAvailabilityItem {
  bloodGroup: string;
  componentType: string;
  availableUnits: number;
  availability: 'AVAILABLE' | 'NOT_AVAILABLE';
}

export interface PublicBloodAvailabilityData {
  lastUpdated: string;
  totalAvailableUnits: number;
  groups: PublicBloodGroupAvailability[];
  items: PublicBloodAvailabilityItem[];
}

/**
 * Translates public availability error messages into user-friendly text.
 */
export function getFriendlyPublicAvailabilityErrorMessage(err: any): string {
  if (err?.message && typeof err.message === 'string') {
    return err.message;
  }
  return 'Unable to load current blood availability. Please verify your connection or try again shortly.';
}

/**
 * Fetches real, aggregated public blood availability from the backend.
 * GET /api/public/blood-availability
 */
export async function fetchPublicBloodAvailability(filters?: {
  bloodGroup?: string;
  componentType?: string;
}): Promise<PublicBloodAvailabilityData> {
  const params = new URLSearchParams();
  if (filters?.bloodGroup) params.append('bloodGroup', filters.bloodGroup);
  if (filters?.componentType) params.append('componentType', filters.componentType);

  const url = `${API_BASE_URL}/public/blood-availability${
    params.toString() ? `?${params.toString()}` : ''
  }`;

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
      : body.message || 'Unable to load current blood availability.';
    const err: any = new Error(errorMsg);
    err.code = body.code;
    err.details = body;
    throw err;
  }

  return body.data;
}
