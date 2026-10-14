export enum InvoiceStatus {
  PENDING = 'PENDING',
  PARTIALLY_COLLECTED = 'PARTIALLY_COLLECTED',
  PAID = 'PAID',
  WAIVED = 'WAIVED',
  CANCELLED = 'CANCELLED',
}

export enum CollectionPaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
  NEFT_RTGS = 'NEFT_RTGS',
  HOSPITAL_CREDIT = 'HOSPITAL_CREDIT',
}

export enum WaiverCategory {
  BPL_CARDHOLDER = 'BPL_CARDHOLDER',
  THALASSEMIA_HEMOPHILIA = 'THALASSEMIA_HEMOPHILIA',
  GOVERNMENT_SCHEME = 'GOVERNMENT_SCHEME',
  REPLACEMENT_DONOR = 'REPLACEMENT_DONOR',
  EMERGENCY_INDIGENT = 'EMERGENCY_INDIGENT',
  DISCRETIONARY_ADMIN = 'DISCRETIONARY_ADMIN',
  OTHER = 'OTHER',
}

export const WAIVER_CATEGORY_LABELS: Record<WaiverCategory, string> = {
  [WaiverCategory.BPL_CARDHOLDER]: 'Below Poverty Line (BPL)',
  [WaiverCategory.THALASSEMIA_HEMOPHILIA]: 'Thalassemia / Hemophilia / Sickle Cell',
  [WaiverCategory.GOVERNMENT_SCHEME]: 'Government Health Scheme (Ayushman Bharat / State)',
  [WaiverCategory.REPLACEMENT_DONOR]: 'Replacement Donor Credit',
  [WaiverCategory.EMERGENCY_INDIGENT]: 'Emergency Indigent Patient Exemption',
  [WaiverCategory.DISCRETIONARY_ADMIN]: 'Discretionary Administrative Waiver',
  [WaiverCategory.OTHER]: 'Other Authorized Exemption',
};

// Regulatory standard processing fee defaults (NBTC guidelines) in Integer Paise
export const DEFAULT_TARIFF_PAISE: Record<string, { processingFeePaise: number; crossmatchFeePaise: number }> = {
  WHOLE_BLOOD: { processingFeePaise: 145000, crossmatchFeePaise: 30000 },
  PRBC: { processingFeePaise: 145000, crossmatchFeePaise: 30000 },
  FFP: { processingFeePaise: 40000, crossmatchFeePaise: 0 },
  PLATELETS: { processingFeePaise: 40000, crossmatchFeePaise: 0 },
};

/**
 * Standard Admin waiver limit in paise (₹500.00).
 * Any waiver exceeding ₹500 or granting 100% full exemption requires SUPER_ADMIN role.
 */
export const ADMIN_MAX_WAIVER_PAISE = 50000;
