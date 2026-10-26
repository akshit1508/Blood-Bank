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

import {
  evaluateComponentCompatibility,
  isBloodGroupCompatible,
  ComponentCompatibilityEvaluation,
} from '../../inventory/services/unit-issue-validation.service';

export {
  evaluateComponentCompatibility,
  isBloodGroupCompatible,
  ComponentCompatibilityEvaluation,
};

/**
 * General ABO/RhD Red Blood Cell (PRBC) Compatibility Reference.
 *
 * IMPORTANT MEDICAL SAFETY NOTICE:
 * This reference reflects general red-cell antigen/antibody expectations for PRBC (Packed Red Blood Cells).
 * It is an educational and pre-selection reference ONLY.
 * - DOES NOT apply to Whole Blood, which strictly requires identical ABO/RhD matching due to donor plasma.
 * - DOES NOT apply to Plasma (FFP) or Platelet components, which follow plasma compatibility rules.
 * - Does NOT replace serological/laboratory crossmatching or patient-specific antibody screens.
 * - RhD and ABO compatibility alone do NOT establish clinical compatibility.
 */
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

/**
 * Checks whether a given component is a packed red blood cell product (PRBC)
 * Note: WHOLE_BLOOD is NOT an isolated RBC component; it contains donor plasma antibodies.
 */
export function isRbcComponent(component: string): boolean {
  const comp = component?.toUpperCase();
  return (
    comp === 'PRBC' ||
    comp === 'PACKED_CELLS' ||
    comp === 'RED_BLOOD_CELLS' ||
    comp === 'PACKED_RED_BLOOD_CELLS'
  );
}

/**
 * Evaluates component-specific ABO/RhD eligibility using the authoritative compatibility engine.
 */
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
