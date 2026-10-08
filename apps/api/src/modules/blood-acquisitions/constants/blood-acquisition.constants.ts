/**
 * Blood Acquisition Module Constants — Phase 6D
 *
 * Centralized configuration for the External Blood Acquisition / Receipt module.
 * This module handles blood received from external sources that is NOT a donor donation
 * within this system.
 */

/**
 * Authorized external source types for external blood receipts.
 * Use these specific, recognized categories only.
 */
export enum ExternalSourceType {
  BLOOD_BANK = 'BLOOD_BANK',
  HOSPITAL = 'HOSPITAL',
  BLOOD_ORGANIZATION = 'BLOOD_ORGANIZATION',
  GOVERNMENT_BLOOD_CENTRE = 'GOVERNMENT_BLOOD_CENTRE',
  OTHER = 'OTHER',
}

/**
 * Identifies the origin source of a Blood Unit.
 * Extends the traceability model to support both internal donation
 * and external acquisition origins.
 */
export enum BloodUnitSourceType {
  DONATION = 'DONATION',
  EXTERNAL_RECEIPT = 'EXTERNAL_RECEIPT',
}

/**
 * High-level status of a Blood Acquisition Receipt.
 */
export enum BloodAcquisitionStatus {
  /** Blood units have been generated and are being processed (testing or direct inventory) */
  PROCESSING = 'PROCESSING',
  /** All blood units generated from this receipt have been finalized (approved/rejected) */
  COMPLETED = 'COMPLETED',
}
