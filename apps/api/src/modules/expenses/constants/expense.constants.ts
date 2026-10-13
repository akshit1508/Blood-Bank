export enum ExpenseStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ExpenseCategory {
  MEDICAL_SUPPLIES = 'MEDICAL_SUPPLIES',
  LABORATORY_TESTING = 'LABORATORY_TESTING',
  LOGISTICS_TRANSPORT = 'LOGISTICS_TRANSPORT',
  FACILITIES_EQUIPMENT = 'FACILITIES_EQUIPMENT',
  STAFF_CAMP_MEALS = 'STAFF_CAMP_MEALS',
  ADMIN_OFFICE = 'ADMIN_OFFICE',
  UTILITIES_WASTE = 'UTILITIES_WASTE',
  OTHER = 'OTHER',
}

export enum CostCenter {
  BLOOD_BANK_OPERATIONS = 'BLOOD_BANK_OPERATIONS',
  MOBILE_DONATION_CAMPS = 'MOBILE_DONATION_CAMPS',
  LABORATORY_SERVICES = 'LABORATORY_SERVICES',
  STORAGE_COLD_CHAIN = 'STORAGE_COLD_CHAIN',
  ADMIN_OVERHEAD = 'ADMIN_OVERHEAD',
}

export enum ReceiptMimeType {
  PDF = 'application/pdf',
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
}

export enum ExpenseAuditEventType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  RECEIPT_UPLOADED = 'RECEIPT_UPLOADED',
  RECEIPT_REMOVED = 'RECEIPT_REMOVED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RESUBMITTED = 'RESUBMITTED',
  CANCELLED = 'CANCELLED',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.MEDICAL_SUPPLIES]: 'Medical & Phlebotomy Supplies',
  [ExpenseCategory.LABORATORY_TESTING]: 'Laboratory Testing & Reagents',
  [ExpenseCategory.LOGISTICS_TRANSPORT]: 'Cold-Chain Transport & Logistics',
  [ExpenseCategory.FACILITIES_EQUIPMENT]: 'Facilities & Equipment Maintenance',
  [ExpenseCategory.STAFF_CAMP_MEALS]: 'Camp Refreshments & Donor Welfare',
  [ExpenseCategory.ADMIN_OFFICE]: 'Administrative & Office Consumables',
  [ExpenseCategory.UTILITIES_WASTE]: 'Utilities & Biohazard Waste Disposal',
  [ExpenseCategory.OTHER]: 'Other Operational Expenditure',
};

export const COST_CENTER_LABELS: Record<CostCenter, string> = {
  [CostCenter.BLOOD_BANK_OPERATIONS]: 'Blood Bank Central Operations',
  [CostCenter.MOBILE_DONATION_CAMPS]: 'Mobile Donation Drives',
  [CostCenter.LABORATORY_SERVICES]: 'Laboratory Screening Workstation',
  [CostCenter.STORAGE_COLD_CHAIN]: 'Cold Chain & Quarantine Storage',
  [CostCenter.ADMIN_OVERHEAD]: 'Administrative Overhead',
};
