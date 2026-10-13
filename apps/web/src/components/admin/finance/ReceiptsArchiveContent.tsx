'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ExpenseItem,
  ExpenseStatus,
  ExpenseCategory,
  CostCenter,
  EXPENSE_CATEGORY_LABELS,
  COST_CENTER_LABELS,
  fetchExpenses,
  fetchExpenseSummary,
  deleteExpense,
  formatINR,
  ExpenseSummaryStats,
  downloadExpenseReceipt,
  openExpenseReceiptInNewTab,
} from '@/lib/expense-api';
import StatCard from '@/components/admin/StatCard';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { TableSkeleton } from '@/components/admin/LoadingSkeleton';

interface ReceiptsArchiveProps {
  portalRole: 'ADMIN' | 'SUPER_ADMIN';
}

export default function ReceiptsArchiveContent({ portalRole }: ReceiptsArchiveProps) {
  const pathname = usePathname();
  const basePath = portalRole === 'SUPER_ADMIN' ? '/super-admin/finance' : '/admin/finance';

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [stats, setStats] = useState<ExpenseSummaryStats>({
    approvedAmount: 0,
    approvedCount: 0,
    submittedAmount: 0,
    submittedCount: 0,
    rejectedAmount: 0,
    rejectedCount: 0,
    draftAmount: 0,
    draftCount: 0,
    currency: 'INR',
    byCategory: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [costCenterFilter, setCostCenterFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Selected item modal for audit view
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, summaryRes] = await Promise.all([
        fetchExpenses({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          costCenter: costCenterFilter !== 'all' ? costCenterFilter : undefined,
          search: searchTerm.trim() || undefined,
          page,
          limit: 15,
        }),
        fetchExpenseSummary(),
      ]);

      setExpenses(listRes.items);
      setTotalCount(listRes.total);
      setTotalPages(listRes.totalPages);
      setStats(summaryRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load expense records.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, costCenterFilter, searchTerm, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteDraft = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to cancel draft expense ${code}?`)) return;
    try {
      await deleteExpense(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete draft expense.');
    }
  };

  const getStatusBadge = (status: ExpenseStatus) => {
    switch (status) {
      case ExpenseStatus.APPROVED:
        return <StatusBadge status="APPROVED" />;
      case ExpenseStatus.SUBMITTED:
        return <StatusBadge status="PENDING" />;
      case ExpenseStatus.REJECTED:
        return <StatusBadge status="REJECTED" />;
      case ExpenseStatus.DRAFT:
        return <StatusBadge status="DRAFT" />;
      default:
        return <StatusBadge status={status} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Digital Bill & Receipt Archive
            </h1>
            <span
              style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                backgroundColor: '#f1f5f9',
                color: '#475569',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
              }}
            >
              Indian Rupee (INR ₹)
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            Durable, access-controlled repository of uploaded vendor bills, tax invoices, and vouchers across all cost centres.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {portalRole === 'SUPER_ADMIN' && stats.submittedCount > 0 && (
            <Link
              href="/super-admin/finance/approvals"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.85rem',
                textDecoration: 'none',
              }}
            >
              <span>🛡️ Review Pending ({stats.submittedCount})</span>
            </Link>
          )}

          <Link
            href={`${basePath}/expenses/new`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '0.6rem 1.15rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              textDecoration: 'none',
              boxShadow: '0 1px 3px rgba(220,38,38,0.25)',
            }}
          >
            <span>+ Record Expense</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <StatCard
          title="Total Incurred (Approved)"
          value={formatINR(stats.approvedAmount)}
          subtitle={`${stats.approvedCount} verified commitments`}
          accentColor="#059669"
          badge="Authorized"
          badgeType="success"
          loading={loading}
          icon={<span>₹</span>}
        />

        <StatCard
          title="Pending Approval"
          value={formatINR(stats.submittedAmount)}
          subtitle={`${stats.submittedCount} claims in Super Admin queue`}
          accentColor="#d97706"
          badge={stats.submittedCount > 0 ? 'Action Req' : 'Clear'}
          badgeType={stats.submittedCount > 0 ? 'warning' : 'success'}
          loading={loading}
          icon={<span>⏳</span>}
        />

        <StatCard
          title="Returned / Rejected"
          value={formatINR(stats.rejectedAmount)}
          subtitle={`${stats.rejectedCount} claims requiring correction`}
          accentColor="#dc2626"
          badge={stats.rejectedCount > 0 ? 'Attention' : 'None'}
          badgeType={stats.rejectedCount > 0 ? 'danger' : 'info'}
          loading={loading}
          icon={<span>✕</span>}
        />

        <StatCard
          title="Active Drafts"
          value={stats.draftCount}
          subtitle={`Unsubmitted operator drafts (${formatINR(stats.draftAmount)})`}
          accentColor="#64748b"
          badge="Work in Prog"
          badgeType="info"
          loading={loading}
          icon={<span>📝</span>}
        />
      </div>

      {error && (
        <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {/* Status Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0', gap: '2px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `All (${totalCount})` },
              { id: ExpenseStatus.SUBMITTED, label: `In Review (${stats.submittedCount})` },
              { id: ExpenseStatus.APPROVED, label: `Approved (${stats.approvedCount})` },
              { id: ExpenseStatus.REJECTED, label: `Rejected (${stats.rejectedCount})` },
              { id: ExpenseStatus.DRAFT, label: `Drafts (${stats.draftCount})` },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  style={{
                    border: 'none',
                    backgroundColor: active ? '#ffffff' : 'transparent',
                    color: active ? '#dc2626' : '#64748b',
                    fontWeight: active ? 700 : 500,
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search code, vendor, invoice..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.75rem',
                fontSize: '0.8rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                minWidth: '220px',
              }}
            />

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.8rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#334155',
              }}
            >
              <option value="all">All Categories</option>
              {Object.values(ExpenseCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {EXPENSE_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>

            {/* Cost Center Dropdown */}
            <select
              value={costCenterFilter}
              onChange={(e) => {
                setCostCenterFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.8rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#334155',
              }}
            >
              <option value="all">All Cost Centers</option>
              {Object.values(CostCenter).map((cc) => (
                <option key={cc} value={cc}>
                  {COST_CENTER_LABELS[cc]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Expense Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div className="admin-table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Expense Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Title & Category</th>
                <th style={{ padding: '0.75rem 1rem' }}>Vendor / Payee</th>
                <th style={{ padding: '0.75rem 1rem' }}>Invoice #</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Receipt</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '2rem' }}>
                    <TableSkeleton rows={5} />
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '3rem 1rem' }}>
                    <EmptyState
                      title="No expense records found"
                      description="No records match your active search or filters. Use the button above to record a new expenditure."
                      actionText="+ Record Expense"
                      onAction={() => (window.location.href = `${basePath}/expenses/new`)}
                    />
                  </td>
                </tr>
              ) : (
                expenses.map((item) => (
                  <tr
                    key={item._id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                      <button
                        onClick={() => setSelectedExpense(item)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#b91c1c',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '0.85rem',
                        }}
                      >
                        {item.expenseCode}
                      </button>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                      {new Date(item.expenseDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {EXPENSE_CATEGORY_LABELS[item.category] || item.category}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#334155', fontWeight: 500 }}>
                      {item.vendorName}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {item.invoiceNumber}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {formatINR(item.amount)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {item.receipt ? (
                        <a
                          href={`http://localhost:4000/api/expenses/${item._id}/receipt`}
                          target="_blank"
                          rel="noreferrer"
                          title={`View ${item.receipt.originalName}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: '#0284c7',
                            backgroundColor: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          <span>📎 Bill</span>
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {getStatusBadge(item.status)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        {item.status === ExpenseStatus.DRAFT && (
                          <>
                            <Link
                              href={`${basePath}/expenses/${item._id}/edit`}
                              style={{
                                color: '#475569',
                                fontSize: '0.75rem',
                                textDecoration: 'none',
                                fontWeight: 600,
                                padding: '0.25rem 0.5rem',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                              }}
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDeleteDraft(item._id, item.expenseCode)}
                              style={{
                                background: 'none',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                borderRadius: '4px',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}

                        {item.status === ExpenseStatus.REJECTED && (
                          <Link
                            href={`${basePath}/expenses/${item._id}/edit`}
                            style={{
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              fontSize: '0.75rem',
                              textDecoration: 'none',
                              fontWeight: 700,
                              padding: '0.25rem 0.5rem',
                              border: '1px solid #fca5a5',
                              borderRadius: '4px',
                            }}
                          >
                            Correct & Resubmit
                          </Link>
                        )}

                        <button
                          onClick={() => setSelectedExpense(item)}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            borderRadius: '4px',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Audit Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }}>
            <span>Showing page {page} of {totalPages} ({totalCount} total)</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: '0.25rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                &larr; Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: '0.25rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Expense Detail & Audit Modal */}
      {selectedExpense && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={() => setSelectedExpense(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
                  Expenditure Verification Record
                </span>
                <h3 style={{ margin: '0.2rem 0', fontSize: '1.2rem', color: '#0f172a' }}>
                  {selectedExpense.title}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Code: {selectedExpense.expenseCode} &bull; Created by {selectedExpense.creatorEmail} ({selectedExpense.creatorRole})
                </span>
              </div>
              <button
                onClick={() => setSelectedExpense(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {selectedExpense.status === ExpenseStatus.REJECTED && selectedExpense.rejectionReason && (
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <strong>Rejection Reason from Super Admin:</strong>
                <p style={{ margin: '0.25rem 0 0 0' }}>{selectedExpense.rejectionReason}</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Amount</span>
                <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{formatINR(selectedExpense.amount)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Vendor</span>
                <strong style={{ color: '#0f172a' }}>{selectedExpense.vendorName}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Invoice Number</span>
                <span style={{ fontFamily: 'monospace', color: '#334155' }}>{selectedExpense.invoiceNumber}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Cost Center</span>
                <span style={{ color: '#334155' }}>{COST_CENTER_LABELS[selectedExpense.costCenter]}</span>
              </div>
            </div>

            {/* Receipt Download Action */}
            <div style={{ marginBottom: '1.5rem', padding: '0.85rem', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Attached Digital Bill / Receipt</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                  {selectedExpense.receipt ? `${selectedExpense.receipt.originalName} (${(selectedExpense.receipt.sizeBytes / 1024).toFixed(1)} KB)` : 'No receipt attached.'}
                </span>
              </div>
              {selectedExpense.receipt && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await openExpenseReceiptInNewTab(selectedExpense._id);
                      } catch (err: any) {
                        alert(err?.message || 'Failed to open private receipt.');
                      }
                    }}
                    style={{
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    View Bill
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await downloadExpenseReceipt(
                          selectedExpense._id,
                          selectedExpense.receipt?.originalName,
                        );
                      } catch (err: any) {
                        alert(err?.message || 'Failed to download receipt.');
                      }
                    }}
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    Download &darr;
                  </button>
                </div>
              )}
            </div>

            {/* Audit History Timeline */}
            <div>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                Verification Audit History ({selectedExpense.auditHistory.length} events)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {selectedExpense.auditHistory.map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      borderLeft: '3px solid #cbd5e1',
                      paddingLeft: '0.75rem',
                      fontSize: '0.775rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <strong style={{ color: '#0f172a' }}>{ev.action}</strong>
                      <span>{new Date(ev.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ color: '#475569', marginTop: '0.15rem' }}>
                      By {ev.performedByName} ({ev.performedByEmail})
                    </div>
                    {ev.notes && (
                      <div style={{ color: '#64748b', fontStyle: 'italic', marginTop: '0.15rem' }}>
                        &ldquo;{ev.notes}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
