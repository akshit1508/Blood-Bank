'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Employee,
  getEmployees,
  createEmployee,
  CreateEmployeeInput,
  EmployeeDepartment,
  DEPARTMENT_LABELS,
  EmploymentType,
  EMPLOYMENT_TYPE_LABELS,
  EmployeeStatus,
  EMPLOYEE_STATUS_LABELS,
  formatINR,
} from '@/lib/payroll-api';

export default function EmployeesDirectoryPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Register Employee Modal
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateEmployeeInput>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: '',
    department: EmployeeDepartment.MEDICAL_CLINICAL,
    employmentType: EmploymentType.PERMANENT,
    dateOfJoining: new Date().toISOString().slice(0, 10),
    bankDetails: {
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      accountHolderName: '',
      panNumber: '',
    },
    emergencyContact: {
      name: '',
      phone: '',
      relationship: '',
    },
    notes: '',
  });

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEmployees({
        department: departmentFilter || undefined,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      });
      setEmployees(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, statusFilter, searchFilter]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleInputChange = (field: string, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleBankChange = (field: string, val: any) => {
    setFormData((prev) => ({
      ...prev,
      bankDetails: {
        ...prev.bankDetails,
        [field]: val,
      },
    }));
  };

  const handleEmergencyChange = (field: string, val: any) => {
    setFormData((prev) => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact!,
        [field]: val,
      },
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const cleanedPayload: CreateEmployeeInput = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        designation: formData.designation.trim(),
        department: formData.department,
        employmentType: formData.employmentType,
        dateOfJoining: formData.dateOfJoining,
        bankDetails: {
          bankName: formData.bankDetails.bankName.trim(),
          accountNumber: formData.bankDetails.accountNumber.trim(),
          ifscCode: formData.bankDetails.ifscCode.trim().toUpperCase(),
          accountHolderName: formData.bankDetails.accountHolderName.trim(),
          panNumber: formData.bankDetails.panNumber?.trim()
            ? formData.bankDetails.panNumber.trim().toUpperCase()
            : undefined,
        },
        emergencyContact:
          formData.emergencyContact?.name?.trim() && formData.emergencyContact?.phone?.trim()
            ? {
                name: formData.emergencyContact.name.trim(),
                phone: formData.emergencyContact.phone.trim(),
                relationship: formData.emergencyContact.relationship?.trim() || 'Other',
              }
            : undefined,
        notes: formData.notes?.trim() || undefined,
      };

      await createEmployee(cleanedPayload);
      setShowModal(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        designation: '',
        department: EmployeeDepartment.MEDICAL_CLINICAL,
        employmentType: EmploymentType.PERMANENT,
        dateOfJoining: new Date().toISOString().slice(0, 10),
        bankDetails: {
          bankName: '',
          accountNumber: '',
          ifscCode: '',
          accountHolderName: '',
          panNumber: '',
        },
        emergencyContact: {
          name: '',
          phone: '',
          relationship: '',
        },
        notes: '',
      });
      await loadEmployees();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to register employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === EmployeeStatus.ACTIVE).length;
    let totalMonthlySalary = 0;
    employees.forEach((e) => {
      if (e.status === EmployeeStatus.ACTIVE && e.activeSalaryStructure?.netSalary) {
        totalMonthlySalary += e.activeSalaryStructure.netSalary;
      }
    });
    const clinical = employees.filter(
      (e) =>
        e.department === EmployeeDepartment.MEDICAL_CLINICAL ||
        e.department === EmployeeDepartment.LABORATORY ||
        e.department === EmployeeDepartment.PHLEBOTOMY_COLLECTION,
    ).length;
    const operations = employees.filter(
      (e) =>
        e.department === EmployeeDepartment.ADMINISTRATION_HR ||
        e.department === EmployeeDepartment.FINANCE_ACCOUNTS ||
        e.department === EmployeeDepartment.LOGISTICS_DISPATCH ||
        e.department === EmployeeDepartment.QUALITY_ASSURANCE,
    ).length;
    return { total, active, totalMonthlySalary, clinical, operations };
  }, [employees]);

  const getStatusBadge = (status: EmployeeStatus) => {
    switch (status) {
      case EmployeeStatus.ACTIVE:
        return (
          <span
            style={{
              display: 'inline-flex',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.725rem',
              fontWeight: 700,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.35)',
            }}
          >
            Active
          </span>
        );
      case EmployeeStatus.PROBATION:
        return (
          <span
            style={{
              display: 'inline-flex',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.725rem',
              fontWeight: 700,
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.35)',
            }}
          >
            Probation
          </span>
        );
      case EmployeeStatus.ON_LEAVE:
        return (
          <span
            style={{
              display: 'inline-flex',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.725rem',
              fontWeight: 700,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.35)',
            }}
          >
            On Leave
          </span>
        );
      case EmployeeStatus.RESIGNED:
        return (
          <span
            style={{
              display: 'inline-flex',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.725rem',
              fontWeight: 700,
              backgroundColor: '#334155',
              color: '#94a3b8',
              border: '1px solid #475569',
            }}
          >
            Resigned
          </span>
        );
      case EmployeeStatus.TERMINATED:
        return (
          <span
            style={{
              display: 'inline-flex',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.725rem',
              fontWeight: 700,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            Terminated
          </span>
        );
      default:
        return <span style={{ color: '#94a3b8' }}>{status}</span>;
    }
  };

  return (
    <div
      style={{
        maxWidth: '1360px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        color: '#0f172a',
      }}
    >
      {/* 1. Header with Authority Badge & Register Button (NO Payroll buttons) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid #fef3c7',
          paddingBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: '#fef3c7',
                color: '#92400e',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #fde68a',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Super Admin Authority
            </span>
          </div>
          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0.35rem 0 0 0',
              letterSpacing: '-0.02em',
            }}
          >
            Blood Bank Employee & Staff Directory
          </h1>
          <p style={{ color: '#94a3b8', margin: '0.35rem 0 0 0', fontSize: '0.875rem' }}>
            Complete staff roster, departmental profiles, contact details, bank credentials, and monthly compensation.
          </p>
        </div>

        <div>
          <button
            onClick={() => {
              setSubmitError(null);
              setShowModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#d97706',
              color: '#ffffff',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(220,38,38,0.3)',
            }}
          >
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span>
            <span>Register New Employee</span>
          </button>
        </div>
      </div>

      {/* 2. Employee Statistics Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Registered Staff
          </div>
          <div style={{ color: '#0f172a', fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem' }}>
            {stats.total}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
            Across all 7 departments
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
          }}
        >
          <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            Active Personnel
          </div>
          <div style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem' }}>
            {stats.active}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
            Currently in active service
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
          }}
        >
          <div style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            Total Monthly Decided Salary
          </div>
          <div style={{ color: '#38bdf8', fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem' }}>
            {formatINR(stats.totalMonthlySalary)}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
            Monthly net take-home liability
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
          }}
        >
          <div style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            Departmental Breakdown
          </div>
          <div style={{ color: '#f59e0b', fontSize: '1.4rem', fontWeight: 800, marginTop: '0.45rem' }}>
            {stats.clinical} Clinical &bull; {stats.operations} Support
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
            Medical officers, lab & operations
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          backgroundColor: '#ffffff',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          border: '1px solid #fde68a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search name, code, phone, email, designation..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '0.5rem 0.85rem',
              color: '#0f172a',
              fontSize: '0.85rem',
              outline: 'none',
              width: '280px',
            }}
          />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '0.5rem 0.85rem',
              color: '#0f172a',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">All Departments</option>
            {Object.values(EmployeeDepartment).map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABELS[d]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '0.5rem 0.85rem',
              color: '#0f172a',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">All Statuses</option>
            {Object.values(EmployeeStatus).map((s) => (
              <option key={s} value={s}>
                {EMPLOYEE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {(departmentFilter || statusFilter || searchFilter) && (
            <button
              onClick={() => {
                setDepartmentFilter('');
                setStatusFilter('');
                setSearchFilter('');
              }}
              style={{
                border: '1px solid #991b1b',
                backgroundColor: '#450a0a',
                color: '#fca5a5',
                fontSize: '0.775rem',
                fontWeight: 600,
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        <button
          onClick={loadEmployees}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            padding: '0.5rem 0.95rem',
            borderRadius: '8px',
            color: '#0f172a',
            fontSize: '0.825rem',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <span>🔄</span>
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#450a0a',
            border: '1px solid #991b1b',
            borderRadius: '8px',
            color: '#fca5a5',
            fontSize: '0.875rem',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* 4. Complete Employee Directory Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #fef3c7',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Staff & Employee Dossier Table
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              Click any employee to view their complete dossier, date of joining, contact, bank, and full salary breakdown.
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {employees.length} employees registered
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
            Loading employee directory...
          </div>
        ) : employees.length === 0 ? (
          <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👥</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              No employees registered
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '420px', margin: '0.5rem auto 1.25rem' }}>
              Register new blood bank employees with their complete personal, contact, and banking details.
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                backgroundColor: '#d97706',
                color: '#ffffff',
                padding: '0.65rem 1.35rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Register First Employee
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                  <th style={{ padding: '0.8rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Code
                  </th>
                  <th style={{ padding: '0.8rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Staff Member
                  </th>
                  <th style={{ padding: '0.8rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Role & Department
                  </th>
                  <th style={{ padding: '0.8rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Contact Details
                  </th>
                  <th style={{ padding: '0.8rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Date Joined
                  </th>
                  <th style={{ padding: '0.8rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Decided Salary
                  </th>
                  <th style={{ padding: '0.8rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Bank Coordinates
                  </th>
                  <th style={{ padding: '0.8rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                    Status
                  </th>
                  <th style={{ padding: '0.8rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr
                    key={emp._id}
                    onClick={() => router.push(`/super-admin/employees/${emp._id}`)}
                    style={{
                      borderBottom: '1px solid #fef3c7',
                      transition: 'background-color 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(30, 41, 59, 0.45)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '0.95rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem' }}>
                      {emp.employeeCode}
                    </td>
                    <td style={{ padding: '0.95rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(220, 38, 38, 0.15)',
                            border: '1px solid rgba(220, 38, 38, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#f87171',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                          }}
                        >
                          {emp.firstName[0]}
                          {emp.lastName[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{emp.fullName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {EMPLOYMENT_TYPE_LABELS[emp.employmentType] || emp.employmentType}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.95rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{emp.designation}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {DEPARTMENT_LABELS[emp.department] || emp.department}
                      </div>
                    </td>
                    <td style={{ padding: '0.95rem 1rem' }}>
                      <div style={{ fontSize: '0.825rem', color: '#0f172a' }}>{emp.email}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{emp.phone}</div>
                    </td>
                    <td style={{ padding: '0.95rem 1rem' }}>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#cbd5e1' }}>
                        {new Date(emp.dateOfJoining).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                        {(() => {
                          const diffDays = Math.ceil(
                            Math.abs(new Date().getTime() - new Date(emp.dateOfJoining).getTime()) /
                              (1000 * 60 * 60 * 24),
                          );
                          if (diffDays < 30) return `${diffDays} days tenure`;
                          const months = Math.floor(diffDays / 30.4375);
                          if (months < 12) return `${months} mo tenure`;
                          return `${(diffDays / 365.25).toFixed(1)} yrs tenure`;
                        })()}
                      </div>
                    </td>
                    <td style={{ padding: '0.95rem 1rem' }}>
                      {emp.activeSalaryStructure ? (
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#10b981' }}>
                            {formatINR(emp.activeSalaryStructure.netSalary)}
                            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#94a3b8' }}>/mo</span>
                          </div>
                          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                            Basic: {formatINR(emp.activeSalaryStructure.basicSalary)}
                          </div>
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.725rem',
                            backgroundColor: '#ffffff',
                            color: '#94a3b8',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #fde68a',
                          }}
                        >
                          Not Decided
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.95rem 1rem' }}>
                      {emp.bankDetails?.accountNumber ? (
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                            {emp.bankDetails.bankName}
                          </div>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                            A/C ••••{emp.bankDetails.accountNumber.slice(-4)} &bull; {emp.bankDetails.ifscCode}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                          Not provided
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.95rem 1rem', textAlign: 'center' }}>
                      {getStatusBadge(emp.status)}
                    </td>
                    <td style={{ padding: '0.95rem 1rem', textAlign: 'right' }}>
                      <Link
                        href={`/super-admin/employees/${emp._id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          border: '1px solid #fde68a',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <span>View Details</span>
                        <span>&rarr;</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Register Employee Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              padding: '1.75rem',
              color: '#0f172a',
              boxShadow: '0 20px 25px -5px rgba(180, 83, 9, 0.15)',
              margin: '2rem auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #fef3c7',
                paddingBottom: '0.75rem',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Register New Blood Bank Staff
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.2rem 0 0 0' }}>
                  Record personal profile, department role, emergency contact, and bank account details.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#0f172a',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#0f172a',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#0f172a',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#0f172a',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Designation *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Medical Officer"
                    value={formData.designation}
                    onChange={(e) => handleInputChange('designation', e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#0f172a',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#0f172a',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {Object.values(EmployeeDepartment).map((d) => (
                      <option key={d} value={d}>
                        {DEPARTMENT_LABELS[d]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Employment Type
                  </label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) => handleInputChange('employmentType', e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#0f172a',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {Object.values(EmploymentType).map((t) => (
                      <option key={t} value={t}>
                        {EMPLOYMENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Date of Joining *
                </label>
                <input
                  type="date"
                  required
                  value={formData.dateOfJoining}
                  onChange={(e) => handleInputChange('dateOfJoining', e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#ffffff',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    color: '#0f172a',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Bank Details Container */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #fde68a',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Bank Disbursement Account Coordinates
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. HDFC Bank"
                      value={formData.bankDetails.bankName}
                      onChange={(e) => handleBankChange('bankName', e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Account Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Account number"
                      value={formData.bankDetails.accountNumber}
                      onChange={(e) => handleBankChange('accountNumber', e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      IFSC Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. HDFC0001234"
                      value={formData.bankDetails.ifscCode}
                      onChange={(e) => handleBankChange('ifscCode', e.target.value.toUpperCase())}
                      style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                        outline: 'none',
                        textTransform: 'uppercase',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Account Holder Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Name on bank passbook"
                      value={formData.bankDetails.accountHolderName}
                      onChange={(e) => handleBankChange('accountHolderName', e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      PAN Card Number <span style={{ color: '#64748b' }}>(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ABCDE1234F"
                      value={formData.bankDetails.panNumber || ''}
                      onChange={(e) => handleBankChange('panNumber', e.target.value.toUpperCase())}
                      style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                        outline: 'none',
                        textTransform: 'uppercase',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Optional Emergency Contact Container */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #fde68a',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Emergency Contact <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Contact Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Jane Doe"
                      value={formData.emergencyContact?.name || ''}
                      onChange={(e) => handleEmergencyChange('name', e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={formData.emergencyContact?.phone || ''}
                      onChange={(e) => handleEmergencyChange('phone', e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Relationship
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Spouse / Parent"
                      value={formData.emergencyContact?.relationship || ''}
                      onChange={(e) => handleEmergencyChange('relationship', e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {submitError && (
                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#450a0a',
                    border: '1px solid #991b1b',
                    borderRadius: '8px',
                    color: '#fca5a5',
                    fontSize: '0.8rem',
                  }}
                >
                  ⚠️ {submitError}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderTop: '1px solid #1e293b',
                  paddingTop: '1rem',
                  marginTop: '0.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #fde68a',
                    color: '#0f172a',
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  {isSubmitting ? 'Registering...' : 'Register Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
