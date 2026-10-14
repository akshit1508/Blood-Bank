import { getAuthHeaders } from './auth-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  [EmploymentType.PERMANENT]: 'Permanent Full-Time',
  [EmploymentType.PROBATION]: 'Probationary Staff',
  [EmploymentType.CONTRACTUAL]: 'Fixed-Term Contract',
  [EmploymentType.CONSULTANT]: 'Consultant / Specialist',
};

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  PROBATION = 'PROBATION',
  ON_LEAVE = 'ON_LEAVE',
  RESIGNED = 'RESIGNED',
  TERMINATED = 'TERMINATED',
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  [EmployeeStatus.ACTIVE]: 'Active',
  [EmployeeStatus.PROBATION]: 'On Probation',
  [EmployeeStatus.ON_LEAVE]: 'On Extended Leave',
  [EmployeeStatus.RESIGNED]: 'Resigned',
  [EmployeeStatus.TERMINATED]: 'Terminated',
};

export enum PayrollRunStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  PARTIALLY_DISBURSED = 'PARTIALLY_DISBURSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const PAYROLL_RUN_STATUS_LABELS: Record<PayrollRunStatus, string> = {
  [PayrollRunStatus.DRAFT]: 'Draft (Pending Review)',
  [PayrollRunStatus.APPROVED]: 'Approved for Disbursement',
  [PayrollRunStatus.PARTIALLY_DISBURSED]: 'Partially Disbursed',
  [PayrollRunStatus.COMPLETED]: 'Fully Completed',
  [PayrollRunStatus.CANCELLED]: 'Cancelled',
};

export enum SalarySlipPaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
}

export const SALARY_SLIP_PAYMENT_STATUS_LABELS: Record<SalarySlipPaymentStatus, string> = {
  [SalarySlipPaymentStatus.UNPAID]: 'Unpaid',
  [SalarySlipPaymentStatus.PARTIALLY_PAID]: 'Partially Paid',
  [SalarySlipPaymentStatus.PAID]: 'Fully Paid',
};

export enum DisbursementPaymentMethod {
  BANK_TRANSFER_NEFT_RTGS = 'BANK_TRANSFER_NEFT_RTGS',
  DIRECT_DEPOSIT_ACH = 'DIRECT_DEPOSIT_ACH',
  UPI = 'UPI',
  CHEQUE = 'CHEQUE',
  CASH = 'CASH',
}

export const DISBURSEMENT_PAYMENT_METHOD_LABELS: Record<DisbursementPaymentMethod, string> = {
  [DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS]: 'NEFT / RTGS / IMPS',
  [DisbursementPaymentMethod.DIRECT_DEPOSIT_ACH]: 'Bank Direct Deposit (ACH)',
  [DisbursementPaymentMethod.UPI]: 'UPI Transfer',
  [DisbursementPaymentMethod.CHEQUE]: 'Cheque',
  [DisbursementPaymentMethod.CASH]: 'Cash',
};

export function formatINR(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface Employee {
  _id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  designation: string;
  department: EmployeeDepartment;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  dateOfJoining: string;
  dateOfLeaving?: string;
  adminUserId?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    panNumber?: string;
  };
  notes?: string;
  activeSalaryStructure?: SalaryStructure | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  designation: string;
  department: EmployeeDepartment;
  employmentType?: EmploymentType;
  status?: EmployeeStatus;
  dateOfJoining: string;
  adminUserId?: string;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    panNumber?: string;
  };
  notes?: string;
}

export interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  designation?: string;
  department?: EmployeeDepartment;
  employmentType?: EmploymentType;
  status?: EmployeeStatus;
  dateOfJoining?: string;
  dateOfLeaving?: string;
  adminUserId?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    panNumber?: string;
  };
  notes?: string;
}

export interface SalaryStructure {
  _id: string;
  employeeId: string;
  revisionNumber: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  basicSalaryPaise: number;
  basicSalary: number;
  hraPaise: number;
  hra: number;
  allowancesPaise: number;
  allowances: number;
  grossSalaryPaise: number;
  grossSalary: number;
  pfDeductionPaise: number;
  pfDeduction: number;
  taxDeductionPaise: number;
  taxDeduction: number;
  otherDeductionsPaise: number;
  otherDeductions: number;
  netSalaryPaise: number;
  netSalary: number;
  createdBy: string;
  createdByName: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalaryStructureInput {
  effectiveFrom: string;
  basicSalary: number;
  hra?: number;
  allowances?: number;
  pfDeduction?: number;
  taxDeduction?: number;
  otherDeductions?: number;
  notes?: string;
}

export interface MonthlyPayrollRun {
  _id: string;
  payrollPeriod: string; // YYYY-MM
  runCode: string;
  periodStartDate: string;
  periodEndDate: string;
  status: PayrollRunStatus;
  totalEmployees: number;
  totalGrossPaise: number;
  totalGross: number;
  totalDeductionsPaise: number;
  totalDeductions: number;
  totalNetPayablePaise: number;
  totalNetPayable: number;
  totalDisbursedPaise: number;
  totalDisbursed: number;
  totalOutstandingPaise: number;
  totalOutstanding: number;
  generatedBy: string;
  generatedByName: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalarySlip {
  _id: string;
  slipNumber: string;
  payrollRunId: string;
  employeeId: string;
  payPeriod: string;
  employeeSnapshot: {
    employeeCode: string;
    fullName: string;
    designation: string;
    department: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    panNumber?: string;
  };
  daysInMonth: number;
  payableDays: number;
  lossOfPayDays: number;
  basicPaise: number;
  basic: number;
  hraPaise: number;
  hra: number;
  allowancesPaise: number;
  allowances: number;
  grossEarningsPaise: number;
  grossEarnings: number;
  pfDeductionPaise: number;
  pfDeduction: number;
  taxDeductionPaise: number;
  taxDeduction: number;
  otherDeductionsPaise: number;
  otherDeductions: number;
  totalDeductionsPaise: number;
  totalDeductions: number;
  netPayablePaise: number;
  netPayable: number;
  paidAmountPaise: number;
  paidAmount: number;
  remainingPaise: number;
  remaining: number;
  paymentStatus: SalarySlipPaymentStatus;
  disbursedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryDisbursement {
  _id: string;
  disbursementNumber: string;
  salarySlipId: string;
  payrollRunId: string;
  employeeId: string;
  amountPaise: number;
  amount: number;
  paymentMethod: DisbursementPaymentMethod;
  transactionReference: string;
  paymentDate: string;
  recipientBankName: string;
  recipientAccountNumber: string;
  recipientIfscCode: string;
  disbursedBy: string;
  disbursedByName: string;
  notes?: string;
  receiptDocumentRef?: string;
  createdAt: string;
}

export interface PayrollSummary {
  totalActiveEmployees: number;
  totalPayrollOutflow: number;
  totalOutstandingLiability: number;
  draftRunsCount: number;
  approvedRunsCount: number;
  completedRunsCount: number;
  totalRunsCount: number;
}

export interface PayrollRosterItem {
  employee: Employee;
  salaryStructure: SalaryStructure | null;
  slip: SalarySlip | null;
  paymentStatus: string; // 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'NO_STRUCTURE'
  netSalary: number;
  paidAmount: number;
  remainingAmount: number;
  isPaid: boolean;
}

export interface PayrollRosterSummary {
  totalEmployees: number;
  employeesWithSalaryCount: number;
  employeesPaidCount: number;
  employeesPartiallyPaidCount: number;
  employeesUnpaidCount: number;
  totalPayrollBudget: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
}

export interface PayrollRosterResponse {
  period: string;
  summary: PayrollRosterSummary;
  items: PayrollRosterItem[];
}

export interface DirectPayEmployeeInput {
  period?: string;
  amount?: number;
  paymentMethod: DisbursementPaymentMethod;
  transactionReference: string;
  notes?: string;
  receiptDocumentRef?: string;
}

// ----------------- Helper Functions -----------------

function extractErrorMessage(payload: any, defaultMsg: string): string {
  if (!payload) return defaultMsg;
  if (Array.isArray(payload.message)) {
    return payload.message.join('; ');
  }
  return payload.message || payload.error || defaultMsg;
}

// ----------------- API Methods -----------------

export async function getEmployees(params?: {
  department?: string;
  status?: string;
  employmentType?: string;
  search?: string;
}): Promise<Employee[]> {
  const query = new URLSearchParams();
  if (params?.department) query.set('department', params.department);
  if (params?.status) query.set('status', params.status);
  if (params?.employmentType) query.set('employmentType', params.employmentType);
  if (params?.search) query.set('search', params.search);

  const res = await fetch(`${API_BASE_URL}/employees?${query.toString()}`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to fetch employees'));
  }
  return payload.data;
}

export async function getEmployeeById(id: string): Promise<Employee> {
  const res = await fetch(`${API_BASE_URL}/employees/${id}`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to fetch employee details'));
  }
  return payload.data;
}

export async function createEmployee(data: CreateEmployeeInput): Promise<Employee> {
  const res = await fetch(`${API_BASE_URL}/employees`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to create employee'));
  }
  return payload.data;
}

export async function updateEmployee(id: string, data: UpdateEmployeeInput): Promise<Employee> {
  const res = await fetch(`${API_BASE_URL}/employees/${id}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to update employee'));
  }
  return payload.data;
}

export async function terminateEmployee(
  id: string,
  data: { status: EmployeeStatus; dateOfLeaving: string; notes?: string },
): Promise<Employee> {
  const res = await fetch(`${API_BASE_URL}/employees/${id}/terminate`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to terminate employee'));
  }
  return payload.data;
}

export async function getActiveSalaryStructure(employeeId: string): Promise<SalaryStructure | null> {
  const res = await fetch(`${API_BASE_URL}/payroll/structures/employee/${employeeId}/active`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to fetch active salary structure');
  }
  return payload.data;
}

export async function getSalaryStructureHistory(employeeId: string): Promise<SalaryStructure[]> {
  const res = await fetch(`${API_BASE_URL}/payroll/structures/employee/${employeeId}/history`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to fetch salary structure history');
  }
  return payload.data;
}

export async function createSalaryStructure(
  employeeId: string,
  data: CreateSalaryStructureInput,
): Promise<SalaryStructure> {
  const res = await fetch(`${API_BASE_URL}/payroll/structures/employee/${employeeId}`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to save salary structure');
  }
  return payload.data;
}

export async function getPayrollSummary(): Promise<PayrollSummary> {
  const res = await fetch(`${API_BASE_URL}/payroll/summary`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to fetch payroll summary');
  }
  return payload.data;
}

export async function getPayrollRuns(params?: {
  status?: string;
  payrollPeriod?: string;
}): Promise<MonthlyPayrollRun[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.payrollPeriod) query.set('payrollPeriod', params.payrollPeriod);

  const res = await fetch(`${API_BASE_URL}/payroll/runs?${query.toString()}`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to fetch payroll runs');
  }
  return payload.data;
}

export async function getPayrollRunById(runId: string): Promise<MonthlyPayrollRun> {
  const res = await fetch(`${API_BASE_URL}/payroll/runs/${runId}`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to fetch payroll run details');
  }
  return payload.data;
}

export async function generatePayrollRun(data: {
  payrollPeriod: string;
  notes?: string;
}): Promise<MonthlyPayrollRun> {
  const res = await fetch(`${API_BASE_URL}/payroll/runs`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to generate payroll run');
  }
  return payload.data;
}

export async function approvePayrollRun(
  runId: string,
  data?: { notes?: string },
): Promise<MonthlyPayrollRun> {
  const res = await fetch(`${API_BASE_URL}/payroll/runs/${runId}/approve`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data || {}),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to approve payroll run');
  }
  return payload.data;
}

export async function batchDisbursePayrollRun(
  runId: string,
  data: {
    paymentMethod: DisbursementPaymentMethod;
    transactionReferencePrefix: string;
    notes?: string;
  },
): Promise<{ run: MonthlyPayrollRun; processedCount: number; totalDisbursed: number }> {
  const res = await fetch(`${API_BASE_URL}/payroll/runs/${runId}/batch-disburse`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to batch disburse payroll run');
  }
  return payload.data;
}

export async function getSalarySlipsForRun(runId: string): Promise<SalarySlip[]> {
  const res = await fetch(`${API_BASE_URL}/payroll/runs/${runId}/slips`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to fetch salary slips');
  }
  return payload.data;
}

export async function getSalarySlipById(slipId: string): Promise<SalarySlip> {
  const res = await fetch(`${API_BASE_URL}/payroll/slips/${slipId}`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to fetch salary slip');
  }
  return payload.data;
}

export async function disburseSalarySlip(
  slipId: string,
  data: {
    amount?: number;
    paymentMethod: DisbursementPaymentMethod;
    transactionReference: string;
    notes?: string;
    receiptDocumentRef?: string;
  },
): Promise<{ slip: SalarySlip; disbursement: SalaryDisbursement; run: MonthlyPayrollRun }> {
  const res = await fetch(`${API_BASE_URL}/payroll/slips/${slipId}/disburse`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || 'Failed to disburse salary slip');
  }
  return payload.data;
}

export async function getDisbursementsForSlip(slipId: string): Promise<SalaryDisbursement[]> {
  const res = await fetch(`${API_BASE_URL}/payroll/slips/${slipId}/disbursements`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to fetch salary disbursements'));
  }
  return payload.data;
}

export async function getDashboardRoster(params?: {
  period?: string;
  department?: string;
  search?: string;
}): Promise<PayrollRosterResponse> {
  const query = new URLSearchParams();
  if (params?.period) query.set('period', params.period);
  if (params?.department) query.set('department', params.department);
  if (params?.search) query.set('search', params.search);

  const res = await fetch(`${API_BASE_URL}/payroll/dashboard-roster?${query.toString()}`, {
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to fetch payroll roster'));
  }
  return payload.data;
}

export async function directPayEmployee(
  employeeId: string,
  data: DirectPayEmployeeInput,
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/payroll/employees/${employeeId}/pay`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to process salary payment'));
  }
  return payload.data;
}
