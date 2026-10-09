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
  phone?: string;
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

export async function completeBloodRequest(
  id: string,
  notes?: string,
): Promise<BloodRequest> {
  const res = await fetch(`${API_BASE_URL}/blood-requests/${id}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ notes }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to complete blood request';
    throw new Error(errorMsg);
  }

  return body.data;
}

export interface MatchingBloodUnit {
  inventoryId: string;
  bloodUnitId: string;
  unitCode: string;
  bloodGroup: string;
  componentType: string;
  expiryDate: string | null;
  storageLocation: string;
  status: string;
}

export interface BloodRequestMatchData {
  request: {
    id: string;
    requestCode: string;
    bloodGroup: string;
    componentType: string;
    unitsRequested: number;
    status: string;
  };
  matchingUnits: MatchingBloodUnit[];
  availableUnits: number;
  unitsRequested: number;
  canFulfill: boolean;
}

export async function fetchBloodRequestMatches(
  id: string,
): Promise<BloodRequestMatchData> {
  const res = await fetch(`${API_BASE_URL}/blood-requests/${id}/matches`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      body.message || 'Failed to retrieve matching inventory units',
    );
  }

  return body.data;
}

export enum ReservationStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export interface ReservedUnit {
  inventoryId: string;
  bloodUnitId: string;
  unitCode: string;
  bloodGroup: string;
  componentType: string;
  status: string;
}

export interface ReservationData {
  _id?: string;
  reservationCode: string;
  bloodRequestId: string;
  requestCode: string;
  status: ReservationStatus;
  reservedUnits: ReservedUnit[];
  reservedAt: string;
  expiresAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
}

export async function reserveBloodUnits(
  requestId: string,
  inventoryIds: string[],
): Promise<ReservationData> {
  const res = await fetch(
    `${API_BASE_URL}/blood-requests/${requestId}/reservations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ inventoryIds }),
    },
  );

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to reserve blood units';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function fetchBloodRequestReservations(
  requestId: string,
): Promise<ReservationData[]> {
  const res = await fetch(
    `${API_BASE_URL}/blood-requests/${requestId}/reservations`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      body.message || 'Failed to retrieve reservations for request',
    );
  }

  return body.data;
}

export async function cancelReservation(
  reservationId: string,
  reason?: string,
): Promise<ReservationData> {
  const res = await fetch(`${API_BASE_URL}/reservations/${reservationId}/cancel`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to cancel reservation';
    throw new Error(errorMsg);
  }

  return body.data;
}

export interface IssuedUnit {
  inventoryId: string;
  bloodUnitId: string;
  unitCode: string;
  bloodGroup: string;
  componentType: string;
  volume?: number;
  status: string;
}

export interface BloodIssueData {
  _id: string;
  issueCode: string;
  bloodRequestId: string;
  requestCode: string;
  reservationId: string;
  reservationCode: string;
  status: string;
  issuedUnits: IssuedUnit[];
  issuedAt: string;
  issuedBy?: string | null;
  remarks?: string | null;
  createdAt: string;
}

export async function issueReservedBlood(
  reservationId: string,
  remarks?: string,
  issuedBy?: string,
): Promise<BloodIssueData> {
  const res = await fetch(`${API_BASE_URL}/reservations/${reservationId}/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ remarks, issuedBy }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to issue blood units';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function fetchBloodIssuesByRequest(
  requestId: string,
): Promise<BloodIssueData[]> {
  const res = await fetch(
    `${API_BASE_URL}/blood-requests/${requestId}/issues`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      body.message || 'Failed to retrieve blood issues for request',
    );
  }

  return body.data || [];
}

/**
 * Normalizes phone numbers for WhatsApp wa.me links.
 * Prefixes 10-digit Indian numbers with 91.
 */
export function formatWhatsAppPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
}

export type BloodRequestNotificationType =
  | 'SUBMISSION'
  | 'CONFIRMATION'
  | 'REJECTION';

export interface BuildBloodRequestWhatsAppUrlParams {
  recipientPhone: string;
  recipientName: string;
  recipientRole?: 'RELATIVE' | 'PATIENT' | string;
  request: {
    requestCode: string;
    patientName: string;
    bloodGroup: string;
    componentType: string;
    unitsRequested: number;
    hospitalName: string;
    status?: string;
    statusReason?: string;
  };
  type: BloodRequestNotificationType;
}

/**
 * Builds a direct wa.me WhatsApp Click-to-Chat URL for blood request notifications
 * (Submission receipt, Approval/Confirmation, or Rejection) without any .env credentials.
 */
export function buildBloodRequestWhatsAppUrl({
  recipientPhone,
  recipientName,
  recipientRole,
  request,
  type,
}: BuildBloodRequestWhatsAppUrlParams): string {
  const formattedPhone = formatWhatsAppPhone(recipientPhone);
  const roleLabel = recipientRole ? ` (${recipientRole})` : '';

  let message = '';

  if (type === 'CONFIRMATION') {
    message = `🩸 *Blood Bank — Blood Request Confirmed*

Dear ${recipientName}${roleLabel},

We are pleased to inform you that the blood request for *${request.patientName}* has been verified and APPROVED by our blood bank.

📋 *Request Code*: ${request.requestCode}
🩸 *Blood Group*: ${request.bloodGroup} (${request.componentType})
📦 *Units*: ${request.unitsRequested}
🏥 *Hospital*: ${request.hospitalName}
✅ *Status*: ${request.status || 'APPROVED'}
${request.statusReason ? `📝 *Notes*: ${request.statusReason}\n` : ''}
Please coordinate with our blood bank desk or your hospital administration for collection and issue formalities.

Thank you,
— Blood Bank Team`;
  } else if (type === 'REJECTION') {
    message = `🩸 *Blood Bank — Blood Request Update*

Dear ${recipientName}${roleLabel},

Regarding the blood request for *${request.patientName}* (Request Code: *${request.requestCode}*):

❌ *Status*: REJECTED
🩸 *Blood Group*: ${request.bloodGroup} (${request.componentType})
📦 *Units*: ${request.unitsRequested}
🏥 *Hospital*: ${request.hospitalName}
⚠️ *Reason*: ${request.statusReason || 'Requested units currently unavailable or requirements not met'}

If you need urgent assistance or replacement donor guidance, please contact our emergency blood bank helpline immediately.

— Blood Bank Team`;
  } else {
    // SUBMISSION
    message = `🩸 *Blood Bank — Blood Request Received*

Dear ${recipientName}${roleLabel},

Your blood request has been successfully registered with our blood bank.

📋 *Request Code*: ${request.requestCode}
👤 *Patient*: ${request.patientName}
🩸 *Blood Group*: ${request.bloodGroup} (${request.componentType})
📦 *Units Requested*: ${request.unitsRequested}
🏥 *Hospital*: ${request.hospitalName}
⏱️ *Status*: REQUESTED (Under Review)

Our staff is currently reviewing the request and checking available blood inventory. We will update you shortly.

— Blood Bank Team`;
  }

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

