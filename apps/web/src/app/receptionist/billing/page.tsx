'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  Printer,
  X,
  FileText,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import {
  fetchInvoices,
  recordCollectionPayment,
} from '@/lib/receptionist-api';

export default function ReceptionistBillingPage() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams?.get('search') || '';

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Payment Collection Modal State
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'HOSPITAL_CREDIT'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Generated Receipt Modal State
  const [receiptData, setReceiptData] = useState<any | null>(null);

  const getInvoiceTotal = (inv: any) => {
    if (!inv) return 0;
    return inv.netPayable ?? inv.totalAmount ?? inv.subtotal ?? 0;
  };

  const getInvoiceBalance = (inv: any) => {
    if (!inv) return 0;
    if (inv.outstandingAmount !== undefined && inv.outstandingAmount !== null) {
      return Number(inv.outstandingAmount);
    }
    const total = getInvoiceTotal(inv);
    const collected = Number(inv.collectedAmount || 0);
    return Math.max(0, total - collected);
  };

  const getPatientName = (inv: any) => {
    return inv?.patient?.name || inv?.patientSnapshot?.name || inv?.patientName || 'Walk-in Patient';
  };

  const getPatientAgeGender = (inv: any) => {
    const age = inv?.patient?.age ?? inv?.patientSnapshot?.age;
    const gender = inv?.patient?.gender ?? inv?.patientSnapshot?.gender;
    if (age && gender) return `${age} yrs • ${gender}`;
    if (age) return `${age} yrs`;
    return 'Age N/A';
  };

  const getPatientBloodGroup = (inv: any) => {
    return inv?.patient?.bloodGroup || inv?.patientSnapshot?.bloodGroup || inv?.bloodGroup || 'Blood Group N/A';
  };

  const getHospitalName = (inv: any) => {
    return inv?.hospitalName || inv?.hospitalSnapshot?.name || 'Hospital Clinic';
  };

  const getCaseNumber = (inv: any) => {
    return inv?.patient?.hospitalCaseNumber || inv?.patientSnapshot?.hospitalCaseNumber || 'N/A';
  };

  const loadInvoices = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchInvoices({
        status: statusFilter,
        search: searchQuery,
      });
      setInvoices(data);
      if (data.length > 0 && !selectedInvoice) {
        setSelectedInvoice(data[0]);
      } else if (data.length > 0 && selectedInvoice) {
        const found = data.find((i: any) => (i._id || i.id) === (selectedInvoice._id || selectedInvoice.id));
        if (found) setSelectedInvoice(found);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  const handleOpenCollect = (inv: any) => {
    setSelectedInvoice(inv);
    const balance = getInvoiceBalance(inv);
    setCollectAmount(balance > 0 ? balance : getInvoiceTotal(inv));
    setReferenceNumber(
      paymentMethod === 'CASH'
        ? `CASH-${Date.now().toString().slice(-6)}`
        : `TXN-${Date.now().toString().slice(-8)}`,
    );
    setIsCollectModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setSubmittingPayment(true);
    setErrorMsg(null);

    try {
      const invId = selectedInvoice._id || selectedInvoice.id;
      const idempotencyKey = `PAY-${invId}-${Date.now()}`;
      const collectionResult = await recordCollectionPayment(invId, {
        amount: Number(collectAmount),
        paymentMethod,
        referenceNumber: referenceNumber || `REF-${Date.now()}`,
        idempotencyKey,
        notes: paymentNotes || 'Counter payment collected by Finance Receptionist',
      });

      setSuccessMsg(`Payment of ₹${Number(collectAmount).toLocaleString()} recorded successfully!`);
      setIsCollectModalOpen(false);
      setReceiptData({
        collection: collectionResult,
        invoice: selectedInvoice,
      });

      await loadInvoices();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record payment collection.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: '#064e3b',
              color: '#6ee7b7',
              border: '1px solid #059669',
            }}
          >
            <CheckCircle2 style={{ width: '12px', height: '12px' }} />
            Paid in Full
          </span>
        );
      case 'PARTIALLY_COLLECTED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: '#172554',
              color: '#93c5fd',
              border: '1px solid #1d4ed8',
            }}
          >
            <Clock style={{ width: '12px', height: '12px' }} />
            Partially Collected
          </span>
        );
      case 'PENDING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: '#451a03',
              color: '#fde68a',
              border: '1px solid #b45309',
            }}
          >
            <AlertTriangle style={{ width: '12px', height: '12px' }} />
            Unpaid / Pending
          </span>
        );
      case 'WAIVED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: '#3b0764',
              color: '#d8b4fe',
              border: '1px solid #7e22ce',
            }}
          >
            Waived / Exempt
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
            }}
          >
            {status}
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem', color: '#f8fafc' }}>
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
            <CreditCard style={{ width: '28px', height: '28px', color: '#f43f5e' }} />
            Billing & Payment Desk
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
            Review blood issue invoices, collect customer counter payments, and generate official stamped receipts.
          </p>
        </div>
      </div>

      {/* Alert Messages */}
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
      {successMsg && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#064e3b',
            border: '1px solid #059669',
            borderRadius: '8px',
            color: '#6ee7b7',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <CheckCircle2 style={{ width: '20px', height: '20px', flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left List: Invoices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadInvoices();
              }}
              style={{ position: 'relative' }}
            >
              <Search
                style={{
                  width: '16px',
                  height: '16px',
                  color: '#64748b',
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice number, patient, case #..."
                style={{
                  width: '100%',
                  backgroundColor: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                  fontSize: '0.8rem',
                  color: '#f8fafc',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {['ALL', 'PENDING', 'PARTIALLY_COLLECTED', 'PAID'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    border: '1px solid',
                    backgroundColor: statusFilter === st ? '#dc2626' : '#020617',
                    color: statusFilter === st ? '#ffffff' : '#94a3b8',
                    borderColor: statusFilter === st ? '#dc2626' : '#1e293b',
                  }}
                >
                  {st === 'PARTIALLY_COLLECTED' ? 'PARTIAL' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices List */}
          {loading ? (
            <div
              style={{
                padding: '2.5rem',
                textAlign: 'center',
                color: '#94a3b8',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
              }}
            >
              <Clock style={{ width: '24px', height: '24px', margin: '0 auto 0.5rem auto', color: '#f43f5e' }} />
              Loading invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div
              style={{
                padding: '2.5rem',
                textAlign: 'center',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                color: '#64748b',
                fontSize: '0.85rem',
              }}
            >
              No matching invoices found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '650px', overflowY: 'auto' }}>
              {invoices.map((inv) => {
                const isSelected = (selectedInvoice?._id || selectedInvoice?.id) === (inv._id || inv.id);
                const total = getInvoiceTotal(inv);
                const balance = getInvoiceBalance(inv);

                return (
                  <div
                    key={inv._id || inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      border: isSelected ? '1px solid #f43f5e' : '1px solid #1e293b',
                      backgroundColor: isSelected ? 'rgba(244, 63, 94, 0.08)' : '#0f172a',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 0 1px rgba(244, 63, 94, 0.4)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: '#f43f5e' }}>
                            {inv.invoiceNumber}
                          </span>
                          {getStatusBadge(inv.status)}
                        </div>
                        <h4 style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem', margin: '0.4rem 0 0 0' }}>
                          {getPatientName(inv)}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                          Case #{getCaseNumber(inv)} • {getHospitalName(inv)}
                        </p>
                      </div>
                      <ChevronRight
                        style={{
                          width: '16px',
                          height: '16px',
                          color: isSelected ? '#f43f5e' : '#475569',
                          transform: isSelected ? 'translateX(2px)' : 'none',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #1e293b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                      }}
                    >
                      <div>
                        <span style={{ color: '#94a3b8' }}>Total: </span>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>₹{total.toLocaleString()}</span>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Due: </span>
                        <span style={{ fontWeight: 700, color: balance > 0 ? '#fbbf24' : '#6ee7b7' }}>
                          ₹{balance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Detail Pane */}
        <div>
          {selectedInvoice ? (
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
              }}
            >
              {/* Invoice Banner */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  paddingBottom: '1.25rem',
                  borderBottom: '1px solid #1e293b',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.15rem', color: '#ffffff' }}>
                      {selectedInvoice.invoiceNumber}
                    </span>
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: '0.35rem 0 0 0' }}>
                    {getPatientName(selectedInvoice)}
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                    Hospital: {getHospitalName(selectedInvoice)} • Date: {new Date(selectedInvoice.invoiceDate || selectedInvoice.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Net Payable Amount</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6ee7b7', fontFamily: 'monospace' }}>
                    ₹{getInvoiceTotal(selectedInvoice).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Patient Meta Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    fontSize: '0.75rem',
                  }}
                >
                  <span style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Patient Details</span>
                  <p style={{ fontWeight: 700, color: '#ffffff', margin: '0 0 0.2rem 0' }}>
                    {getPatientName(selectedInvoice)} ({getPatientAgeGender(selectedInvoice)})
                  </p>
                  <p style={{ color: '#94a3b8', margin: 0 }}>Blood Group: {getPatientBloodGroup(selectedInvoice)}</p>
                </div>

                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    fontSize: '0.75rem',
                  }}
                >
                  <span style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Hospital & Case</span>
                  <p style={{ fontWeight: 700, color: '#ffffff', margin: '0 0 0.2rem 0' }}>
                    {getHospitalName(selectedInvoice)}
                  </p>
                  <p style={{ color: '#94a3b8', margin: 0 }}>Case #{getCaseNumber(selectedInvoice)}</p>
                </div>

                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    fontSize: '0.75rem',
                  }}
                >
                  <span style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Payment Ledger</span>
                  <p style={{ fontWeight: 700, color: '#6ee7b7', margin: '0 0 0.2rem 0' }}>
                    Paid: ₹{Number(selectedInvoice.collectedAmount || 0).toLocaleString()}
                  </p>
                  <p style={{ color: '#fbbf24', fontWeight: 600, margin: 0 }}>
                    Balance: ₹{getInvoiceBalance(selectedInvoice).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Line Items Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <FileText style={{ width: '16px', height: '16px', color: '#f43f5e' }} />
                  Itemized Tariff Charges
                </h3>

                <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', display: 'block' }}>
                  <table style={{ width: '100%', minWidth: '420px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#020617', borderBottom: '1px solid #1e293b', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Item Description</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Unit Rate</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedInvoice.items || []).map((item: any, idx: number) => {
                        const qty = Number(item.quantity ?? item.qty ?? 1);

                        // Fallback rate from total invoice amount if item-level amounts are missing
                        const fallbackPerItem = (selectedInvoice.items && selectedInvoice.items.length > 0)
                          ? Math.round(Number(selectedInvoice.subtotal ?? selectedInvoice.totalAmount ?? selectedInvoice.netPayable ?? 0) / selectedInvoice.items.length)
                          : 0;

                        const rawItemTotal = Number(
                          item.lineTotal ??
                          item.totalPrice ??
                          item.totalAmount ??
                          item.amount ??
                          (item.lineTotalPaise ? item.lineTotalPaise / 100 : undefined) ??
                          (item.baseProcessingFee !== undefined ? (Number(item.baseProcessingFee) + Number(item.crossmatchFee || 0)) : undefined) ??
                          (item.baseProcessingFeePaise !== undefined ? (Number(item.baseProcessingFeePaise) + Number(item.crossmatchFeePaise || 0)) / 100 : undefined) ??
                          (item.unitRate ? Number(item.unitRate) * qty : undefined) ??
                          (item.rate ? Number(item.rate) * qty : undefined) ??
                          (item.unitPrice ? Number(item.unitPrice) * qty : undefined) ??
                          0
                        );

                        const lineTotal = rawItemTotal > 0 ? rawItemTotal : (fallbackPerItem > 0 ? fallbackPerItem * qty : 0);

                        const rawRate = Number(
                          item.unitRate ??
                          item.rate ??
                          item.unitPrice ??
                          item.basePrice ??
                          (item.lineTotal ? item.lineTotal / qty : undefined) ??
                          (item.baseProcessingFee !== undefined ? (Number(item.baseProcessingFee) + Number(item.crossmatchFee || 0)) / qty : undefined) ??
                          (item.lineTotalPaise ? (item.lineTotalPaise / 100) / qty : undefined) ??
                          (lineTotal > 0 ? lineTotal / qty : 0)
                        );

                        const rate = rawRate > 0 ? rawRate : (lineTotal > 0 ? lineTotal / qty : (fallbackPerItem > 0 ? fallbackPerItem : 0));

                        const bloodGroup = item.bloodGroup || selectedInvoice.bloodGroup;
                        const component = (item.componentType || selectedInvoice.componentType || 'Whole Blood').replace(/_/g, ' ');
                        const unitCode = item.unitCode || item.unitNumber || (item.bloodUnitId ? `Unit #${String(item.bloodUnitId).slice(-6)}` : '');

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #1e293b', backgroundColor: '#0f172a' }}>
                            <td style={{ padding: '0.65rem 0.85rem', color: '#ffffff', minWidth: '180px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {bloodGroup && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '0.1rem 0.4rem',
                                      borderRadius: '4px',
                                      fontWeight: 800,
                                      fontSize: '0.75rem',
                                      backgroundColor: '#450a0a',
                                      color: '#fda4af',
                                      border: '1px solid #9f1239',
                                    }}
                                  >
                                    {bloodGroup}
                                  </span>
                                )}
                                <strong style={{ color: '#f8fafc' }}>{component}</strong>
                              </div>
                              {unitCode && (
                                <div style={{ fontSize: '0.725rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                                  {unitCode}
                                </div>
                              )}
                              {!unitCode && item.description && (
                                <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                  {item.description}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', color: '#cbd5e1', fontFamily: 'monospace' }}>
                              {qty}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#cbd5e1', fontFamily: 'monospace' }}>
                              ₹{rate.toLocaleString()}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#ffffff', fontFamily: 'monospace', fontWeight: 700 }}>
                              ₹{lineTotal.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {selectedInvoice.waiverAmount > 0 && (
                        <tr style={{ backgroundColor: '#020617', borderTop: '1px solid #1e293b' }}>
                          <td colSpan={3} style={{ padding: '0.45rem 0.85rem', textAlign: 'right', color: '#6ee7b7' }}>
                            Approved Medical Waiver:
                          </td>
                          <td style={{ padding: '0.45rem 0.85rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#6ee7b7' }}>
                            -₹{Number(selectedInvoice.waiverAmount).toLocaleString()}
                          </td>
                        </tr>
                      )}
                      <tr style={{ backgroundColor: '#020617', borderTop: '1px solid #1e293b' }}>
                        <td colSpan={3} style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>
                          Net Payable Amount:
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#ffffff' }}>
                          ₹{getInvoiceTotal(selectedInvoice).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #1e293b',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  {getInvoiceBalance(selectedInvoice) === 0 ? (
                    <span style={{ color: '#6ee7b7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <CheckCircle2 style={{ width: '16px', height: '16px' }} />
                      Invoice is fully settled.
                    </span>
                  ) : (
                    <span>
                      Outstanding balance:{' '}
                      <strong style={{ color: '#fbbf24' }}>
                        ₹{getInvoiceBalance(selectedInvoice).toLocaleString()}
                      </strong>
                    </span>
                  )}
                </div>

                <div>
                  {getInvoiceBalance(selectedInvoice) > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenCollect(selectedInvoice)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 1.25rem',
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                      }}
                    >
                      <DollarSign style={{ width: '16px', height: '16px' }} />
                      Receive & Record Payment
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '3rem 1.5rem',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              <Receipt style={{ width: '42px', height: '42px', margin: '0 auto 0.75rem auto', color: '#334155' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1', margin: 0 }}>Select an invoice</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.35rem auto 0 auto', maxWidth: '380px' }}>
                Pick an invoice from the queue to inspect charges, review patient case details, and record counter payment collections.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collect Payment Modal */}
      {isCollectModalOpen && selectedInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '0.85rem',
                borderBottom: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign style={{ width: '20px', height: '20px', color: '#6ee7b7' }} />
                <h3 style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.1rem', margin: 0 }}>Collect Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCollectModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: '8px',
                  backgroundColor: '#020617',
                  border: '1px solid #1e293b',
                  fontSize: '0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ color: '#94a3b8' }}>Invoice: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ffffff' }}>
                    {selectedInvoice.invoiceNumber}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Total Due: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fbbf24' }}>
                    ₹{getInvoiceBalance(selectedInvoice).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Amount to Collect (₹)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={getInvoiceBalance(selectedInvoice)}
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                  {(['CASH', 'UPI', 'CARD', 'HOSPITAL_CREDIT'] as const).map((m) => {
                    const isSelected = paymentMethod === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m);
                          setReferenceNumber(
                            m === 'CASH'
                              ? `CASH-${Date.now().toString().slice(-6)}`
                              : `${m}-${Date.now().toString().slice(-8)}`,
                          );
                        }}
                        style={{
                          padding: '0.55rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #10b981' : '1px solid #1e293b',
                          backgroundColor: isSelected ? '#064e3b' : '#020617',
                          color: isSelected ? '#6ee7b7' : '#94a3b8',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {m.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Transaction / UTR / Reference Number
                </label>
                <input
                  type="text"
                  required
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. UTR12389472 / CARD-AUTH-8821"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Collection Notes
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Counter remarks or cashier shift note..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #1e293b',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(false)}
                  style={{
                    padding: '0.55rem 1rem',
                    backgroundColor: '#1e293b',
                    color: '#cbd5e1',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  style={{
                    padding: '0.55rem 1.25rem',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: 'none',
                    cursor: submittingPayment ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                    opacity: submittingPayment ? 0.6 : 1,
                  }}
                >
                  {submittingPayment ? 'Recording Collection...' : 'Confirm Payment & Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt style={{ width: '20px', height: '20px', color: '#6ee7b7' }} />
                <h3 style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.1rem', margin: 0 }}>Payment Receipt Generated</h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptData(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Receipt Paper Card */}
            <div
              id="receptionist-receipt-print"
              style={{
                padding: '1.25rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.75rem',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ textAlign: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #cbd5e1' }}>
                <h4
                  style={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#be123c',
                    margin: 0,
                  }}
                >
                  Blood Bank Management System
                </h4>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0.2rem 0 0 0' }}>Official Payment & Collection Receipt</p>
                <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                  Receipt #{receiptData.collection?.receiptNumber || receiptData.collection?._id?.slice(-8) || 'RCP-001'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Patient Name:</span>
                  <strong style={{ color: '#0f172a' }}>{getPatientName(receiptData.invoice)}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#64748b', display: 'block' }}>Date & Time:</span>
                  <span style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                    {new Date().toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Invoice Number:</span>
                  <span style={{ fontFamily: 'monospace', color: '#0f172a', fontWeight: 600 }}>{receiptData.invoice?.invoiceNumber}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#64748b', display: 'block' }}>Payment Mode:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{receiptData.collection?.paymentMethod}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Reference / UTR:</span>
                  <span style={{ fontFamily: 'monospace', color: '#334155', fontSize: '0.7rem' }}>{receiptData.collection?.referenceNumber || 'N/A'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#64748b', display: 'block' }}>Cashier Desk:</span>
                  <span style={{ color: '#334155' }}>Finance Receptionist</span>
                </div>
              </div>

              <div
                style={{
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #cbd5e1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  backgroundColor: '#f8fafc',
                  padding: '0.65rem',
                  borderRadius: '6px',
                }}
              >
                <span>Total Amount Paid:</span>
                <span style={{ fontFamily: 'monospace', color: '#047857', fontSize: '1rem' }}>
                  ₹{Number(receiptData.collection?.amount || collectAmount).toLocaleString()}
                </span>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#64748b', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                <p style={{ fontWeight: 600, color: '#334155', margin: 0 }}>Thank you for your payment.</p>
                <p style={{ margin: '0.2rem 0 0 0' }}>This is a computer-generated transaction receipt. No physical signature required.</p>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setReceiptData(null)}
                style={{
                  padding: '0.55rem 1rem',
                  backgroundColor: '#1e293b',
                  color: '#cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  cursor: 'pointer',
                }}
              >
                Close
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
                Print Official Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
