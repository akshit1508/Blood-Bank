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

export enum DonorScreeningDecision {
  PENDING = 'PENDING',
  SELECTED = 'SELECTED',
  TEMPORARILY_DEFERRED = 'TEMPORARILY_DEFERRED',
  PERMANENTLY_DEFERRED = 'PERMANENTLY_DEFERRED',
}

export interface DonorVitals {
  weightKg: number;
  heightCm?: number;
  hemoglobinGdl: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  pulseBpm: number;
  temperatureCelsius: number;
  generalAppearance?: string;
  veinAccess?: string;
}

export interface MedicalQuestionnaire {
  hasDonatedBefore?: boolean;
  feelingWellToday?: boolean;
  recentIllnessOrFever?: boolean;
  takingMedications?: boolean;
  medicationDetails?: string;
  majorSurgeryOrDentalRecent?: boolean;
  tattooPiercingLast12Months?: boolean;
  recentVaccinations?: boolean;
  cardiacOrRespiratoryDisease?: boolean;
  diabetesOrHypertension?: boolean;
  bleedingDisorderOrEpilepsy?: boolean;
  historyOfJaundiceOrHepatitis?: boolean;
  highRiskBehaviorOrSTI?: boolean;
  malariaTreatmentOrTravelHistory?: boolean;
  pregnantOrLactating?: boolean;
  alcoholIntakeLast24Hours?: boolean;
  healthRemarks?: string;
}

export interface DonorScreening {
  _id: string;
  screeningCode: string;
  donorId: string;
  donorCode: string;
  donorFullName: string;
  donorBloodGroup?: string;
  donorGender?: string;
  campaignId?: string;
  vitals: DonorVitals;
  questionnaire: MedicalQuestionnaire;
  consent: {
    consentAcknowledged: boolean;
    donorSignatureConfirmed: boolean;
    consentTimestamp: string;
  };
  decision: DonorScreeningDecision;
  deferralType?: 'TEMPORARY' | 'PERMANENT';
  deferralReason?: string;
  deferredUntil?: string;
  decisionRemarks?: string;
  collectionStatus: 'PENDING_COLLECTION' | 'COLLECTED' | 'CANCELLED';
  linkedDonationId?: string;
  linkedDonationCode?: string;
  screenedByName: string;
  screenedByRole: string;
  screenedAt: string;
  createdAt: string;
}

export interface CreateDonorScreeningInput {
  donorId: string;
  campaignId?: string;
  vitals: DonorVitals;
  questionnaire?: MedicalQuestionnaire;
  consent?: {
    consentAcknowledged?: boolean;
    donorSignatureConfirmed?: boolean;
  };
  decision?: DonorScreeningDecision;
  deferralType?: 'TEMPORARY' | 'PERMANENT';
  deferralReason?: string;
  deferredUntil?: string;
  decisionRemarks?: string;
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
  deferralStatus?: 'NONE' | 'TEMPORARY' | 'PERMANENT';
  deferredUntil?: string;
  deferralReason?: string;
  lastScreeningDate?: string;
  lastScreeningDecision?: string;
  registeredBy?: string;
  registeredByName?: string;
  registeredByRole?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedByRole?: string;
  verifiedAt?: string;
  updatedByName?: string;
  updatedByRole?: string;
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

import { getAuthHeaders } from './auth-api';

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
      ...getAuthHeaders(),
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
      ...getAuthHeaders(),
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
      ...getAuthHeaders(),
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


/**
 * Builds a direct wa.me WhatsApp Click-to-Chat URL pre-filled with the canonical
 * donor verification message for instant dispatch via WhatsApp Web or mobile app.
 */
export function buildDonorWhatsAppUrl(phone: string, fullName: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  const formattedPhone =
    digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

  const message = `🩸 *Blood Donor Registration Verified*

Dear ${fullName},

We are happy to inform you that your donor registration has been successfully verified by our blood bank.

You are now registered as an active blood donor with us.

You may visit the blood bank for blood donation when you are eligible, subject to the required donation interval and final screening by our staff.

Your willingness to donate blood can help save lives.

Thank you for your support and for being willing to contribute to the community. ❤️

— Blood Bank Team`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Checks donor eligibility before scheduling or conducting screening.
 */
export async function checkDonorEligibility(
  donorId: string,
  donationDate?: string,
  donationType?: string,
): Promise<any> {
  const params = new URLSearchParams();
  if (donationDate) params.append('donationDate', donationDate);
  if (donationType) params.append('donationType', donationType);

  const res = await fetch(`${API_BASE_URL}/donors/${donorId}/eligibility?${params.toString()}`, {
    headers: getAuthHeaders(),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Donor is ineligible to donate blood.';
    throw new Error(errorMsg);
  }

  return body.data;
}

/**
 * Submits clinical pre-donation screening & examination.
 */
export async function createDonorScreening(
  donorId: string,
  input: CreateDonorScreeningInput,
): Promise<{ screening: DonorScreening; donor: Donor; autoEvaluation: any }> {
  const res = await fetch(`${API_BASE_URL}/donors/${donorId}/screenings`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to record donor screening';
    throw new Error(errorMsg);
  }

  return {
    screening: body.data,
    donor: body.donor,
    autoEvaluation: body.autoEvaluation,
  };
}

/**
 * Fetches all screening records for a donor.
 */
export async function fetchDonorScreenings(
  donorId: string,
): Promise<DonorScreening[]> {
  const res = await fetch(`${API_BASE_URL}/donors/${donorId}/screenings`, {
    headers: getAuthHeaders(),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to fetch donor screenings');
  }

  return body.data || [];
}

/**
 * Fetches today's active passing screening record for a donor ready for collection.
 */
export async function fetchActiveScreeningForDonor(
  donorId: string,
): Promise<DonorScreening | null> {
  const res = await fetch(`${API_BASE_URL}/donors/${donorId}/screenings/active`, {
    headers: getAuthHeaders(),
  });

  const body = await res.json();
  if (!res.ok) {
    return null;
  }

  return body.data || null;
}
