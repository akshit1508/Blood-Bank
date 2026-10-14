export enum PaymentMethod {
  UPI = 'UPI',
  NEFT = 'NEFT',
  RTGS = 'RTGS',
  IMPS = 'IMPS',
  CHEQUE = 'CHEQUE',
  CASH = 'CASH',
}

export enum PaymentStatus {
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.UPI]: 'UPI (Unified Payments Interface)',
  [PaymentMethod.NEFT]: 'NEFT (National Electronic Funds Transfer)',
  [PaymentMethod.RTGS]: 'RTGS (Real Time Gross Settlement)',
  [PaymentMethod.IMPS]: 'IMPS (Immediate Payment Service)',
  [PaymentMethod.CHEQUE]: 'Cheque / Demand Draft',
  [PaymentMethod.CASH]: 'Cash Voucher',
};
