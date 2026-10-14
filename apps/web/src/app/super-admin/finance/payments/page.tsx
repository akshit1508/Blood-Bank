'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

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

  const loadPayments = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetchPayments({
        status: statusFilter || undefined,
        paymentMethod: methodFilter || undefined,
      });
      setPayments(res.payments);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, methodFilter]);

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
      // Fetch approved expenses with unpaid balances
      const res = await fetchExpenses({ status: ExpenseStatus.APPROVED, limit: 100 });
      let unpaid = res.items.filter((e) => {
        const paid = e.paidAmount || 0;
        return e.amount > paid;
      });

      const targetId = targetExpenseId || queryExpenseId;
      let matched = targetId ? unpaid.find((e) => e._id === targetId) : null;

      // Fallback: If deep-linked expense was not in first 100 or has filter discrepancy, fetch directly
      if (targetId && !matched) {
        try {
          const direct = await fetchExpenseById(targetId);
          if (direct && direct.status === ExpenseStatus.APPROVED) {
            const rem = direct.amount - (direct.paidAmount || 0);
            if (rem > 0) {
              unpaid = [direct, ...unpaid];
              matched = direct;
            }
          } else if (direct && direct.status === ExpenseStatus.SUBMITTED) {
            setModalError(`Expense ${direct.expenseCode} is currently PENDING APPROVAL. A Super Admin must approve it in Approvals before disbursement.`);
            return;
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
        setModalError('The requested expense is either not approved, already fully settled, or not found.');
      }
    } catch (err: any) {
      setModalError('Could not fetch approved expenses list: ' + err.message);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            Disbursements &amp; Payments
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
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
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 1px 2px rgba(220,38,38,0.2)',
            }}
          >
            <span>+</span> Record Disbursement
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            backgroundColor: '#ffffff',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '1.5rem',
            alignItems: 'center',
          }}
        >
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.85rem',
              color: '#334155',
            }}
          >
            <option value="">All Statuses</option>
            <option value={PaymentStatus.COMPLETED}>Completed</option>
            <option value={PaymentStatus.CANCELLED}>Cancelled</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.85rem',
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
          ) : payments.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>No payment disbursements recorded.</p>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem' }}>
                Click &ldquo;Record Disbursement&rdquo; above to settle an approved medical or facilities invoice.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
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
                {payments.map((p) => (
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
                Record Vendor Disbursement
              </h2>

              {modalError && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', marginBottom: '1rem', fontSize: '0.825rem' }}>
                  ⚠️ {modalError}
                </div>
              )}

              <form onSubmit={handleRecordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {approvedExpenses.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                    No approved expenses with pending payable balances were found.
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                        Select Approved Expense *
                      </label>
                      <select
                        value={selectedExpenseId}
                        onChange={(e) => handleExpenseSelect(e.target.value)}
                        style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                      >
                        {approvedExpenses.map((exp) => {
                          const rem = exp.amount - (exp.paidAmount || 0);
                          return (
                            <option key={exp._id} value={exp._id}>
                              {exp.expenseCode} &bull; {exp.title} &bull; {exp.vendorName} &bull; Bal: {formatINR(rem)}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {selectedExpense && (
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
                borderRadius: '10px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                padding: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Disbursement Voucher Details
                </h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{ border: 'none', background: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Payment ID:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedPaymentDetail._id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Vendor:</span>
                  <strong style={{ color: '#0f172a' }}>{selectedPaymentDetail.vendorName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Amount Disbursed:</span>
                  <strong style={{ color: '#166534', fontSize: '1rem' }}>{formatINR(selectedPaymentDetail.amount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Payment Method:</span>
                  <span>{selectedPaymentDetail.paymentMethod}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Reference / UTR:</span>
                  <span style={{ fontFamily: 'monospace' }}>{selectedPaymentDetail.referenceNumber}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Disbursement Date:</span>
                  <span>{new Date(selectedPaymentDetail.paymentDate).toLocaleDateString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Recorded By:</span>
                  <span>{selectedPaymentDetail.createdByName}</span>
                </div>

                {selectedPaymentDetail.status === 'CANCELLED' && (
                  <div style={{ backgroundColor: '#fff1f2', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fecdd3' }}>
                    <div style={{ color: '#9f1239', fontWeight: 700, fontSize: '0.8rem' }}>⚠️ CANCELLATION AUDIT</div>
                    <div style={{ color: '#be123c', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      Reason: {selectedPaymentDetail.cancellationReason}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
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
