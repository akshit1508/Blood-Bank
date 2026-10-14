'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Employee,
  SalaryStructure,
  getEmployeeById,
  getActiveSalaryStructure,
  updateEmployee,
  terminateEmployee,
  formatINR,
  EmployeeDepartment,
  DEPARTMENT_LABELS,
  EmploymentType,
  EMPLOYMENT_TYPE_LABELS,
  EmployeeStatus,
  EMPLOYEE_STATUS_LABELS,
  UpdateEmployeeInput,
} from '@/lib/payroll-api';

interface PageProps {
  params: { id: string };
}

export default function EmployeeProfilePage({ params }: PageProps) {
  const routeParams = useParams();
  const rawEmployeeId = routeParams?.id || params?.id;
  const employeeId = Array.isArray(rawEmployeeId) ? rawEmployeeId[0] : (rawEmployeeId as string);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeStructure, setActiveStructure] = useState<SalaryStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Employee Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateEmployeeInput>({});

  // Status Lifecycle Modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lifecycleStatus, setLifecycleStatus] = useState<EmployeeStatus>(EmployeeStatus.ACTIVE);
  const [leavingDate, setLeavingDate] = useState<string>('');
  const [lifecycleNotes, setLifecycleNotes] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      setError(null);
      const [empData, activeData] = await Promise.all([
        getEmployeeById(employeeId),
        getActiveSalaryStructure(employeeId).catch(() => null),
      ]);
      setEmployee(empData);
      setActiveStructure(activeData || empData.activeSalaryStructure || null);

      if (empData) {
        setEditForm({
          firstName: empData.firstName,
          lastName: empData.lastName,
          email: empData.email,
          phone: empData.phone,
          designation: empData.designation,
          department: empData.department,
          employmentType: empData.employmentType,
          dateOfJoining: empData.dateOfJoining ? empData.dateOfJoining.slice(0, 10) : '',
          bankDetails: empData.bankDetails ? { ...empData.bankDetails } : undefined,
          emergencyContact: empData.emergencyContact ? { ...empData.emergencyContact } : undefined,
          notes: empData.notes || '',
        });
        setLifecycleStatus(empData.status);
        setLeavingDate(empData.dateOfLeaving ? empData.dateOfLeaving.slice(0, 10) : '');
        setLifecycleNotes(empData.notes || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load employee details');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tenure & Joined Details calculation
  const joinedDetails = useMemo(() => {
    if (!employee?.dateOfJoining) return { formattedDate: 'N/A', tenureStr: 'N/A', daysCount: 0 };
    const join = new Date(employee.dateOfJoining);
    const end = employee.dateOfLeaving ? new Date(employee.dateOfLeaving) : new Date();

    const formattedDate = join.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const diffTime = Math.abs(end.getTime() - join.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let tenureStr = `${diffDays} days`;
    if (diffDays >= 30 && diffDays < 365) {
      const months = Math.floor(diffDays / 30.4375);
      const remDays = Math.round(diffDays % 30.4375);
      tenureStr = `${months} month${months > 1 ? 's' : ''}${remDays > 0 ? ` ${remDays} day${remDays > 1 ? 's' : ''}` : ''}`;
    } else if (diffDays >= 365) {
      const years = Math.floor(diffDays / 365.25);
      const remMonths = Math.floor((diffDays % 365.25) / 30.4375);
      tenureStr = `${years} year${years > 1 ? 's' : ''}${remMonths > 0 ? ` ${remMonths} month${remMonths > 1 ? 's' : ''}` : ''}`;
    }

    return { formattedDate, tenureStr, daysCount: diffDays };
  }, [employee]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;
    try {
      setIsSaving(true);
      setEditError(null);
      await updateEmployee(employeeId, editForm);
      setShowEditModal(false);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update employee details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;
    try {
      setIsUpdatingStatus(true);
      setStatusError(null);
      if (lifecycleStatus === EmployeeStatus.RESIGNED || lifecycleStatus === EmployeeStatus.TERMINATED) {
        await terminateEmployee(employeeId, {
          status: lifecycleStatus,
          dateOfLeaving: leavingDate || new Date().toISOString().slice(0, 10),
          notes: lifecycleNotes.trim() || undefined,
        });
      } else {
        await updateEmployee(employeeId, {
          status: lifecycleStatus,
          dateOfLeaving: undefined,
          notes: lifecycleNotes.trim() || undefined,
        });
      }
      setShowStatusModal(false);
      await loadData();
    } catch (err: any) {
      setStatusError(err.message || 'Failed to update employee lifecycle status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: EmployeeStatus) => {
    switch (status) {
      case EmployeeStatus.ACTIVE:
        return (
          <span
            style={{
              display: 'inline-flex',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 700,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.35)',
            }}
          >
            Active Personnel
          </span>
        );
      case EmployeeStatus.PROBATION:
        return (
          <span
            style={{
              display: 'inline-flex',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 700,
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.35)',
            }}
          >
            On Probation
          </span>
        );
      case EmployeeStatus.ON_LEAVE:
        return (
          <span
            style={{
              display: 'inline-flex',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
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
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
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
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
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

  if (loading) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading employee dossier...
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '4rem', textAlign: 'center' }}>
        <div style={{ color: '#f87171', fontWeight: 600, marginBottom: '1.25rem', fontSize: '1.1rem' }}>
          ⚠️ {error || 'Employee record not found'}
        </div>
        <Link
          href="/super-admin/employees"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            padding: '0.6rem 1.15rem',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '0.875rem',
          }}
        >
          &larr; Back to Employee Directory
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        color: '#f8fafc',
      }}
    >
      {/* 1. Breadcrumbs & Top Navigation (NO Payroll link) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link
          href="/super-admin/employees"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            color: '#94a3b8',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <span>&larr;</span>
          <span>Back to Employee Directory</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              padding: '0.3rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid #334155',
              fontWeight: 700,
            }}
          >
            {employee.employeeCode}
          </span>
          {getStatusBadge(employee.status)}
        </div>
      </div>

      {/* 2. Employee Profile Header Banner */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '18px',
              backgroundColor: 'rgba(220, 38, 38, 0.15)',
              border: '1px solid rgba(220, 38, 38, 0.35)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.65rem',
              fontWeight: 800,
            }}
          >
            {employee.firstName[0]}
            {employee.lastName[0]}
          </div>

          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              {employee.fullName}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '0.35rem 0 0 0', fontWeight: 600 }}>
              {employee.designation} &bull;{' '}
              <span style={{ color: '#cbd5e1' }}>{DEPARTMENT_LABELS[employee.department] || employee.department}</span>
            </p>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.25rem 0 0 0' }}>
              {EMPLOYMENT_TYPE_LABELS[employee.employmentType] || employee.employmentType} &bull;{' '}
              Code: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{employee.employeeCode}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons (NO Payroll) */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setEditError(null);
              setShowEditModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>✏️</span>
            <span>Edit Employee Details</span>
          </button>

          <button
            onClick={() => {
              setStatusError(null);
              setShowStatusModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #334155',
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>⚙️</span>
            <span>Update Employment Status</span>
          </button>
        </div>
      </div>

      {/* 3. High-Priority "When He Joined & Tenure" Highlight Banner */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #0284c7',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
          background: 'linear-gradient(135deg, #0f172a 0%, #0c2340 100%)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📅 Official Joining Date
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.35rem' }}>
            {joinedDetails.formattedDate}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Inducted into {DEPARTMENT_LABELS[employee.department] || employee.department}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⏳ Length of Service / Tenure
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '0.35rem' }}>
            {joinedDetails.tenureStr}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            {joinedDetails.daysCount} total days with organization
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📋 Current Staff Status
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.35rem' }}>
            {EMPLOYEE_STATUS_LABELS[employee.status] || employee.status}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            {EMPLOYMENT_TYPE_LABELS[employee.employmentType] || employee.employmentType}
          </div>
        </div>

        {employee.dateOfLeaving && (
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🚪 Separation / Exit Date
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171', marginTop: '0.35rem' }}>
              {new Date(employee.dateOfLeaving).toLocaleDateString('en-IN', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '0.2rem' }}>
              Service completed
            </div>
          </div>
        )}
      </div>

      {/* 4. Complete Decided Salary & Compensation Dossier */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            borderBottom: '1px solid #1e293b',
            paddingBottom: '0.75rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              💰 Decided Salary & Compensation Structure
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', margin: '0.25rem 0 0 0' }}>
              Monthly Earnings & Deductions Breakdown
            </h2>
          </div>

          {activeStructure && (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', backgroundColor: '#1e293b', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #334155' }}>
              Revision #{activeStructure.revisionNumber} &bull; Effective From{' '}
              <strong style={{ color: '#f8fafc' }}>
                {new Date(activeStructure.effectiveFrom).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </strong>
            </div>
          )}
        </div>

        {activeStructure ? (
          <div>
            {/* Top Salary Summary Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                  Net Monthly Take-Home Pay
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10b981', marginTop: '0.35rem' }}>
                  {formatINR(activeStructure.netSalary)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6ee7b7', marginTop: '0.2rem' }}>
                  Credited directly to bank account
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                  Gross Monthly Salary
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.35rem' }}>
                  {formatINR(activeStructure.grossSalary)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Basic + HRA + Allowances
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Monthly Deductions
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f87171', marginTop: '0.35rem' }}>
                  -{formatINR(activeStructure.pfDeduction + activeStructure.taxDeduction + activeStructure.otherDeductions)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                  PF, income tax & deductions
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                  Annual Cost to Company (CTC)
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.35rem' }}>
                  {formatINR(activeStructure.grossSalary * 12)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Estimated annual package
                </div>
              </div>
            </div>

            {/* Detailed Component Breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
              }}
            >
              {/* Earnings Table */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  📈 Monthly Earnings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Basic Salary</span>
                    <strong style={{ color: '#f8fafc' }}>{formatINR(activeStructure.basicSalary)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>House Rent Allowance (HRA)</span>
                    <strong style={{ color: '#f8fafc' }}>{formatINR(activeStructure.hra)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Special & Medical Allowances</span>
                    <strong style={{ color: '#f8fafc' }}>{formatINR(activeStructure.allowances)}</strong>
                  </div>
                  <div style={{ borderTop: '1px solid #334155', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc' }}>Gross Earnings</span>
                    <strong style={{ color: '#10b981', fontWeight: 800 }}>{formatINR(activeStructure.grossSalary)}</strong>
                  </div>
                </div>
              </div>

              {/* Deductions Table */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  📉 Monthly Deductions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Provident Fund (PF)</span>
                    <strong style={{ color: '#f8fafc' }}>{formatINR(activeStructure.pfDeduction)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Professional / Income Tax (TDS)</span>
                    <strong style={{ color: '#f8fafc' }}>{formatINR(activeStructure.taxDeduction)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Other Authorized Deductions</span>
                    <strong style={{ color: '#f8fafc' }}>{formatINR(activeStructure.otherDeductions)}</strong>
                  </div>
                  <div style={{ borderTop: '1px solid #334155', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc' }}>Total Deductions</span>
                    <strong style={{ color: '#f87171', fontWeight: 800 }}>
                      -{formatINR(activeStructure.pfDeduction + activeStructure.taxDeduction + activeStructure.otherDeductions)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.85rem' }}>
              <span>Decided & Configured by: <strong style={{ color: '#94a3b8' }}>{activeStructure.createdByName}</strong></span>
              {activeStructure.notes && <span>Memo: {activeStructure.notes}</span>}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              backgroundColor: '#1e293b',
              borderRadius: '10px',
              border: '1px dashed #334155',
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              Salary Structure Not Decided Yet
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
              No active compensation structure has been assigned to this employee yet.
            </p>
          </div>
        )}
      </div>

      {/* 5. Complete Employee Details Grid (Employment, Contact, Bank, Notes) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Card 1: Job & Employment Details */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#38bdf8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid #1e293b',
              paddingBottom: '0.5rem',
            }}
          >
            <span>🏢 Employment & Department Profile</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Employee Code</div>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#f8fafc', marginTop: '0.2rem' }}>
                {employee.employeeCode}
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Official Designation</div>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>
                {employee.designation}
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Assigned Department</div>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>
                {DEPARTMENT_LABELS[employee.department] || employee.department}
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Employment Category</div>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>
                {EMPLOYMENT_TYPE_LABELS[employee.employmentType] || employee.employmentType}
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Joining Date</div>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>
                {new Date(employee.dateOfJoining).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Active Service Tenure</div>
              <div style={{ fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                {joinedDetails.tenureStr}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Contact & Emergency Information */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#10b981',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid #1e293b',
              paddingBottom: '0.5rem',
            }}
          >
            <span>📞 Contact & Emergency Information</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Official Email Address</div>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>
                {employee.email}
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Mobile Phone Number</div>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>
                {employee.phone}
              </div>
            </div>

            <div
              style={{
                gridColumn: 'span 2',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.85rem',
              }}
            >
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Emergency Contact Details
              </div>
              {employee.emergencyContact?.name ? (
                <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                    {employee.emergencyContact.name}{' '}
                    <span style={{ color: '#94a3b8', fontWeight: 400 }}>({employee.emergencyContact.relationship})</span>
                  </div>
                  <div style={{ color: '#38bdf8', fontSize: '0.85rem' }}>
                    Phone: {employee.emergencyContact.phone}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.3rem', fontStyle: 'italic' }}>
                  No emergency contact registered.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Disbursement Bank Account */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#f59e0b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid #1e293b',
              paddingBottom: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>🏦 Bank Account Coordinates</span>
            <span
              style={{
                fontSize: '0.7rem',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              Direct Deposit Verified
            </span>
          </div>

          {employee.bankDetails ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Bank Name</div>
                <div style={{ fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
                  {employee.bankDetails.bankName}
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Account Holder</div>
                <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>
                  {employee.bankDetails.accountHolderName}
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Account Number</div>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8', marginTop: '0.2rem' }}>
                  {employee.bankDetails.accountNumber}
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>IFSC Branch Code</div>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#f8fafc', marginTop: '0.2rem' }}>
                  {employee.bankDetails.ifscCode}
                </div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Permanent Account Number (PAN)</div>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#cbd5e1', marginTop: '0.2rem' }}>
                  {employee.bankDetails.panNumber || 'Not provided'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
              No bank account coordinates registered for this employee.
            </div>
          )}
        </div>

        {/* Card 4: Administrative Notes & Dossier History */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid #1e293b',
              paddingBottom: '0.5rem',
            }}
          >
            <span>📝 Administrative Records & Audit</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Dossier Registered On</div>
                <div style={{ color: '#cbd5e1', marginTop: '0.15rem' }}>
                  {new Date(employee.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Last Profile Modified</div>
                <div style={{ color: '#cbd5e1', marginTop: '0.15rem' }}>
                  {new Date(employee.updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Staff Memo / Notes</div>
              <div
                style={{
                  marginTop: '0.35rem',
                  padding: '0.75rem',
                  backgroundColor: '#1e293b',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  color: employee.notes ? '#f8fafc' : '#64748b',
                  fontStyle: employee.notes ? 'normal' : 'italic',
                  fontSize: '0.825rem',
                  minHeight: '48px',
                }}
              >
                {employee.notes || 'No administrative notes recorded.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Edit Employee Details */}
      {showEditModal && (
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
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Edit Employee Details
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.2rem 0 0 0' }}>
                  Update contact, department, emergency person, or bank account credentials.
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
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

            <form onSubmit={handleEditSubmit} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
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
                    value={editForm.lastName || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
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
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
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
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
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
                    value={editForm.designation || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, designation: e.target.value }))}
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
                    value={editForm.department}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value as EmployeeDepartment }))}
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
                    value={editForm.employmentType}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, employmentType: e.target.value as EmploymentType }))}
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

              {/* Bank Details */}
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
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                  Bank Account Coordinates
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.bankDetails?.bankName || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          bankDetails: {
                            ...prev.bankDetails!,
                            bankName: e.target.value,
                          },
                        }))
                      }
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
                      value={editForm.bankDetails?.accountNumber || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          bankDetails: {
                            ...prev.bankDetails!,
                            accountNumber: e.target.value,
                          },
                        }))
                      }
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
                      IFSC Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.bankDetails?.ifscCode || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          bankDetails: {
                            ...prev.bankDetails!,
                            ifscCode: e.target.value.toUpperCase(),
                          },
                        }))
                      }
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
                      value={editForm.bankDetails?.accountHolderName || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          bankDetails: {
                            ...prev.bankDetails!,
                            accountHolderName: e.target.value,
                          },
                        }))
                      }
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

              {/* Emergency Contact */}
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
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Emergency Contact
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={editForm.emergencyContact?.name || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          emergencyContact: {
                            name: e.target.value,
                            phone: prev.emergencyContact?.phone || '',
                            relationship: prev.emergencyContact?.relationship || '',
                          },
                        }))
                      }
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
                      value={editForm.emergencyContact?.phone || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          emergencyContact: {
                            name: prev.emergencyContact?.name || '',
                            phone: e.target.value,
                            relationship: prev.emergencyContact?.relationship || '',
                          },
                        }))
                      }
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
                      value={editForm.emergencyContact?.relationship || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          emergencyContact: {
                            name: prev.emergencyContact?.name || '',
                            phone: prev.emergencyContact?.phone || '',
                            relationship: e.target.value,
                          },
                        }))
                      }
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

              {/* Administrative Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Administrative Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
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
                    resize: 'vertical',
                  }}
                />
              </div>

              {editError && (
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
                  ⚠️ {editError}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderTop: '1px solid #1e293b',
                  paddingTop: '1rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
                  disabled={isSaving}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {isSaving ? 'Saving Changes...' : 'Save Employee Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Status / Life Cycle */}
      {showStatusModal && (
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
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Update Staff Employment Status
              </h3>
              <button
                onClick={() => setShowStatusModal(false)}
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

            <form onSubmit={handleStatusSubmit} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Employment Status *
                </label>
                <select
                  value={lifecycleStatus}
                  onChange={(e) => setLifecycleStatus(e.target.value as EmployeeStatus)}
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
                >
                  {Object.values(EmployeeStatus).map((s) => (
                    <option key={s} value={s}>
                      {EMPLOYEE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              {(lifecycleStatus === EmployeeStatus.RESIGNED || lifecycleStatus === EmployeeStatus.TERMINATED) && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#f87171', marginBottom: '0.35rem' }}>
                    Separation / Exit Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={leavingDate}
                    onChange={(e) => setLeavingDate(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #991b1b',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Lifecycle Reason / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Regular status review, extended leave approved, or resignation accepted"
                  value={lifecycleNotes}
                  onChange={(e) => setLifecycleNotes(e.target.value)}
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
                    resize: 'vertical',
                  }}
                />
              </div>

              {statusError && (
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
                  ⚠️ {statusError}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderTop: '1px solid #1e293b',
                  paddingTop: '1rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
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
                  disabled={isUpdatingStatus}
                  style={{
                    backgroundColor:
                      lifecycleStatus === EmployeeStatus.TERMINATED || lifecycleStatus === EmployeeStatus.RESIGNED
                        ? '#dc2626'
                        : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                    opacity: isUpdatingStatus ? 0.6 : 1,
                  }}
                >
                  {isUpdatingStatus ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
