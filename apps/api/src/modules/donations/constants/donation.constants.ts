export enum DonationType {
  WHOLE_BLOOD = 'WHOLE_BLOOD',
}

export enum DonationStatus {
  RECORDED = 'RECORDED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Strict valid status transitions for donations
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
  [DonationStatus.COMPLETED]: [], // Terminal state
  [DonationStatus.CANCELLED]: [], // Terminal state
};
