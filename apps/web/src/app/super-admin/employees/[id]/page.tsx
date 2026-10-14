'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Employee,
  SalaryStructure,
  getEmployeeById,
  getActiveSalaryStructure,
  getSalaryStructureHistory,
  createSalaryStructure,
  terminateEmployee,
  formatINR,
  EmployeeStatus,
  EMPLOYEE_STATUS_LABELS,
  DEPARTMENT_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  CreateSalaryStructureInput,
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
  const [structureHistory, setStructureHistory] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Revise Compensation Structure Modal
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [isSavingStructure, setIsSavingStructure] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  const [structureForm, setStructureForm] = useState<CreateSalaryStructureInput>({
    effectiveFrom: new Date().toISOString().slice(0, 10),
    basicSalary: 0,
    hra: 0,
    allowances: 0,
    pfDeduction: 0,
    taxDeduction: 0,
    otherDeductions: 0,
    notes: '',
  });

  // Termination Modal
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [termStatus, setTermStatus] = useState<EmployeeStatus>(EmployeeStatus.RESIGNED);
  const [termDate, setTermDate] = useState(new Date().toISOString().slice(0, 10));
  const [termNotes, setTermNotes] = useState('');
  const [isTerminating, setIsTerminating] = useState(false);
  const [termError, setTermError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      setError(null);
      const [empData, activeData, historyData] = await Promise.all([
        getEmployeeById(employeeId),
        getActiveSalaryStructure(employeeId),
        getSalaryStructureHistory(employeeId),
      ]);
      setEmployee(empData);
      setActiveStructure(activeData);
      setStructureHistory(historyData);

      if (activeData) {
        setStructureForm({
          effectiveFrom: new Date().toISOString().slice(0, 10),
          basicSalary: activeData.basicSalary,
          hra: activeData.hra,
          allowances: activeData.allowances,
          pfDeduction: activeData.pfDeduction,
          taxDeduction: activeData.taxDeduction,
          otherDeductions: activeData.otherDeductions,
          notes: '',
        });
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

  const handleStructureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (structureForm.basicSalary <= 0) {
      setStructureError('Basic salary must be greater than ₹0');
      return;
    }

    try {
      setIsSavingStructure(true);
      setStructureError(null);
      await createSalaryStructure(employeeId, structureForm);
      setShowStructureModal(false);
      await loadData();
    } catch (err: any) {
      setStructureError(err.message || 'Failed to revise salary structure');
    } finally {
      setIsSavingStructure(false);
    }
  };

  const handleTerminateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsTerminating(true);
      setTermError(null);
      await terminateEmployee(employeeId, {
        status: termStatus,
        dateOfLeaving: termDate,
        notes: termNotes.trim() || undefined,
      });
      setShowTerminateModal(false);
      await loadData();
    } catch (err: any) {
      setTermError(err.message || 'Failed to update employee status');
    } finally {
      setIsTerminating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading profile...
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
        <div style={{ color: '#f87171', fontWeight: 600, marginBottom: '1rem' }}>{error || 'Employee not found'}</div>
        <Link
          href="/super-admin/employees"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          &larr; Back to Directory
        </Link>
      </div>
    );
  }

  // Live calculation for modal preview
  const previewGross =
    (Number(structureForm.basicSalary) || 0) +
    (Number(structureForm.hra) || 0) +
    (Number(structureForm.allowances) || 0);

  const previewDeductions =
    (Number(structureForm.pfDeduction) || 0) +
    (Number(structureForm.taxDeduction) || 0) +
    (Number(structureForm.otherDeductions) || 0);

  const previewNet = previewGross - previewDeductions;

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
      {/* 1. Breadcrumbs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <span>Back to Staff Directory</span>
        </Link>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            backgroundColor: '#1e293b',
            color: '#38bdf8',
            padding: '0.25rem 0.65rem',
            borderRadius: '6px',
            border: '1px solid #334155',
            fontWeight: 700,
          }}
        >
          Employee: {employee.employeeCode}
        </span>
      </div>

      {/* 2. Profile Header Banner */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '14px',
              backgroundColor: 'rgba(220, 38, 38, 0.15)',
              border: '1px solid rgba(220, 38, 38, 0.35)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              fontWeight: 800,
            }}
          >
            {employee.firstName[0]}
            {employee.lastName[0]}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                {employee.fullName}
              </h1>
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
                {EMPLOYEE_STATUS_LABELS[employee.status] || employee.status}
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
              {employee.designation} &bull; {DEPARTMENT_LABELS[employee.department] || employee.department}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0.2rem 0 0 0' }}>
              Joined on {new Date(employee.dateOfJoining).toLocaleDateString('en-IN')} &bull;{' '}
              {EMPLOYMENT_TYPE_LABELS[employee.employmentType] || employee.employmentType}
            </p>
          </div>
        </div>

        {employee.status === EmployeeStatus.ACTIVE && (
          <button
            onClick={() => {
              setTermError(null);
              setShowTerminateModal(true);
            }}
            style={{
              backgroundColor: '#1e293b',
              color: '#f87171',
              border: '1px solid #991b1b',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Mark Resigned / Terminated
          </button>
        )}
      </div>

      {/* 3. Personal & Bank Details Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Personal Details */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Contact & Personal Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.825rem' }}>
            <div>
              <div style={{ color: '#64748b' }}>Official Email</div>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.15rem' }}>{employee.email}</div>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>Phone</div>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.15rem' }}>{employee.phone}</div>
            </div>
            {employee.emergencyContact && (
              <div style={{ gridColumn: 'span 2', backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Emergency Contact</div>
                <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>
                  {employee.emergencyContact.name} ({employee.emergencyContact.relationship}) &bull; {employee.emergencyContact.phone}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bank Disbursement Details */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Bank Disbursement Account
          </div>
          {employee.bankDetails ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.825rem' }}>
              <div>
                <div style={{ color: '#64748b' }}>Bank Name</div>
                <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '0.15rem' }}>{employee.bankDetails.bankName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b' }}>Account Number</div>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#f8fafc', marginTop: '0.15rem' }}>
                  {employee.bankDetails.accountNumber}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b' }}>IFSC Code</div>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#f8fafc', marginTop: '0.15rem' }}>
                  {employee.bankDetails.ifscCode}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b' }}>PAN Number</div>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#f8fafc', marginTop: '0.15rem' }}>
                  {employee.bankDetails.panNumber || 'Not provided'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '0.825rem', fontStyle: 'italic' }}>
              No bank account details configured.
            </div>
          )}
        </div>
      </div>

      {/* 4. Active Compensation Structure Card */}
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
            gap: '1rem',
            borderBottom: '1px solid #1e293b',
            paddingBottom: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(220, 38, 38, 0.15)',
                  color: '#f87171',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  textTransform: 'uppercase',
                }}
              >
                Compensation Plan
              </span>
              {activeStructure && (
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Revision #{activeStructure.revisionNumber} &bull; Effective From{' '}
                  {new Date(activeStructure.effectiveFrom).toLocaleDateString('en-IN')}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: '0.35rem 0 0 0' }}>
              Current Active Salary Structure
            </h2>
          </div>

          <button
            onClick={() => {
              setStructureError(null);
              setShowStructureModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
            }}
          >
            <span>✏️</span>
            <span>{activeStructure ? 'Revise Compensation Plan' : 'Configure Initial Salary'}</span>
          </button>
        </div>

        {activeStructure ? (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Basic Pay</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
                  {formatINR(activeStructure.basicSalary)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>HRA & Allowances</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
                  {formatINR(activeStructure.hra + activeStructure.allowances)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>Monthly Deductions</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '0.25rem' }}>
                  -{formatINR(activeStructure.pfDeduction + activeStructure.taxDeduction + activeStructure.otherDeductions)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                  Net Monthly Take-Home
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981', marginTop: '0.25rem' }}>
                  {formatINR(activeStructure.netSalary)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '1rem' }}>
              <span>Configured by: <strong style={{ color: '#94a3b8' }}>{activeStructure.createdByName}</strong></span>
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
              No salary structure configured
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
              You must configure an active compensation structure for this employee before monthly payroll runs can be generated.
            </p>
          </div>
        )}
      </div>

      {/* 5. Revision History Table */}
      {structureHistory.length > 0 && (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1e293b' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Compensation Revision History
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Rev #</th>
                  <th style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Effective Range</th>
                  <th style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Basic Pay</th>
                  <th style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Gross Salary</th>
                  <th style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Deductions</th>
                  <th style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Net Salary</th>
                  <th style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Updated By</th>
                  <th style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {structureHistory.map((s) => (
                  <tr key={s._id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#f8fafc' }}>#{s.revisionNumber}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                      {new Date(s.effectiveFrom).toLocaleDateString('en-IN')}
                      {s.effectiveTo ? ` to ${new Date(s.effectiveTo).toLocaleDateString('en-IN')}` : ' (Current)'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#f8fafc' }}>
                      {formatINR(s.basicSalary)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#f8fafc' }}>
                      {formatINR(s.grossSalary)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#f87171' }}>
                      -{formatINR(s.pfDeduction + s.taxDeduction + s.otherDeductions)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                      {formatINR(s.netSalary)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{s.createdByName}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      {s.isActive ? (
                        <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 700 }}>
                          Active
                        </span>
                      ) : (
                        <span style={{ backgroundColor: '#1e293b', color: '#64748b', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem' }}>
                          Superseded
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revise Compensation Structure Modal */}
      {showStructureModal && (
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
              maxWidth: '560px',
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                {activeStructure ? 'Revise Compensation Plan' : 'Configure Initial Salary Plan'}
              </h3>
              <button
                onClick={() => setShowStructureModal(false)}
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

            <form onSubmit={handleStructureSubmit} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Effective From Date *
                </label>
                <input
                  type="date"
                  required
                  value={structureForm.effectiveFrom}
                  onChange={(e) =>
                    setStructureForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))
                  }
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

              {/* Earnings */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                  Monthly Earnings (₹)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Basic Pay *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      value={structureForm.basicSalary || ''}
                      onChange={(e) =>
                        setStructureForm((prev) => ({
                          ...prev,
                          basicSalary: parseFloat(e.target.value) || 0,
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
                      HRA
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={structureForm.hra || ''}
                      onChange={(e) =>
                        setStructureForm((prev) => ({
                          ...prev,
                          hra: parseFloat(e.target.value) || 0,
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
                      Allowances
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={structureForm.allowances || ''}
                      onChange={(e) =>
                        setStructureForm((prev) => ({
                          ...prev,
                          allowances: parseFloat(e.target.value) || 0,
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

              {/* Deductions */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>
                  Monthly Deductions (₹)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      PF Contribution
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={structureForm.pfDeduction || ''}
                      onChange={(e) =>
                        setStructureForm((prev) => ({
                          ...prev,
                          pfDeduction: parseFloat(e.target.value) || 0,
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
                      Tax (TDS)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={structureForm.taxDeduction || ''}
                      onChange={(e) =>
                        setStructureForm((prev) => ({
                          ...prev,
                          taxDeduction: parseFloat(e.target.value) || 0,
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
                      Other Deductions
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={structureForm.otherDeductions || ''}
                      onChange={(e) =>
                        setStructureForm((prev) => ({
                          ...prev,
                          otherDeductions: parseFloat(e.target.value) || 0,
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

              {/* Live Preview Bar */}
              <div
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.825rem',
                }}
              >
                <div>
                  <span style={{ color: '#94a3b8' }}>Gross:</span>{' '}
                  <span style={{ fontWeight: 700, color: '#10b981' }}>{formatINR(previewGross)}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Deductions:</span>{' '}
                  <span style={{ fontWeight: 700, color: '#f87171' }}>-{formatINR(previewDeductions)}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Net:</span>{' '}
                  <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '1rem' }}>{formatINR(previewNet)}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Revision Reason / Memo (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual compensation increment"
                  value={structureForm.notes || ''}
                  onChange={(e) =>
                    setStructureForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
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
                />
              </div>

              {structureError && (
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
                  ⚠️ {structureError}
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
                  onClick={() => setShowStructureModal(false)}
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
                  disabled={isSavingStructure}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isSavingStructure ? 'not-allowed' : 'pointer',
                    opacity: isSavingStructure ? 0.6 : 1,
                  }}
                >
                  {isSavingStructure ? 'Saving...' : 'Save Compensation Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminate Modal */}
      {showTerminateModal && (
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
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Update Employee Status
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.5rem 0 1rem' }}>
              Mark <strong style={{ color: '#f8fafc' }}>{employee.fullName}</strong> ({employee.employeeCode}) as resigned or terminated.
            </p>

            <form onSubmit={handleTerminateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Status *
                </label>
                <select
                  value={termStatus}
                  onChange={(e) => setTermStatus(e.target.value as EmployeeStatus)}
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
                  <option value={EmployeeStatus.RESIGNED}>Resigned</option>
                  <option value={EmployeeStatus.TERMINATED}>Terminated</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Date of Leaving *
                </label>
                <input
                  type="date"
                  required
                  value={termDate}
                  onChange={(e) => setTermDate(e.target.value)}
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
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={termNotes}
                  onChange={(e) => setTermNotes(e.target.value)}
                  placeholder="e.g. Relieved with full and final settlement"
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
                />
              </div>

              {termError && (
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
                  ⚠️ {termError}
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
                  onClick={() => setShowTerminateModal(false)}
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
                  disabled={isTerminating}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isTerminating ? 'not-allowed' : 'pointer',
                    opacity: isTerminating ? 0.6 : 1,
                  }}
                >
                  {isTerminating ? 'Updating...' : 'Confirm Status Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
