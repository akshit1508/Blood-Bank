'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ExternalSourceType,
  EXTERNAL_SOURCE_TYPE_LABELS,
  BloodAcquisitionReceipt,
  BloodAcquisitionDetail,
  AcquisitionSummaryStats,
  fetchBloodAcquisitions,
  fetchBloodAcquisitionById,
  fetchBloodAcquisitionSummary,
} from '@/lib/blood-acquisition-api';
import { formatINR, ExpenseStatus, ExpensePaymentStatus } from '@/lib/expense-api';
import StatCard from '@/components/admin/StatCard';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { TableSkeleton } from '@/components/admin/LoadingSkeleton';
import UnifiedDateFilterBar from '@/components/admin/UnifiedDateFilterBar';
import StaffAttributionBadge from '@/components/admin/StaffAttributionBadge';

type DateFilterPreset = 'all' | 'today' | '7days' | '15days' | '30days' | 'this_month' | 'custom';

export default function AcquisitionCostingPage() {
  const [stats, setStats] = useState<AcquisitionSummaryStats | null>(null);
  const [acquisitions, setAcquisitions] = useState<BloodAcquisitionReceipt[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date filters
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Table filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Detail Modal / Drawer
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<BloodAcquisitionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Calculate actual ISO date boundaries for query based on preset
  const { queryStartDate, queryEndDate } = useMemo(() => {
    const now = new Date();
    if (datePreset === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      return { queryStartDate: todayStr, queryEndDate: todayStr };
    }
    if (datePreset === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        queryStartDate: past.toISOString().slice(0, 10),
        queryEndDate: now.toISOString().slice(0, 10),
      };
    }
    if (datePreset === '15days') {
      const past = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      return {
        queryStartDate: past.toISOString().slice(0, 10),
        queryEndDate: now.toISOString().slice(0, 10),
      };
    }
    if (datePreset === '30days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return {
        queryStartDate: past.toISOString().slice(0, 10),
        queryEndDate: now.toISOString().slice(0, 10),
      };
    }
    if (datePreset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        queryStartDate: firstDay.toISOString().slice(0, 10),
        queryEndDate: now.toISOString().slice(0, 10),
      };
    }
    if (datePreset === 'custom') {
      return {
        queryStartDate: customStartDate || undefined,
        queryEndDate: customEndDate || undefined,
      };
    }
    return { queryStartDate: undefined, queryEndDate: undefined };
  }, [datePreset, customStartDate, customEndDate]);

  // Load summary stats
  const loadSummaryStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const data = await fetchBloodAcquisitionSummary(queryStartDate, queryEndDate);
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load acquisition costing summary:', err);
      setError(err?.message || 'Failed to load acquisition costing statistics');
    } finally {
      setLoadingStats(false);
    }
  }, [queryStartDate, queryEndDate]);

  // Load acquisitions list
  const loadAcquisitions = useCallback(async () => {
    try {
      setLoadingTable(true);
      setError(null);
      const res = await fetchBloodAcquisitions({
        sourceType: sourceTypeFilter !== 'all' ? (sourceTypeFilter as ExternalSourceType) : undefined,
        paymentStatus: paymentStatusFilter !== 'all' ? paymentStatusFilter : undefined,
        expenseStatus: expenseStatusFilter !== 'all' ? expenseStatusFilter : undefined,
        search: searchTerm.trim() || undefined,
        startDate: queryStartDate,
        endDate: queryEndDate,
        page,
        limit: pageSize,
      });

      setAcquisitions(res.items);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err: any) {
      console.error('Failed to load acquisitions:', err);
      setError(err?.message || 'Failed to load blood acquisition receipts');
    } finally {
      setLoadingTable(false);
    }
  }, [
    sourceTypeFilter,
    paymentStatusFilter,
    expenseStatusFilter,
    searchTerm,
    queryStartDate,
    queryEndDate,
    page,
    pageSize,
  ]);

  useEffect(() => {
    loadSummaryStats();
  }, [loadSummaryStats]);

  useEffect(() => {
    loadAcquisitions();
  }, [loadAcquisitions]);

  // Open detail view
  const handleOpenDetail = async (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setLoadingDetail(true);
    try {
      const data = await fetchBloodAcquisitionById(receiptId);
      setSelectedReceipt(data);
    } catch (err: any) {
      alert(err?.message || 'Failed to load acquisition details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedReceiptId(null);
    setSelectedReceipt(null);
  };

  // Safe formatting helpers
  const totalInvoiced = stats?.totalInvoicedValue ?? (stats?.totalInvoicedValuePaise ? stats.totalInvoicedValuePaise / 100 : 0);
  const approvedLiability = stats?.approvedLiability ?? (stats?.approvedLiabilityPaise ? stats.approvedLiabilityPaise / 100 : 0);
  const pendingApprovalAmount = stats?.pendingApprovalAmount ?? (stats?.pendingApprovalAmountPaise ? stats.pendingApprovalAmountPaise / 100 : 0);
  const outstandingDues = stats?.outstandingDues ?? (stats?.outstandingDuesPaise ? stats.outstandingDuesPaise / 100 : 0);
  const totalPaid = stats?.totalPaid ?? (stats?.totalPaidPaise ? stats.totalPaidPaise / 100 : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Scoped CSS for full mobile responsiveness */}
      <style jsx>{`
        .acq-header-wrap {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .acq-header-actions {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .acq-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1rem;
        }
        .acq-analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1rem;
          width: 100%;
        }
        .acq-analytics-card {
          background-color: #ffffff;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        .acq-chart-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .acq-chart-badge {
          flex-shrink: 0;
          white-space: nowrap;
        }
        .blood-group-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
        }
        .acq-filters-toolbar {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e2e8f0;
          background-color: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .acq-filters-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          flex: 1 1 auto;
        }

        /* Responsive Breakpoints */
        @media (max-width: 880px) {
          .acq-analytics-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 720px) {
          .acq-header-wrap {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .acq-header-actions {
            width: 100% !important;
            display: flex !important;
          }
          .acq-header-actions > * {
            flex: 1 1 auto !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .acq-filters-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 0.75rem 1rem !important;
          }
          .acq-filters-group {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100% !important;
          }
          .acq-filters-group input,
          .acq-filters-group select {
            width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
          }
        }
        @media (max-width: 640px) {
          .acq-analytics-card {
            padding: 0.85rem 1rem !important;
            gap: 0.75rem !important;
          }
          .acq-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.65rem !important;
          }
          .blood-group-grid {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 0.45rem !important;
          }
        }
        @media (max-width: 420px) {
          .blood-group-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.4rem !important;
          }
          .acq-kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="acq-header-wrap">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Finance &bull; Blood Banking Operations
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Acquisition Costing &amp; Supplier Liabilities
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Real-time financial liabilities, unit procurement costs, and payment reconciliation for blood consignments.
          </p>
        </div>

        <div className="acq-header-actions">
          <button
            onClick={() => {
              loadSummaryStats();
              loadAcquisitions();
            }}
            style={{
              padding: '0.55rem 0.95rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            🔄 Refresh
          </button>

          <Link
            href="/super-admin/finance/dues"
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '6px',
              border: '1px solid #fecdd3',
              backgroundColor: '#fff1f2',
              color: '#be123c',
              fontSize: '0.825rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            📊 Outstanding Dues
          </Link>

          <Link
            href="/super-admin/finance/payments"
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: '0.825rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 1px 2px rgba(220,38,38,0.25)',
            }}
          >
            💳 Disbursements &amp; Payments &rarr;
          </Link>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <UnifiedDateFilterBar
          label="📅 Time Period:"
          activePreset={datePreset}
          onSelectPreset={(p) => {
            setDatePreset(p as DateFilterPreset);
            setPage(1);
          }}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomStartDateChange={(d) => {
            setCustomStartDate(d);
            setPage(1);
          }}
          onCustomEndDateChange={(d) => {
            setCustomEndDate(d);
            setPage(1);
          }}
          accentColor="#dc2626"
        />
      </div>

      {error && (
        <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Summary KPI Cards Grid (8 Cards) */}
      <div className="acq-kpi-grid">
        <StatCard
          title="Total Consignments"
          value={stats?.totalAcquisitions ?? stats?.totalReceipts ?? 0}
          subtitle="External acquisition batches received"
          accentColor="#2563eb"
          badge="Consignments"
          badgeType="info"
          loading={loadingStats}
          icon={<span>📦</span>}
        />

        <StatCard
          title="Invoiced Acquisition Value"
          value={formatINR(totalInvoiced)}
          subtitle="Gross invoiced value from suppliers"
          accentColor="#0f172a"
          badge="Invoiced"
          badgeType="info"
          loading={loadingStats}
          icon={<span>🧾</span>}
        />

        <StatCard
          title="Approved Liability"
          value={formatINR(approvedLiability)}
          subtitle="Net verified liability ready for payment"
          accentColor="#059669"
          badge="Authorized"
          badgeType="success"
          loading={loadingStats}
          icon={<span>✅</span>}
        />

        <StatCard
          title="Pending Financial Approval"
          value={formatINR(pendingApprovalAmount)}
          subtitle={`${stats?.pendingApprovalCount || 0} consignment(s) awaiting Super Admin`}
          accentColor="#d97706"
          badge={stats?.pendingApprovalCount ? `${stats.pendingApprovalCount} Pending` : '0 Pending'}
          badgeType="warning"
          loading={loadingStats}
          icon={<span>⏳</span>}
        />

        <StatCard
          title="Outstanding Supplier Dues"
          value={formatINR(outstandingDues)}
          subtitle={`Paid to date: ${formatINR(totalPaid)}`}
          accentColor="#be123c"
          badge="Payable"
          badgeType="danger"
          loading={loadingStats}
          icon={<span>💳</span>}
        />

        <StatCard
          title="Accepted Blood Units"
          value={stats?.totalAcceptedUnits ?? 0}
          subtitle={`Out of ${stats?.totalUnitsReceived ?? 0} total units`}
          accentColor="#059669"
          badge="Inventory Ready"
          badgeType="success"
          loading={loadingStats}
          icon={<span>🩸</span>}
        />

        <StatCard
          title="Rejected Blood Units"
          value={stats?.totalRejectedUnits ?? 0}
          subtitle="Quarantined or rejected on intake"
          accentColor="#dc2626"
          badge="Discrepancy"
          badgeType="danger"
          loading={loadingStats}
          icon={<span>🚫</span>}
        />

        <StatCard
          title="Pending Testing & Inspection"
          value={stats?.pendingTestingUnits ?? stats?.pendingTesting ?? 0}
          subtitle="Under laboratory verification"
          accentColor="#7c3aed"
          badge="In Testing"
          badgeType="info"
          loading={loadingStats}
          icon={<span>🔬</span>}
        />
      </div>

      {/* Visual Analytics / Charts Section */}
      <div className="acq-analytics-grid">
        {/* Chart 1: Acquisition Value Timeline */}
        <div className="acq-analytics-card">
          <div className="acq-chart-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                📈 Acquisition Cost Trend Over Time
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Daily distribution of invoiced consignment costs
              </p>
            </div>
            <span
              className="acq-chart-badge"
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#2563eb',
                backgroundColor: '#eff6ff',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid #bfdbfe',
              }}
            >
              Timeline
            </span>
          </div>

          {stats?.timeline && stats.timeline.length > 0 ? (
            (() => {
              const timelineList = stats.timeline;
              const isFew = timelineList.length <= 3;
              const isMany = timelineList.length > 6;
              const maxVal = Math.max(...timelineList.map((t) => t.value), 1);
              return (
                <div style={{ marginTop: '0.5rem', width: '100%' }}>
                  <div
                    className="admin-table-scroll"
                    style={{
                      width: '100%',
                      overflowX: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      paddingBottom: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '0.75rem',
                        height: '140px',
                        paddingBottom: '0.5rem',
                        borderBottom: '1px solid #e2e8f0',
                        minWidth: isMany ? `${timelineList.length * 60}px` : '100%',
                        justifyContent: isFew ? 'center' : 'flex-start',
                      }}
                    >
                      {timelineList.map((item, idx) => {
                        const heightPercent = Math.max(14, Math.round((item.value / maxVal) * 100));
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.25rem',
                              minWidth: '55px',
                              flex: isFew ? '0 0 75px' : 1,
                              maxWidth: isFew ? '90px' : 'none',
                            }}
                            title={`${item.date}: ${formatINR(item.value)} (${item.count} consignment${item.count > 1 ? 's' : ''})`}
                          >
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#0f172a' }}>
                              ₹{item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}k` : item.value}
                            </span>
                            <div
                              style={{
                                width: '100%',
                                maxWidth: '36px',
                                height: `${heightPercent}%`,
                                backgroundColor: '#3b82f6',
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.3s ease',
                              }}
                            />
                            <span style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                              {item.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              No timeline data available for the selected date range.
            </div>
          )}
        </div>

        {/* Chart 2: Blood Group & Quality Breakdown */}
        <div className="acq-analytics-card">
          <div className="acq-chart-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                🧬 Blood Group &amp; Component Distribution
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Units received grouped by ABO/Rh group and component type
              </p>
            </div>
            <span
              className="acq-chart-badge"
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#059669',
                backgroundColor: '#ecfdf5',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid #a7f3d0',
              }}
            >
              Inventory Intake
            </span>
          </div>

          {stats?.byBloodGroup && Object.keys(stats.byBloodGroup).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="blood-group-grid">
                {Object.entries(stats.byBloodGroup).map(([group, count]) => (
                  <div
                    key={group}
                    style={{
                      padding: '0.55rem 0.4rem',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      textAlign: 'center',
                      minWidth: 0,
                    }}
                  >
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#dc2626' }}>{group}</div>
                    <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {count} unit{count > 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>

              {/* Component pills */}
              {stats?.byComponent && Object.keys(stats.byComponent).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.25rem' }}>
                  {Object.entries(stats.byComponent).map(([comp, count]) => (
                    <span
                      key={comp}
                      style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '20px',
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        border: '1px solid #cbd5e1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>{comp.replace(/_/g, ' ')}:</span>
                      <strong style={{ color: '#0f172a' }}>{count}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              No blood unit metrics available for the selected range.
            </div>
          )}
        </div>
      </div>

      {/* Acquisitions Table Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          overflow: 'hidden',
        }}
      >
        {/* Table Filters Toolbar */}
        <div className="acq-filters-toolbar">
          <div className="acq-filters-group">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search receipt code, supplier, invoice #..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.75rem',
                fontSize: '0.825rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                minWidth: '220px',
                backgroundColor: '#ffffff',
              }}
            />

            {/* Source Type Filter */}
            <select
              value={sourceTypeFilter}
              onChange={(e) => {
                setSourceTypeFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.825rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#334155',
              }}
            >
              <option value="all">All Source Types</option>
              {Object.values(ExternalSourceType).map((st) => (
                <option key={st} value={st}>
                  {EXTERNAL_SOURCE_TYPE_LABELS[st]}
                </option>
              ))}
            </select>

            {/* Payment Status Filter */}
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.825rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#334155',
              }}
            >
              <option value="all">All Payment Statuses</option>
              <option value={ExpensePaymentStatus.UNPAID}>Unpaid</option>
              <option value={ExpensePaymentStatus.PARTIALLY_PAID}>Partially Paid</option>
              <option value={ExpensePaymentStatus.PAID}>Fully Paid</option>
            </select>

            {/* Expense Approval Status Filter */}
            <select
              value={expenseStatusFilter}
              onChange={(e) => {
                setExpenseStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.825rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#334155',
              }}
            >
              <option value="all">All Approval Statuses</option>
              <option value={ExpenseStatus.SUBMITTED}>Pending Approval (Submitted)</option>
              <option value={ExpenseStatus.APPROVED}>Approved</option>
              <option value={ExpenseStatus.REJECTED}>Rejected</option>
              <option value={ExpenseStatus.DRAFT}>Draft</option>
            </select>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Showing <strong>{acquisitions.length}</strong> of <strong>{totalCount}</strong> consignment{totalCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table Content */}
        {loadingTable ? (
          <div style={{ padding: '2rem' }}>
            <TableSkeleton rows={6} />
          </div>
        ) : acquisitions.length === 0 ? (
          <div style={{ padding: '3rem 1rem' }}>
            <EmptyState
              title="No blood acquisitions found"
              description="No acquisition records match your selected date range and filter criteria."
              icon="📦"
            />
          </div>
        ) : (
          <div className="admin-table-scroll" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ color: '#475569', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Receipt Code &amp; Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Supplier / Source</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Acquired / Called By</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Invoice / Ref</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Units (Acc / Tot)</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Invoiced</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Approval Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Payment Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Outstanding Due</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {acquisitions.map((item) => {
                  const fin = item.financials;
                  const acceptedUnits = item.unitsSummary?.approved ?? 0;
                  const totalUnits = item.unitsSummary?.total ?? item.totalUnitsGenerated ?? 0;
                  const invoicedAmt = fin?.totalPayable ?? item.totalPayable ?? 0;
                  const outstandingAmt = fin?.outstandingBalance ?? 0;
                  const expStatus = fin?.expenseStatus || 'NO_EXPENSE';
                  const payStatus = fin?.paymentStatus || 'UNPAID';
                  const isApproved = expStatus === ExpenseStatus.APPROVED;

                  return (
                    <tr
                      key={item._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.1s ease',
                      }}
                      className="hover:bg-slate-50"
                    >
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                          {item.receiptCode}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>
                          {new Date(item.receivedDate).toLocaleDateString('en-IN')}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.sourceName}</div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                          {EXTERNAL_SOURCE_TYPE_LABELS[item.sourceType] || item.sourceType}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <StaffAttributionBadge
                            label="Called by"
                            name={item.createdByName || 'Staff Member'}
                            role={item.createdByRole || 'ADMIN'}
                            timestamp={item.createdAt}
                            size="xs"
                          />
                          {item.clearanceAuthorizedByName && (
                            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
                              Clearance: {item.clearanceAuthorizedByName}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#475569' }}>
                        {item.invoiceNumber || item.referenceNumber || '—'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: acceptedUnits > 0 ? '#ecfdf5' : '#f1f5f9',
                            color: acceptedUnits > 0 ? '#065f46' : '#64748b',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {acceptedUnits} / {totalUnits}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                        {formatINR(invoicedAmt)}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {expStatus === ExpenseStatus.APPROVED ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d' }}>
                            APPROVED
                          </span>
                        ) : expStatus === ExpenseStatus.SUBMITTED ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                            PENDING APPROVAL
                          </span>
                        ) : expStatus === ExpenseStatus.REJECTED ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#991b1b' }}>
                            REJECTED
                          </span>
                        ) : expStatus === ExpenseStatus.DRAFT ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                            DRAFT
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>None</span>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {payStatus === ExpensePaymentStatus.PAID ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857' }}>
                            PAID
                          </span>
                        ) : payStatus === ExpensePaymentStatus.PARTIALLY_PAID ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                            PARTIAL
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#fff1f2', color: '#be123c' }}>
                            UNPAID
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: outstandingAmt > 0 ? '#be123c' : '#15803d',
                          }}
                        >
                          {formatINR(outstandingAmt)}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          <button
                            onClick={() => handleOpenDetail(item._id)}
                            style={{
                              padding: '0.25rem 0.55rem',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Details
                          </button>

                          {fin?.expenseId && isApproved && outstandingAmt > 0 && (
                            <Link
                              href={`/super-admin/finance/payments?expenseId=${fin.expenseId}`}
                              style={{
                                padding: '0.25rem 0.55rem',
                                borderRadius: '4px',
                                border: '1px solid #bfdbfe',
                                backgroundColor: '#eff6ff',
                                color: '#1d4ed8',
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              💳 Disburse
                            </Link>
                          )}

                          {fin?.expenseId && expStatus === ExpenseStatus.SUBMITTED && (
                            <Link
                              href="/super-admin/finance/expenses"
                              style={{
                                padding: '0.25rem 0.55rem',
                                borderRadius: '4px',
                                border: '1px solid #fde68a',
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Approve &rarr;
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: page <= 1 ? '#f1f5f9' : '#ffffff',
                  color: page <= 1 ? '#94a3b8' : '#334155',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: page >= totalPages ? '#f1f5f9' : '#ffffff',
                  color: page >= totalPages ? '#94a3b8' : '#334155',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer / Modal */}
      {selectedReceiptId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={handleCloseDetail}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
                  Consignment Traceability &amp; Costing
                </span>
                <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {selectedReceipt?.receiptCode || 'Loading...'}
                </h2>
              </div>
              <button
                onClick={handleCloseDetail}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#64748b',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {loadingDetail || !selectedReceipt ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  Loading consignment details...
                </div>
              ) : (
                <>
                  {/* Summary Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>SUPPLIER / SOURCE</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>
                        {selectedReceipt.sourceName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {EXTERNAL_SOURCE_TYPE_LABELS[selectedReceipt.sourceType]}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>RECEIVED DATE</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>
                        {new Date(selectedReceipt.receivedDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Ref: {selectedReceipt.invoiceNumber || selectedReceipt.referenceNumber || 'N/A'}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>ACQUIRED / CALLED BY</span>
                      <div style={{ marginTop: '0.25rem' }}>
                        <StaffAttributionBadge
                          label="Called by"
                          name={selectedReceipt.createdByName || 'Staff Member'}
                          role={selectedReceipt.createdByRole || 'ADMIN'}
                          timestamp={selectedReceipt.createdAt}
                          size="xs"
                        />
                      </div>
                      {selectedReceipt.createdByEmail && (
                        <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem' }}>
                          {selectedReceipt.createdByEmail}
                        </div>
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>UNITS STATUS</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#059669', marginTop: '0.15rem' }}>
                        {selectedReceipt.stats?.approved ?? 0} Accepted
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {selectedReceipt.stats?.testing ?? 0} In Testing &bull; {selectedReceipt.stats?.rejected ?? 0} Rejected
                      </div>
                    </div>
                  </div>

                  {selectedReceipt.clearanceAuthorizedByName && (
                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Medical Clearance Certification</span>
                        <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '0.15rem' }}>
                          Certificate #{selectedReceipt.clearanceCertificateNumber || 'N/A'} &bull; Direct Inventory Intake Authorized
                        </div>
                      </div>
                      <StaffAttributionBadge
                        label="Authorized by"
                        name={selectedReceipt.clearanceAuthorizedByName}
                        role="MEDICAL_OFFICER"
                        timestamp={selectedReceipt.clearanceAuthorizationDate}
                        size="xs"
                      />
                    </div>
                  )}

                  {/* Financial Reconciliation Box */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                        💰 Financial Breakdown &amp; Linked Expense
                      </h4>
                      {selectedReceipt.financials?.expenseCode && (
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          {selectedReceipt.financials.expenseCode}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', textAlign: 'center' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>GROSS INVOICED</span>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                          {formatINR(selectedReceipt.financials?.totalPayable ?? selectedReceipt.totalPayable ?? 0)}
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>CREDIT NOTES</span>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
                          {formatINR(selectedReceipt.financials?.totalAdjustments ?? 0)}
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#f0fdf4', padding: '0.75rem', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>PAID TO DATE</span>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d', marginTop: '0.25rem' }}>
                          {formatINR(selectedReceipt.financials?.paidAmount ?? 0)}
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#fff1f2', padding: '0.75rem', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#9f1239', fontWeight: 700 }}>REMAINING DUE</span>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#be123c', marginTop: '0.25rem' }}>
                          {formatINR(selectedReceipt.financials?.outstandingBalance ?? 0)}
                        </div>
                      </div>
                    </div>

                    {/* Disburse Action Link */}
                    {selectedReceipt.financials?.expenseId && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        {selectedReceipt.financials.expenseStatus === ExpenseStatus.APPROVED && (selectedReceipt.financials.outstandingBalance ?? 0) > 0 && (
                          <Link
                            href={`/super-admin/finance/payments?expenseId=${selectedReceipt.financials.expenseId}`}
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '6px',
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              boxShadow: '0 1px 2px rgba(220,38,38,0.2)',
                            }}
                          >
                            💳 Record Disbursement in Payments &rarr;
                          </Link>
                        )}

                        {selectedReceipt.financials.expenseStatus === ExpenseStatus.SUBMITTED && (
                          <Link
                            href="/super-admin/finance/expenses"
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '6px',
                              backgroundColor: '#f59e0b',
                              color: '#ffffff',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                            }}
                          >
                            Review &amp; Approve in Expenditure &rarr;
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Consignment Items Table */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                      Blood Consignment Line Items ({selectedReceipt.items?.length || 0})
                    </h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '0.5rem' }}>Group</th>
                          <th style={{ padding: '0.5rem' }}>Component</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Invoiced</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Accepted</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Rejected</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Unit Cost</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReceipt.items?.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.5rem', fontWeight: 700, color: '#dc2626' }}>{it.bloodGroup}</td>
                            <td style={{ padding: '0.5rem', color: '#334155' }}>{it.componentType}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{it.invoicedQuantity}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center', color: '#15803d', fontWeight: 600 }}>{it.acceptedQuantity}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center', color: it.rejectedQuantity > 0 ? '#dc2626' : '#64748b' }}>{it.rejectedQuantity || 0}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatINR(it.unitCost)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>{formatINR((it.totalCostPaise || 0) / 100)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Attached Documents */}
                  {(selectedReceipt.invoiceDocumentUrl || selectedReceipt.clearanceCertificateUrl) && (
                    <div style={{ display: 'flex', gap: '1rem', backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      {selectedReceipt.invoiceDocumentUrl && (
                        <a
                          href={selectedReceipt.invoiceDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#2563eb',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          📄 View Invoiced Bill (PDF)
                        </a>
                      )}
                      {selectedReceipt.clearanceCertificateUrl && (
                        <a
                          href={selectedReceipt.clearanceCertificateUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#059669',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          📜 View Clearance Certificate
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
