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
  approveExpense,
  rejectExpense,
  fetchExpenseById,
} from '@/lib/expense-api';
import { getStoredAdmin } from '@/lib/auth-api';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
  PAYMENT_METHOD_LABELS,
  fetchPayments,
  recordPayment,
  cancelPayment,
  linkExpenseVendor,
} from '@/lib/payment-api';
import { fetchActiveVendorOptions, ActiveVendorOption } from '@/lib/vendor-api';
import StatCard from '@/components/admin/StatCard';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { TableSkeleton } from '@/components/admin/LoadingSkeleton';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface ExpenseDirectoryProps {
  portalRole: 'ADMIN' | 'SUPER_ADMIN';
}

export default function ExpenseDirectoryContent({ portalRole }: ExpenseDirectoryProps) {
  const pathname = usePathname();
  const basePath = portalRole === 'SUPER_ADMIN' ? '/super-admin/finance' : '/admin/finance';

  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  useEffect(() => {
    setCurrentAdmin(getStoredAdmin());
  }, []);

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

  // Payments for selected expense
  const [expensePayments, setExpensePayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Approval / Rejection in Audit Modal
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Payment Recording in Audit Modal
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState('');
  const [payIdempotencyKey, setPayIdempotencyKey] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Link Vendor in Audit Modal
  const [showLinkVendorModal, setShowLinkVendorModal] = useState(false);
  const [vendorOptions, setVendorOptions] = useState<ActiveVendorOption[]>([]);
  const [loadingVendorOptions, setLoadingVendorOptions] = useState(false);
  const [selectedVendorToLink, setSelectedVendorToLink] = useState('');
  const [linkingVendor, setLinkingVendor] = useState(false);
  const [linkVendorError, setLinkVendorError] = useState<string | null>(null);

  // Payment Cancellation in Audit Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [paymentToCancel, setPaymentToCancel] = useState<Payment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  // Pre-load active vendors for instant modal rendering
  useEffect(() => {
    fetchActiveVendorOptions()
      .then((opts) => {
        setVendorOptions(opts);
      })
      .catch((err) => {
        console.error('Failed to pre-fetch active vendor options:', err);
      });
  }, []);

  const handleDeleteDraft = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to cancel draft expense ${code}?`)) return;
    try {
      await deleteExpense(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete draft expense.');
    }
  };

  const loadExpensePayments = useCallback(async (expId: string) => {
    try {
      setLoadingPayments(true);
      const res = await fetchPayments({ expenseId: expId });
      setExpensePayments(res.payments || []);
    } catch {
      setExpensePayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  const refreshSelectedExpense = async (expId: string) => {
    try {
      const updated = await fetchExpenseById(expId);
      setSelectedExpense(updated);
      if (updated.status === ExpenseStatus.APPROVED) {
        await loadExpensePayments(expId);
      }
      await loadData();
    } catch (err: any) {
      console.error('Failed to refresh expense details:', err);
    }
  };

  useEffect(() => {
    if (selectedExpense) {
      if (selectedExpense.status === ExpenseStatus.APPROVED) {
        loadExpensePayments(selectedExpense._id);
      } else {
        setExpensePayments([]);
      }
      setActionSuccess(null);
      setApprovalRemarks('');
      setRejectionReason('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExpense?._id, loadExpensePayments]);

  const handleApproveExpense = async () => {
    if (!selectedExpense) return;
    setActionInProgress(true);
    setActionSuccess(null);
    try {
      await approveExpense(selectedExpense._id, approvalRemarks.trim() || undefined);
      setActionSuccess(`Expense ${selectedExpense.expenseCode} approved successfully.`);
      setApprovalRemarks('');
      await refreshSelectedExpense(selectedExpense._id);
    } catch (err: any) {
      alert(err?.message || 'Failed to approve expense.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRejectExpense = async () => {
    if (!selectedExpense) return;
    if (rejectionReason.trim().length < 10) {
      alert('Mandatory rejection reason must be at least 10 characters.');
      return;
    }
    setActionInProgress(true);
    try {
      await rejectExpense(selectedExpense._id, rejectionReason.trim());
      setShowRejectModal(false);
      setRejectionReason('');
      setActionSuccess(`Expense ${selectedExpense.expenseCode} rejected and returned for correction.`);
      await refreshSelectedExpense(selectedExpense._id);
    } catch (err: any) {
      alert(err?.message || 'Failed to reject expense.');
    } finally {
      setActionInProgress(false);
    }
  };

  const openRecordPaymentModal = () => {
    if (!selectedExpense) return;
    const remaining = Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0));
    setPayAmount(remaining.toFixed(2));
    setPayMethod(PaymentMethod.UPI);
    setPayRef('');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNotes('');
    setPayIdempotencyKey(generateUUID());
    setPayError(null);
    setShowRecordPaymentModal(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense) return;
    setPayError(null);

    const parsed = parseFloat(payAmount);
    if (isNaN(parsed) || parsed < 0.01) {
      setPayError('Please enter a valid disbursement amount (minimum ₹0.01).');
      return;
    }

    const remaining = Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0));
    if (parsed > remaining + 0.001) {
      setPayError(`Disbursement amount cannot exceed remaining balance of ${formatINR(remaining)}.`);
      return;
    }

    if (!payRef.trim()) {
      setPayError('Transaction / UTR reference number is required.');
      return;
    }

    try {
      setPaySubmitting(true);
      await recordPayment({
        expenseId: selectedExpense._id,
        amount: parsed,
        paymentMethod: payMethod,
        referenceNumber: payRef.trim(),
        paymentDate: payDate,
        notes: payNotes.trim() || undefined,
        idempotencyKey: payIdempotencyKey,
      });

      setShowRecordPaymentModal(false);
      setActionSuccess(`Payment of ${formatINR(parsed)} recorded successfully.`);
      await refreshSelectedExpense(selectedExpense._id);
    } catch (err: any) {
      setPayError(err?.message || 'Failed to record disbursement.');
    } finally {
      setPaySubmitting(false);
    }
  };

  const openLinkVendorDialog = async () => {
    if (!selectedExpense) return;
    setLinkVendorError(null);
    setShowLinkVendorModal(true);

    // If options are already loaded, find matching vendor or select first
    if (vendorOptions.length > 0) {
      const match = vendorOptions.find(
        (v) => v.name.toLowerCase() === (selectedExpense.vendorName || '').toLowerCase()
      );
      setSelectedVendorToLink(match ? match._id : vendorOptions[0]._id);
    }

    try {
      setLoadingVendorOptions(true);
      const opts = await fetchActiveVendorOptions();
      setVendorOptions(opts);
      if (opts.length > 0) {
        const match = opts.find(
          (v) => v.name.toLowerCase() === (selectedExpense.vendorName || '').toLowerCase()
        );
        setSelectedVendorToLink(match ? match._id : opts[0]._id);
      } else {
        setSelectedVendorToLink('');
      }
    } catch (err: any) {
      setLinkVendorError('Failed to load active vendors: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingVendorOptions(false);
    }
  };

  const handleLinkVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense || !selectedVendorToLink) return;
    try {
      setLinkingVendor(true);
      await linkExpenseVendor(selectedExpense._id, selectedVendorToLink);
      setShowLinkVendorModal(false);
      setActionSuccess('Registered vendor successfully linked to this expense.');
      await refreshSelectedExpense(selectedExpense._id);
    } catch (err: any) {
      setLinkVendorError(err?.message || 'Failed to link vendor.');
    } finally {
      setLinkingVendor(false);
    }
  };

  const openCancelPaymentModal = (p: Payment) => {
    setPaymentToCancel(p);
    setCancelReason('');
    setCancelError(null);
    setShowCancelModal(true);
  };

  const handleCancelPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentToCancel || !selectedExpense) return;
    setCancelError(null);

    if (cancelReason.trim().length < 10) {
      setCancelError('Mandatory cancellation reason must be at least 10 characters.');
      return;
    }

    try {
      setCancelling(true);
      await cancelPayment(paymentToCancel._id, cancelReason.trim());
      setShowCancelModal(false);
      setPaymentToCancel(null);
      setCancelReason('');
      setActionSuccess(`Disbursement ${paymentToCancel.referenceNumber} has been cancelled and outstanding liability restored.`);
      await refreshSelectedExpense(selectedExpense._id);
    } catch (err: any) {
      setCancelError(err?.message || 'Failed to cancel disbursement.');
    } finally {
      setCancelling(false);
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
              Expenditure & Bill Management
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
            Itemized center operational expenditures, supplier bills, digital voucher verification, and authorization audit trail.
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
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        {getStatusBadge(item.status)}
                        {item.status === ExpenseStatus.APPROVED && (
                          <span
                            style={{
                              fontSize: '0.675rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              letterSpacing: '0.02em',
                              backgroundColor:
                                (item.paidAmount || 0) >= item.amount
                                  ? '#dcfce7'
                                  : (item.paidAmount || 0) > 0
                                  ? '#fef3c7'
                                  : '#f1f5f9',
                              color:
                                (item.paidAmount || 0) >= item.amount
                                  ? '#15803d'
                                  : (item.paidAmount || 0) > 0
                                  ? '#b45309'
                                  : '#475569',
                              border:
                                (item.paidAmount || 0) >= item.amount
                                  ? '1px solid #bbf7d0'
                                  : (item.paidAmount || 0) > 0
                                  ? '1px solid #fde68a'
                                  : '1px solid #cbd5e1',
                            }}
                          >
                            {(item.paidAmount || 0) >= item.amount
                              ? 'PAID'
                              : (item.paidAmount || 0) > 0
                              ? 'PARTIALLY_PAID'
                              : 'UNPAID'}
                          </span>
                        )}
                      </div>
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

            {/* Financial Details Grid */}
            {selectedExpense.status === ExpenseStatus.APPROVED ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.85rem',
                  marginBottom: '1.25rem',
                  backgroundColor: '#f8fafc',
                  padding: '1.15rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                    Approved Amount
                  </span>
                  <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>{formatINR(selectedExpense.amount)}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: '#166534', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                    Total Paid
                  </span>
                  <strong style={{ fontSize: '1.15rem', color: '#15803d' }}>
                    {formatINR(selectedExpense.paidAmount || 0)}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: '#9f1239', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                    Outstanding Balance
                  </span>
                  <strong style={{ fontSize: '1.15rem', color: '#be123c' }}>
                    {formatINR(Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0)))}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Payment Status
                  </span>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      backgroundColor:
                        (selectedExpense.paidAmount || 0) >= selectedExpense.amount
                          ? '#dcfce7'
                          : (selectedExpense.paidAmount || 0) > 0
                          ? '#fef3c7'
                          : '#fee2e2',
                      color:
                        (selectedExpense.paidAmount || 0) >= selectedExpense.amount
                          ? '#15803d'
                          : (selectedExpense.paidAmount || 0) > 0
                          ? '#b45309'
                          : '#b91c1c',
                      border:
                        (selectedExpense.paidAmount || 0) >= selectedExpense.amount
                          ? '1px solid #bbf7d0'
                          : (selectedExpense.paidAmount || 0) > 0
                          ? '1px solid #fde68a'
                          : '1px solid #fecaca',
                    }}
                  >
                    {(selectedExpense.paidAmount || 0) >= selectedExpense.amount
                      ? 'PAID'
                      : (selectedExpense.paidAmount || 0) > 0
                      ? 'PARTIALLY_PAID'
                      : 'UNPAID'}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                    Vendor / Payee
                  </span>
                  {portalRole === 'SUPER_ADMIN' && selectedExpense.vendorId ? (
                    <Link
                      href={`/super-admin/finance/vendors?vendorId=${selectedExpense.vendorId}`}
                      style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}
                      title="View Vendor Financial Statement & Ledger"
                    >
                      {selectedExpense.vendorName} ↗
                    </Link>
                  ) : (
                    <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }}>
                      {selectedExpense.vendorName}
                    </span>
                  )}
                  {!selectedExpense.vendorId && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.675rem',
                        color: '#d97706',
                        fontWeight: 600,
                        marginTop: '0.15rem',
                      }}
                    >
                      ⚠️ Unlinked (Historical)
                    </span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                    Invoice Number
                  </span>
                  <span style={{ fontFamily: 'monospace', color: '#334155', fontWeight: 600 }}>
                    {selectedExpense.invoiceNumber}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Amount</span>
                  <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{formatINR(selectedExpense.amount)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Vendor</span>
                  {portalRole === 'SUPER_ADMIN' && selectedExpense.vendorId ? (
                    <Link
                      href={`/super-admin/finance/vendors?vendorId=${selectedExpense.vendorId}`}
                      style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}
                      title="View Vendor Financial Ledger"
                    >
                      {selectedExpense.vendorName} ↗
                    </Link>
                  ) : (
                    <strong style={{ color: '#0f172a' }}>{selectedExpense.vendorName}</strong>
                  )}
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
            )}

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

            {/* Notification alert */}
            {actionSuccess && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                ✓ {actionSuccess}
              </div>
            )}

            {/* Super Admin Action Controls */}
            {portalRole === 'SUPER_ADMIN' && (
              <div style={{ marginBottom: '1.5rem', padding: '1.15rem', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px' }}>
                {selectedExpense.status === ExpenseStatus.SUBMITTED ? (
                  selectedExpense.creatorId === currentAdmin?.id ? (
                    <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '0.825rem' }}>
                      <strong>Self-Approval Prevention Enforced:</strong> You created this expense ({selectedExpense.creatorEmail}). Segregation of duties mandates that another authorized Super Admin review and approve this transaction.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#581c87' }}>
                        🛡️ Super Admin Review &amp; Approval Action
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                          Approval Remarks (Optional)
                        </label>
                        <input
                          type="text"
                          value={approvalRemarks}
                          onChange={(e) => setApprovalRemarks(e.target.value)}
                          placeholder="e.g., Verified against phlebotomy camp rate card and GST bill"
                          style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setShowRejectModal(true)}
                          disabled={actionInProgress}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          Reject with Reason...
                        </button>
                        <button
                          type="button"
                          onClick={handleApproveExpense}
                          disabled={actionInProgress}
                          style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', backgroundColor: '#16a34a', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          {actionInProgress ? 'Processing...' : '✓ Approve Expense'}
                        </button>
                      </div>
                    </div>
                  )
                ) : selectedExpense.status === ExpenseStatus.APPROVED ? (
                  <div>
                    {Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0)) > 0 ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: '#581c87', display: 'block' }}>
                            Disbursement Ready
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#6b21a8' }}>
                            Outstanding balance payable: <strong>{formatINR(Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0)))}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {!selectedExpense.vendorId ? (
                            <button
                              type="button"
                              onClick={openLinkVendorDialog}
                              style={{
                                padding: '0.55rem 1.15rem',
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                border: '1px solid #fde68a',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              🔗 Link Registered Vendor
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={openRecordPaymentModal}
                              style={{
                                padding: '0.55rem 1.25rem',
                                backgroundColor: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(220,38,38,0.25)',
                              }}
                            >
                              💳 Record Payment
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', fontSize: '0.85rem' }}>
                        <span>✓</span>
                        <strong>Fully Paid &amp; Settled:</strong>
                        <span>No remaining balance on this commitment. Further payments are disabled.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Status: <strong>{selectedExpense.status}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Payment History Section (for Approved expenses) */}
            {selectedExpense.status === ExpenseStatus.APPROVED && (
              <div style={{ marginBottom: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.925rem', color: '#0f172a', fontWeight: 700 }}>
                    Payment &amp; Disbursement History ({expensePayments.length})
                  </h4>
                  {Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0)) > 0 && selectedExpense.vendorId && (
                    <button
                      type="button"
                      onClick={openRecordPaymentModal}
                      style={{
                        padding: '0.3rem 0.65rem',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      + Add Payment
                    </button>
                  )}
                </div>

                {loadingPayments ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                    Loading payment records...
                  </div>
                ) : expensePayments.length === 0 ? (
                  <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.8rem', textAlign: 'center' }}>
                    No payments have been recorded against this approved expense yet.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.725rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Method &amp; Ref</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Amount (₹)</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Details</th>
                          {portalRole === 'SUPER_ADMIN' && <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {expensePayments.map((p) => (
                          <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.55rem 0.75rem', color: '#64748b' }}>
                              {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.paymentMethod}</div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                                {p.referenceNumber}
                              </div>
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color: p.status === 'COMPLETED' ? '#15803d' : '#94a3b8' }}>
                              {formatINR(p.amount)}
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                              <span
                                style={{
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.675rem',
                                  fontWeight: 700,
                                  backgroundColor: p.status === 'COMPLETED' ? '#dcfce7' : '#fee2e2',
                                  color: p.status === 'COMPLETED' ? '#15803d' : '#991b1b',
                                }}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', fontSize: '0.725rem', color: '#64748b' }}>
                              {p.status === 'CANCELLED' && p.cancellationReason ? (
                                <span style={{ color: '#dc2626', fontStyle: 'italic' }}>
                                  Cancelled: {p.cancellationReason}
                                </span>
                              ) : (
                                <span>By {p.createdByName} {p.notes ? `• "${p.notes}"` : ''}</span>
                              )}
                            </td>
                            {portalRole === 'SUPER_ADMIN' && (
                              <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>
                                {p.status === 'COMPLETED' && (
                                  <button
                                    type="button"
                                    onClick={() => openCancelPaymentModal(p)}
                                    style={{
                                      backgroundColor: 'transparent',
                                      border: '1px solid #fecaca',
                                      color: '#dc2626',
                                      borderRadius: '4px',
                                      padding: '0.2rem 0.45rem',
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

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

      {/* Record Payment Dialog */}
      {showRecordPaymentModal && selectedExpense && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '1rem',
          }}
          onClick={() => setShowRecordPaymentModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
                Disbursement Voucher
              </span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', color: '#0f172a' }}>
                Record Payment &bull; {selectedExpense.expenseCode}
              </h3>
            </div>

            {/* Expense details summary card */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>VENDOR / PAYEE</span>
                <strong style={{ color: '#0f172a' }}>{selectedExpense.vendorName}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>APPROVED AMOUNT</span>
                <strong style={{ color: '#0f172a' }}>{formatINR(selectedExpense.amount)}</strong>
              </div>
              <div>
                <span style={{ color: '#166534', display: 'block', fontSize: '0.7rem' }}>PREVIOUSLY PAID</span>
                <strong style={{ color: '#15803d' }}>{formatINR(selectedExpense.paidAmount || 0)}</strong>
              </div>
              <div>
                <span style={{ color: '#9f1239', display: 'block', fontSize: '0.7rem' }}>REMAINING BALANCE</span>
                <strong style={{ color: '#be123c', fontSize: '0.95rem' }}>
                  {formatINR(Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0)))}
                </strong>
              </div>
            </div>

            {payError && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.825rem' }}>
                ⚠️ {payError}
              </div>
            )}

            <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                    Disbursement Amount (₹) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const rem = Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0));
                      setPayAmount(rem.toFixed(2));
                    }}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Full Balance ({formatINR(Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0)))})
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0))}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Payment Method *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.825rem', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#0f172a' }}
                  >
                    {Object.values(PaymentMethod).map((m) => (
                      <option key={m} value={m} style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                        {PAYMENT_METHOD_LABELS[m] || m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Disbursement Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.825rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Transaction / UTR / Cheque Ref # *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UTR2026101389472"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Disbursement Notes (Optional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Bank settlement batch A"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.825rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRecordPaymentModal(false)}
                  style={{ padding: '0.55rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  style={{ padding: '0.55rem 1.25rem', border: 'none', borderRadius: '6px', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '0.85rem', fontWeight: 700, cursor: paySubmitting ? 'not-allowed' : 'pointer' }}
                >
                  {paySubmitting ? 'Recording...' : 'Confirm Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Vendor Dialog */}
      {showLinkVendorModal && selectedExpense && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '1rem',
          }}
          onClick={() => setShowLinkVendorModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
                Vendor Master Linking
              </span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', color: '#0f172a' }}>
                Link Registered Vendor &bull; {selectedExpense.expenseCode}
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Historical recorded payee: <strong>{selectedExpense.vendorName}</strong>. Select the corresponding active registered vendor profile to establish this ledger relationship.
            </p>

            {linkVendorError && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.825rem' }}>
                ⚠️ {linkVendorError}
              </div>
            )}

            <form onSubmit={handleLinkVendorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Select Registered Vendor *
                </label>
                <select
                  value={selectedVendorToLink}
                  onChange={(e) => setSelectedVendorToLink(e.target.value)}
                  disabled={loadingVendorOptions || vendorOptions.length === 0}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontWeight: 500,
                    outline: 'none',
                    cursor: loadingVendorOptions ? 'wait' : 'pointer',
                  }}
                >
                  {loadingVendorOptions ? (
                    <option value="" disabled style={{ color: '#64748b', backgroundColor: '#ffffff' }}>
                      ⏳ Loading registered vendors...
                    </option>
                  ) : vendorOptions.length === 0 ? (
                    <option value="" disabled style={{ color: '#64748b', backgroundColor: '#ffffff' }}>
                      No active registered vendors found
                    </option>
                  ) : (
                    <>
                      <option value="" disabled style={{ color: '#64748b', backgroundColor: '#ffffff' }}>
                        -- Select Registered Vendor --
                      </option>
                      {vendorOptions.map((v) => (
                        <option key={v._id} value={v._id} style={{ color: '#0f172a', backgroundColor: '#ffffff', padding: '4px' }}>
                          {v.name} &bull; {EXPENSE_CATEGORY_LABELS[v.category as ExpenseCategory] || v.category}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {vendorOptions.length === 0 && !loadingVendorOptions && (
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: '#dc2626' }}>
                    No active vendors available in Master Directory. Please register an active vendor profile first.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowLinkVendorModal(false)}
                  style={{ padding: '0.55rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkingVendor || !selectedVendorToLink}
                  style={{ padding: '0.55rem 1.25rem', border: 'none', borderRadius: '6px', backgroundColor: '#0284c7', color: '#ffffff', fontSize: '0.85rem', fontWeight: 700, cursor: linkingVendor ? 'not-allowed' : 'pointer' }}
                >
                  {linkingVendor ? 'Linking...' : 'Confirm Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {showRejectModal && selectedExpense && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '1rem',
          }}
          onClick={() => setShowRejectModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              padding: '1.5rem',
              maxWidth: '480px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Reject Expense {selectedExpense.expenseCode}
            </h3>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Please state the specific reason for rejecting this claim. The expense will transition to REJECTED status so the creator can revise and resubmit.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                Mandatory Rejection Reason * (minimum 10 characters)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., GSTIN missing on the uploaded invoice; item quantity does not match requisition sheet."
                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectExpense}
                disabled={actionInProgress || rejectionReason.trim().length < 10}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', backgroundColor: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                {actionInProgress ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Payment Modal */}
      {showCancelModal && paymentToCancel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '1rem',
          }}
          onClick={() => setShowCancelModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              padding: '1.5rem',
              maxWidth: '480px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Cancel Disbursement Voucher
            </h3>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Are you sure you want to cancel payment of <strong>{formatINR(paymentToCancel.amount)}</strong> (Ref: {paymentToCancel.referenceNumber})? This will reverse the disbursement in the vendor ledger and restore the outstanding liability.
            </p>

            {cancelError && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.825rem' }}>
                ⚠️ {cancelError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                Mandatory Cancellation Reason * (minimum 10 characters)
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Payment failed at banking portal; duplicate disbursement voucher issued."
                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCancelPaymentSubmit}
                disabled={cancelling || cancelReason.trim().length < 10}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', backgroundColor: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
