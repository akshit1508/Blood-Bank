'use client';

import React, { useEffect, useState, useCallback } from 'react';
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

      // Clean & sanitize payload before submitting
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
      // Reset form
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

  const getStatusBadge = (status: EmployeeStatus) => {
    switch (status) {
      case EmployeeStatus.ACTIVE:
        return (
          <span
            style={{
              display: 'inline-flex',
              padding: '0.2rem 0.55rem',
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
              padding: '0.2rem 0.55rem',
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
              padding: '0.2rem 0.55rem',
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
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              fontSize: '0.725rem',
              fontWeight: 700,
              backgroundColor: '#334155',
              color: '#94a3b8',
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
              padding: '0.2rem 0.55rem',
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
    }
  };

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
        color: '#f8fafc',
      }}
    >
      {/* 1. Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: '#1e293b',
                color: '#f59e0b',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #334155',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Super Admin Authority
            </span>
          </div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#f8fafc',
              margin: '0.35rem 0 0 0',
              letterSpacing: '-0.02em',
            }}
          >
            Blood Bank Staff & Employee Directory
          </h1>
          <p style={{ color: '#94a3b8', margin: '0.35rem 0 0 0', fontSize: '0.875rem' }}>
            Manage medical officers, phlebotomists, lab technicians, and administration staff profiles and compensation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            href="/super-admin/payroll"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <span>💳</span>
            <span>Payroll Batches</span>
          </Link>
          <button
            onClick={() => {
              setSubmitError(null);
              setShowModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(220,38,38,0.3)',
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
            <span>Register Employee</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          backgroundColor: '#0f172a',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          border: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search name, code, phone..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              color: '#f8fafc',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              color: '#f8fafc',
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
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              color: '#f8fafc',
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
                padding: '0.4rem 0.65rem',
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
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            padding: '0.45rem 0.85rem',
            borderRadius: '8px',
            color: '#f8fafc',
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

      {/* 3. Employees Table Card */}
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
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
            Registered Staff
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {employees.length} employees found
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
            Loading staff records...
          </div>
        ) : employees.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👥</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              No employees registered
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '420px', margin: '0.5rem auto 1.25rem' }}>
              Register new blood bank employees to configure compensation structures and run payroll.
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '0.6rem 1.2rem',
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
                <tr style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Code
                  </th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Full Name
                  </th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Department & Designation
                  </th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Contact
                  </th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Type
                  </th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Joined
                  </th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                    Status
                  </th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr
                    key={emp._id}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '0.9rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8', fontSize: '0.8rem' }}>
                      {emp.employeeCode}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', fontWeight: 700, color: '#f8fafc' }}>
                      {emp.fullName}
                    </td>
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{emp.designation}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {DEPARTMENT_LABELS[emp.department] || emp.department}
                      </div>
                    </td>
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#f8fafc' }}>{emp.email}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{emp.phone}</div>
                    </td>
                    <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {EMPLOYMENT_TYPE_LABELS[emp.employmentType] || emp.employmentType}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                      {new Date(emp.dateOfJoining).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                      {getStatusBadge(emp.status)}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                      <Link
                        href={`/super-admin/employees/${emp._id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(`/super-admin/employees/${emp._id}`);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: '#1e293b',
                          color: '#f8fafc',
                          border: '1px solid #334155',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <span>Profile & Salary</span>
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

      {/* 4. Register Employee Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              margin: '2rem auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #1e293b',
                paddingBottom: '0.75rem',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Register New Blood Bank Staff
              </h3>
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
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#f8fafc',
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
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#f8fafc',
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
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#f8fafc',
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
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#f8fafc',
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
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#f8fafc',
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
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#f8fafc',
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
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#f8fafc',
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
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    color: '#f8fafc',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Bank Details Container */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Bank Disbursement Account Details
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
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#f8fafc',
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
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#f8fafc',
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
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#f8fafc',
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
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#f8fafc',
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
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#f8fafc',
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
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
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
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#f8fafc',
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
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#f8fafc',
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
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        color: '#f8fafc',
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
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc',
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
                    backgroundColor: '#dc2626',
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
