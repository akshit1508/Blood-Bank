export enum FinancialPeriodPreset {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = '7days',
  LAST_15_DAYS = '15days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_FINANCIAL_YEAR = 'this_fy',
  CUSTOM = 'custom',
}

export enum FinancialTransactionType {
  BLOOD_ISSUE_INVOICE = 'BLOOD_ISSUE_INVOICE',
  BLOOD_ISSUE_COLLECTION = 'BLOOD_ISSUE_COLLECTION',
  EXPENSE_LIABILITY = 'EXPENSE_LIABILITY',
  EXPENSE_PAYMENT = 'EXPENSE_PAYMENT',
  PAYROLL_ACCRUAL = 'PAYROLL_ACCRUAL',
  PAYROLL_DISBURSEMENT = 'PAYROLL_DISBURSEMENT',
  BLOOD_ACQUISITION_COST = 'BLOOD_ACQUISITION_COST',
  SUPPLIER_CREDIT_NOTE = 'SUPPLIER_CREDIT_NOTE',
  SUPPLIER_REFUND = 'SUPPLIER_REFUND',
  INVOICE_WAIVER = 'INVOICE_WAIVER',
}

export enum FinancialTransactionDirection {
  INFLOW = 'INFLOW',     // Money received / Inflow (Collections, Supplier refunds)
  OUTFLOW = 'OUTFLOW',   // Money disbursed / Outflow (Payments, Salary disbursements)
  ACCRUAL = 'ACCRUAL',   // Recognized liability or invoice (Invoice, Expense, Payroll run)
  ADJUSTMENT = 'ADJUSTMENT', // Credit note, waiver, discount
}

export const TRANSACTION_TYPE_LABELS: Record<FinancialTransactionType, string> = {
  [FinancialTransactionType.BLOOD_ISSUE_INVOICE]: 'Blood Issue Invoice',
  [FinancialTransactionType.BLOOD_ISSUE_COLLECTION]: 'Blood Issue Collection',
  [FinancialTransactionType.EXPENSE_LIABILITY]: 'Expense Recognized',
  [FinancialTransactionType.EXPENSE_PAYMENT]: 'Supplier Disbursement',
  [FinancialTransactionType.PAYROLL_ACCRUAL]: 'Payroll Salary Accrual',
  [FinancialTransactionType.PAYROLL_DISBURSEMENT]: 'Salary Disbursement',
  [FinancialTransactionType.BLOOD_ACQUISITION_COST]: 'Blood Acquisition Cost',
  [FinancialTransactionType.SUPPLIER_CREDIT_NOTE]: 'Supplier Credit Note',
  [FinancialTransactionType.SUPPLIER_REFUND]: 'Supplier Refund Received',
  [FinancialTransactionType.INVOICE_WAIVER]: 'Approved Invoice Waiver',
};

export const COLLECTION_PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI / QR',
  CARD: 'Credit / Debit Card',
  NEFT_RTGS: 'NEFT / RTGS',
  HOSPITAL_CREDIT: 'Hospital Credit Line',
};

