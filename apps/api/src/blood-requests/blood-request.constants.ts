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

// Allowed state transitions map
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
    BloodRequestStatus.RESERVED,
    BloodRequestStatus.CANCELLED,
  ],
  [BloodRequestStatus.RESERVED]: [
    BloodRequestStatus.ISSUED,
    BloodRequestStatus.CANCELLED,
  ],
  [BloodRequestStatus.ISSUED]: [
    BloodRequestStatus.COMPLETED,
  ],
  [BloodRequestStatus.COMPLETED]: [], // Terminal state
  [BloodRequestStatus.REJECTED]: [],  // Terminal state
  [BloodRequestStatus.CANCELLED]: [], // Terminal state
};
