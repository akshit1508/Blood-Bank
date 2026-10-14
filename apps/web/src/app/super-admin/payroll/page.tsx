'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MonthlyPayrollRun,
  PayrollSummary,
  getPayrollRuns,
  getPayrollSummary,
  generatePayrollRun,
  formatINR,
  PayrollRunStatus,
  PAYROLL_RUN_STATUS_LABELS,
  EmployeeDepartment,
  DEPARTMENT_LABELS,
  EmploymentType,
  EMPLOYMENT_TYPE_LABELS,
  createEmployee,
  createSalaryStructure,
  getDashboardRoster,
  directPayEmployee,
  PayrollRosterItem,
  PayrollRosterSummary,
  DisbursementPaymentMethod,
  DISBURSEMENT_PAYMENT_METHOD_LABELS,
} from '@/lib/payroll-api';

export default function PayrollDashboardPage() {
  const router = useRouter();

  // Active view tab
  const [activeTab, setActiveTab] = useState<'roster' | 'runs'>('roster');

  // Period filter (defaults to current month YYYY-MM)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  });

  // Roster state
  const [roster, setRoster] = useState<PayrollRosterItem[]>([]);
  const [rosterSummary, setRosterSummary] = useState<PayrollRosterSummary | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID' | 'NO_SALARY'>('ALL');

  // Legacy/Batch runs state
  const [runs, setRuns] = useState<MonthlyPayrollRun[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);

  // Loading & notification state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal-specific error messages (displayed directly inside modals)
  const [employeeModalError, setEmployeeModalError] = useState<string | null>(null);
  const [salaryModalError, setSalaryModalError] = useState<string | null>(null);
  const [payModalError, setPayModalError] = useState<string | null>(null);

  // --- Modals State ---
  // 1. Add Employee Modal
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [isSubmittingEmployee, setIsSubmittingEmployee] = useState(false);
  const [employeeFormData, setEmployeeFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: EmployeeDepartment.MEDICAL_CLINICAL,
    designation: '',
    employmentType: EmploymentType.PERMANENT,
    dateOfJoining: new Date().toISOString().split('T')[0],
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    panNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: 'Spouse/Parent',
    // Optional initial salary
    initialBasicSalary: '',
    initialHra: '',
    initialAllowances: '',
    initialPf: '',
    initialTax: '',
  });

  // 2. Decide / Revise Salary Modal
  const [showDecideSalaryModal, setShowDecideSalaryModal] = useState(false);
  const [selectedEmployeeForSalary, setSelectedEmployeeForSalary] = useState<PayrollRosterItem | null>(null);
  const [isSubmittingSalary, setIsSubmittingSalary] = useState(false);
  const [salaryFormData, setSalaryFormData] = useState({
    basicSalary: 0,
    hra: 0,
    allowances: 0,
    pfDeduction: 0,
    taxDeduction: 0,
    otherDeductions: 0,
    effectiveFrom: new Date().toISOString().split('T')[0],
    notes: 'Approved by Super Admin',
  });

  // 3. Direct Pay Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedEmployeeForPay, setSelectedEmployeeForPay] = useState<PayrollRosterItem | null>(null);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [payFormData, setPayFormData] = useState({
    amount: 0,
    paymentMethod: DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS,
    transactionReference: '',
    disbursementDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // 4. Generate Monthly Batch Run Modal
  const [showGenerateRunModal, setShowGenerateRunModal] = useState(false);
  const [isGeneratingRun, setIsGeneratingRun] = useState(false);
  const [batchPeriodInput, setBatchPeriodInput] = useState(selectedPeriod);
  const [batchNotesInput, setBatchNotesInput] = useState('');

  // Auto-dismiss success alert
  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  // Load roster data
  const loadRosterData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDashboardRoster({
        period: selectedPeriod,
        department: departmentFilter || undefined,
        search: searchFilter || undefined,
      });
      setRoster(res.items);
      setRosterSummary(res.summary);
    } catch (err: any) {
      setError(err?.message || 'Failed to load staff roster');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, departmentFilter, searchFilter]);

  // Load batch runs data
  const loadRunsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [runsData, summaryData] = await Promise.all([
        getPayrollRuns({ payrollPeriod: selectedPeriod || undefined }),
        getPayrollSummary(),
      ]);
      setRuns(runsData);
      setPayrollSummary(summaryData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  // Reload when activeTab or selectedPeriod changes
  useEffect(() => {
    if (activeTab === 'roster') {
      loadRosterData();
    } else {
      loadRunsData();
    }
  }, [activeTab, loadRosterData, loadRunsData]);

  // Filter roster items in memory by payment status
  const filteredRoster = useMemo(() => {
    return roster.filter((item) => {
      if (paymentStatusFilter === 'PAID') {
        return item.paymentStatus === 'PAID' || item.isPaid;
      }
      if (paymentStatusFilter === 'UNPAID') {
        return item.paymentStatus === 'UNPAID' || item.paymentStatus === 'PARTIALLY_PAID';
      }
      if (paymentStatusFilter === 'NO_SALARY') {
        return !item.salaryStructure || item.paymentStatus === 'NO_STRUCTURE';
      }
      return true;
    });
  }, [roster, paymentStatusFilter]);

  // --- Handlers: Open Modals ---
  const handleOpenDecideSalary = (item: PayrollRosterItem) => {
    setSelectedEmployeeForSalary(item);
    setSalaryModalError(null);
    if (item.salaryStructure) {
      setSalaryFormData({
        basicSalary: item.salaryStructure.basicSalary || 0,
        hra: item.salaryStructure.hra || 0,
        allowances: item.salaryStructure.allowances || 0,
        pfDeduction: item.salaryStructure.pfDeduction || 0,
        taxDeduction: item.salaryStructure.taxDeduction || 0,
        otherDeductions: item.salaryStructure.otherDeductions || 0,
        effectiveFrom: new Date().toISOString().split('T')[0],
        notes: `Salary updated by Super Admin for ${item.employee.fullName}`,
      });
    } else {
      setSalaryFormData({
        basicSalary: 30000,
        hra: 12000,
        allowances: 3000,
        pfDeduction: 1800,
        taxDeduction: 500,
        otherDeductions: 0,
        effectiveFrom: new Date().toISOString().split('T')[0],
        notes: `Initial salary structure established for ${item.employee.fullName}`,
      });
    }
    setShowDecideSalaryModal(true);
  };

  const handleOpenPaySalary = (item: PayrollRosterItem) => {
    if (!item.salaryStructure) {
      handleOpenDecideSalary(item);
      return;
    }
    setSelectedEmployeeForPay(item);
    setPayModalError(null);
    const amount = item.slip?.remaining ?? item.netSalary ?? item.salaryStructure.netSalary;
    setPayFormData({
      amount: amount > 0 ? amount : 0,
      paymentMethod: DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS,
      transactionReference: `PAY-${Date.now().toString().slice(-6)}`,
      disbursementDate: new Date().toISOString().split('T')[0],
      notes: `Salary payment for period ${selectedPeriod} to ${item.employee.fullName}`,
    });
    setShowPayModal(true);
  };

  // --- Handlers: Submissions ---
  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeForSalary) return;
    try {
      setIsSubmittingSalary(true);
      setSalaryModalError(null);
      setError(null);
      await createSalaryStructure(selectedEmployeeForSalary.employee._id, {
        effectiveFrom: salaryFormData.effectiveFrom,
        basicSalary: Number(salaryFormData.basicSalary),
        hra: Number(salaryFormData.hra),
        allowances: Number(salaryFormData.allowances),
        pfDeduction: Number(salaryFormData.pfDeduction),
        taxDeduction: Number(salaryFormData.taxDeduction),
        otherDeductions: Number(salaryFormData.otherDeductions),
        notes: salaryFormData.notes,
      });
      setShowDecideSalaryModal(false);
      setActionSuccess(`Salary structure successfully decided for ${selectedEmployeeForSalary.employee.fullName}!`);
      await loadRosterData();
    } catch (err: any) {
      setSalaryModalError(err?.message || 'Failed to save salary structure');
    } finally {
      setIsSubmittingSalary(false);
    }
  };

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeForPay) return;
    try {
      setIsSubmittingPay(true);
      setPayModalError(null);
      setError(null);
      await directPayEmployee(selectedEmployeeForPay.employee._id, {
        period: selectedPeriod,
        amount: Number(payFormData.amount),
        paymentMethod: payFormData.paymentMethod,
        transactionReference: payFormData.transactionReference.trim(),
        notes: payFormData.notes.trim() || undefined,
      });
      setShowPayModal(false);
      setActionSuccess(
        `Disbursed ${formatINR(payFormData.amount)} to ${selectedEmployeeForPay.employee.fullName} (Ref: ${payFormData.transactionReference})!`,
      );
      await loadRosterData();
    } catch (err: any) {
      console.error('Direct payout failure:', err);
      setPayModalError(err?.message || 'Failed to process payout');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingEmployee(true);
      setEmployeeModalError(null);
      setError(null);
      const created = await createEmployee({
        firstName: employeeFormData.firstName,
        lastName: employeeFormData.lastName,
        email: employeeFormData.email,
        phone: employeeFormData.phone,
        department: employeeFormData.department,
        designation: employeeFormData.designation,
        employmentType: employeeFormData.employmentType,
        dateOfJoining: employeeFormData.dateOfJoining,
        bankDetails: {
          bankName: employeeFormData.bankName,
          accountNumber: employeeFormData.accountNumber,
          ifscCode: employeeFormData.ifscCode,
          accountHolderName: employeeFormData.accountHolderName || `${employeeFormData.firstName} ${employeeFormData.lastName}`,
          panNumber: employeeFormData.panNumber || undefined,
        },
        emergencyContact: {
          name: employeeFormData.emergencyContactName,
          phone: employeeFormData.emergencyContactPhone,
          relationship: employeeFormData.emergencyContactRelation,
        },
      });

      // If initial basic salary was provided, set salary immediately
      if (employeeFormData.initialBasicSalary && Number(employeeFormData.initialBasicSalary) > 0) {
        try {
          await createSalaryStructure(created._id, {
            effectiveFrom: employeeFormData.dateOfJoining,
            basicSalary: Number(employeeFormData.initialBasicSalary),
            hra: Number(employeeFormData.initialHra) || 0,
            allowances: Number(employeeFormData.initialAllowances) || 0,
            pfDeduction: Number(employeeFormData.initialPf) || 0,
            taxDeduction: Number(employeeFormData.initialTax) || 0,
            notes: 'Initial salary configured during registration',
          });
        } catch (salErr) {
          console.error('Failed to configure initial salary', salErr);
        }
      }

      setShowAddEmployeeModal(false);
      setActionSuccess(`Staff member ${created.fullName} (${created.employeeCode}) registered successfully!`);
      // Reset form
      setEmployeeFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        department: EmployeeDepartment.MEDICAL_CLINICAL,
        designation: '',
        employmentType: EmploymentType.PERMANENT,
        dateOfJoining: new Date().toISOString().split('T')[0],
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        accountHolderName: '',
        panNumber: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: 'Spouse/Parent',
        initialBasicSalary: '',
        initialHra: '',
        initialAllowances: '',
        initialPf: '',
        initialTax: '',
      });
      await loadRosterData();
    } catch (err: any) {
      setEmployeeModalError(err?.message || 'Failed to create employee');
    } finally {
      setIsSubmittingEmployee(false);
    }
  };

  const handleGenerateBatchRun = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsGeneratingRun(true);
      setError(null);
      const res = await generatePayrollRun({
        payrollPeriod: batchPeriodInput,
        notes: batchNotesInput || undefined,
      });
      setShowGenerateRunModal(false);
      setActionSuccess(`Payroll batch run ${res.runCode} for ${res.payrollPeriod} generated!`);
      setActiveTab('runs');
      await loadRunsData();
    } catch (err: any) {
      setError(err?.message || 'Failed to generate payroll batch');
    } finally {
      setIsGeneratingRun(false);
    }
  };

  // Salary Preview in Modal
  const calculatedGross =
    Number(salaryFormData.basicSalary || 0) +
    Number(salaryFormData.hra || 0) +
    Number(salaryFormData.allowances || 0);
  const calculatedDeductions =
    Number(salaryFormData.pfDeduction || 0) +
    Number(salaryFormData.taxDeduction || 0) +
    Number(salaryFormData.otherDeductions || 0);
  const calculatedNet = calculatedGross - calculatedDeductions;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Top Banner & Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                letterSpacing: '0.05em',
              }}
            >
              Super Admin Exclusive
            </span>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>• Direct Payout Control</span>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            Payroll & Employee Command Center
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Decide employee salaries, disburse payments directly, and track real-time payout totals.
          </p>
        </div>

        {/* Upper Action Tab / Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setEmployeeModalError(null);
              setShowAddEmployeeModal(true);
            }}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>+</span>
            <span>Register New Employee</span>
          </button>

          <button
            onClick={() => setShowGenerateRunModal(true)}
            style={{
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>Generate Monthly Batch</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #10b981',
            color: '#34d399',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification Alert */}
      {error && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid #ef4444',
            color: '#f87171',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards: Who We Paid & How Much We Paid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Card 1: Active Staff */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Active Staff
            </span>
            <span style={{ fontSize: '1.25rem' }}>👥</span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#f8fafc' }}>
              {rosterSummary ? rosterSummary.totalEmployees : '...'}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
              Enrolled across all departments
            </div>
          </div>
        </div>

        {/* Card 2: People Paid This Month (Crucial Metric requested by User) */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #10b981',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              backgroundColor: '#10b981',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
              People Paid This Month
            </span>
            <span style={{ fontSize: '1.25rem' }}>✅</span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#34d399' }}>
              {rosterSummary
                ? `${rosterSummary.employeesPaidCount} of ${rosterSummary.totalEmployees}`
                : '...'}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.2rem' }}>
              {rosterSummary && rosterSummary.totalEmployees > 0
                ? `${Math.round((rosterSummary.employeesPaidCount / rosterSummary.totalEmployees) * 100)}% staff paid for ${selectedPeriod}`
                : `Payout period: ${selectedPeriod}`}
            </div>
          </div>
        </div>

        {/* Card 3: Total Salary Paid Out (Crucial Metric requested by User) */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Salary Paid ({selectedPeriod})
            </span>
            <span style={{ fontSize: '1.25rem' }}>💸</span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#10b981' }}>
              {rosterSummary ? formatINR(rosterSummary.totalPaidAmount) : '₹0.00'}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
              Disbursed via direct NEFT/RTGS/UPI
            </div>
          </div>
        </div>

        {/* Card 4: Pending Salary To Pay */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Pending Salary To Pay
            </span>
            <span style={{ fontSize: '1.25rem' }}>⏳</span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <div
              style={{
                fontSize: '1.875rem',
                fontWeight: 800,
                color: rosterSummary && rosterSummary.totalPendingAmount > 0 ? '#f59e0b' : '#94a3b8',
              }}
            >
              {rosterSummary ? formatINR(rosterSummary.totalPendingAmount) : '₹0.00'}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
              {rosterSummary
                ? `${rosterSummary.totalEmployees - rosterSummary.employeesPaidCount} staff pending disbursement`
                : 'Unpaid liabilities'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1e293b',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('roster')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'roster' ? '2px solid #dc2626' : '2px solid transparent',
              color: activeTab === 'roster' ? '#ffffff' : '#94a3b8',
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Staff Direct Payouts & Roster</span>
            <span
              style={{
                backgroundColor: activeTab === 'roster' ? '#dc2626' : '#1e293b',
                color: '#ffffff',
                fontSize: '0.75rem',
                padding: '0.1rem 0.5rem',
                borderRadius: '12px',
              }}
            >
              {roster.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('runs')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'runs' ? '2px solid #dc2626' : '2px solid transparent',
              color: activeTab === 'runs' ? '#ffffff' : '#94a3b8',
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Monthly Batch Runs & Audit</span>
            <span
              style={{
                backgroundColor: '#1e293b',
                color: '#94a3b8',
                fontSize: '0.75rem',
                padding: '0.1rem 0.5rem',
                borderRadius: '12px',
              }}
            >
              {runs.length}
            </span>
          </button>
        </div>

        {/* Month Selector & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '0.5rem' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 }}>
            Payroll Period:
          </label>
          <input
            type="month"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              color: '#f8fafc',
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
          <button
            onClick={() => (activeTab === 'roster' ? loadRosterData() : loadRunsData())}
            title="Refresh Data"
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* TAB 1: STAFF DIRECT PAYOUTS & ROSTER (DEFAULT) */}
      {activeTab === 'roster' && (
        <div>
          {/* Filters Bar */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Search & Department Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, minWidth: '300px' }}>
              <input
                type="text"
                placeholder="Search staff by name, code, or email..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  backgroundColor: '#0b1120',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  flex: 1,
                  minWidth: '220px',
                  outline: 'none',
                }}
              />

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                style={{
                  backgroundColor: '#0b1120',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="">All Departments</option>
                {Object.entries(DEPARTMENT_LABELS).map(([deptKey, deptName]) => (
                  <option key={deptKey} value={deptKey}>
                    {deptName}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Status Filter Buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {(
                [
                  { key: 'ALL', label: 'All Staff' },
                  { key: 'PAID', label: 'Paid Only' },
                  { key: 'UNPAID', label: 'Pending Payout' },
                  { key: 'NO_SALARY', label: 'Salary Not Decided' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setPaymentStatusFilter(tab.key)}
                  style={{
                    backgroundColor: paymentStatusFilter === tab.key ? '#dc2626' : '#1e293b',
                    color: paymentStatusFilter === tab.key ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Roster Table */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
                Loading staff roster and payout balances...
              </div>
            ) : filteredRoster.length === 0 ? (
              <div style={{ padding: '3.5rem', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>👥</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                  No employees matched the filters
                </div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: '400px', margin: '0.5rem auto 1.5rem' }}>
                  Get started by registering employees or adjusting your search parameters.
                </p>
                <button
                  onClick={() => {
                    setEmployeeModalError(null);
                    setShowAddEmployeeModal(true);
                  }}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  + Register First Employee
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#0b1120',
                        borderBottom: '1px solid #1e293b',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        fontSize: '0.72rem',
                        letterSpacing: '0.05em',
                      }}
                    >
                      <th style={{ padding: '0.9rem 1rem' }}>Employee</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Department & Role</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Decided Salary / Mo</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Bank Account</th>
                      <th style={{ padding: '0.9rem 1rem' }}>{selectedPeriod} Status</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoster.map((item, idx) => {
                      const emp = item.employee;
                      const structure = item.salaryStructure;
                      const slip = item.slip;
                      const isPaid = item.isPaid || item.paymentStatus === 'PAID';
                      const isPending = !isPaid && structure;

                      return (
                        <tr
                          key={emp._id}
                          style={{
                            borderBottom: '1px solid #1e293b',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(15, 23, 42, 0.4)',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          {/* Col 1: Employee info */}
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>
                              {emp.fullName}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                              <span
                                style={{
                                  backgroundColor: '#1e293b',
                                  color: '#cbd5e1',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                }}
                              >
                                {emp.employeeCode}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{emp.email}</span>
                            </div>
                          </td>

                          {/* Col 2: Department & Role */}
                          <td style={{ padding: '1rem' }}>
                            <div style={{ color: '#f8fafc', fontWeight: 500 }}>
                              {DEPARTMENT_LABELS[emp.department] || emp.department}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                              {emp.designation} • {EMPLOYMENT_TYPE_LABELS[emp.employmentType] || emp.employmentType}
                            </div>
                          </td>

                          {/* Col 3: Decided Salary / Mo */}
                          <td style={{ padding: '1rem' }}>
                            {structure ? (
                              <div>
                                <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.95rem' }}>
                                  {formatINR(structure.netSalary)} <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>/ mo (Net)</span>
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                                  Gross: {formatINR(structure.grossSalary)} | Ded: {formatINR(structure.pfDeduction + structure.taxDeduction + (structure.otherDeductions || 0))}
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  color: '#fbbf24',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                }}
                              >
                                <span>⚠️</span>
                                <span>Not Decided</span>
                              </div>
                            )}
                          </td>

                          {/* Col 4: Bank Details */}
                          <td style={{ padding: '1rem' }}>
                            <div style={{ color: '#f8fafc', fontSize: '0.82rem' }}>
                              {emp.bankDetails?.bankName || 'Bank Not Set'}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                              A/C: •••• {emp.bankDetails?.accountNumber?.slice(-4) || 'N/A'} | IFSC: {emp.bankDetails?.ifscCode || 'N/A'}
                            </div>
                          </td>

                          {/* Col 5: Period Status */}
                          <td style={{ padding: '1rem' }}>
                            {isPaid ? (
                              <div>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid #10b981',
                                    color: '#34d399',
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  <span>✓</span>
                                  <span>Paid {formatINR(item.paidAmount || slip?.paidAmount || structure?.netSalary || 0)}</span>
                                </span>
                                {slip?.disbursedAt && (
                                  <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                                    Paid on {new Date(slip.disbursedAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            ) : isPending ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                  border: '1px solid #f59e0b',
                                  color: '#fbbf24',
                                  padding: '0.25rem 0.65rem',
                                  borderRadius: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                }}
                              >
                                <span>⏳</span>
                                <span>Pending Payout</span>
                              </span>
                            ) : (
                              <span
                                style={{
                                  backgroundColor: '#1e293b',
                                  color: '#94a3b8',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                }}
                              >
                                Needs Salary Setup
                              </span>
                            )}
                          </td>

                          {/* Col 6: Actions */}
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              {/* Action 1: Decide / Revise Salary */}
                              <button
                                onClick={() => handleOpenDecideSalary(item)}
                                title="Decide or revise monthly compensation"
                                style={{
                                  backgroundColor: '#1e293b',
                                  border: '1px solid #334155',
                                  color: '#38bdf8',
                                  padding: '0.45rem 0.75rem',
                                  borderRadius: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {structure ? 'Revise Salary' : 'Decide Salary'}
                              </button>

                              {/* Action 2: Pay Salary (Direct Disburse) */}
                              {isPaid ? (
                                <Link
                                  href={`/super-admin/employees/${emp._id}`}
                                  style={{
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    color: '#34d399',
                                    padding: '0.45rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    display: 'inline-block',
                                  }}
                                >
                                  View Slip
                                </Link>
                              ) : (
                                <button
                                  onClick={() => handleOpenPaySalary(item)}
                                  title="Disburse salary directly for this month"
                                  style={{
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '0.45rem 0.85rem',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                  }}
                                >
                                  Pay Salary
                                </button>
                              )}

                              {/* Action 3: Profile */}
                              <Link
                                href={`/super-admin/employees/${emp._id}`}
                                title="View Employee File"
                                style={{
                                  color: '#94a3b8',
                                  padding: '0.45rem',
                                  borderRadius: '6px',
                                  fontSize: '0.85rem',
                                  textDecoration: 'none',
                                }}
                              >
                                ➔
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MONTHLY BATCH AUDIT RUNS */}
      {activeTab === 'runs' && (
        <div>
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1.25rem',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                  Formal Monthly Payroll Batch Runs
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0.2rem 0 0 0' }}>
                  Institutional audit trail, regulatory compliance, and bulk slip batches.
                </p>
              </div>

              <button
                onClick={() => setShowGenerateRunModal(true)}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                + Generate New Run
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                Loading batch runs...
              </div>
            ) : runs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📄</div>
                No monthly batch runs recorded for period {selectedPeriod}.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#0b1120',
                        borderBottom: '1px solid #1e293b',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        fontSize: '0.72rem',
                        letterSpacing: '0.05em',
                      }}
                    >
                      <th style={{ padding: '0.85rem 1rem' }}>Run Code & Period</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Staff Count</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Gross Total</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Net Payable</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Disbursed</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run._id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{run.runCode}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                            Period: {run.payrollPeriod} ({new Date(run.periodStartDate).toLocaleDateString()} - {new Date(run.periodEndDate).toLocaleDateString()})
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span
                            style={{
                              backgroundColor:
                                run.status === PayrollRunStatus.COMPLETED
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : run.status === PayrollRunStatus.APPROVED
                                  ? 'rgba(59, 130, 246, 0.15)'
                                  : 'rgba(245, 158, 11, 0.15)',
                              color:
                                run.status === PayrollRunStatus.COMPLETED
                                  ? '#34d399'
                                  : run.status === PayrollRunStatus.APPROVED
                                  ? '#60a5fa'
                                  : '#fbbf24',
                              border: `1px solid ${
                                run.status === PayrollRunStatus.COMPLETED
                                  ? '#10b981'
                                  : run.status === PayrollRunStatus.APPROVED
                                  ? '#3b82f6'
                                  : '#f59e0b'
                              }`,
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}
                          >
                            {PAYROLL_RUN_STATUS_LABELS[run.status]}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', color: '#f8fafc' }}>{run.totalEmployees} Employees</td>
                        <td style={{ padding: '1rem', color: '#94a3b8' }}>{formatINR(run.totalGross)}</td>
                        <td style={{ padding: '1rem', fontWeight: 600, color: '#f8fafc' }}>{formatINR(run.totalNetPayable)}</td>
                        <td style={{ padding: '1rem', fontWeight: 600, color: '#10b981' }}>{formatINR(run.totalDisbursed)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <Link
                            href={`/super-admin/payroll/runs/${run._id}`}
                            style={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #334155',
                              color: '#38bdf8',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-block',
                            }}
                          >
                            Review & Slips
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: REGISTER NEW EMPLOYEE                            */}
      {/* ========================================================= */}
      {showAddEmployeeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                backgroundColor: '#0f172a',
                zIndex: 10,
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Register New Employee
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>
                  Add a new staff member to the payroll directory with personal, departmental, and bank details.
                </p>
              </div>
              <button
                onClick={() => setShowAddEmployeeModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee} style={{ padding: '1.5rem' }}>
              {/* Error banner inside modal */}
              {employeeModalError && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#f87171',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.85rem',
                  }}
                >
                  ⚠️ {employeeModalError}
                </div>
              )}

              {/* Section 1: Personal Details */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  1. Personal & Contact Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      First Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={employeeFormData.firstName}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, firstName: e.target.value })}
                      placeholder="e.g. Rahul"
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Last Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={employeeFormData.lastName}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, lastName: e.target.value })}
                      placeholder="e.g. Sharma"
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Email Address *
                    </label>
                    <input
                      required
                      type="email"
                      value={employeeFormData.email}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, email: e.target.value })}
                      placeholder="rahul.s@bloodbank.org"
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Phone Number *
                    </label>
                    <input
                      required
                      type="tel"
                      value={employeeFormData.phone}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Department & Employment */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  2. Department & Employment
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Department *
                    </label>
                    <select
                      value={employeeFormData.department}
                      onChange={(e) =>
                        setEmployeeFormData({ ...employeeFormData, department: e.target.value as EmployeeDepartment })
                      }
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    >
                      {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Designation / Role *
                    </label>
                    <input
                      required
                      type="text"
                      value={employeeFormData.designation}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, designation: e.target.value })}
                      placeholder="e.g. Senior Medical Officer"
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Employment Type *
                    </label>
                    <select
                      value={employeeFormData.employmentType}
                      onChange={(e) =>
                        setEmployeeFormData({ ...employeeFormData, employmentType: e.target.value as EmploymentType })
                      }
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    >
                      {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Date of Joining *
                    </label>
                    <input
                      required
                      type="date"
                      value={employeeFormData.dateOfJoining}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, dateOfJoining: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Bank Account Details */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  3. Bank & Payout Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Bank Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={employeeFormData.bankName}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, bankName: e.target.value })}
                      placeholder="e.g. HDFC Bank"
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Account Number *
                    </label>
                    <input
                      required
                      type="text"
                      value={employeeFormData.accountNumber}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, accountNumber: e.target.value })}
                      placeholder="e.g. 50100234567890"
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      IFSC Code *
                    </label>
                    <input
                      required
                      type="text"
                      value={employeeFormData.ifscCode}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, ifscCode: e.target.value.toUpperCase() })}
                      placeholder="e.g. HDFC0001234"
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      PAN Card Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={employeeFormData.panNumber}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, panNumber: e.target.value.toUpperCase() })}
                      placeholder="ABCDE1234F"
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Initial Salary Setup */}
              <div
                style={{
                  marginBottom: '1.5rem',
                  backgroundColor: '#0b1120',
                  border: '1px dashed #334155',
                  borderRadius: '8px',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>
                    4. Initial Salary Configuration (Optional)
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Can also decide later anytime</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Basic Salary (₹/mo)
                    </label>
                    <input
                      type="number"
                      value={employeeFormData.initialBasicSalary}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, initialBasicSalary: e.target.value })}
                      placeholder="e.g. 35000"
                      style={{
                        width: '100%',
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.45rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      HRA (₹/mo)
                    </label>
                    <input
                      type="number"
                      value={employeeFormData.initialHra}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, initialHra: e.target.value })}
                      placeholder="e.g. 14000"
                      style={{
                        width: '100%',
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.45rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Allowances (₹/mo)
                    </label>
                    <input
                      type="number"
                      value={employeeFormData.initialAllowances}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, initialAllowances: e.target.value })}
                      placeholder="e.g. 3000"
                      style={{
                        width: '100%',
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.45rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      PF Deduction (₹/mo)
                    </label>
                    <input
                      type="number"
                      value={employeeFormData.initialPf}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, initialPf: e.target.value })}
                      placeholder="e.g. 1800"
                      style={{
                        width: '100%',
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.45rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeModal(false)}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEmployee}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.6rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: isSubmittingEmployee ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingEmployee ? 0.7 : 1,
                  }}
                >
                  {isSubmittingEmployee ? 'Registering...' : 'Register Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: DECIDE / REVISE SALARY                           */}
      {/* ========================================================= */}
      {showDecideSalaryModal && selectedEmployeeForSalary && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Decide / Revise Monthly Salary
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>
                  Employee: <strong style={{ color: '#f8fafc' }}>{selectedEmployeeForSalary.employee.fullName}</strong> ({selectedEmployeeForSalary.employee.employeeCode})
                </p>
              </div>
              <button
                onClick={() => setShowDecideSalaryModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSalary} style={{ padding: '1.5rem' }}>
              {/* Error banner inside modal */}
              {salaryModalError && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#f87171',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.85rem',
                  }}
                >
                  ⚠️ {salaryModalError}
                </div>
              )}

              {/* Effective Date & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    Effective Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={salaryFormData.effectiveFrom}
                    onChange={(e) => setSalaryFormData({ ...salaryFormData, effectiveFrom: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#0b1120',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    Revision Justification / Notes
                  </label>
                  <input
                    type="text"
                    value={salaryFormData.notes}
                    onChange={(e) => setSalaryFormData({ ...salaryFormData, notes: e.target.value })}
                    placeholder="e.g. Annual revision, probation confirmed"
                    style={{
                      width: '100%',
                      backgroundColor: '#0b1120',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Earnings Components */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Earnings (₹/month)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Basic Salary (₹) *
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={salaryFormData.basicSalary}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, basicSalary: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      HRA (House Rent)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={salaryFormData.hra}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, hra: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Special Allowances
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={salaryFormData.allowances}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, allowances: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Deductions Components */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Statutory Deductions (₹/month)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      PF Deduction
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={salaryFormData.pfDeduction}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, pfDeduction: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Professional Tax / TDS
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={salaryFormData.taxDeduction}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, taxDeduction: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Other Deductions
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={salaryFormData.otherDeductions}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, otherDeductions: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        backgroundColor: '#0b1120',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Calculation Summary Box */}
              <div
                style={{
                  backgroundColor: '#0b1120',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Gross Salary</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                    {formatINR(calculatedGross)}
                  </div>
                </div>
                <div style={{ color: '#64748b', fontSize: '1.25rem' }}>−</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Deductions</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f87171' }}>
                    {formatINR(calculatedDeductions)}
                  </div>
                </div>
                <div style={{ color: '#64748b', fontSize: '1.25rem' }}>=</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Net Take-Home / Mo
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                    {formatINR(calculatedNet)}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDecideSalaryModal(false)}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSalary || calculatedNet <= 0}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.6rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: isSubmittingSalary ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingSalary ? 0.7 : 1,
                  }}
                >
                  {isSubmittingSalary ? 'Saving...' : 'Save & Activate Salary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: DIRECT PAY EMPLOYEE SALARY                       */}
      {/* ========================================================= */}
      {showPayModal && selectedEmployeeForPay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #10b981',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Pay Employee Salary
                </h3>
                <p style={{ color: '#34d399', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>
                  Period: <strong>{selectedPeriod}</strong> • Direct Bank Payout
                </p>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPay} style={{ padding: '1.5rem' }}>
              {/* Error banner inside modal */}
              {payModalError && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#f87171',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>⚠️</span>
                  <span>{payModalError}</span>
                </div>
              )}

              {/* Employee & Bank Summary Box */}
              <div
                style={{
                  backgroundColor: '#0b1120',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1rem' }}>
                      {selectedEmployeeForPay.employee.fullName}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                      {selectedEmployeeForPay.employee.employeeCode} • {selectedEmployeeForPay.employee.designation}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Account:</div>
                    <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontFamily: 'monospace' }}>
                      •••• {selectedEmployeeForPay.employee.bankDetails?.accountNumber?.slice(-4) || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      {selectedEmployeeForPay.employee.bankDetails?.ifscCode}
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount to Pay */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  Salary Payout Amount (₹) *
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  value={payFormData.amount}
                  onChange={(e) => setPayFormData({ ...payFormData, amount: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    backgroundColor: '#0b1120',
                    border: '1px solid #10b981',
                    color: '#10b981',
                    padding: '0.65rem',
                    borderRadius: '6px',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Disbursement Method & Transaction Reference */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    Payment Mode *
                  </label>
                  <select
                    value={payFormData.paymentMethod}
                    onChange={(e) =>
                      setPayFormData({ ...payFormData, paymentMethod: e.target.value as DisbursementPaymentMethod })
                    }
                    style={{
                      width: '100%',
                      backgroundColor: '#0b1120',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {Object.entries(DISBURSEMENT_PAYMENT_METHOD_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    UTR / Transaction Ref # *
                  </label>
                  <input
                    required
                    type="text"
                    value={payFormData.transactionReference}
                    onChange={(e) => setPayFormData({ ...payFormData, transactionReference: e.target.value })}
                    placeholder="e.g. UTR1928374650"
                    style={{
                      width: '100%',
                      backgroundColor: '#0b1120',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Disbursement Date & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    Payment Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={payFormData.disbursementDate}
                    onChange={(e) => setPayFormData({ ...payFormData, disbursementDate: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#0b1120',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    Payer Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={payFormData.notes}
                    onChange={(e) => setPayFormData({ ...payFormData, notes: e.target.value })}
                    placeholder="e.g. Cleared by Super Admin"
                    style={{
                      width: '100%',
                      backgroundColor: '#0b1120',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay || payFormData.amount <= 0}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.6rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: isSubmittingPay ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingPay ? 0.7 : 1,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  {isSubmittingPay ? 'Processing...' : `Confirm & Pay ${formatINR(payFormData.amount)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: GENERATE MONTHLY BATCH RUN                       */}
      {/* ========================================================= */}
      {showGenerateRunModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Generate Monthly Batch Run
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>
                  Creates formal snapshot slips for all active employees.
                </p>
              </div>
              <button
                onClick={() => setShowGenerateRunModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateBatchRun} style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  Payroll Period (YYYY-MM) *
                </label>
                <input
                  required
                  type="month"
                  value={batchPeriodInput}
                  onChange={(e) => setBatchPeriodInput(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0b1120',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  Batch Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={batchNotesInput}
                  onChange={(e) => setBatchNotesInput(e.target.value)}
                  placeholder="e.g. October monthly regular payroll run"
                  style={{
                    width: '100%',
                    backgroundColor: '#0b1120',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowGenerateRunModal(false)}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingRun}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.6rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: isGeneratingRun ? 'not-allowed' : 'pointer',
                    opacity: isGeneratingRun ? 0.7 : 1,
                  }}
                >
                  {isGeneratingRun ? 'Generating...' : 'Confirm & Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
