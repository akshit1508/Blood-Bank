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
  PRBC = 'PRBC', // Packed Red Blood Cells
  FFP = 'FFP', // Fresh Frozen Plasma
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

// Operational milestones that must NOT be reached via generic PATCH /status endpoint
export const OPERATIONAL_MILESTONE_STATUSES: BloodRequestStatus[] = [
  BloodRequestStatus.RESERVED,
  BloodRequestStatus.ISSUED,
  BloodRequestStatus.COMPLETED,
];

// Allowed state transitions map for generic PATCH /status endpoint
export const ALLOWED_STATUS_TRANSITIONS: Record<BloodRequestStatus, BloodRequestStatus[]> = {
  [BloodRequestStatus.REQUESTED]: [
    BloodRequestStatus.VERIFIED,
    BloodRequestStatus.REJECTED,
    BloodRequestStatus.CANCELLED,
  ],
  [BloodRequestStatus.VERIFIED]: [
    BloodRequestStatus.APPROVED,
    BloodRequestStatus.REJECTED,
    BloodRequestStatus.CANCELLED,
  ],
  [BloodRequestStatus.APPROVED]: [
    BloodRequestStatus.CANCELLED,
    BloodRequestStatus.REJECTED,
  ],
  [BloodRequestStatus.RESERVED]: [
    BloodRequestStatus.CANCELLED,
  ],
  [BloodRequestStatus.ISSUED]: [], // Cannot change status via generic PATCH; must use POST /complete
  [BloodRequestStatus.COMPLETED]: [], // Terminal state
  [BloodRequestStatus.REJECTED]: [],  // Terminal state
  [BloodRequestStatus.CANCELLED]: [], // Terminal state
};
