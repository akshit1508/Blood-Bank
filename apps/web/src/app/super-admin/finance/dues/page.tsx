'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  OutstandingDuesReport,
  OutstandingCreditor,
  fetchOutstandingDues,
  linkExpenseVendor,
} from '@/lib/payment-api';
import { fetchActiveVendorOptions, ActiveVendorOption } from '@/lib/vendor-api';
import { formatINR } from '@/lib/expense-api';

export default function SuperAdminDuesPage() {
  const [report, setReport] = useState<OutstandingDuesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  // Link Vendor Modal states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [targetExpense, setTargetExpense] = useState<{ id: string; code: string; vendorName: string } | null>(null);
  const [registeredVendors, setRegisteredVendors] = useState<ActiveVendorOption[]>([]);
  const [selectedLinkVendorId, setSelectedLinkVendorId] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadDues = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await fetchOutstandingDues();
      setReport(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load outstanding dues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDues();
  }, []);

  const openLinkModal = async (expenseId: string, expenseCode: string, historicalName: string) => {
    setTargetExpense({ id: expenseId, code: expenseCode, vendorName: historicalName });
    setSelectedLinkVendorId('');
    setLinkError(null);
    setShowLinkModal(true);

    try {
      const opts = await fetchActiveVendorOptions();
      setRegisteredVendors(opts);
      if (opts.length > 0) {
        setSelectedLinkVendorId(opts[0]._id);
      }
    } catch (err: any) {
      setLinkError('Failed to load registered vendor list: ' + err.message);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetExpense || !selectedLinkVendorId) return;
    setLinkError(null);

    try {
      setLinking(true);
      await linkExpenseVendor(targetExpense.id, selectedLinkVendorId);
      setShowLinkModal(false);
      loadDues();
    } catch (err: any) {
      setLinkError(err?.message || 'Failed to link vendor to expense');
    } finally {
      setLinking(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedVendor(expandedVendor === key ? null : key);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            Outstanding Dues &amp; Aging
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            Real-time summary of approved center expenditures awaiting supplier disbursement.
          </p>
        </div>
          <Link
            href="/super-admin/finance/payments"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '0.65rem 1.25rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 1px 2px rgba(220,38,38,0.2)',
            }}
          >
            Go to Disbursements &rarr;
          </Link>
        </div>

        {errorMessage && (
          <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* KPI Cards */}
        {report && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#fff1f2', padding: '1.15rem', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9f1239' }}>OUTSTANDING LIABILITIES</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#be123c', marginTop: '0.35rem' }}>
                  {formatINR(report.summary.totalOutstandingInr)}
                </div>
                <div style={{ fontSize: '0.725rem', color: '#9f1239', marginTop: '0.25rem' }}>
                  Total payable to suppliers
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '1.15rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>TOTAL INVOICED</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                  {formatINR(report.summary.totalInvoicedInr)}
                </div>
                <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.25rem' }}>
                  {report.summary.pendingExpensesCount} approved bills
                </div>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', padding: '1.15rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>DISBURSED TO DATE</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', marginTop: '0.35rem' }}>
                  {formatINR(report.summary.totalPaidInr)}
                </div>
                <div style={{ fontSize: '0.725rem', color: '#166534', marginTop: '0.25rem' }}>
                  Settled portion of bills
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '1.15rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>ACTIVE CREDITORS</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                  {report.summary.creditorsCount}
                </div>
                <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Vendors with pending balance
                </div>
              </div>
            </div>

            {/* Aging Summary Row */}
            {report.summary.aging && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#047857' }}>0–30 DAYS (CURRENT)</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#065f46', marginTop: '0.2rem' }}>
                    {formatINR(report.summary.aging.under30DaysInr)}
                  </div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309' }}>31–60 DAYS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400e', marginTop: '0.2rem' }}>
                    {formatINR(report.summary.aging.days31To60Inr)}
                  </div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c2410c' }}>61–90 DAYS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#9a3412', marginTop: '0.2rem' }}>
                    {formatINR(report.summary.aging.days61To90Inr)}
                  </div>
                </div>
                <div style={{ backgroundColor: '#fff1f2', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b91c1c' }}>90+ DAYS (OVERDUE)</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', marginTop: '0.2rem' }}>
                    {formatINR(report.summary.aging.over90DaysInr)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Creditors Breakdown */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              Loading outstanding dues...
            </div>
          ) : !report || report.creditors.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#166534', backgroundColor: '#f0fdf4' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>🎉 All Vendor Dues Fully Settled!</p>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem', color: '#15803d' }}>
                There are currently no approved expenses with outstanding payable balances.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                Creditor Balances &amp; Payable Breakdown
              </div>

              {report.creditors.map((creditor, idx) => {
                const groupKey = creditor.vendorId || `LEGACY_${creditor.vendorName}`;
                const isExpanded = expandedVendor === groupKey;

                return (
                  <div key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {/* Header Row */}
                    <div
                      onClick={() => toggleExpand(groupKey)}
                      style={{
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        backgroundColor: isExpanded ? '#fafafa' : '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          {isExpanded ? '▼' : '►'}
                        </span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                              {creditor.vendorName}
                            </strong>
                            {!creditor.isLinked && (
                              <span
                                style={{
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.675rem',
                                  fontWeight: 700,
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                }}
                              >
                                LEGACY / UNLINKED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                            {creditor.expenseCount} pending invoice{creditor.expenseCount > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>TOTAL INVOICED</span>
                          <span style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600 }}>
                            {formatINR(creditor.totalInvoicedInr)}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>PAID TO DATE</span>
                          <span style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: 600 }}>
                            {formatINR(creditor.totalPaidInr)}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right', minWidth: '120px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#9f1239', fontWeight: 700, display: 'block' }}>
                            OUTSTANDING DUE
                          </span>
                          <span style={{ fontSize: '1.05rem', color: '#be123c', fontWeight: 800 }}>
                            {formatINR(creditor.outstandingInr)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Invoices Table */}
                    {isExpanded && (
                      <div style={{ backgroundColor: '#f8fafc', padding: '1rem 1.25rem 1.25rem 2.5rem', borderTop: '1px solid #f1f5f9' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '0.5rem' }}>Expense Code</th>
                              <th style={{ padding: '0.5rem' }}>Title</th>
                              <th style={{ padding: '0.5rem' }}>Invoice No</th>
                              <th style={{ padding: '0.5rem' }}>Date</th>
                              <th style={{ padding: '0.5rem' }}>Aging</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total (₹)</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Paid (₹)</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Balance (₹)</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {creditor.expenses.map((exp) => {
                              const badgeBg =
                                exp.agingBucket === '90+ Days'
                                  ? '#fee2e2'
                                  : exp.agingBucket === '61-90 Days'
                                  ? '#ffedd5'
                                  : exp.agingBucket === '31-60 Days'
                                  ? '#fef3c7'
                                  : '#ecfdf5';
                              const badgeColor =
                                exp.agingBucket === '90+ Days'
                                  ? '#991b1b'
                                  : exp.agingBucket === '61-90 Days'
                                  ? '#9a3412'
                                  : exp.agingBucket === '31-60 Days'
                                  ? '#92400e'
                                  : '#065f46';

                              return (
                                <tr key={exp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '0.5rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                                    {exp.expenseCode}
                                  </td>
                                  <td style={{ padding: '0.5rem', color: '#334155' }}>{exp.title}</td>
                                  <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#64748b' }}>
                                    {exp.invoiceNumber}
                                  </td>
                                  <td style={{ padding: '0.5rem', color: '#64748b' }}>
                                    {new Date(exp.expenseDate).toLocaleDateString('en-IN')}
                                  </td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: '4px',
                                        backgroundColor: badgeBg,
                                        color: badgeColor,
                                      }}
                                    >
                                      {exp.agingBucket || '0-30 Days'} ({exp.ageDays || 0}d)
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                                    {formatINR(exp.amount)}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>
                                    {formatINR(exp.paidAmount)}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', color: '#be123c', fontWeight: 700 }}>
                                    {formatINR(exp.outstandingAmount)}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                    {!exp.vendorId ? (
                                      <button
                                        onClick={() => openLinkModal(exp._id, exp.expenseCode, exp.vendorName)}
                                        style={{
                                          padding: '0.25rem 0.55rem',
                                          backgroundColor: '#fef3c7',
                                          border: '1px solid #fde68a',
                                          borderRadius: '4px',
                                          color: '#b45309',
                                          fontSize: '0.725rem',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Link Vendor
                                      </button>
                                    ) : (
                                      <Link
                                        href={`/super-admin/finance/payments?expenseId=${exp._id}`}
                                        style={{
                                          padding: '0.25rem 0.55rem',
                                          backgroundColor: '#eff6ff',
                                          border: '1px solid #bfdbfe',
                                          borderRadius: '4px',
                                          color: '#1d4ed8',
                                          fontSize: '0.725rem',
                                          fontWeight: 700,
                                          textDecoration: 'none',
                                        }}
                                      >
                                        Disburse &rarr;
                                      </Link>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Link Vendor Modal */}
        {showLinkModal && targetExpense && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                width: '100%',
                maxWidth: '520px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                padding: '1.75rem',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                Link Historical Expense to Registered Vendor
              </h2>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.85rem' }}>
                Expense <strong>{targetExpense.code}</strong> currently has free-text vendor name &ldquo;{targetExpense.vendorName}&rdquo;. Select a registered vendor profile to enable disbursement.
              </p>

              {linkError && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', margin: '1rem 0', fontSize: '0.825rem' }}>
                  ⚠️ {linkError}
                </div>
              )}

              <form onSubmit={handleLinkSubmit} style={{ marginTop: '1rem' }}>
                {registeredVendors.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                    No registered vendors found. Please register a vendor first in the Vendor Directory.
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      Select Registered Vendor *
                    </label>
                    <select
                      value={selectedLinkVendorId}
                      onChange={(e) => setSelectedLinkVendorId(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                      {registeredVendors.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.name} ({v.category})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    style={{ padding: '0.55rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={linking || registeredVendors.length === 0}
                    style={{ padding: '0.55rem 1.25rem', border: 'none', borderRadius: '6px', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: linking ? 'not-allowed' : 'pointer' }}
                  >
                    {linking ? 'Linking...' : 'Confirm Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
