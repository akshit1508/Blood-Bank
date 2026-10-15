export enum VolunteerStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  INACTIVE = 'INACTIVE',
}

export enum VolunteerAttendanceStatus {
  PENDING = 'PENDING',
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
}

export enum VolunteerAvailability {
  WEEKENDS = 'WEEKENDS',
  WEEKDAYS = 'WEEKDAYS',
  ANYTIME = 'ANYTIME',
  ON_CALL = 'ON_CALL',
}

export enum VolunteerRole {
  GENERAL = 'GENERAL',
  REGISTRATION_DESK = 'REGISTRATION_DESK',
  DONOR_CARE = 'DONOR_CARE',
  LOGISTICS = 'LOGISTICS',
  REFRESHMENTS = 'REFRESHMENTS',
  FIRST_AID = 'FIRST_AID',
  CROWD_COORDINATION = 'CROWD_COORDINATION',
}

export const VOLUNTEER_ROLE_LABELS: Record<VolunteerRole, string> = {
  [VolunteerRole.GENERAL]: 'General Volunteer',
  [VolunteerRole.REGISTRATION_DESK]: 'Registration & Triage Desk',
  [VolunteerRole.DONOR_CARE]: 'Donor Care & Recovery',
  [VolunteerRole.LOGISTICS]: 'Logistics & Setup',
  [VolunteerRole.REFRESHMENTS]: 'Refreshments & Nutrition',
  [VolunteerRole.FIRST_AID]: 'First Aid & Vitals Support',
  [VolunteerRole.CROWD_COORDINATION]: 'Crowd & Queue Coordination',
};
