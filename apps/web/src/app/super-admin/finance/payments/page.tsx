'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
  PAYMENT_METHOD_LABELS,
  fetchPayments,
  fetchPaymentById,
  recordPayment,
  cancelPayment,
} from '@/lib/payment-api';
import { fetchExpenses, fetchExpenseById, ExpenseItem, ExpenseStatus, formatINR } from '@/lib/expense-api';
import StatCard from '@/components/admin/StatCard';
import UnifiedDateFilterBar from '@/components/admin/UnifiedDateFilterBar';

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

function PaymentsContent() {
  const searchParams = useSearchParams();
  const queryExpenseId = searchParams.get('expenseId');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters (Image 2 style)
  const [statusTab, setStatusTab] = useState<'all' | 'COMPLETED' | 'CANCELLED'>('all');
  const [methodFilter, setMethodFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '15days' | '30days' | 'this_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Bills Awaiting Disbursement states
  const [pendingExpenses, setPendingExpenses] = useState<ExpenseItem[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  // Record Disbursement Modal states
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [approvedExpenses, setApprovedExpenses] = useState<ExpenseItem[]>([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState('');
  const [modalIdempotencyKey, setModalIdempotencyKey] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Cancellation Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [paymentToCancel, setPaymentToCancel] = useState<Payment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Detail Modal states
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Calculate actual ISO date boundaries for server-side queries
  const { queryStartDate, queryEndDate } = useMemo(() => {
    const now = new Date();
    if (datePreset === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      return { queryStartDate: todayStr, queryEndDate: todayStr };
    }
    if (datePreset === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { queryStartDate: past.toISOString().slice(0, 10), queryEndDate: now.toISOString().slice(0, 10) };
    }
    if (datePreset === '15days') {
      const past = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      return { queryStartDate: past.toISOString().slice(0, 10), queryEndDate: now.toISOString().slice(0, 10) };
    }
    if (datePreset === '30days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { queryStartDate: past.toISOString().slice(0, 10), queryEndDate: now.toISOString().slice(0, 10) };
    }
    if (datePreset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { queryStartDate: firstDay.toISOString().slice(0, 10), queryEndDate: now.toISOString().slice(0, 10) };
    }
    if (datePreset === 'custom' && customStartDate && customEndDate) {
      return { queryStartDate: customStartDate, queryEndDate: customEndDate };
    }
    return { queryStartDate: undefined, queryEndDate: undefined };
  }, [datePreset, customStartDate, customEndDate]);

  const loadPendingExpenses = async () => {
    try {
      setPendingLoading(true);
      const [appRes, subRes] = await Promise.all([
        fetchExpenses({ status: ExpenseStatus.APPROVED, limit: 100 }),
        fetchExpenses({ status: ExpenseStatus.SUBMITTED, limit: 100 }),
      ]);
      const map = new Map<string, ExpenseItem>();
      [...appRes.items, ...subRes.items].forEach((e) => map.set(e._id, e));
      const unpaid = Array.from(map.values()).filter((e) => {
        const paid = e.paidAmount || 0;
        return e.amount > paid;
      });
      setPendingExpenses(unpaid);
    } catch (e) {
      console.error('Failed to load pending expenses:', e);
    } finally {
      setPendingLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetchPayments({
        status: statusTab !== 'all' ? statusTab : undefined,
        paymentMethod: methodFilter || undefined,
        startDate: queryStartDate,
        endDate: queryEndDate,
        limit: 1000,
      });
      setPayments(res.payments || []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab, methodFilter, queryStartDate, queryEndDate]);

  useEffect(() => {
    loadPendingExpenses();
  }, []);

  // Filtered Payments matching Search Term
  const filteredPayments = useMemo(() => {
    if (!searchTerm.trim()) return payments;
    const term = searchTerm.toLowerCase();
    return payments.filter((p) => {
      const ref = (p.referenceNumber || '').toLowerCase();
      const vendor = (p.vendorName || '').toLowerCase();
      const code = (p.expense?.expenseCode || '').toLowerCase();
      const title = (p.expense?.title || '').toLowerCase();
      const inv = (p.expense?.invoiceNumber || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      return (
        ref.includes(term) ||
        vendor.includes(term) ||
        code.includes(term) ||
        title.includes(term) ||
        inv.includes(term) ||
        notes.includes(term)
      );
    });
  }, [payments, searchTerm]);

  // Aggregate KPI stats
  const totalPaidCompleted = useMemo(() => {
    return payments
      .filter((p) => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const completedCount = useMemo(() => {
    return payments.filter((p) => p.status === PaymentStatus.COMPLETED).length;
  }, [payments]);

  const totalCancelled = useMemo(() => {
    return payments
      .filter((p) => p.status === PaymentStatus.CANCELLED)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const cancelledCount = useMemo(() => {
    return payments.filter((p) => p.status === PaymentStatus.CANCELLED).length;
  }, [payments]);

  const totalPendingToPay = useMemo(() => {
    return pendingExpenses.reduce((sum, e) => {
      const rem = Math.max(0, e.amount - (e.paidAmount || 0));
      return sum + rem;
    }, 0);
  }, [pendingExpenses]);

  const totalCommitments = useMemo(() => {
    return totalPaidCompleted + totalPendingToPay;
  }, [totalPaidCompleted, totalPendingToPay]);

  const openRecordModal = async (targetExpenseId?: string) => {
    setModalError(null);
    setPaymentAmount('');
    setPaymentMethod(PaymentMethod.UPI);
    setReferenceNumber('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes('');
    setModalIdempotencyKey(generateUUID());
    setSelectedExpenseId('');
    setShowRecordModal(true);

    try {
      // Fetch approved and submitted expenses with unpaid balances
      const [appRes, subRes] = await Promise.all([
        fetchExpenses({ status: ExpenseStatus.APPROVED, limit: 100 }),
        fetchExpenses({ status: ExpenseStatus.SUBMITTED, limit: 100 }),
      ]);
      const map = new Map<string, ExpenseItem>();
      [...appRes.items, ...subRes.items].forEach((e) => map.set(e._id, e));
      let unpaid = Array.from(map.values()).filter((e) => {
        const paid = e.paidAmount || 0;
        return e.amount > paid;
      });

      const targetId = targetExpenseId || queryExpenseId;
      let matched = targetId ? unpaid.find((e) => e._id === targetId) : null;

      // Fallback: If deep-linked expense was not in first 100 or has filter discrepancy, fetch directly
      if (targetId && !matched) {
        try {
          const direct = await fetchExpenseById(targetId);
          if (direct && (direct.status === ExpenseStatus.APPROVED || direct.status === ExpenseStatus.SUBMITTED)) {
            const rem = direct.amount - (direct.paidAmount || 0);
            if (rem > 0) {
              unpaid = [direct, ...unpaid];
              matched = direct;
            }
          }
        } catch {}
      }

      setApprovedExpenses(unpaid);

      if (matched) {
        setSelectedExpenseId(matched._id);
        const rem = matched.amount - (matched.paidAmount || 0);
        setPaymentAmount(rem.toFixed(2));
      } else if (unpaid.length > 0) {
        setSelectedExpenseId(unpaid[0]._id);
        const rem = unpaid[0].amount - (unpaid[0].paidAmount || 0);
        setPaymentAmount(rem.toFixed(2));
      } else if (targetId) {
        setModalError('The requested expense is either not found, already fully settled, or not payable.');
      }
    } catch (err: any) {
      setModalError('Could not fetch payable expenses list: ' + err.message);
    }
  };

  // Deep-link from Outstanding Dues (?expenseId=...)
  useEffect(() => {
    if (queryExpenseId) {
      openRecordModal(queryExpenseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryExpenseId]);

  const handleExpenseSelect = (eId: string) => {
    setSelectedExpenseId(eId);
    const exp = approvedExpenses.find((e) => e._id === eId);
    if (exp) {
      const remaining = exp.amount - (exp.paidAmount || 0);
      setPaymentAmount(remaining.toFixed(2));
    }
  };

  const selectedExpense = approvedExpenses.find((e) => e._id === selectedExpenseId);
  const remainingPayable = selectedExpense
    ? Math.max(0, selectedExpense.amount - (selectedExpense.paidAmount || 0))
    : 0;

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0.01) {
      setModalError('Please enter a valid disbursement amount (minimum ₹0.01).');
      return;
    }

    if (parsedAmount > remainingPayable + 0.001) {
      setModalError(`Disbursement amount exceeds remaining balance of ${formatINR(remainingPayable)}.`);
      return;
    }

    if (!referenceNumber.trim()) {
      setModalError('A valid transaction / UTR / Cheque reference number is required.');
      return;
    }

    try {
      setModalSubmitting(true);
      await recordPayment({
        expenseId: selectedExpenseId,
        amount: parsedAmount,
        paymentMethod,
        referenceNumber: referenceNumber.trim(),
        paymentDate,
        notes: paymentNotes.trim() || undefined,
        idempotencyKey: modalIdempotencyKey,
      });

      setShowRecordModal(false);
      loadPayments();
      loadPendingExpenses();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to record disbursement');
    } finally {
      setModalSubmitting(false);
    }
  };

  const openCancelModal = (p: Payment) => {
    setPaymentToCancel(p);
    setCancelReason('');
    setCancelError(null);
    setShowCancelModal(true);
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentToCancel) return;
    setCancelError(null);

    if (cancelReason.trim().length < 10) {
      setCancelError('A mandatory cancellation reason of at least 10 characters is required.');
      return;
    }

    try {
      setCancelling(true);
      await cancelPayment(paymentToCancel._id, cancelReason.trim());
      setShowCancelModal(false);
      loadPayments();
      loadPendingExpenses();
    } catch (err: any) {
      setCancelError(err?.message || 'Failed to cancel payment');
    } finally {
      setCancelling(false);
    }
  };

  const openDetailModal = async (paymentId: string) => {
    try {
      const data = await fetchPaymentById(paymentId);
      setSelectedPaymentDetail(data);
      setShowDetailModal(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to load disbursement details');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Disbursements &amp; Payments
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            Track supplier disbursements, payment vouchers, banking references, and atomic reversals.
          </p>
        </div>
        <button
          onClick={() => openRecordModal()}
          style={{
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 1px 3px rgba(220,38,38,0.25)',
          }}
        >
          <span>+</span> Record Disbursement
        </button>
      </div>

      {/* Scoped Grid Styles for Clean 4-Column Layout */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .payments-kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 1.15rem;
            }
            @media (max-width: 1100px) {
              .payments-kpi-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
            }
            @media (max-width: 640px) {
              .payments-kpi-grid {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />

      {/* KPI Cards Grid */}
      <div className="payments-kpi-grid">
        <StatCard
          title="Money Paid (Disbursed)"
          value={formatINR(totalPaidCompleted)}
          subtitle={`${completedCount} settled disbursements`}
          accentColor="#059669"
          badge="Settled"
          badgeType="success"
          loading={loading}
          icon={<span>💳</span>}
        />

        <StatCard
          title="Money to be Paid (Pending)"
          value={formatINR(totalPendingToPay)}
          subtitle={`${pendingExpenses.length} bills awaiting disbursement`}
          accentColor="#d97706"
          badge={pendingExpenses.length > 0 ? 'Action Req' : 'Clear'}
          badgeType={pendingExpenses.length > 0 ? 'warning' : 'success'}
          loading={pendingLoading}
          icon={<span>⏳</span>}
        />

        <StatCard
          title="Total Commitments (Approved)"
          value={formatINR(totalCommitments)}
          subtitle="Approved center & procurement liabilities"
          accentColor="#2563eb"
          badge="Purview"
          badgeType="info"
          loading={loading || pendingLoading}
          icon={<span>📋</span>}
        />

        <StatCard
          title="Cancelled / Voided"
          value={formatINR(totalCancelled)}
          subtitle={`${cancelledCount} reversed disbursements`}
          accentColor="#dc2626"
          badge={cancelledCount > 0 ? 'Reversed' : 'None'}
          badgeType={cancelledCount > 0 ? 'danger' : 'info'}
          loading={loading}
          icon={<span>✕</span>}
        />
      </div>

        {/* Bills & Consignments Awaiting Disbursement */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>📋</span>
              <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Bills &amp; Consignments Awaiting Disbursement</strong>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  backgroundColor: pendingExpenses.length > 0 ? '#fee2e2' : '#f1f5f9',
                  color: pendingExpenses.length > 0 ? '#991b1b' : '#64748b',
                }}
              >
                {pendingExpenses.length} pending
              </span>
            </div>
            <Link
              href="/super-admin/finance/dues"
              style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', textDecoration: 'none' }}
            >
              View Outstanding Dues &amp; Aging &rarr;
            </Link>
          </div>

          {pendingLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              Loading pending payable bills...
            </div>
          ) : pendingExpenses.length === 0 ? (
            <div style={{ padding: '1.75rem 1.25rem', textAlign: 'center', color: '#166534', backgroundColor: '#f0fdf4' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>✓ All bills and blood acquisition orders are fully disbursed!</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#15803d' }}>
                No center or blood acquisition expenditures are currently pending payment.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fdfdfd', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Expense Code</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Payee / Center</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Title / Description</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Invoice Date</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 600, textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 600, textAlign: 'right' }}>Outstanding Due (₹)</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 600, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingExpenses.map((exp) => {
                    const remaining = Math.max(0, exp.amount - (exp.paidAmount || 0));
                    return (
                      <tr key={exp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                          {exp.expenseCode}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>
                          {exp.vendorName || 'Unspecified Payee'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                          {exp.title}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                          {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                          {formatINR(exp.amount)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#be123c' }}>
                          {formatINR(remaining)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: exp.status === ExpenseStatus.SUBMITTED ? '#fef3c7' : '#ecfdf5',
                              color: exp.status === ExpenseStatus.SUBMITTED ? '#92400e' : '#065f46',
                            }}
                          >
                            {exp.status === ExpenseStatus.SUBMITTED ? 'Pending Approval' : 'Approved'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <button
                            onClick={() => openRecordModal(exp._id)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Disburse &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section Heading & Filters for Payment Records */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            Disbursement History &amp; Vouchers
          </h2>
        </div>

        {/* Filter Toolbar (Image 2 style) */}
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
          {/* Status Tabs and Search + Method Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            {/* Status Tabs */}
            <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0', gap: '2px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All (${payments.length})` },
                { id: PaymentStatus.COMPLETED, label: `Completed (${completedCount})` },
                { id: PaymentStatus.CANCELLED, label: `Cancelled (${cancelledCount})` },
              ].map((tab) => {
                const active = statusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusTab(tab.id as any)}
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
                placeholder="Search reference #, payee / vendor, invoice, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                  minWidth: '260px',
                }}
              />

              {/* Payment Method Dropdown */}
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
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
                <option value="">All Payment Methods</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Unified Horizontally Scrollable Date Filter Bar */}
          <div style={{ paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9', width: '100%' }}>
            <UnifiedDateFilterBar
              label="📅 Disbursement Date:"
              activePreset={datePreset}
              onSelectPreset={(p) => setDatePreset(p as any)}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomStartDateChange={setCustomStartDate}
              onCustomEndDateChange={setCustomEndDate}
              accentColor="#dc2626"
            />
          </div>
        </div>

        {errorMessage && (
          <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Payments Table */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              Loading disbursements...
            </div>
          ) : filteredPayments.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>No payment disbursements match the selected filter criteria.</p>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem' }}>
                Try adjusting the status tabs, search terms, or date horizon above.
              </p>
            </div>
          ) : (
            <div className="admin-table-scroll" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Vendor / Payee</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Payment Method</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Reference / UTR</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                      {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                      {p.vendorName}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                        }}
                      >
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#475569' }}>
                      {p.referenceNumber}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: p.status === PaymentStatus.COMPLETED ? '#15803d' : '#94a3b8' }}>
                      {formatINR(p.amount)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          backgroundColor: p.status === PaymentStatus.COMPLETED ? '#ecfdf5' : '#fef2f2',
                          color: p.status === PaymentStatus.COMPLETED ? '#059669' : '#dc2626',
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openDetailModal(p._id)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            color: '#1d4ed8',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Details
                        </button>
                        {p.status === PaymentStatus.COMPLETED && (
                          <button
                            onClick={() => openCancelModal(p)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              backgroundColor: '#fff1f2',
                              border: '1px solid #fecdd3',
                              borderRadius: '4px',
                              color: '#e11d48',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

        {/* Record Disbursement Modal */}
        {showRecordModal && (
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
                maxWidth: '620px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                padding: '1.75rem',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Record Supplier Disbursement
              </h2>

              {modalError && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', marginBottom: '1rem', fontSize: '0.825rem' }}>
                  ⚠️ {modalError}
                </div>
              )}

              <form onSubmit={handleRecordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {approvedExpenses.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                    No expenses or blood acquisition orders with pending payable balances were found.
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                        Select Payable Expense or Blood Consignment *
                      </label>
                      <select
                        value={selectedExpenseId}
                        onChange={(e) => handleExpenseSelect(e.target.value)}
                        style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                      >
                        {approvedExpenses.map((exp) => {
                          const rem = exp.amount - (exp.paidAmount || 0);
                          const isPending = exp.status === ExpenseStatus.SUBMITTED;
                          return (
                            <option key={exp._id} value={exp._id}>
                              {exp.expenseCode} &bull; {exp.title} &bull; {exp.vendorName} &bull; Bal: {formatINR(rem)} {isPending ? '— [Pending Approval]' : '— [Approved]'}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {selectedExpense && (
                      <>
                        <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                          <div>
                            <span style={{ color: '#64748b', display: 'block' }}>Total Invoiced</span>
                            <strong style={{ color: '#0f172a' }}>{formatINR(selectedExpense.amount)}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block' }}>Already Paid</span>
                            <strong style={{ color: '#166534' }}>{formatINR(selectedExpense.paidAmount || 0)}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block' }}>Remaining Due</span>
                            <strong style={{ color: '#be123c' }}>{formatINR(remainingPayable)}</strong>
                          </div>
                        </div>

                        {selectedExpense.status === ExpenseStatus.SUBMITTED && (
                          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.65rem 0.85rem', fontSize: '0.775rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>ℹ️</span>
                            <span>This bill is currently pending approval. Disbursing payment as Super Admin authorizes and approves this expenditure simultaneously.</span>
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Disbursement Amount (₹) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={remainingPayable}
                          required
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 700 }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Payment Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Payment Method *
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                        >
                          {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Reference / UTR / Cheque No *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. UTR-2026-9901"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'monospace' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                        Disbursement Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Voucher details, bank branch or remarks..."
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowRecordModal(false)}
                    style={{ padding: '0.55rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting || approvedExpenses.length === 0}
                    style={{ padding: '0.55rem 1.25rem', border: 'none', borderRadius: '6px', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: modalSubmitting || approvedExpenses.length === 0 ? 'not-allowed' : 'pointer', opacity: modalSubmitting ? 0.7 : 1 }}
                  >
                    {modalSubmitting ? 'Recording...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancellation Modal */}
        {showCancelModal && paymentToCancel && (
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b', margin: '0 0 0.5rem 0' }}>
                Cancel Disbursement Voucher
              </h2>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.85rem' }}>
                Cancelling disbursement of <strong>{formatINR(paymentToCancel.amount)}</strong> to &ldquo;{paymentToCancel.vendorName}&rdquo; will atomically reverse the expense balance.
              </p>

              {cancelError && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', margin: '1rem 0', fontSize: '0.825rem' }}>
                  ⚠️ {cancelError}
                </div>
              )}

              <form onSubmit={handleCancelSubmit} style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Mandatory Cancellation Reason (Min 10 Characters) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Duplicate cheque issued / bank transaction reversed..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    style={{ padding: '0.55rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Go Back
                  </button>
                  <button
                    type="submit"
                    disabled={cancelling}
                    style={{ padding: '0.55rem 1.25rem', border: 'none', borderRadius: '6px', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: cancelling ? 'not-allowed' : 'pointer' }}
                  >
                    {cancelling ? 'Reversing...' : 'Confirm Cancellation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedPaymentDetail && (
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
                borderRadius: '12px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
                padding: '1.75rem',
                border: '1px solid #fde68a',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      border: '1px solid #fde68a',
                    }}
                  >
                    ₹
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Disbursement Voucher Details
                    </h2>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Settlement &amp; Verification Record
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{ border: 'none', background: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer', lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Payment ID:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', backgroundColor: '#f8fafc', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    {selectedPaymentDetail._id}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Vendor / Payee:</span>
                  <strong style={{ color: '#0f172a', fontWeight: 700 }}>{selectedPaymentDetail.vendorName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Amount Disbursed:</span>
                  <strong style={{ color: '#15803d', fontSize: '1.1rem', fontWeight: 800 }}>
                    {formatINR(selectedPaymentDetail.amount)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Payment Method:</span>
                  <span style={{ color: '#0f172a', fontWeight: 700, backgroundColor: '#fef3c7', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '0.8rem' }}>
                    {selectedPaymentDetail.paymentMethod}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Reference / UTR:</span>
                  <span style={{ fontFamily: 'monospace', color: '#0f172a', fontWeight: 700, backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                    {selectedPaymentDetail.referenceNumber}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Disbursement Date:</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>
                    {new Date(selectedPaymentDetail.paymentDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Recorded By:</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedPaymentDetail.createdByName}</span>
                </div>

                {selectedPaymentDetail.status === 'CANCELLED' && (
                  <div style={{ backgroundColor: '#fff1f2', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                    <div style={{ color: '#9f1239', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>⚠️</span> CANCELLATION AUDIT
                    </div>
                    <div style={{ color: '#be123c', fontSize: '0.825rem', marginTop: '0.35rem' }}>
                      Reason: {selectedPaymentDetail.cancellationReason}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{
                    padding: '0.55rem 1.25rem',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
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

export default function SuperAdminPaymentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading disbursements...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}
