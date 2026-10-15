import { getAuthHeaders } from './auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export type VolunteerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
export type VolunteerAttendanceStatus = 'PENDING' | 'PRESENT' | 'ABSENT';

export type VolunteerAvailability = 'WEEKENDS' | 'WEEKDAYS' | 'ANYTIME' | 'ON_CALL';

export type VolunteerRole =
  | 'GENERAL'
  | 'REGISTRATION_DESK'
  | 'DONOR_CARE'
  | 'LOGISTICS'
  | 'REFRESHMENTS'
  | 'FIRST_AID'
  | 'CROWD_COORDINATION';

export const VOLUNTEER_ROLE_LABELS: Record<string, string> = {
  GENERAL: 'General Support Volunteer',
  REGISTRATION_DESK: 'Registration & Triage Desk',
  DONOR_CARE: 'Donor Care & Recovery',
  LOGISTICS: 'Logistics & Camp Setup',
  REFRESHMENTS: 'Refreshments & Nutrition',
  FIRST_AID: 'First Aid & Vitals Support',
  CROWD_COORDINATION: 'Crowd & Queue Coordination',
};

export interface Volunteer {
  _id: string;
  volunteerCode: string;
  fullName: string;
  phone: string;
  email?: string;
  bloodGroup?: string;
  gender?: string;
  city: string;
  address?: string;
  occupation?: string;
  availability?: VolunteerAvailability;
  skills?: string;
  preferredRole?: VolunteerRole;
  status: VolunteerStatus;
  rejectionReason?: string;
  adminNotes?: string;
  registeredVia: 'PUBLIC_PORTAL' | 'ADMIN_MANUAL' | 'CAMPAIGN_DIRECT';
  verifiedAt?: string;
  verifiedBy?: string;
  assignedCampaignsCount: number;
  attendedCampaignsCount: number;
  createdAt: string;
  updatedAt: string;
  participations?: CampaignVolunteerAssignment[];
}

export interface CampaignVolunteerAssignment {
  _id: string;
  campaignId: string | any;
  campaignCode: string;
  volunteerId: string;
  volunteerCode: string;
  volunteerName: string;
  volunteerPhone: string;
  volunteerBloodGroup?: string;
  role: string;
  attendanceStatus: VolunteerAttendanceStatus;
  attendanceMarkedAt?: string;
  attendanceMarkedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignVolunteersResponse {
  campaign: {
    _id: string;
    name: string;
    campaignCode: string;
    venue: string;
    city: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  summary: {
    totalAssigned: number;
    present: number;
    absent: number;
    pending: number;
  };
  volunteers: CampaignVolunteerAssignment[];
}

export interface VolunteersListResponse {
  volunteers: Volunteer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

export interface PublicRegisterVolunteerPayload {
  fullName: string;
  phone: string;
  email?: string;
  bloodGroup?: string;
  gender?: string;
  city: string;
  address?: string;
  occupation?: string;
  availability?: VolunteerAvailability;
  skills?: string;
  preferredRole?: VolunteerRole;
}

export interface AdminCreateVolunteerPayload {
  fullName: string;
  phone: string;
  email?: string;
  bloodGroup?: string;
  gender?: string;
  city: string;
  address?: string;
  occupation?: string;
  availability?: VolunteerAvailability;
  skills?: string;
  preferredRole?: VolunteerRole;
  status?: VolunteerStatus;
  adminNotes?: string;
}

export interface VerifyVolunteerPayload {
  status: 'APPROVED' | 'REJECTED';
  adminNotes?: string;
  rejectionReason?: string;
}

export interface AssignVolunteerPayload {
  volunteerId: string;
  role?: string;
  notes?: string;
}

export interface RegisterAndAssignCampaignVolunteerPayload {
  fullName: string;
  phone: string;
  email?: string;
  bloodGroup?: string;
  gender?: string;
  city: string;
  role?: string;
  notes?: string;
}

export interface UpdateAttendancePayload {
  attendanceStatus: VolunteerAttendanceStatus;
  notes?: string;
}

/**
 * Public volunteer self-registration.
 */
export async function publicRegisterVolunteer(payload: PublicRegisterVolunteerPayload) {
  const res = await fetch(`${API_BASE_URL}/volunteers/public-register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to submit volunteer application.');
  }
  return json.data;
}

/**
 * Staff/Admin query of all volunteers.
 */
export async function fetchVolunteers(params?: {
  status?: VolunteerStatus;
  city?: string;
  bloodGroup?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<VolunteersListResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.city) q.set('city', params.city);
  if (params?.bloodGroup) q.set('bloodGroup', params.bloodGroup);
  if (params?.search) q.set('search', params.search);
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE_URL}/volunteers?${q.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch volunteers.');
  }
  return json.data;
}

/**
 * Get pending applications count for notification badges.
 */
export async function fetchPendingVolunteersCount(): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/volunteers/pending-count`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    return 0;
  }
  return json.data?.pendingCount || 0;
}

/**
 * Admin manual creation of a volunteer.
 */
export async function adminCreateVolunteer(payload: AdminCreateVolunteerPayload) {
  const res = await fetch(`${API_BASE_URL}/volunteers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to register volunteer.');
  }
  return json.data;
}

/**
 * Admin verification (Approve or Reject).
 */
export async function verifyVolunteer(volunteerId: string, payload: VerifyVolunteerPayload) {
  const res = await fetch(`${API_BASE_URL}/volunteers/${encodeURIComponent(volunteerId)}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to verify volunteer.');
  }
  return json.data;
}

/**
 * Fetch volunteer by ID with participation history.
 */
export async function fetchVolunteerById(volunteerId: string): Promise<Volunteer> {
  const res = await fetch(`${API_BASE_URL}/volunteers/${encodeURIComponent(volunteerId)}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch volunteer details.');
  }
  return json.data;
}

/**
 * Fetch volunteers assigned to a campaign with attendance summary.
 */
export async function fetchCampaignVolunteers(campaignId: string): Promise<CampaignVolunteersResponse> {
  const res = await fetch(`${API_BASE_URL}/volunteers/campaign/${encodeURIComponent(campaignId)}`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch campaign volunteers.');
  }
  return json.data;
}

/**
 * Assign existing volunteer to campaign.
 */
export async function assignVolunteerToCampaign(campaignId: string, payload: AssignVolunteerPayload) {
  const res = await fetch(`${API_BASE_URL}/volunteers/campaign/${encodeURIComponent(campaignId)}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to assign volunteer to campaign.');
  }
  return json.data;
}

/**
 * Register new volunteer directly on campaign page and assign them to the drive.
 */
export async function registerAndAssignCampaignVolunteer(
  campaignId: string,
  payload: RegisterAndAssignCampaignVolunteerPayload,
) {
  const res = await fetch(
    `${API_BASE_URL}/volunteers/campaign/${encodeURIComponent(campaignId)}/register-and-assign`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    },
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to register and assign campaign volunteer.');
  }
  return json.data;
}

/**
 * Mark volunteer attendance (PRESENT / ABSENT).
 */
export async function updateVolunteerAttendance(
  campaignId: string,
  assignmentId: string,
  payload: UpdateAttendancePayload,
) {
  const res = await fetch(
    `${API_BASE_URL}/volunteers/campaign/${encodeURIComponent(campaignId)}/attendance/${encodeURIComponent(assignmentId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    },
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to update volunteer attendance.');
  }
  return json.data;
}

/**
 * Remove volunteer assignment from campaign.
 */
export async function removeVolunteerFromCampaign(campaignId: string, assignmentId: string) {
  const res = await fetch(
    `${API_BASE_URL}/volunteers/campaign/${encodeURIComponent(campaignId)}/assignment/${encodeURIComponent(assignmentId)}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
    },
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to remove volunteer from campaign.');
  }
  return json.data;
}

/**
 * Generates formatted WhatsApp broadcast message for campaign volunteers.
 */
export function buildCampaignWhatsAppMessage(campaign: {
  name: string;
  campaignCode: string;
  venue: string;
  city: string;
  startDate: string;
  endDate?: string;
  targetDonations?: number;
}): string {
  const dateStr = campaign.startDate
    ? new Date(campaign.startDate).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Upcoming';

  const timeStr = campaign.startDate
    ? new Date(campaign.startDate).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '09:00 AM';

  return `🩸 *VOLUNTEER INVITATION — BLOOD BANK CAMPAIGN DRIVE* 🩸

Dear Volunteer Team,

You are cordially invited to support our upcoming voluntary blood donation drive!

📋 *Campaign:* ${campaign.name} (${campaign.campaignCode})
📅 *Date:* ${dateStr}
⏰ *Reporting Time:* ${timeStr}
📍 *Venue:* ${campaign.venue}, ${campaign.city}
🎯 *Target Collections:* ${campaign.targetDonations || 100} units

*Required Volunteer Support:*
• Registration & Donor Triage Desk
• Donor Hydration & Recovery Care
• Camp Logistics & Queue Coordination

*Important Instructions:*
1. Please report 30 minutes prior to camp commencement.
2. Wear comfortable clothing and your Volunteer ID badge.
3. Your presence saves lives!

Kindly confirm your attendance.
*Blood Bank Volunteer Coordination Team*`;
}

/**
 * Builds direct WhatsApp URL for sending message to a specific volunteer or sharing to group.
 */
export function buildWhatsAppLink(phone?: string, message?: string): string {
  const encoded = encodeURIComponent(message || '');
  if (!phone) {
    return `https://api.whatsapp.com/send?text=${encoded}`;
  }
  // Sanitize phone number (strip spaces, dashes, ensure country code 91 if 10 digits)
  let clean = phone.replace(/[^\d+]/g, '');
  if (clean.length === 10) {
    clean = `91${clean}`;
  } else if (clean.startsWith('+')) {
    clean = clean.substring(1);
  }
  return `https://wa.me/${clean}?text=${encoded}`;
}
