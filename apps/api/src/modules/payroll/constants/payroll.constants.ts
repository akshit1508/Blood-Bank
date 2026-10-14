export enum EmployeeDepartment {
  MEDICAL_CLINICAL = 'MEDICAL_CLINICAL',
  LABORATORY = 'LABORATORY',
  PHLEBOTOMY_COLLECTION = 'PHLEBOTOMY_COLLECTION',
  QUALITY_ASSURANCE = 'QUALITY_ASSURANCE',
  LOGISTICS_DISPATCH = 'LOGISTICS_DISPATCH',
  ADMINISTRATION_HR = 'ADMINISTRATION_HR',
  FINANCE_ACCOUNTS = 'FINANCE_ACCOUNTS',
}

export const DEPARTMENT_LABELS: Record<EmployeeDepartment, string> = {
  [EmployeeDepartment.MEDICAL_CLINICAL]: 'Medical & Clinical Services',
  [EmployeeDepartment.LABORATORY]: 'Laboratory & Testing',
  [EmployeeDepartment.PHLEBOTOMY_COLLECTION]: 'Phlebotomy & Donor Camps',
  [EmployeeDepartment.QUALITY_ASSURANCE]: 'Quality Assurance & Regulatory',
  [EmployeeDepartment.LOGISTICS_DISPATCH]: 'Cold Chain Logistics & Dispatch',
  [EmployeeDepartment.ADMINISTRATION_HR]: 'Administration & Operations',
  [EmployeeDepartment.FINANCE_ACCOUNTS]: 'Finance & Accounting',
};

export enum EmploymentType {
  PERMANENT = 'PERMANENT',
  PROBATION = 'PROBATION',
  CONTRACTUAL = 'CONTRACTUAL',
  CONSULTANT = 'CONSULTANT',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  PROBATION = 'PROBATION',
  ON_LEAVE = 'ON_LEAVE',
  RESIGNED = 'RESIGNED',
  TERMINATED = 'TERMINATED',
}

export enum PayrollRunStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  PARTIALLY_DISBURSED = 'PARTIALLY_DISBURSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum SalarySlipPaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
}

export enum DisbursementPaymentMethod {
  BANK_TRANSFER_NEFT_RTGS = 'BANK_TRANSFER_NEFT_RTGS',
  DIRECT_DEPOSIT_ACH = 'DIRECT_DEPOSIT_ACH',
  UPI = 'UPI',
  CHEQUE = 'CHEQUE',
  CASH = 'CASH',
}

export const PAYMENT_METHOD_LABELS: Record<DisbursementPaymentMethod, string> = {
  [DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS]: 'NEFT / RTGS / IMPS',
  [DisbursementPaymentMethod.DIRECT_DEPOSIT_ACH]: 'Bank Direct Deposit (ACH)',
  [DisbursementPaymentMethod.UPI]: 'UPI Transfer',
  [DisbursementPaymentMethod.CHEQUE]: 'Cheque',
  [DisbursementPaymentMethod.CASH]: 'Cash',
};
