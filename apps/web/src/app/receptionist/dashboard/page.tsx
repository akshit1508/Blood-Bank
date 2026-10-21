'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  fetchReceptionistDashboard,
  ReceptionistPeriod,
  ReceptionistDashboardResponse,
} from '@/lib/receptionist-api';
import ReceptionistSelect from '@/components/receptionist/ReceptionistSelect';

const PERIOD_LABELS: Record<ReceptionistPeriod, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7_days: 'Last 7 Days',
  last_15_days: 'Last 15 Days',
  last_30_days: 'Last 30 Days',
  this_month: 'This Month',
  previous_month: 'Previous Month',
  custom: 'Custom Range',
};

const PAYMENT_STATUS_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  PAID: { bg: '#064e3b', text: '#6ee7b7', border: '#059669' },
  PARTIALLY_COLLECTED: { bg: '#451a03', text: '#fde68a', border: '#b45309' },
  PENDING: { bg: '#450a0a', text: '#fca5a5', border: '#dc2626' },
  WAIVED: { bg: '#312e81', text: '#c7d2fe', border: '#4f46e5' },
  CANCELLED: { bg: '#1e293b', text: '#94a3b8', border: '#334155' },
};

export default function ReceptionistDashboardPage() {
  const [data, setData] = useState<ReceptionistDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Date range filter states
  const [period, setPeriod] = useState<ReceptionistPeriod>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Search & table filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Receipt / Transaction detail modal state
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchReceptionistDashboard({
        period,
        startDate: period === 'custom' ? customStart : undefined,
        endDate: period === 'custom' ? customEnd : undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Format currency in Indian Rupees
  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!data?.recentTransactions) return [];
    return data.recentTransactions.filter((tx) => {
      const matchSearch =
        !searchQuery.trim() ||
        tx.transactionNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.patient?.phone?.includes(searchQuery) ||
        tx.requestCode?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === 'ALL' ||
        tx.paymentStatus === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [data?.recentTransactions, searchQuery, statusFilter]);

  const handlePrint = () => {
    window.print();
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            border: '3px solid #334155',
            borderTopColor: '#dc2626',
            margin: '0 auto 1.5rem',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
        <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>
          Loading Receptionist Command & Billing Dashboard...
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
          Fetching real-time blood issues, collections, and billing records
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: '3rem 2rem', maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', borderRadius: '12px', padding: '2rem', color: '#fca5a5' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
          <h3 style={{ color: '#fecaca', fontSize: '1.1rem', margin: '0 0 0.75rem 0' }}>Failed to Load Dashboard Metrics</h3>
          <p style={{ fontSize: '0.85rem', color: '#fca5a5', marginBottom: '1.25rem' }}>{error}</p>
          <button
            type="button"
            onClick={loadDashboard}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retry Loading Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="receptionist-dash-container">
      {/* Scoped Responsive Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .receptionist-dash-container {
              width: 100%;
              max-width: 1440px;
              margin: 0 auto;
              padding-bottom: 3rem;
              box-sizing: border-box;
              overflow-x: hidden;
            }
            .receptionist-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 1rem;
              margin-bottom: 1.5rem;
              width: 100%;
              box-sizing: border-box;
            }
            .receptionist-header-actions {
              display: flex;
              gap: 0.65rem;
              flex-wrap: wrap;
            }
            .receptionist-kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 1rem;
              margin-bottom: 1.5rem;
              width: 100%;
              box-sizing: border-box;
            }
            .receptionist-analytics-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 1.25rem;
              margin-bottom: 1.5rem;
              width: 100%;
              box-sizing: border-box;
            }
            .receptionist-period-bar {
              background-color: #0f172a;
              border: 1px solid #1e293b;
              border-radius: 12px;
              padding: 1rem;
              margin-bottom: 1.5rem;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 1rem;
              width: 100%;
              box-sizing: border-box;
            }
            .receptionist-period-buttons {
              display: flex;
              align-items: center;
              gap: 0.45rem;
              flex-wrap: wrap;
            }
            .receptionist-filter-bar {
              display: flex;
              align-items: center;
              gap: 0.75rem;
              flex-wrap: wrap;
            }
            .receptionist-table-wrapper {
              width: 100%;
              max-width: 100%;
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
              display: block;
              box-sizing: border-box;
            }
            .receptionist-table-scroll-hint {
              display: none;
            }

            @media (max-width: 1024px) {
              .receptionist-kpi-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
            }

            @media (max-width: 768px) {
              .receptionist-analytics-grid {
                grid-template-columns: 1fr !important;
              }
              .receptionist-header {
                flex-direction: column;
                align-items: stretch !important;
              }
              .receptionist-header-actions {
                width: 100%;
              }
              .receptionist-header-actions a,
              .receptionist-header-actions button {
                flex: 1 1 calc(50% - 0.5rem);
                min-width: 120px;
                justify-content: center;
                text-align: center;
                box-sizing: border-box;
              }
              .receptionist-period-bar {
                padding: 0.75rem !important;
              }
              .receptionist-period-buttons {
                width: 100%;
                overflow-x: auto;
                flex-wrap: nowrap !important;
                padding-bottom: 0.35rem;
                -webkit-overflow-scrolling: touch;
              }
              .receptionist-period-buttons button {
                flex-shrink: 0;
              }
              .receptionist-filter-bar {
                width: 100% !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 0.5rem !important;
              }
              .receptionist-filter-bar input,
              .receptionist-filter-bar select,
              .receptionist-filter-bar > * {
                width: 100% !important;
                min-width: 0 !important;
                box-sizing: border-box !important;
              }
              .receptionist-table-scroll-hint {
                display: flex !important;
              }
            }

            @media (max-width: 480px) {
              .receptionist-kpi-grid {
                grid-template-columns: 1fr !important;
                gap: 0.75rem !important;
              }
              .receptionist-header-actions a,
              .receptionist-header-actions button {
                flex: 1 1 100%;
              }
              .receptionist-header h1 {
                font-size: 1.3rem !important;
              }
            }
          `,
        }}
      />

      {/* Top Header */}
      <div className="receptionist-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              Receptionist Command & Billing Center
            </h1>
            <span
              style={{
                backgroundColor: '#064e3b',
                color: '#6ee7b7',
                border: '1px solid #059669',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.725rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              Finance Receptionist
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
            Real-time patient blood issue tracking, billing operations, collections register, and shift reporting.
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="receptionist-header-actions">
          <Link
            href="/receptionist/patients/new"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.825rem',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)',
            }}
          >
            <span>+</span> Register Patient & Request
          </Link>
          <Link
            href="/receptionist/availability"
            style={{
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #0284c7',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.825rem',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>🩸</span> Check Availability
          </Link>
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            style={{
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '0.55rem 0.95rem',
              borderRadius: '8px',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="receptionist-period-bar">
        <div className="receptionist-period-buttons">
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginRight: '0.5rem', flexShrink: 0 }}>
            Reporting Period:
          </span>
          {(['today', 'yesterday', 'last_7_days', 'last_15_days', 'last_30_days', 'this_month', 'previous_month', 'custom'] as ReceptionistPeriod[]).map(
            (p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                style={{
                  backgroundColor: period === p ? '#dc2626' : '#1e293b',
                  color: period === p ? '#ffffff' : '#cbd5e1',
                  border: `1px solid ${period === p ? '#ef4444' : '#334155'}`,
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.775rem',
                  fontWeight: period === p ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            ),
          )}
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
              }}
            />
            <span style={{ color: '#64748b' }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
              }}
            />
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            padding: '1rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* 8 Summary Cards */}
      <div className="receptionist-kpi-grid">
        {/* Card 1: Completed Blood Issues */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.1rem', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            1. Completed Blood Issues
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', margin: '0.35rem 0 0.15rem 0' }}>
            {data?.summary?.totalBloodIssues ?? 0}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Successfully released across period</span>
        </div>

        {/* Card 2: Total Units Issued */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.1rem', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            2. Total Units Issued
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a78bfa', margin: '0.35rem 0 0.15rem 0' }}>
            {data?.summary?.totalUnitsIssued ?? 0} Units
          </div>
          <span style={{ fontSize: '0.725rem', color: '#64748b' }}>PRBC, FFP, Platelets, Whole Blood</span>
        </div>

        {/* Card 3: Total Invoices Generated */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.1rem', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            3. Invoices Generated
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24', margin: '0.35rem 0 0.15rem 0' }}>
            {data?.summary?.totalInvoicesGenerated ?? 0}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
            Billed: {formatCurrency(data?.summary?.totalInvoiceAmount ?? 0)}
          </span>
        </div>

        {/* Card 4: Total Payments Collected */}
        <div style={{ backgroundColor: '#064e3b', border: '1px solid #059669', borderRadius: '10px', padding: '1.1rem', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            4. Total Payments Collected
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399', margin: '0.35rem 0 0.15rem 0' }}>
            {formatCurrency(data?.summary?.totalPaymentsCollected ?? 0)}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#6ee7b7' }}>✓ Verified collections recorded</span>
        </div>

        {/* Card 5: Cash Collected */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.1rem', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            5. Cash Collected
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4ade80', margin: '0.35rem 0 0.15rem 0' }}>
            {formatCurrency(data?.summary?.totalCashCollected ?? 0)}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Direct counter currency</span>
        </div>

        {/* Card 6: Digital Collections */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.1rem', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            6. Digital Payments Collected
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60a5fa', margin: '0.35rem 0 0.15rem 0' }}>
            {formatCurrency(data?.summary?.totalDigitalCollected ?? 0)}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#64748b' }}>UPI, Card, Hospital Credit</span>
        </div>

        {/* Card 7: Outstanding Receivables */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.1rem', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            7. Outstanding Balance
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: (data?.summary?.totalOutstanding ?? 0) > 0 ? '#f87171' : '#34d399', margin: '0.35rem 0 0.15rem 0' }}>
            {formatCurrency(data?.summary?.totalOutstanding ?? 0)}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Pending collection receivables</span>
        </div>

        {/* Card 8: Pending Transactions */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.1rem', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            8. Follow-up Incomplete Tx
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: (data?.summary?.pendingTransactionsCount ?? 0) > 0 ? '#fb923c' : '#f8fafc', margin: '0.35rem 0 0.15rem 0' }}>
            {data?.summary?.pendingTransactionsCount ?? 0}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Pending payment or verification</span>
        </div>
      </div>

      {/* Visual Analytics Row: Issues over time & Payment Distribution */}
      <div className="receptionist-analytics-grid">
        {/* Payment Method Distribution Breakdown */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.25rem',
            overflow: 'hidden',
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.4rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Payment Method Breakdown
            </h3>
            <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Real-time collections</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {data?.charts?.paymentMethodDistribution?.map((item) => {
              const total = data?.summary?.totalPaymentsCollected || 1;
              const pct = Math.round((item.amount / total) * 100);
              return (
                <div key={item.method} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.method} ({item.count} payments)</span>
                    <span style={{ fontWeight: 700, color: '#38bdf8' }}>{formatCurrency(item.amount)} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor:
                          item.method === 'CASH'
                            ? '#22c55e'
                            : item.method === 'UPI'
                            ? '#3b82f6'
                            : item.method === 'CARD'
                            ? '#a855f7'
                            : '#f59e0b',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Component & Blood Group Summary */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.25rem',
            overflow: 'hidden',
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.4rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Blood Component Issue Distribution
            </h3>
            <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Total units released</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem', width: '100%' }}>
            {(!data?.charts?.componentDistribution || data.charts.componentDistribution.length === 0) ? (
              <div style={{ color: '#64748b', fontSize: '0.8rem', gridColumn: 'span 2', textAlign: 'center', padding: '1.5rem' }}>
                No units issued in selected date range.
              </div>
            ) : (
              data?.charts?.componentDistribution?.map((item) => (
                <div
                  key={item.component}
                  style={{
                    backgroundColor: '#1e293b',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    border: '1px solid #334155',
                    minWidth: 0,
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.component}</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.15rem' }}>
                    {item.units} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>units</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Table Filter Header */}
        <div
          style={{
            padding: '1.25rem',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Recent Blood Issue & Billing Transactions
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Individual blood releases, invoice numbers, collected sums, and outstanding balances
            </p>
          </div>

          <div className="receptionist-filter-bar">
            <input
              type="text"
              placeholder="Search receipt, invoice, patient, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0.45rem 0.75rem',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />

            <div style={{ minWidth: '180px', flex: '0 0 auto' }}>
              <ReceptionistSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'ALL', label: 'All Payment Statuses' },
                  { value: 'PAID', label: 'Paid in Full' },
                  { value: 'PARTIALLY_COLLECTED', label: 'Partially Paid' },
                  { value: 'PENDING', label: 'Pending Payment' },
                  { value: 'WAIVED', label: 'Waived' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Mobile Swipe Hint */}
        <div className="receptionist-table-scroll-hint" style={{ padding: '0.5rem 1rem', backgroundColor: '#131e33', borderBottom: '1px solid #1e293b', fontSize: '0.75rem', color: '#38bdf8', alignItems: 'center', gap: '0.5rem' }}>
          <span>👉 Swipe table horizontally to view full invoice & payment details</span>
        </div>

        {/* Transactions Table */}
        <div className="receptionist-table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#131e33', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Transaction / Receipt #</th>
                <th style={{ padding: '0.75rem 1rem' }}>Patient & Hospital</th>
                <th style={{ padding: '0.75rem 1rem' }}>Blood Unit / Group</th>
                <th style={{ padding: '0.75rem 1rem' }}>Issue Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Invoice Amount</th>
                <th style={{ padding: '0.75rem 1rem' }}>Collected</th>
                <th style={{ padding: '0.75rem 1rem' }}>Outstanding</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Receipt Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    No transactions recorded for the selected period.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const badge = PAYMENT_STATUS_BADGES[tx.paymentStatus] || PAYMENT_STATUS_BADGES.PENDING;
                  return (
                    <tr
                      key={tx.invoiceNumber}
                      style={{ borderBottom: '1px solid #1e293b' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Transaction # */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                          {tx.receiptNumber || tx.transactionNumber}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          Inv: {tx.invoiceNumber}
                        </div>
                      </td>

                      {/* Patient */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{tx.patient?.name}</div>
                        <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                          {tx.patient?.age}y / {tx.patient?.gender} • {tx.hospitalName}
                        </div>
                      </td>

                      {/* Blood Unit & Group */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            style={{
                              backgroundColor: '#881337',
                              color: '#fecdd3',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                            }}
                          >
                            {tx.bloodGroup}
                          </span>
                          <span style={{ color: '#cbd5e1' }}>{tx.componentType}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          Qty: {tx.quantity} unit(s) • Ref: {tx.requestCode}
                        </span>
                      </td>

                      {/* Issue Date */}
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                        {new Date(tx.issueDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Invoice Amount */}
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                        {formatCurrency(tx.invoiceAmount)}
                      </td>

                      {/* Amount Collected */}
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#34d399' }}>
                        {formatCurrency(tx.amountCollected)}
                      </td>

                      {/* Outstanding */}
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: tx.outstandingAmount > 0 ? '#f87171' : '#64748b' }}>
                        {formatCurrency(tx.outstandingAmount)}
                      </td>

                      {/* Payment Status */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                          }}
                        >
                          {tx.paymentStatus}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedTx(tx)}
                          style={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #38bdf8',
                            color: '#38bdf8',
                            borderRadius: '6px',
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          👁️ Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {selectedTx && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTx(null);
          }}
        >
          <div
            className="receptionist-receipt-modal"
            style={{
              backgroundColor: '#ffffff',
              color: '#0f172a',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {/* Blood Bank Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>BLOOD BANK MANAGEMENT</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Official Money Receipt & Blood Issue Voucher</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                Licensed Blood Center • 24x7 Clinical Support Desk
              </div>
            </div>

            {/* Receipt Identifiers */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              <div>
                <strong>Receipt #:</strong> {selectedTx.receiptNumber || selectedTx.transactionNumber}
              </div>
              <div>
                <strong>Date:</strong> {new Date(selectedTx.issueDate).toLocaleDateString('en-IN')}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '1rem' }}>
              <div>
                <strong>Invoice #:</strong> {selectedTx.invoiceNumber}
              </div>
              <div>
                <strong>Request Code:</strong> {selectedTx.requestCode}
              </div>
            </div>

            {/* Patient & Hospital Info */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>Patient Details</div>
              <div><strong>Name:</strong> {selectedTx.patient?.name} ({selectedTx.patient?.age}y / {selectedTx.patient?.gender})</div>
              {selectedTx.patient?.phone && <div><strong>Phone:</strong> {selectedTx.patient?.phone}</div>}
              <div><strong>Hospital:</strong> {selectedTx.hospitalName} • Dr. {selectedTx.doctorName}</div>
            </div>

            {/* Issued Item Details */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Blood Group / Component</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Quantity</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <strong>{selectedTx.bloodGroup}</strong> — {selectedTx.componentType}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{selectedTx.quantity} unit(s)</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(selectedTx.invoiceAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Financial Reconciliation Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Total Invoice Amount:</span>
                <strong>{formatCurrency(selectedTx.invoiceAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                <span>Amount Collected:</span>
                <strong>{formatCurrency(selectedTx.amountCollected)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '0.35rem' }}>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>Balance Remaining:</span>
                <strong style={{ color: selectedTx.outstandingAmount > 0 ? '#dc2626' : '#16a34a' }}>
                  {formatCurrency(selectedTx.outstandingAmount)}
                </strong>
              </div>
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🖨️ Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
