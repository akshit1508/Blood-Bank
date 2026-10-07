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

export enum BloodComponent {
  WHOLE_BLOOD = 'WHOLE_BLOOD',
  PRBC = 'PRBC',
  FFP = 'FFP',
  PLATELETS = 'PLATELETS',
}

export enum RequestPriority {
  CRITICAL_EMERGENCY = 'CRITICAL_EMERGENCY',
  URGENT = 'URGENT',
  ROUTINE = 'ROUTINE',
}

export enum BloodRequestStatus {
  REQUESTED = 'REQUESTED',
  VERIFIED = 'VERIFIED',
  APPROVED = 'APPROVED',
  RESERVED = 'RESERVED',
  ISSUED = 'ISSUED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface PatientDetails {
  name: string;
  age: number;
  gender: string;
}

export interface ContactPerson {
  name: string;
  phone: string;
  relationship: string;
}

export interface BloodRequest {
  _id: string;
  requestCode: string;
  patient: PatientDetails;
  bloodGroup: BloodGroup;
  componentType: BloodComponent;
  unitsRequested: number;
  hospitalName: string;
  doctorName: string;
  doctorContact?: string;
  hospitalCaseNumber?: string;
  priority: RequestPriority;
  contactPerson: ContactPerson;
  requiredDate: string;
  medicalJustification?: string;
  additionalNotes?: string;
  status: BloodRequestStatus;
  statusReason?: string;
  statusUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBloodRequestInput {
  patient: PatientDetails;
  bloodGroup: BloodGroup;
  componentType: BloodComponent;
  unitsRequested: number;
  hospitalName: string;
  doctorName: string;
  doctorContact?: string;
  hospitalCaseNumber?: string;
  priority: RequestPriority;
  contactPerson: ContactPerson;
  requiredDate: string;
  medicalJustification?: string;
  additionalNotes?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function createBloodRequest(
  input: CreateBloodRequestInput,
): Promise<BloodRequest> {
  const res = await fetch(`${API_BASE_URL}/blood-requests`, {
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
      : body.message || 'Failed to submit blood request';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function fetchBloodRequests(filters?: {
  status?: string;
  bloodGroup?: string;
}): Promise<BloodRequest[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.bloodGroup) params.append('bloodGroup', filters.bloodGroup);

  const url = `${API_BASE_URL}/blood-requests${
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
    throw new Error(body.message || 'Failed to load blood requests');
  }

  return body.data;
}

export async function fetchBloodRequestById(id: string): Promise<BloodRequest> {
  const res = await fetch(`${API_BASE_URL}/blood-requests/${id}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to retrieve blood request details');
  }

  return body.data;
}

export async function updateBloodRequestStatus(
  id: string,
  status: BloodRequestStatus,
  statusReason?: string,
): Promise<BloodRequest> {
  const res = await fetch(`${API_BASE_URL}/blood-requests/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ status, statusReason }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to update request status';
    throw new Error(errorMsg);
  }

  return body.data;
}
