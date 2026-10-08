import { Donor, BloodGroup } from './donor-api';

export enum DonationType {
  WHOLE_BLOOD = 'WHOLE_BLOOD',
}

export enum DonationStatus {
  RECORDED = 'RECORDED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const ALLOWED_DONATION_STATUS_TRANSITIONS: Record<
  DonationStatus,
  DonationStatus[]
> = {
  [DonationStatus.RECORDED]: [
    DonationStatus.PROCESSING,
    DonationStatus.CANCELLED,
  ],
  [DonationStatus.PROCESSING]: [
    DonationStatus.COMPLETED,
    DonationStatus.CANCELLED,
  ],
  [DonationStatus.COMPLETED]: [],
  [DonationStatus.CANCELLED]: [],
};

export interface Donation {
  _id: string;
  donationCode: string;
  donorId: Donor;
  donationDate: string;
  donationType: DonationType;
  quantity: number;
  status: DonationStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDonationInput {
  donorId: string;
  donationDate: string;
  donationType?: DonationType;
  quantity: number;
  notes?: string;
}

export interface PaginatedDonations {
  items: Donation[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Staff/Admin record physical blood donation event.
 */
export async function createDonation(
  input: CreateDonationInput,
): Promise<Donation> {
  const res = await fetch(`${API_BASE_URL}/donations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to record donation';
    const err: any = new Error(errorMsg);
    err.details = body;
    throw err;
  }

  return body.data;
}

/**
 * Staff/Admin query paginated donations with search and filters.
 */
export async function fetchDonations(filters?: {
  donorId?: string;
  search?: string;
  status?: string;
  bloodGroup?: string;
  donationType?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedDonations> {
  const params = new URLSearchParams();
  if (filters?.donorId) params.append('donorId', filters.donorId);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.bloodGroup) params.append('bloodGroup', filters.bloodGroup);
  if (filters?.donationType) params.append('donationType', filters.donationType);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const url = `${API_BASE_URL}/donations${
    params.toString() ? `?${params.toString()}` : ''
  }`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to retrieve donations');
  }

  return body.data;
}

/**
 * Staff/Admin query single donation by MongoDB ID or donationCode.
 */
export async function fetchDonationById(id: string): Promise<Donation> {
  const res = await fetch(`${API_BASE_URL}/donations/${id}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to retrieve donation details');
  }

  return body.data;
}

/**
 * Staff/Admin advance donation status following strict lifecycle rules.
 */
export async function updateDonationStatus(
  id: string,
  status: DonationStatus,
): Promise<Donation> {
  const res = await fetch(`${API_BASE_URL}/donations/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to update donation status';
    throw new Error(errorMsg);
  }

  return body.data;
}
