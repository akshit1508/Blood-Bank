'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  MonthlyPayrollRun,
  SalarySlip,
  getPayrollRunById,
  getSalarySlipsForRun,
  approvePayrollRun,
  disburseSalarySlip,
  batchDisbursePayrollRun,
  formatINR,
  PayrollRunStatus,
  SalarySlipPaymentStatus,
  DisbursementPaymentMethod,
  DISBURSEMENT_PAYMENT_METHOD_LABELS,
} from '@/lib/payroll-api';

interface PageProps {
  params: { runId: string };
}

export default function PayrollRunDetailPage({ params }: PageProps) {
  const routeParams = useParams();
  const rawRunId = routeParams?.runId || params?.runId;
  const runId = Array.isArray(rawRunId) ? rawRunId[0] : (rawRunId as string);

  const [run, setRun] = useState<MonthlyPayrollRun | null>(null);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approve Modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Single Disburse Modal
  const [selectedSlip, setSelectedSlip] = useState<SalarySlip | null>(null);
  const [disburseAmountInput, setDisburseAmountInput] = useState('');
  const [disburseMethod, setDisburseMethod] = useState<DisbursementPaymentMethod>(
    DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS,
  );
  const [disburseTxRef, setDisburseTxRef] = useState('');
  const [disburseNotes, setDisburseNotes] = useState('');
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [disburseError, setDisburseError] = useState<string | null>(null);

  // Batch Disburse Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchMethod, setBatchMethod] = useState<DisbursementPaymentMethod>(
    DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS,
  );
  const [batchPrefix, setBatchPrefix] = useState('NEFT-CORP-');
  const [batchNotes, setBatchNotes] = useState('');
  const [isBatchDisbursing, setIsBatchDisbursing] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!runId) return;
    try {
      setLoading(true);
      setError(null);
      const [runData, slipsData] = await Promise.all([
        getPayrollRunById(runId),
        getSalarySlipsForRun(runId),
      ]);
      setRun(runData);
      setSlips(slipsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load payroll run');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async () => {
    try {
      setIsApproving(true);
      setApproveError(null);
      await approvePayrollRun(runId, { notes: approveNotes.trim() || undefined });
      setShowApproveModal(false);
      await loadData();
    } catch (err: any) {
      setApproveError(err.message || 'Failed to approve payroll run');
    } finally {
      setIsApproving(false);
    }
  };

  const handleOpenDisburse = (slip: SalarySlip) => {
    setSelectedSlip(slip);
    setDisburseAmountInput(slip.remaining.toString());
    setDisburseTxRef(`NEFT-${Date.now().toString().slice(-6)}`);
    setDisburseNotes('');
    setDisburseError(null);
  };

  const handleSingleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlip) return;

    const amt = parseFloat(disburseAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setDisburseError('Please enter a valid disbursement amount');
      return;
    }
    if (!disburseTxRef.trim()) {
      setDisburseError('Transaction reference (UTR/NEFT) is required');
      return;
    }

    try {
      setIsDisbursing(true);
      setDisburseError(null);
      await disburseSalarySlip(selectedSlip._id, {
        amount: amt,
        paymentMethod: disburseMethod,
        transactionReference: disburseTxRef.trim(),
        notes: disburseNotes.trim() || undefined,
      });
      setSelectedSlip(null);
      await loadData();
    } catch (err: any) {
      setDisburseError(err.message || 'Failed to disburse salary');
    } finally {
      setIsDisbursing(false);
    }
  };

  const handleBatchDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchPrefix.trim()) {
      setBatchError('Transaction reference prefix is required');
      return;
    }

    try {
      setIsBatchDisbursing(true);
      setBatchError(null);
      await batchDisbursePayrollRun(runId, {
        paymentMethod: batchMethod,
        transactionReferencePrefix: batchPrefix.trim(),
        notes: batchNotes.trim() || undefined,
      });
      setShowBatchModal(false);
      await loadData();
    } catch (err: any) {
      setBatchError(err.message || 'Failed to complete batch disbursement');
    } finally {
      setIsBatchDisbursing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading payroll run details...
      </div>
    );
  }

  if (error || !run) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
        <div style={{ color: '#f87171', fontWeight: 600, marginBottom: '1rem' }}>{error || 'Payroll run not found'}</div>
        <Link
          href="/super-admin/payroll"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            backgroundColor: '#fffbeb',
            color: '#0f172a',
            border: '1px solid #fde68a',
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          &larr; Back to Payroll Dashboard
        </Link>
      </div>
    );
  }

  const pendingSlipsCount = slips.filter((s) => s.paymentStatus !== SalarySlipPaymentStatus.PAID).length;

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
        color: '#0f172a',
      }}
    >
      {/* 1. Navigation / Breadcrumbs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          href="/super-admin/payroll"
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
          <span>Back to Payroll Dashboard</span>
        </Link>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            backgroundColor: '#fffbeb',
            color: '#94a3b8',
            padding: '0.25rem 0.65rem',
            borderRadius: '6px',
            border: '1px solid #fde68a',
          }}
        >
          Run ID: {run.runCode}
        </span>
      </div>

      {/* 2. Run Header Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
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
              }}
            >
              Batch Period
            </span>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
              {run.payrollPeriod}
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.825rem', margin: '0.35rem 0 0 0' }}>
            Generated by <strong style={{ color: '#0f172a' }}>{run.generatedByName}</strong> on {new Date(run.createdAt).toLocaleDateString('en-IN')}
            {run.approvedByName && (
              <> &bull; Approved by <strong style={{ color: '#38bdf8' }}>{run.approvedByName}</strong></>
            )}
          </p>
          {run.notes && (
            <div
              style={{
                backgroundColor: '#fffbeb',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #fde68a',
                fontSize: '0.8rem',
                color: '#cbd5e1',
                marginTop: '0.75rem',
              }}
            >
              <strong style={{ color: '#94a3b8' }}>Notes:</strong> {run.notes}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {run.status === PayrollRunStatus.DRAFT && (
            <button
              onClick={() => {
                setApproveError(null);
                setShowApproveModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.3)',
              }}
            >
              <span>✓</span>
              <span>Approve Payroll Run</span>
            </button>
          )}

          {(run.status === PayrollRunStatus.APPROVED ||
            run.status === PayrollRunStatus.PARTIALLY_DISBURSED) && (
            <button
              onClick={() => {
                setBatchError(null);
                setShowBatchModal(true);
              }}
              disabled={pendingSlipsCount === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: pendingSlipsCount === 0 ? '#334155' : '#16a34a',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: pendingSlipsCount === 0 ? 'not-allowed' : 'pointer',
                boxShadow: pendingSlipsCount === 0 ? 'none' : '0 2px 4px rgba(22, 163, 74, 0.3)',
              }}
            >
              <span>💳</span>
              <span>Batch Disburse All ({pendingSlipsCount} Pending)</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Financial Summary Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
            Gross Earnings
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
            {formatINR(run.totalGross)}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f87171', textTransform: 'uppercase' }}>
            Total Deductions
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f87171', marginTop: '0.35rem' }}>
            -{formatINR(run.totalDeductions)}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase' }}>
            Net Payable Outflow
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.35rem' }}>
            {formatINR(run.totalNetPayable)}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
            Remaining Liability
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.35rem' }}>
            {formatINR(run.totalOutstanding)}
          </div>
        </div>
      </div>

      {/* 4. Slips Table */}
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
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
            Staff Salary Slips
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {slips.length} employees in run
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                <th style={{ padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Slip Number
                </th>
                <th style={{ padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Employee
                </th>
                <th style={{ padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Department
                </th>
                <th style={{ padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Disbursement Bank
                </th>
                <th style={{ padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                  Gross
                </th>
                <th style={{ padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                  Deductions
                </th>
                <th style={{ padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                  Net Pay
                </th>
                <th style={{ padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                  Remaining
                </th>
                <th style={{ padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  Status
                </th>
                <th style={{ padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {slips.map((slip) => (
                <tr
                  key={slip._id}
                  style={{
                    borderBottom: '1px solid #fef3c7',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={{ padding: '0.9rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>
                    {slip.slipNumber}
                  </td>
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{slip.employeeSnapshot.fullName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {slip.employeeSnapshot.employeeCode} &bull; {slip.employeeSnapshot.designation}
                    </div>
                  </td>
                  <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    {slip.employeeSnapshot.department.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
                      {slip.employeeSnapshot.bankName}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b' }}>
                      A/C: {slip.employeeSnapshot.accountNumber}
                    </div>
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                    {formatINR(slip.grossEarnings)}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontWeight: 600, color: '#f87171' }}>
                    -{formatINR(slip.totalDeductions)}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                    {formatINR(slip.netPayable)}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>
                    {formatINR(slip.remaining)}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                    {slip.paymentStatus === SalarySlipPaymentStatus.PAID ? (
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
                        Paid
                      </span>
                    ) : slip.paymentStatus === SalarySlipPaymentStatus.PARTIALLY_PAID ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(168, 85, 247, 0.15)',
                          color: '#c084fc',
                          border: '1px solid rgba(168, 85, 247, 0.35)',
                        }}
                      >
                        Partially Paid
                      </span>
                    ) : (
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
                        Unpaid
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.45rem' }}>
                      {slip.remaining > 0 &&
                        (run.status === PayrollRunStatus.APPROVED ||
                          run.status === PayrollRunStatus.PARTIALLY_DISBURSED) && (
                          <button
                            onClick={() => handleOpenDisburse(slip)}
                            style={{
                              backgroundColor: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.775rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Pay
                          </button>
                        )}
                      <Link
                        href={`/super-admin/payroll/slips/${slip._id}`}
                        style={{
                          backgroundColor: '#fffbeb',
                          color: '#0f172a',
                          border: '1px solid #fde68a',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.775rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        Slip &rarr;
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && (
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
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              color: '#0f172a',
              boxShadow: '0 20px 25px -5px rgba(180, 83, 9, 0.15)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Approve Payroll Run
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.5rem 0 1rem' }}>
              By approving this run, you authorize disbursement of{' '}
              <strong style={{ color: '#38bdf8' }}>{formatINR(run.totalNetPayable)}</strong> across{' '}
              <strong style={{ color: '#0f172a' }}>{run.totalEmployees} employees</strong>.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' }}>
                Approval Remarks / Memo (Optional)
              </label>
              <textarea
                rows={2}
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="e.g. Verified by Super Admin for bank disbursement"
                style={{
                  width: '100%',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '0.6rem 0.85rem',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {approveError && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#450a0a',
                  border: '1px solid #991b1b',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                  marginTop: '0.75rem',
                }}
              >
                ⚠️ {approveError}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                borderTop: '1px solid #fde68a',
                paddingTop: '1rem',
                marginTop: '1.25rem',
              }}
            >
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                style={{
                  backgroundColor: '#fffbeb',
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
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: isApproving ? 'not-allowed' : 'pointer',
                  opacity: isApproving ? 0.6 : 1,
                }}
              >
                {isApproving ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Disburse Modal */}
      {selectedSlip && (
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
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              color: '#0f172a',
              boxShadow: '0 20px 25px -5px rgba(180, 83, 9, 0.15)',
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Disburse Salary Payment
              </h3>
              <button
                onClick={() => setSelectedSlip(null)}
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

            <div
              style={{
                backgroundColor: '#fffbeb',
                padding: '0.85rem',
                borderRadius: '8px',
                border: '1px solid #fde68a',
                fontSize: '0.8rem',
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div>
                <span style={{ color: '#94a3b8' }}>Staff:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{selectedSlip.employeeSnapshot.fullName}</strong> ({selectedSlip.employeeSnapshot.employeeCode})
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Bank:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{selectedSlip.employeeSnapshot.bankName}</strong> &bull; A/C: {selectedSlip.employeeSnapshot.accountNumber}
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Remaining Balance:</span>{' '}
                <strong style={{ color: '#f59e0b' }}>{formatINR(selectedSlip.remaining)}</strong>
              </div>
            </div>

            <form onSubmit={handleSingleDisburse} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Disbursement Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={selectedSlip.remaining}
                  value={disburseAmountInput}
                  onChange={(e) => setDisburseAmountInput(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Payment Method *
                </label>
                <select
                  value={disburseMethod}
                  onChange={(e) => setDisburseMethod(e.target.value as DisbursementPaymentMethod)}
                  style={{
                    width: '100%',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {Object.values(DisbursementPaymentMethod).map((m) => (
                    <option key={m} value={m}>
                      {DISBURSEMENT_PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Bank UTR / Transaction Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTR-20261014-998822"
                  value={disburseTxRef}
                  onChange={(e) => setDisburseTxRef(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    color: '#0f172a',
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
                <input
                  type="text"
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  placeholder="e.g. Salary transfer via corporate net banking"
                  style={{
                    width: '100%',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {disburseError && (
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
                  ⚠️ {disburseError}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderTop: '1px solid #fde68a',
                  paddingTop: '1rem',
                  marginTop: '0.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedSlip(null)}
                  style={{
                    backgroundColor: '#fffbeb',
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
                  disabled={isDisbursing}
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isDisbursing ? 'not-allowed' : 'pointer',
                    opacity: isDisbursing ? 0.6 : 1,
                  }}
                >
                  {isDisbursing ? 'Processing...' : 'Confirm Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Disburse Modal */}
      {showBatchModal && (
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
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              color: '#0f172a',
              boxShadow: '0 20px 25px -5px rgba(180, 83, 9, 0.15)',
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Batch Disburse All Pending Slips
              </h3>
              <button
                onClick={() => setShowBatchModal(false)}
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

            <div
              style={{
                backgroundColor: 'rgba(22, 163, 74, 0.15)',
                border: '1px solid rgba(22, 163, 74, 0.35)',
                color: '#4ade80',
                padding: '0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                marginTop: '1rem',
              }}
            >
              This will automatically process bank payments for all{' '}
              <strong>{pendingSlipsCount} unpaid/partially paid employees</strong> in this run, totaling{' '}
              <strong>{formatINR(run.totalOutstanding)}</strong>.
            </div>

            <form onSubmit={handleBatchDisburse} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Payment Method *
                </label>
                <select
                  value={batchMethod}
                  onChange={(e) => setBatchMethod(e.target.value as DisbursementPaymentMethod)}
                  style={{
                    width: '100%',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {Object.values(DisbursementPaymentMethod).map((m) => (
                    <option key={m} value={m}>
                      {DISBURSEMENT_PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Transaction Reference Prefix *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BATCH-NEFT-202610"
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <p style={{ fontSize: '0.725rem', color: '#64748b', margin: '0.35rem 0 0 0' }}>
                  Individual slips will be tagged with: <code style={{ color: '#38bdf8' }}>{batchPrefix}-[EMP-CODE]</code>
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Batch Memo / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="e.g. Bulk salary upload"
                  style={{
                    width: '100%',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {batchError && (
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
                  ⚠️ {batchError}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderTop: '1px solid #fde68a',
                  paddingTop: '1rem',
                  marginTop: '0.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  style={{
                    backgroundColor: '#fffbeb',
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
                  disabled={isBatchDisbursing}
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isBatchDisbursing ? 'not-allowed' : 'pointer',
                    opacity: isBatchDisbursing ? 0.6 : 1,
                  }}
                >
                  {isBatchDisbursing ? 'Processing...' : 'Confirm & Disburse All'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
