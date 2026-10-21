'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  Calendar,
  Printer,
  DollarSign,
  CreditCard,
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  fetchDailyRegisterReport,
  ReceptionistPeriod,
} from '@/lib/receptionist-api';

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

export default function ReceptionistReportsPage() {
  const [period, setPeriod] = useState<ReceptionistPeriod>('today');
  const [customStart, setCustomStart] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollButtons = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchDailyRegisterReport({
        period,
        startDate: period === 'custom' ? customStart : undefined,
        endDate: period === 'custom' ? customEnd : undefined,
      });
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate cashier shift report.');
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const getPeriodDisplayLabel = () => {
    switch (period) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'last_7_days':
        return 'Last 7 Days';
      case 'last_15_days':
        return 'Last 15 Days';
      case 'last_30_days':
        return 'Last 30 Days';
      case 'this_month':
        return 'This Month';
      case 'previous_month':
        return 'Previous Month';
      case 'custom':
        return `${customStart || 'Start'} to ${customEnd || 'End'}`;
      default:
        return 'Today';
    }
  };

  const isMultiDay = period !== 'today' && period !== 'yesterday';
  const collections = report?.collections || report?.transactions || [];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem', color: '#f8fafc' }}>
      {/* Scoped Styles for Period Bar and Print Handling */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .reports-period-bar {
              background-color: #0f172a;
              border: 1px solid #1e293b;
              border-radius: 12px;
              padding: 0.75rem 1rem;
              margin-bottom: 1.5rem;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 0.85rem;
              width: 100%;
              max-width: 100%;
              box-sizing: border-box;
            }
            .reports-scroll-wrapper {
              display: flex;
              align-items: center;
              gap: 0.45rem;
              flex: 1 1 auto;
              min-width: 0;
              max-width: 100%;
              position: relative;
            }
            .reports-period-buttons {
              display: flex;
              align-items: center;
              gap: 0.45rem;
              overflow-x: auto;
              overflow-y: hidden;
              flex-wrap: nowrap !important;
              max-width: 100%;
              min-width: 0;
              flex: 1 1 auto;
              padding: 0.25rem 0.15rem 0.45rem 0.15rem;
              -webkit-overflow-scrolling: touch;
              scrollbar-width: thin;
              scrollbar-color: #334155 transparent;
              scroll-behavior: smooth;
            }
            .reports-period-buttons::-webkit-scrollbar {
              height: 5px;
            }
            .reports-period-buttons::-webkit-scrollbar-track {
              background: rgba(15, 23, 42, 0.6);
              border-radius: 9999px;
            }
            .reports-period-buttons::-webkit-scrollbar-thumb {
              background: #334155;
              border-radius: 9999px;
            }
            .reports-period-buttons::-webkit-scrollbar-thumb:hover {
              background: #dc2626;
            }
            .reports-period-buttons button {
              flex-shrink: 0 !important;
              white-space: nowrap !important;
            }
            .reports-scroll-arrow {
              background-color: #1e293b;
              border: 1px solid #334155;
              color: #94a3b8;
              border-radius: 6px;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              flex-shrink: 0;
              transition: all 0.15s ease;
            }
            .reports-scroll-arrow:hover {
              background-color: #334155;
              color: #ffffff;
              border-color: #475569;
            }
            @media (max-width: 768px) {
              .reports-period-bar {
                flex-direction: column !important;
                align-items: stretch !important;
              }
            }
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                background: #ffffff !important;
                color: #000000 !important;
              }
            }
          `,
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#f8fafc',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <BarChart3 style={{ width: '28px', height: '28px', color: '#f43f5e' }} />
            Daily Cashier Register & Shift Report
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
            Cashier shift reconciliation, cash count breakdown, and digital collection audit.
          </p>
        </div>

        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #334155',
              padding: '0.55rem 0.95rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw style={{ width: '15px', height: '15px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1.25rem',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
            }}
          >
            <Printer style={{ width: '16px', height: '16px' }} />
            Print Shift Report
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="reports-period-bar no-print">
        <div className="reports-scroll-wrapper">
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginRight: '0.25rem', flexShrink: 0 }}>
            Period:
          </span>

          <button
            type="button"
            className="reports-scroll-arrow"
            onClick={() => scrollButtons('left')}
            aria-label="Scroll left"
            title="Scroll left"
          >
            <ChevronLeft style={{ width: '15px', height: '15px' }} />
          </button>

          <div ref={scrollContainerRef} className="reports-period-buttons">
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
                    whiteSpace: 'nowrap',
                  }}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            className="reports-scroll-arrow"
            onClick={() => scrollButtons('right')}
            aria-label="Scroll right"
            title="Scroll right"
          >
            <ChevronRight style={{ width: '15px', height: '15px' }} />
          </button>
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.775rem' }}>From:</span>
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
                colorScheme: 'dark',
              }}
            />
            <span style={{ color: '#94a3b8', fontSize: '0.775rem' }}>To:</span>
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
                colorScheme: 'dark',
              }}
            />
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle style={{ width: '20px', height: '20px', flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div
          style={{
            padding: '4rem 1.5rem',
            textAlign: 'center',
            color: '#94a3b8',
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
          }}
        >
          <Clock style={{ width: '32px', height: '32px', margin: '0 auto 0.75rem auto', color: '#f43f5e' }} />
          Generating shift reconciliation report for {getPeriodDisplayLabel()}...
        </div>
      ) : report ? (
        <div id="shift-report-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                <span>Total Collected</span>
                <DollarSign style={{ width: '16px', height: '16px', color: '#6ee7b7' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>
                ₹{(report.totalCollected || report.summary?.totalCollected || report.totalCollectionsAmount || 0).toLocaleString()}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6ee7b7', margin: '0.35rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                Shift Total Reconciled
              </p>
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                <span>Cash on Hand</span>
                <Receipt style={{ width: '16px', height: '16px', color: '#fbbf24' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>
                ₹{(report.totalCash || report.summary?.totalCash || report.byMethod?.CASH?.totalAmount || 0).toLocaleString()}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>Physical drawer currency</p>
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                <span>Digital Payments</span>
                <CreditCard style={{ width: '16px', height: '16px', color: '#60a5fa' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#60a5fa', fontFamily: 'monospace' }}>
                ₹{(report.totalDigital || report.summary?.totalDigital || 0).toLocaleString()}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>UPI, POS Card & Online</p>
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                <span>Total Receipts Issued</span>
                <TrendingUp style={{ width: '16px', height: '16px', color: '#c084fc' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c084fc', fontFamily: 'monospace' }}>
                {report.transactionCount || report.totalCount || collections.length || 0}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>Verified transactions</p>
            </div>
          </div>

          {/* Detailed Collections Shift Breakdown */}
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
                padding: '1rem',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <h2 style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Transactions for {getPeriodDisplayLabel()}</span>
                  {report.startDate && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: '#1e293b',
                        color: '#94a3b8',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #334155',
                      }}
                    >
                      {report.startDate === report.endDate ? report.startDate : `${report.startDate} to ${report.endDate}`}
                    </span>
                  )}
                </h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Reception Counter Register</span>
            </div>

            {collections.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No collections logged for the selected period ({getPeriodDisplayLabel()}).
              </div>
            ) : (
              <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', display: 'block' }}>
                <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#020617',
                        borderBottom: '1px solid #1e293b',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <th style={{ padding: '0.75rem 1rem' }}>Receipt #</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Payment Mode</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Reference</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map((c: any) => {
                      const itemDate = new Date(c.paymentDate || c.createdAt || Date.now());
                      return (
                        <tr
                          key={c._id || c.id || c.receiptNumber}
                          style={{
                            borderBottom: '1px solid #1e293b',
                            backgroundColor: '#0f172a',
                          }}
                        >
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#f43f5e' }}>
                            {c.receiptNumber || c._id?.slice(-8)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                            {isMultiDay
                              ? itemDate.toLocaleString([], {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : itemDate.toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.paymentMethod}</span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#94a3b8', fontSize: '0.75rem' }}>
                            {c.referenceNumber || 'N/A'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#6ee7b7' }}>
                            ₹{(c.amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#020617', borderTop: '1px solid #1e293b', fontWeight: 800 }}>
                      <td colSpan={4} style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8' }}>
                        Total Collections:
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#6ee7b7', fontSize: '0.95rem' }}>
                        ₹{(report.totalCollected || report.summary?.totalCollected || report.totalCollectionsAmount || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
