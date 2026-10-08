import { Gender } from '../../modules/donors/constants/donor.constants';

/**
 * Authoritative Indian Blood Donation Criteria for WHOLE_BLOOD
 */
export const MIN_WHOLE_BLOOD_DONOR_AGE = 18;
export const MAX_WHOLE_BLOOD_DONOR_AGE = 65;
export const SENIOR_FIRST_TIME_SCREENING_AGE = 60;

export const MALE_WHOLE_BLOOD_INTERVAL_DAYS = 90;
export const FEMALE_WHOLE_BLOOD_INTERVAL_DAYS = 120;
export const OTHER_WHOLE_BLOOD_INTERVAL_DAYS = 120;

/**
 * Resolves whole-blood donation interval in days by donor gender.
 */
export function getWholeBloodIntervalDays(gender: Gender): number {
  switch (gender) {
    case Gender.MALE:
      return MALE_WHOLE_BLOOD_INTERVAL_DAYS;
    case Gender.FEMALE:
      return FEMALE_WHOLE_BLOOD_INTERVAL_DAYS;
    case Gender.OTHER:
    default:
      return OTHER_WHOLE_BLOOD_INTERVAL_DAYS;
  }
}

/**
 * Calculates exact completed age in full years based on birthday and reference date.
 * Accurately accounts for month and day boundaries.
 */
export function calculateCompletedAge(
  dob: Date | string,
  referenceDate: Date = new Date(),
): number {
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

/**
 * Calculates calendar day difference between two dates in UTC.
 */
export function getCalendarDaysDifference(earlier: Date, later: Date): number {
  const utcEarlier = Date.UTC(
    earlier.getUTCFullYear(),
    earlier.getUTCMonth(),
    earlier.getUTCDate(),
  );
  const utcLater = Date.UTC(
    later.getUTCFullYear(),
    later.getUTCMonth(),
    later.getUTCDate(),
  );
  return Math.floor((utcLater - utcEarlier) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates next eligible donation date based on last completed donation date and gender.
 */
export function calculateNextEligibleDate(
  lastDonationDate: Date,
  gender: Gender,
): Date {
  const intervalDays = getWholeBloodIntervalDays(gender);
  const utcLast = Date.UTC(
    lastDonationDate.getUTCFullYear(),
    lastDonationDate.getUTCMonth(),
    lastDonationDate.getUTCDate(),
  );
  return new Date(utcLast + intervalDays * 24 * 60 * 60 * 1000);
}
