import { getAuthHeaders } from './auth-api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export enum CrossmatchStatus {
  PENDING_SAMPLE_VERIFICATION = 'PENDING_SAMPLE_VERIFICATION',
  SAMPLE_VERIFIED = 'SAMPLE_VERIFIED',
  UNIT_SELECTED = 'UNIT_SELECTED',
  TESTING_IN_PROGRESS = 'TESTING_IN_PROGRESS',
  RESULT_RECORDED = 'RESULT_RECORDED',
  AUTHORIZED_COMPATIBLE = 'AUTHORIZED_COMPATIBLE',
  INCOMPATIBLE = 'INCOMPATIBLE',
  INVALID_SAMPLE = 'INVALID_SAMPLE',
  INCONCLUSIVE = 'INCONCLUSIVE',
  RESERVED = 'RESERVED',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}

export enum SampleCondition {
  VALID = 'VALID',
  HEMOLYZED = 'HEMOLYZED',
  LIPEMIC = 'LIPEMIC',
  ICTERIC = 'ICTERIC',
  INSUFFICIENT_VOLUME = 'INSUFFICIENT_VOLUME',
  INCORRECTLY_LABELLED = 'INCORRECTLY_LABELLED',
  EXPIRED = 'EXPIRED',
  CLOTTED = 'CLOTTED',
}

export enum AntibodyScreenResult {
  NEGATIVE = 'NEGATIVE',
  POSITIVE = 'POSITIVE',
  INCONCLUSIVE = 'INCONCLUSIVE',
  NOT_PERFORMED = 'NOT_PERFORMED',
}

export enum CrossmatchMethod {
  IMMEDIATE_SPIN = 'IMMEDIATE_SPIN',
  AHG_COOMBS = 'AHG_COOMBS',
  GEL_CARD = 'GEL_CARD',
  COMPUTERIZED_ELECTRONIC = 'COMPUTERIZED_ELECTRONIC',
  TUBE_AHG_37C = 'TUBE_AHG_37C',
}

export enum CrossmatchResult {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPATIBLE = 'COMPATIBLE',
  INCOMPATIBLE = 'INCOMPATIBLE',
  INVALID = 'INVALID',
  INCONCLUSIVE = 'INCONCLUSIVE',
  CANCELLED = 'CANCELLED',
}

export enum ReviewDecision {
  COMPATIBLE_AUTHORIZED = 'COMPATIBLE_AUTHORIZED',
  INCOMPATIBLE_REJECTED = 'INCOMPATIBLE_REJECTED',
  REPEAT_REQUIRED = 'REPEAT_REQUIRED',
  SAFETY_HOLD = 'SAFETY_HOLD',
}

export const RBC_COMPATIBILITY_MATRIX: Record<string, string[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

export interface ComponentCompatibilityEvaluation {
  compatible: boolean;
  reason: string;
  ruleCategory:
    | 'IDENTICAL_MATCH'
    | 'PRBC_COMPATIBLE'
    | 'PLASMA_PLATELET_COMPATIBLE'
    | 'WHOLE_BLOOD_INCOMPATIBLE'
    | 'INCOMPATIBLE';
}

export function evaluateComponentCompatibility(
  donorGroup: string,
  recipientGroup: string,
  componentType: string = 'WHOLE_BLOOD',
): ComponentCompatibilityEvaluation {
  const normComp = (componentType || 'WHOLE_BLOOD').toUpperCase().trim();
  const dGrp = (donorGroup || '').toUpperCase().trim();
  const rGrp = (recipientGroup || '').toUpperCase().trim();

  // Rule 1: Exact identical match is always compatible across all components
  if (dGrp === rGrp) {
    return {
      compatible: true,
      reason: `Identical ABO/RhD match (${rGrp}) for ${normComp}.`,
      ruleCategory: 'IDENTICAL_MATCH',
    };
  }

  // Rule 2: Whole blood strictly requires identical ABO/RhD group match
  if (normComp === 'WHOLE_BLOOD') {
    return {
      compatible: false,
      reason: `Whole Blood transfusions strictly require identical ABO/RhD match (${rGrp}). Donor unit ${dGrp} is incompatible for WHOLE_BLOOD due to donor plasma isohemagglutinins.`,
      ruleCategory: 'WHOLE_BLOOD_INCOMPATIBLE',
    };
  }

  // Rule 3: Red Blood Cells / PRBC
  if (
    normComp === 'PRBC' ||
    normComp === 'PACKED_CELLS' ||
    normComp === 'RED_BLOOD_CELLS' ||
    normComp === 'PACKED_RED_BLOOD_CELLS'
  ) {
    const redCellCompatibility: Record<string, string[]> = {
      'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
      'O+': ['O+', 'A+', 'B+', 'AB+'],
      'A-': ['A-', 'A+', 'AB-', 'AB+'],
      'A+': ['A+', 'AB+'],
      'B-': ['B-', 'B+', 'AB-', 'AB+'],
      'B+': ['B+', 'AB+'],
      'AB-': ['AB-', 'AB+'],
      'AB+': ['AB+'],
    };

    const isMatch = redCellCompatibility[dGrp]?.includes(rGrp) ?? false;
    if (isMatch) {
      return {
        compatible: true,
        reason: `Compatible PRBC red cell match: Patient ${rGrp} can receive Donor ${dGrp} packed red cells (Subject to laboratory crossmatch).`,
        ruleCategory: 'PRBC_COMPATIBLE',
      };
    } else {
      return {
        compatible: false,
        reason: `Incompatible ABO/RhD for PRBC: Donor ${dGrp} red cells possess antigens foreign to patient ${rGrp}.`,
        ruleCategory: 'INCOMPATIBLE',
      };
    }
  }

  // Rule 4: Plasma (FFP) & Platelets
  if (
    normComp === 'FFP' ||
    normComp === 'PLATELETS' ||
    normComp === 'PLASMA' ||
    normComp === 'CRYOPRECIPITATE'
  ) {
    const plasmaCompatibility: Record<string, string[]> = {
      'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
      'AB-': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
      'A+': ['A+', 'A-', 'O+', 'O-'],
      'A-': ['A+', 'A-', 'O+', 'O-'],
      'B+': ['B+', 'B-', 'O+', 'O-'],
      'B-': ['B+', 'B-', 'O+', 'O-'],
      'O+': ['O+', 'O-'],
      'O-': ['O+', 'O-'],
    };

    const isMatch = plasmaCompatibility[dGrp]?.includes(rGrp) ?? false;
    if (isMatch) {
      return {
        compatible: true,
        reason: `Compatible plasma/platelet match: Patient ${rGrp} can receive Donor ${dGrp} ${normComp}.`,
        ruleCategory: 'PLASMA_PLATELET_COMPATIBLE',
      };
    } else {
      return {
        compatible: false,
        reason: `Incompatible ABO/RhD for ${normComp}: Donor ${dGrp} plasma contains antibodies directed against patient ${rGrp}.`,
        ruleCategory: 'INCOMPATIBLE',
      };
    }
  }

  return {
    compatible: false,
    reason: `Incompatible blood group: Donor ${dGrp} does not match patient ${rGrp} for component ${normComp}.`,
    ruleCategory: 'INCOMPATIBLE',
  };
}

export function isRbcComponent(component: string): boolean {
  const comp = component?.toUpperCase();
  return (
    comp === 'PRBC' ||
    comp === 'PACKED_CELLS' ||
    comp === 'RED_BLOOD_CELLS' ||
    comp === 'PACKED_RED_BLOOD_CELLS'
  );
}

export function checkTheoreticalRbcEligibility(
  patientGroup: string,
  donorGroup: string,
  componentType: string = 'PRBC',
): { eligible: boolean; reason: string } {
  const evalRes = evaluateComponentCompatibility(donorGroup, patientGroup, componentType);
  return {
    eligible: evalRes.compatible,
    reason: evalRes.reason,
  };
}

export interface PatientDetails {
  name: string;
  age: number;
  gender: string;
  phone?: string;
  hospitalName?: string;
  doctorName?: string;
  doctorContact?: string;
  hospitalCaseNumber?: string;
}

export interface SampleVerification {
  sampleId?: string;
  sampleCollectedAt?: string;
  sampleReceivedAt?: string;
  sampleCondition?: SampleCondition;
  isSampleValid: boolean;
  sampleIdentityVerified: boolean;
  verifiedAboRh?: string;
  antibodyScreenResult?: AntibodyScreenResult;
  antibodyScreenNotes?: string;
  sampleVerifiedAt?: string;
  sampleVerifiedBy?: string;
  sampleVerifiedByName?: string;
  sampleVerifiedByRole?: string;
  sampleVerificationNotes?: string;
}

export interface SelectedUnit {
  bloodUnitId?: any;
  unitCode?: string;
  inventoryId?: any;
  donorBloodGroup?: string;
  componentType?: string;
  expiryDate?: string;
  collectionDate?: string;
  storageLocation?: string;
  isAboRhCompatible: boolean;
  compatibilityRuleReference?: string;
  unitSelectedAt?: string;
  unitSelectedBy?: string;
  unitSelectedByName?: string;
  unitSelectedByRole?: string;
}

export interface LaboratoryTest {
  testMethod?: CrossmatchMethod;
  testPhases?: string[];
  crossmatchResult: CrossmatchResult;
  reactionGrade?: string;
  testedAt?: string;
  testedBy?: string;
  testedByName?: string;
  testedByRole?: string;
  testingNotes?: string;
  isRepeatTest: boolean;
  previousCrossmatchId?: string;
  repeatReason?: string;
}

export interface ReviewAuthorization {
  reviewStatus?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedByRole?: string;
  reviewDecision?: ReviewDecision;
  reviewNotes?: string;
}

export interface TimelineEntry {
  fromStatus: string;
  toStatus: string;
  actorId?: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  action: string;
  notes?: string;
}

export interface CrossmatchRecord {
  _id: string;
  crossmatchCode: string;
  bloodRequestId: any;
  requestCode: string;
  patient: PatientDetails;
  patientBloodGroup: string;
  requestedComponent: string;
  urgency: string;
  unitsRequested: number;
  sample: SampleVerification;
  selectedUnit: SelectedUnit;
  laboratoryTest: LaboratoryTest;
  review: ReviewAuthorization;
  reservationId?: any;
  reservationCode?: string;
  reservedAt?: string;
  bloodIssueId?: any;
  issueCode?: string;
  issuedAt?: string;
  status: CrossmatchStatus;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CrossmatchDashboardMetrics {
  pendingSampleVerification: number;
  sampleVerifiedReady: number;
  testingInProgress: number;
  resultRecordedAwaitingReview: number;
  authorizedCompatibleAwaitingIssue: number;
  incompatibleCount: number;
  invalidOrInconclusiveCount: number;
  reservedCount: number;
  issuedCount: number;
  cancelledCount: number;
  totalCount: number;
}

export interface CandidateUnit {
  inventoryId: string;
  bloodUnitId: string;
  unitCode: string;
  bloodGroup: string;
  componentType: string;
  expiryDate: string | null;
  collectionDate: string | null;
  storageLocation: string;
  isEligible: boolean;
  eligibilityReason: string;
  isTheoreticalRbcMatch: boolean;
  daysUntilExpiry: number | null;
}

export interface EligibleUnitsResponse {
  crossmatch: {
    id: string;
    crossmatchCode: string;
    requestCode: string;
    patientBloodGroup: string;
    requestedComponent: string;
    urgency: string;
  };
  candidateUnits: CandidateUnit[];
  eligibleCount: number;
  totalStockInspected: number;
}

export async function fetchCrossmatches(filters?: {
  status?: string;
  patientBloodGroup?: string;
  component?: string;
  urgency?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  crossmatches: CrossmatchRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.patientBloodGroup)
    params.append('patientBloodGroup', filters.patientBloodGroup);
  if (filters?.component) params.append('component', filters.component);
  if (filters?.urgency) params.append('urgency', filters.urgency);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const url = `${API_BASE_URL}/crossmatches${
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
    throw new Error(body.message || 'Failed to load crossmatching queue');
  }

  return body.data;
}

export async function fetchCrossmatchMetrics(): Promise<CrossmatchDashboardMetrics> {
  const res = await fetch(`${API_BASE_URL}/crossmatches/dashboard-metrics`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to load crossmatch metrics');
  }

  return body.data;
}

export async function fetchCrossmatchById(
  id: string,
): Promise<CrossmatchRecord> {
  const res = await fetch(`${API_BASE_URL}/crossmatches/${id}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || 'Failed to retrieve crossmatch details');
  }

  return body.data;
}

export async function fetchEligibleUnits(
  id: string,
): Promise<EligibleUnitsResponse> {
  const res = await fetch(`${API_BASE_URL}/crossmatches/${id}/eligible-units`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      body.message || 'Failed to inspect candidate inventory units',
    );
  }

  return body.data;
}

export async function createCrossmatch(
  bloodRequestId: string,
  sampleId?: string,
  notes?: string,
): Promise<CrossmatchRecord> {
  const res = await fetch(`${API_BASE_URL}/crossmatches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ bloodRequestId, sampleId, notes }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to initiate crossmatch';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function verifyCrossmatchSample(
  id: string,
  input: {
    sampleId: string;
    sampleCollectedAt: string;
    sampleReceivedAt: string;
    sampleCondition: SampleCondition;
    sampleIdentityVerified: boolean;
    verifiedAboRh: string;
    antibodyScreenResult: AntibodyScreenResult;
    antibodyScreenNotes?: string;
    notes?: string;
  },
): Promise<CrossmatchRecord> {
  const res = await fetch(
    `${API_BASE_URL}/crossmatches/${id}/sample-verification`,
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
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to verify sample';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function selectCrossmatchUnit(
  id: string,
  inventoryId: string,
  notes?: string,
): Promise<CrossmatchRecord> {
  const res = await fetch(`${API_BASE_URL}/crossmatches/${id}/select-unit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ inventoryId, notes }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to select donor unit';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function recordCrossmatchResult(
  id: string,
  input: {
    testMethod: CrossmatchMethod;
    testPhases?: string[];
    crossmatchResult: CrossmatchResult;
    reactionGrade?: string;
    testedAt?: string;
    testingNotes?: string;
  },
): Promise<CrossmatchRecord> {
  const res = await fetch(`${API_BASE_URL}/crossmatches/${id}/results`, {
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
      : body.message || 'Failed to record test result';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function reviewCrossmatch(
  id: string,
  input: {
    reviewDecision: ReviewDecision;
    reviewNotes: string;
  },
): Promise<CrossmatchRecord> {
  const res = await fetch(`${API_BASE_URL}/crossmatches/${id}/review`, {
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
      : body.message || 'Failed to authorize crossmatch';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function reserveCrossmatchUnit(
  id: string,
  notes?: string,
): Promise<CrossmatchRecord> {
  const res = await fetch(`${API_BASE_URL}/crossmatches/${id}/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ notes }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to reserve crossmatched unit';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function issueCrossmatchUnit(
  id: string,
  input?: {
    recipientName?: string;
    recipientHospitalId?: string;
    issueNotes?: string;
  },
): Promise<CrossmatchRecord> {
  const res = await fetch(`${API_BASE_URL}/crossmatches/${id}/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input || {}),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to issue crossmatched unit';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function cancelCrossmatch(
  id: string,
  reason: string,
): Promise<CrossmatchRecord> {
  const res = await fetch(`${API_BASE_URL}/crossmatches/${id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ reason }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to cancel crossmatch';
    throw new Error(errorMsg);
  }

  return body.data;
}

export async function orderRepeatCrossmatch(
  id: string,
  repeatReason: string,
): Promise<CrossmatchRecord> {
  const res = await fetch(`${API_BASE_URL}/crossmatches/${id}/repeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ repeatReason }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to order repeat crossmatch';
    throw new Error(errorMsg);
  }

  return body.data;
}
