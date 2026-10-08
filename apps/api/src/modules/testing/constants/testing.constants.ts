export enum TestingStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum TestingDecision {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum TestResultStatus {
  PENDING = 'PENDING',
  PASS = 'PASS',
  FAIL = 'FAIL',
}

export interface RequiredTestDefinition {
  testCode: string;
  testName: string;
  description: string;
}

/**
 * Configured default blood screening test panel for the blood bank.
 *
 * NOTE: The final required screening test panel must be confirmed against the blood bank's
 * approved Standard Operating Procedure (SOP) and applicable regional regulatory requirements.
 * This panel is centrally maintained to remain configurable.
 *
 * The software records authorized laboratory outcomes (PASS, FAIL, PENDING) only and does
 * not compute or enforce clinical cutoffs, thresholds, or medical interpretations.
 */
export const REQUIRED_BLOOD_TESTS: RequiredTestDefinition[] = [
  {
    testCode: 'HIV',
    testName: 'Human Immunodeficiency Virus (HIV-1/2)',
    description: 'Serological/NAT screening for HIV antibody and antigen',
  },
  {
    testCode: 'HBV',
    testName: 'Hepatitis B Surface Antigen (HBsAg)',
    description: 'Serological screening for Hepatitis B Virus surface antigen',
  },
  {
    testCode: 'HCV',
    testName: 'Hepatitis C Virus (HCV)',
    description: 'Serological/NAT screening for Hepatitis C antibodies',
  },
  {
    testCode: 'SYPHILIS',
    testName: 'Syphilis (VDRL / RPR / TPHA)',
    description: 'Serological screening for Treponema pallidum antibodies',
  },
  {
    testCode: 'MALARIA',
    testName: 'Malaria Parasite (MP / Antigen)',
    description: 'Screening for Plasmodium species parasite or antigen',
  },
];
