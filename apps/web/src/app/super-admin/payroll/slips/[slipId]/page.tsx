'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  SalarySlip,
  SalaryDisbursement,
  getSalarySlipById,
  getDisbursementsForSlip,
  formatINR,
  SalarySlipPaymentStatus,
  DISBURSEMENT_PAYMENT_METHOD_LABELS,
} from '@/lib/payroll-api';

interface PageProps {
  params: { slipId: string };
}

export default function SalarySlipPrintPage({ params }: PageProps) {
  const routeParams = useParams();
  const rawSlipId = routeParams?.slipId || params?.slipId;
  const slipId = Array.isArray(rawSlipId) ? rawSlipId[0] : (rawSlipId as string);

  const [slip, setSlip] = useState<SalarySlip | null>(null);
  const [disbursements, setDisbursements] = useState<SalaryDisbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!slipId) return;
    try {
      setLoading(true);
      setError(null);
      const [slipData, disbData] = await Promise.all([
        getSalarySlipById(slipId),
        getDisbursementsForSlip(slipId),
      ]);
      setSlip(slipData);
      setDisbursements(disbData);
    } catch (err: any) {
      setError(err.message || 'Failed to load salary slip');
    } finally {
      setLoading(false);
    }
  }, [slipId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading salary slip...
      </div>
    );
  }

  if (error || !slip) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
        <div style={{ color: '#f87171', fontWeight: 600, marginBottom: '1rem' }}>{error || 'Salary slip not found'}</div>
        <Link
          href="/super-admin/payroll"
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
          &larr; Back to Payroll Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        color: '#f8fafc',
      }}
    >
      {/* Action Toolbar (hidden on print) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link
          href={`/super-admin/payroll/${slip.payrollRunId}`}
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
          <span>Back to Batch Run</span>
        </Link>
        <button
          onClick={() => window.print()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
          }}
        >
          <span>🖨️</span>
          <span>Print Salary Slip</span>
        </button>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                background-color: #ffffff !important;
                color: #0f172a !important;
              }
              .printable-slip-card {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
              }
            }
          `,
        }}
      />

      {/* Printable Salary Slip Document Container */}
      <div
        className="printable-slip-card"
        style={{
          backgroundColor: '#ffffff',
          color: '#0f172a',
          padding: '2.5rem',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                }}
              >
                BB
              </span>
              <h1
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  color: '#0f172a',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.02em',
                }}
              >
                Blood Bank Management Centre
              </h1>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.35rem 0 0 0' }}>
              Central Transfusion Medicine & Cold Chain Logistics Facility
            </p>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.15rem 0 0 0' }}>
              Licensed under Drugs and Cosmetics Rules &bull; Government Regulatory Compliant
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#dc2626',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Confidential Pay Slip
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', marginTop: '0.2rem' }}>
              {slip.slipNumber}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
              Period: {slip.payPeriod}
            </div>
          </div>
        </div>

        {/* Employee & Bank Info Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            padding: '1.25rem 0',
            borderBottom: '1px solid #e2e8f0',
            fontSize: '0.825rem',
          }}
        >
          <div>
            <div style={{ color: '#64748b', fontWeight: 500 }}>Employee Name</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
              {slip.employeeSnapshot.fullName}
            </div>
            <div style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.775rem' }}>
              {slip.employeeSnapshot.employeeCode}
            </div>
          </div>

          <div>
            <div style={{ color: '#64748b', fontWeight: 500 }}>Designation & Dept</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
              {slip.employeeSnapshot.designation}
            </div>
            <div style={{ color: '#475569', fontSize: '0.775rem' }}>
              {slip.employeeSnapshot.department.replace(/_/g, ' ')}
            </div>
          </div>

          <div>
            <div style={{ color: '#64748b', fontWeight: 500 }}>Bank Account</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
              {slip.employeeSnapshot.bankName}
            </div>
            <div style={{ fontFamily: 'monospace', color: '#475569', fontSize: '0.775rem' }}>
              A/C: {slip.employeeSnapshot.accountNumber}
            </div>
          </div>

          <div>
            <div style={{ color: '#64748b', fontWeight: 500 }}>IFSC & PAN</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', marginTop: '0.2rem' }}>
              {slip.employeeSnapshot.ifscCode}
            </div>
            <div style={{ fontFamily: 'monospace', color: '#475569', fontSize: '0.775rem' }}>
              PAN: {slip.employeeSnapshot.panNumber || 'N/A'}
            </div>
          </div>
        </div>

        {/* Attendance Summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            padding: '0.75rem 1rem',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            margin: '1rem 0',
            textAlign: 'center',
            fontSize: '0.8rem',
            border: '1px solid #e2e8f0',
          }}
        >
          <div>
            <span style={{ color: '#64748b' }}>Calendar Days:</span>{' '}
            <strong style={{ color: '#0f172a' }}>{slip.daysInMonth}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Payable Days:</span>{' '}
            <strong style={{ color: '#16a34a' }}>{slip.payableDays}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Loss of Pay (LOP):</span>{' '}
            <strong style={{ color: '#dc2626' }}>{slip.lossOfPayDays}</strong>
          </div>
        </div>

        {/* Earnings & Deductions Tables */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
            margin: '1.25rem 0',
          }}
        >
          {/* Earnings */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div
              style={{
                backgroundColor: '#ecfdf5',
                padding: '0.6rem 0.85rem',
                borderBottom: '1px solid #d1fae5',
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: '#065f46',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Earnings Component</span>
              <span>Amount (INR)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.825rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Basic Pay</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatINR(slip.basic)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>House Rent Allowance (HRA)</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatINR(slip.hra)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Special & Medical Allowances</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatINR(slip.allowances)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0.85rem',
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  fontWeight: 800,
                  color: '#0f172a',
                }}
              >
                <span>Gross Earnings</span>
                <span style={{ color: '#16a34a', fontSize: '0.95rem' }}>{formatINR(slip.grossEarnings)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div
              style={{
                backgroundColor: '#fef2f2',
                padding: '0.6rem 0.85rem',
                borderBottom: '1px solid #fee2e2',
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: '#991b1b',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Deductions Component</span>
              <span>Amount (INR)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.825rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Provident Fund (PF)</span>
                <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatINR(slip.pfDeduction)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Income Tax (TDS)</span>
                <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatINR(slip.taxDeduction)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Other Authorized Deductions</span>
                <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatINR(slip.otherDeductions)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0.85rem',
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  fontWeight: 800,
                  color: '#0f172a',
                }}
              >
                <span>Total Deductions</span>
                <span style={{ color: '#dc2626', fontSize: '0.95rem' }}>-{formatINR(slip.totalDeductions)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Net Salary Highlight Box */}
        <div
          style={{
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
              Net Take-Home Salary
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', marginTop: '0.2rem' }}>
              {formatINR(slip.netPayable)}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Payment Status</div>
            <div style={{ marginTop: '0.25rem' }}>
              {slip.paymentStatus === SalarySlipPaymentStatus.PAID ? (
                <span
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  Paid & Disbursed
                </span>
              ) : (
                <span
                  style={{
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {slip.paymentStatus === SalarySlipPaymentStatus.PARTIALLY_PAID
                    ? `Partially Paid (${formatINR(slip.remaining)} remaining)`
                    : 'Pending Disbursement'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Disbursement History */}
        {disbursements.length > 0 && (
          <div style={{ marginTop: '1.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#64748b',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
              }}
            >
              Bank Disbursement Audit Records
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>Disbursement No</th>
                  <th style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>Date</th>
                  <th style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>Method</th>
                  <th style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>Transaction / UTR Ref</th>
                  <th style={{ padding: '0.5rem 0.75rem', color: '#64748b', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {disbursements.map((d) => (
                  <tr key={d._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', color: '#64748b' }}>
                      {d.disbursementNumber}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', color: '#334155' }}>
                      {new Date(d.paymentDate).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', color: '#334155' }}>
                      {DISBURSEMENT_PAYMENT_METHOD_LABELS[d.paymentMethod] || d.paymentMethod}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                      {d.transactionReference}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                      {formatINR(d.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: '2.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: '0.75rem',
            color: '#64748b',
          }}
        >
          <div>
            <p style={{ margin: 0 }}>Generated automatically by Blood Bank Central System.</p>
            <p style={{ margin: '0.2rem 0 0 0' }}>This is a computer-generated salary slip and does not require a physical seal.</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #94a3b8', width: '160px', marginBottom: '0.35rem' }}></div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>Authorized Super Admin</div>
            <div>Finance & Payroll Department</div>
          </div>
        </div>
      </div>
    </div>
  );
}
