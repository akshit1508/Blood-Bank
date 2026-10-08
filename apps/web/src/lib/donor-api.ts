export enum BloodGroup {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum DonorStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export const ALLOWED_DONOR_STATUS_TRANSITIONS: Record<
  DonorStatus,
  DonorStatus[]
> = {
  [DonorStatus.PENDING_REVIEW]: [DonorStatus.ACTIVE, DonorStatus.INACTIVE],
  [DonorStatus.ACTIVE]: [DonorStatus.INACTIVE],
  [DonorStatus.INACTIVE]: [DonorStatus.ACTIVE],
};

export interface EmergencyContact {
  name?: string;
  phone?: string;
}

export interface Donor {
  _id: string;
  donorCode: string;
  fullName: string;
  dateOfBirth?: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  emergencyContact?: EmergencyContact;
  status: DonorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDonorInput {
  fullName: string;
  dateOfBirth?: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  emergencyContact?: EmergencyContact;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Public voluntary donor self-registration.
 */
export async function registerDonor(
  input: CreateDonorInput,
): Promise<{ success: boolean; donorCode: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/donors`, {
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
      : body.message || 'Failed to register donor';
    throw new Error(errorMsg);
  }

  return body.data;
}

/**
 * Internal Staff / Admin query of donors with search and filters.
 */
export async function fetchDonors(filters?: {
  search?: string;
  bloodGroup?: string;
  status?: string;
}): Promise<Donor[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.bloodGroup) params.append('bloodGroup', filters.bloodGroup);
  if (filters?.status) params.append('status', filters.status);

  const url = `${API_BASE_URL}/donors${
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
    throw new Error(body.message || 'Failed to retrieve donor list');
  }

  return body.data;
}

/**
 * Internal Staff / Admin query for a single donor.
 */
export async function fetchDonorById(id: string): Promise<Donor> {
  const res = await fetch(`${API_BASE_URL}/donors/${id}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to retrieve donor details');
  }

  return body.data;
}

/**
 * Internal Staff / Admin update donor status (ACTIVE / INACTIVE).
 */
export async function updateDonorStatus(
  id: string,
  status: DonorStatus,
): Promise<Donor> {
  const res = await fetch(`${API_BASE_URL}/donors/${id}/status`, {
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
      : body.message || 'Failed to update donor status';
    throw new Error(errorMsg);
  }

  return body.data;
}
