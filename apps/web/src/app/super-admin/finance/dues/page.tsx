'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  OutstandingDuesReport,
  OutstandingCreditor,
  fetchOutstandingDues,
} from '@/lib/payment-api';
import { formatINR } from '@/lib/expense-api';
import {
  Clock,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Search,
  AlertCircle,
  CreditCard,
  Building2,
} from 'lucide-react';
import StaffAttributionBadge from '@/components/admin/StaffAttributionBadge';

export default function SuperAdminDuesPage() {
  const [report, setReport] = useState<OutstandingDuesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const toggleExpand = (key: string) => {
    setExpandedVendor(expandedVendor === key ? null : key);
  };

  // Filter creditors based on search query
  const filteredCreditors = useMemo(() => {
    if (!report?.creditors) return [];
    if (!searchQuery.trim()) return report.creditors;
    const q = searchQuery.toLowerCase().trim();
    return report.creditors.filter((c) =>
      c.vendorName.toLowerCase().includes(q) ||
      (c.vendorId && c.vendorId.toLowerCase().includes(q))
    );
  }, [report, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      {/* Scoped CSS for full mobile responsiveness & scrollable data */}
      <style jsx>{`
        .dues-header-wrap {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 0.25rem;
        }
        .dues-header-actions {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .dues-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 0.5rem;
        }
        .dues-aging-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1.25rem;
        }
        .creditor-header-row {
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: background-color 0.15s ease;
          gap: 1rem;
        }
        .creditor-metrics-wrap {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
        }
        .creditor-metric-item {
          text-align: right;
          flex-shrink: 0;
        }
        .dues-spin {
          animation: duesSpin 0.9s linear infinite;
        }
        @keyframes duesSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Mobile & Tablet Styles */
        @media (max-width: 960px) {
          .dues-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .dues-aging-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }

        @media (max-width: 720px) {
          .dues-header-wrap {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.85rem !important;
          }
          .dues-header-actions {
            width: 100% !important;
            display: flex !important;
          }
          .dues-header-actions > * {
            flex: 1 1 45% !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .dues-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.65rem !important;
          }
          .dues-aging-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.65rem !important;
          }
          .creditor-header-row {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 0.85rem 1rem !important;
            gap: 0.75rem !important;
          }
          .creditor-metrics-wrap {
            width: 100% !important;
            padding: 0.5rem 0.25rem 0.35rem 0.25rem !important;
            gap: 0.65rem !important;
            justify-content: flex-start !important;
            border-top: 1px dashed #e2e8f0;
          }
          .creditor-metric-item {
            flex: 1 0 auto !important;
            min-width: 105px !important;
            background-color: #f8fafc !important;
            padding: 0.45rem 0.6rem !important;
            border-radius: 6px !important;
            border: 1px solid #e2e8f0 !important;
            text-align: left !important;
          }
          .creditor-metric-item span:first-child {
            font-size: 0.65rem !important;
          }
          .creditor-metric-item span:last-child {
            font-size: 0.85rem !important;
          }
          .expanded-table-container {
            padding: 0.75rem 0.5rem !important;
          }
        }
      `}</style>

      {/* Prominent Super Admin Heading Banner */}
      <div className="dues-header-wrap">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: '#fef3c7',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#b45309',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <Clock size={24} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
              }}
            >
              Outstanding Dues &amp; Creditor Aging
            </h1>
            <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.85rem', lineHeight: 1.4 }}>
              Real-time summary of center, supplier, and blood acquisition expenditures awaiting disbursement.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="dues-header-actions">
          <button
            type="button"
            onClick={loadDues}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.625rem 1rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#334155',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={14} className={loading ? 'dues-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <Link
            href="/super-admin/finance/payments"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '0.625rem 1.15rem',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: '0 1px 3px rgba(220,38,38,0.25)',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.15s ease',
            }}
          >
            <span>Go to Disbursements</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            color: '#991b1b',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      {report && (
        <>
          <div className="dues-kpi-grid">
            <div
              style={{
                backgroundColor: '#fff1f2',
                padding: '1.1rem',
                borderRadius: '8px',
                border: '1px solid #fecdd3',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#9f1239', letterSpacing: '0.04em' }}>
                OUTSTANDING LIABILITIES
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#be123c', marginTop: '0.35rem' }}>
                {formatINR(report.summary.totalOutstandingInr)}
              </div>
              <div style={{ fontSize: '0.725rem', color: '#9f1239', marginTop: '0.25rem' }}>
                Total payable to suppliers
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '1.1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                TOTAL INVOICED
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                {formatINR(report.summary.totalInvoicedInr)}
              </div>
              <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.25rem' }}>
                {report.summary.pendingExpensesCount} approved bills
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#f0fdf4',
                padding: '1.1rem',
                borderRadius: '8px',
                border: '1px solid #bbf7d0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#166534', letterSpacing: '0.04em' }}>
                DISBURSED TO DATE
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#15803d', marginTop: '0.35rem' }}>
                {formatINR(report.summary.totalPaidInr)}
              </div>
              <div style={{ fontSize: '0.725rem', color: '#166534', marginTop: '0.25rem' }}>
                Settled portion of bills
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '1.1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                ACTIVE CREDITORS
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                {report.summary.creditorsCount}
              </div>
              <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.25rem' }}>
                Vendors with pending balance
              </div>
            </div>
          </div>

          {/* Aging Summary Row */}
          {report.summary.aging && (
            <div className="dues-aging-grid">
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#047857', letterSpacing: '0.03em' }}>
                  0–30 DAYS (CURRENT)
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#065f46', marginTop: '0.2rem' }}>
                  {formatINR(report.summary.aging.under30DaysInr)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#b45309', letterSpacing: '0.03em' }}>
                  31–60 DAYS
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400e', marginTop: '0.2rem' }}>
                  {formatINR(report.summary.aging.days31To60Inr)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#c2410c', letterSpacing: '0.03em' }}>
                  61–90 DAYS
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#9a3412', marginTop: '0.2rem' }}>
                  {formatINR(report.summary.aging.days61To90Inr)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#fff1f2',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #fecdd3',
                }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#b91c1c', letterSpacing: '0.03em' }}>
                  90+ DAYS (OVERDUE)
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', marginTop: '0.2rem' }}>
                  {formatINR(report.summary.aging.over90DaysInr)}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Creditors Breakdown Section */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}
      >
        {/* Section Header with Search */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid #fde68a',
            backgroundColor: '#fef3c7',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} style={{ color: '#92400e' }} />
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#92400e' }}>
              Creditor Balances &amp; Payable Breakdown
            </span>
            {report?.creditors && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: '#fef9c3',
                  color: '#854d0e',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  border: '1px solid #fde047',
                }}
              >
                {filteredCreditors.length} {filteredCreditors.length === 1 ? 'Creditor' : 'Creditors'}
              </span>
            )}
          </div>

          {/* Quick Vendor Search Input */}
          <div style={{ position: 'relative', minWidth: '220px', maxWidth: '320px', flex: '1 1 200px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.65rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="text"
              placeholder="Search vendor name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.65rem 0.4rem 2rem',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                outline: 'none',
                color: '#0f172a',
              }}
            />
          </div>
        </div>

        {/* Loading / Empty / Content states */}
        {loading ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
            <RefreshCw size={24} className="dues-spin" style={{ margin: '0 auto 0.75rem auto', color: '#94a3b8' }} />
            <div>Loading outstanding dues and creditor balances...</div>
          </div>
        ) : !report || report.creditors.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#166534', backgroundColor: '#f0fdf4' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>🎉 All Vendor Dues Fully Settled!</p>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem', color: '#15803d' }}>
              There are currently no approved expenses with outstanding payable balances across centers.
            </p>
          </div>
        ) : filteredCreditors.length === 0 ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>No creditors match &ldquo;{searchQuery}&rdquo;</p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                marginTop: '0.5rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div>
            {filteredCreditors.map((creditor, idx) => {
              const groupKey = creditor.vendorId || `LEGACY_${creditor.vendorName}`;
              const isExpanded = expandedVendor === groupKey;

              return (
                <div key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  {/* Creditor Header Row */}
                  <div
                    className="creditor-header-row"
                    onClick={() => toggleExpand(groupKey)}
                    style={{
                      backgroundColor: isExpanded ? '#faf5ff' : '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isExpanded ? '#ede9fe' : '#f1f5f9',
                          color: isExpanded ? '#7c3aed' : '#64748b',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                            {creditor.vendorName}
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                          {creditor.expenseCount} pending invoice{creditor.expenseCount > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Scrollable Creditor Balance Metrics */}
                    <div className="creditor-metrics-wrap">
                      <div className="creditor-metric-item">
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', fontWeight: 600 }}>
                          TOTAL INVOICED
                        </span>
                        <span style={{ fontSize: '0.875rem', color: '#0f172a', fontWeight: 700 }}>
                          {formatINR(creditor.totalInvoicedInr)}
                        </span>
                      </div>

                      <div className="creditor-metric-item">
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', fontWeight: 600 }}>
                          PAID TO DATE
                        </span>
                        <span style={{ fontSize: '0.875rem', color: '#15803d', fontWeight: 700 }}>
                          {formatINR(creditor.totalPaidInr)}
                        </span>
                      </div>

                      <div className="creditor-metric-item" style={{ minWidth: '115px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#9f1239', fontWeight: 800, display: 'block' }}>
                          OUTSTANDING DUE
                        </span>
                        <span style={{ fontSize: '1.05rem', color: '#be123c', fontWeight: 800 }}>
                          {formatINR(creditor.outstandingInr)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Invoices Breakdown Table (Horizontally Scrollable) */}
                  {isExpanded && (
                    <div
                      className="expanded-table-container"
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: '1rem 1.25rem 1.25rem 1.5rem',
                        borderTop: '1px solid #f1f5f9',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.65rem',
                          fontSize: '0.775rem',
                          color: '#64748b',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#334155' }}>
                          Invoices breakdown for {creditor.vendorName}:
                        </span>
                        <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                          👉 Swipe left/right on mobile to scroll all payable data
                        </span>
                      </div>

                      {/* Scrollable Container for Payable Amount Data */}
                      <div
                        className="admin-table-scroll"
                        style={{
                          width: '100%',
                          overflowX: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}
                      >
                        <table
                          style={{
                            minWidth: '880px',
                            width: '100%',
                            borderCollapse: 'collapse',
                            textAlign: 'left',
                            fontSize: '0.8rem',
                          }}
                        >
                          <thead>
                            <tr style={{ color: '#475569', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Expense Code</th>
                              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Title</th>
                              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Invoice No</th>
                              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Date</th>
                              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Aging</th>
                              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Status</th>
                              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>Total (₹)</th>
                              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>Paid (₹)</th>
                              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#be123c' }}>
                                Balance (₹)
                              </th>
                              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Action</th>
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
                                <tr
                                  key={exp._id}
                                  style={{
                                    borderBottom: '1px solid #f1f5f9',
                                    transition: 'background-color 0.1s ease',
                                  }}
                                >
                                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                                    {exp.expenseCode}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', color: '#334155', maxWidth: '200px' }}>
                                    {exp.title}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', color: '#64748b' }}>
                                    {exp.invoiceNumber || '—'}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {new Date(exp.expenseDate).toLocaleDateString('en-IN')}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '4px',
                                        backgroundColor: badgeBg,
                                        color: badgeColor,
                                      }}
                                    >
                                      {exp.agingBucket || '0-30 Days'} ({exp.ageDays || 0}d)
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem' }}>
                                    {exp.status === 'SUBMITTED' ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <span
                                          style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.45rem',
                                            borderRadius: '4px',
                                            backgroundColor: '#fef3c7',
                                            color: '#92400e',
                                            width: 'fit-content',
                                          }}
                                        >
                                          Pending Approval
                                        </span>
                                        {(exp.submittedByName || exp.creatorName) && (
                                          <StaffAttributionBadge
                                            label="Submitted by"
                                            name={exp.submittedByName || exp.creatorName}
                                            role={exp.submittedByRole || exp.creatorRole || 'ADMIN'}
                                            timestamp={exp.submittedAt}
                                            size="xs"
                                          />
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <span
                                          style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.45rem',
                                            borderRadius: '4px',
                                            backgroundColor: '#ecfdf5',
                                            color: '#065f46',
                                            width: 'fit-content',
                                          }}
                                        >
                                          Approved
                                        </span>
                                        <StaffAttributionBadge
                                          label="Approved by"
                                          name={exp.reviewedByName || exp.creatorName || 'Super Admin'}
                                          role={exp.reviewedByRole || 'SUPER_ADMIN'}
                                          timestamp={exp.reviewedAt}
                                          size="xs"
                                        />
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                    {formatINR(exp.amount)}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#15803d', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {formatINR(exp.paidAmount)}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#be123c', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    {formatINR(exp.outstandingAmount)}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    <Link
                                      href={`/super-admin/finance/payments?expenseId=${exp._id}`}
                                      style={{
                                        padding: '0.3rem 0.65rem',
                                        backgroundColor: '#eff6ff',
                                        border: '1px solid #bfdbfe',
                                        borderRadius: '4px',
                                        color: '#1d4ed8',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                      }}
                                    >
                                      <span>Disburse</span>
                                      <ArrowRight size={12} />
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
