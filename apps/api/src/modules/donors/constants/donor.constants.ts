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
