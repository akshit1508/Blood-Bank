'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileCheck,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building,
  Droplet,
  Boxes,
  CreditCard,
  ChevronRight,
  Plus,
  Printer,
  X,
  Receipt,
  User,
  Check,
  Calendar,
  Thermometer,
} from 'lucide-react';
import {
  fetchReceptionistBloodRequests,
  fetchMatchesForRequest,
  createReservationForRequest,
  fetchReservationsForRequest,
  issueBloodFromReservation,
  generateInvoiceForIssue,
  verifySupportingDocuments,
  recordCollectionPayment,
  fetchInvoices,
  fetchIssuesForRequest,
} from '@/lib/receptionist-api';
import { updateBloodRequestStatus, BloodRequestStatus } from '@/lib/blood-request-api';
import { getUnitExpiryInfo } from '@/lib/expiry-rules-api';

const formatINR = (amount: number | undefined | null) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount ?? 0);
};

export default function ReceptionistRequestsDeskPage() {
  const searchParams = useSearchParams();
  const preselectedRequestId = searchParams?.get('requestId');

  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Desk state for selected request
  const [loadingDesk, setLoadingDesk] = useState(false);
  const [matchingUnits, setMatchingUnits] = useState<any[]>([]);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>([]);
  const [existingReservations, setExistingReservations] = useState<any[]>([]);
  const [existingIssues, setExistingIssues] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Issue Confirmation Modal
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issuingLoading, setIssuingLoading] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [issueNotes, setIssueNotes] = useState('');
  const [modalErrorMsg, setModalErrorMsg] = useState<string | null>(null);

  // Payment Collection & Receipt Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'HOSPITAL_CREDIT'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentModalError, setPaymentModalError] = useState<string | null>(null);
  const [generatedReceipt, setGeneratedReceipt] = useState<any | null>(null);

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const data = await fetchReceptionistBloodRequests(filterStatus);
      setRequests(data);
      if (preselectedRequestId) {
        const found = data.find((r: any) => (r._id || r.id) === preselectedRequestId);
        if (found) setSelectedRequest(found);
      } else if (data.length > 0 && !selectedRequest) {
        setSelectedRequest(data[0]);
      } else if (data.length > 0 && selectedRequest) {
        const found = data.find((r: any) => (r._id || r.id) === (selectedRequest._id || selectedRequest.id));
        if (found) setSelectedRequest(found);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch blood requests.');
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [filterStatus]);

  // Load details and matching units when selected request changes
  useEffect(() => {
    if (!selectedRequest) return;
    const reqId = selectedRequest._id || selectedRequest.id;

    async function loadDeskData() {
      setLoadingDesk(true);
      setErrorMsg(null);
      setModalErrorMsg(null);
      setSelectedInventoryIds([]);
      try {
        const [reservations, matchesRes] = await Promise.all([
          fetchReservationsForRequest(reqId).catch(() => []),
          fetchMatchesForRequest(reqId).catch(() => ({ matchingUnits: [] })),
        ]);

        setExistingReservations(reservations || []);

        // Support both matchingUnits and matches response formats
        const units =
          matchesRes?.matchingUnits ||
          matchesRes?.matches ||
          matchesRes?.data?.matchingUnits ||
          [];
        setMatchingUnits(units);
      } catch (err: any) {
        // Non-blocking
      } finally {
        setLoadingDesk(false);
      }
    }

    loadDeskData();
  }, [selectedRequest]);

  // Toggle selection of a matching unit using functional atomic updates
  const toggleUnitSelection = (inventoryId: string, maxAllowed: number) => {
    setSelectedInventoryIds((prev) => {
      if (prev.includes(inventoryId)) {
        return prev.filter((id) => id !== inventoryId);
      } else {
        if (prev.length >= maxAllowed) {
          setErrorMsg(`You can only select up to ${maxAllowed} unit(s) for this request.`);
          return prev;
        }
        setErrorMsg(null);
        return [...prev, inventoryId];
      }
    });
  };

  // Open the Issue Confirmation Modal
  const handleOpenIssueModal = () => {
    if (!selectedRequest) return;
    const unitsNeeded = Number(selectedRequest.unitsRequested || 1);

    // Auto-trim if current selection exceeds requested count
    let ids = selectedInventoryIds;
    if (ids.length > unitsNeeded) {
      ids = ids.slice(0, unitsNeeded);
      setSelectedInventoryIds(ids);
    }

    if (ids.length === 0) {
      setErrorMsg('Please select at least 1 blood unit to issue.');
      return;
    }

    const patName = selectedRequest.patient?.name || selectedRequest.patientName || '';
    setRecipientName(patName);
    setIssueNotes('Authorized blood issue executed at Receptionist Counter');
    setModalErrorMsg(null);
    setIsIssueModalOpen(true);
  };

  // Execute the Blood Issue & Generate Invoice Workflow
  const handleConfirmIssueAndBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const unitsNeeded = Number(selectedRequest.unitsRequested || 1);
    let inventoryIdsToIssue = [...selectedInventoryIds];

    // Ensure we do not exceed unitsRequested
    if (inventoryIdsToIssue.length > unitsNeeded) {
      inventoryIdsToIssue = inventoryIdsToIssue.slice(0, unitsNeeded);
      setSelectedInventoryIds(inventoryIdsToIssue);
    }

    if (inventoryIdsToIssue.length === 0) {
      setModalErrorMsg('Please select at least 1 matching blood unit to issue.');
      return;
    }

    const reqId = selectedRequest._id || selectedRequest.id;
    setIssuingLoading(true);
    setModalErrorMsg(null);
    setErrorMsg(null);

    try {
      // 1. If request is already ISSUED, immediately fetch its invoice and open the payment modal
      if (selectedRequest.status === 'ISSUED' || selectedRequest.status === 'COMPLETED') {
        const invList = await fetchInvoices({ limit: 50 });
        const existingInv = invList.find((i: any) => (i.bloodRequestId === reqId || i.requestCode === selectedRequest.requestCode));
        if (existingInv) {
          setIsIssueModalOpen(false);
          setActiveInvoice(existingInv);
          const totalAmt = existingInv.outstandingAmount ?? existingInv.netPayable ?? existingInv.totalAmount ?? 0;
          setCollectAmount(totalAmt);
          setReferenceNumber(`CASH-${Date.now().toString().slice(-6)}`);
          setPaymentNotes('Counter payment collection');
          setPaymentModalError(null);
          setIsPaymentModalOpen(true);
          return;
        }
      }

      // 2. Query fresh live reservations directly from backend
      const liveReservations = await fetchReservationsForRequest(reqId).catch(() => []);
      const activeRes = liveReservations.find((r: any) => r.status === 'ACTIVE');

      let resId: string;
      if (activeRes) {
        resId = activeRes._id || activeRes.id;
      } else if (selectedRequest.status === 'RESERVED' && liveReservations.length > 0) {
        resId = liveReservations[0]._id || liveReservations[0].id;
      } else {
        // Approve if currently REQUESTED or VERIFIED
        if (selectedRequest.status === 'REQUESTED' || selectedRequest.status === 'VERIFIED') {
          try {
            await verifySupportingDocuments(reqId, {
              status: 'VERIFIED',
              notes: 'Supporting documents verified by Receptionist',
            });
          } catch {
            // Continue if already verified
          }
          try {
            await updateBloodRequestStatus(
              reqId,
              BloodRequestStatus.APPROVED,
              'Request approved for issue at Reception Desk',
            );
          } catch {
            // Continue if already approved
          }
        }

        const reservation = await createReservationForRequest(reqId, inventoryIdsToIssue);
        resId = reservation._id || reservation.id;
      }

      // 3. Issue the blood from the reservation
      const issuePayload = {
        issuedBy: recipientName || selectedRequest.patient?.name || selectedRequest.patientName,
        recipientName: recipientName || selectedRequest.patient?.name || selectedRequest.patientName,
        remarks: issueNotes || 'Authorized blood issue executed at Receptionist Counter',
        notes: issueNotes || 'Authorized blood issue executed at Receptionist Counter',
      };
      let issueId: string;
      try {
        const issueResult = await issueBloodFromReservation(resId, issuePayload);
        issueId = issueResult._id || issueResult.id;
      } catch (issueErr: any) {
        // If reservation is already completed/issued, check if issue record already exists
        const issueList = await fetchIssuesForRequest(reqId).catch(() => []);
        if (issueList.length > 0) {
          issueId = issueList[0]._id || issueList[0].id;
        } else {
          throw issueErr;
        }
      }

      // 4. Generate or locate the official billing invoice (feeds Super Admin Financial Control Center)
      let invoice = null;
      try {
        invoice = await generateInvoiceForIssue(issueId);
      } catch (err: any) {
        // If invoice was already created or handled by defaults, look it up below
      }

      setSuccessMsg(`Blood issued successfully (${inventoryIdsToIssue.length} unit(s))! Proceeding to payment collection.`);
      setIsIssueModalOpen(false);

      // Reload requests & desk data
      await loadRequests();

      // 5. Open Payment Collection modal immediately
      if (invoice) {
        setActiveInvoice(invoice);
        const totalAmt = invoice.outstandingAmount ?? invoice.netPayable ?? invoice.totalAmount ?? invoice.subtotal ?? 0;
        setCollectAmount(totalAmt);
        setReferenceNumber(`CASH-${Date.now().toString().slice(-6)}`);
        setPaymentNotes('Counter payment collection');
        setPaymentModalError(null);
        setIsPaymentModalOpen(true);
      } else {
        // Try locating matching invoice from billing module
        try {
          const invList = await fetchInvoices({ limit: 50 });
          const matchingInv = invList.find((i: any) => (i.issueId === issueId || i.bloodRequestId === reqId || i.requestCode === selectedRequest.requestCode));
          if (matchingInv) {
            setActiveInvoice(matchingInv);
            const totalAmt = matchingInv.outstandingAmount ?? matchingInv.netPayable ?? matchingInv.totalAmount ?? matchingInv.subtotal ?? 0;
            setCollectAmount(totalAmt);
            setReferenceNumber(`CASH-${Date.now().toString().slice(-6)}`);
            setPaymentNotes('Counter payment collection');
            setPaymentModalError(null);
            setIsPaymentModalOpen(true);
          }
        } catch {
          // Fallback handled in the billing desk
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to issue blood units.';
      setModalErrorMsg(msg);
      setErrorMsg(msg);
    } finally {
      setIssuingLoading(false);
    }
  };

  // Record Payment Collection & Generate Official Receipt
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice) return;
    setSubmittingPayment(true);
    setPaymentModalError(null);
    setErrorMsg(null);

    try {
      const invId = activeInvoice._id || activeInvoice.id;
      const idempotencyKey = `PAY-${invId}-${Date.now()}`;
      const collectionResult = await recordCollectionPayment(invId, {
        amount: Number(collectAmount),
        paymentMethod,
        referenceNumber: referenceNumber || `REF-${Date.now()}`,
        idempotencyKey,
        notes: paymentNotes || 'Reception counter payment collection',
      });

      setSuccessMsg(`Payment of ₹${Number(collectAmount).toLocaleString()} recorded! Receipt generated.`);
      setGeneratedReceipt({
        collection: collectionResult,
        invoice: activeInvoice,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to record payment collection.';
      setPaymentModalError(msg);
      setErrorMsg(msg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    let bg = '#1e293b';
    let color = '#94a3b8';
    let border = '#334155';
    let label = status;

    if (s === 'REQUESTED') {
      bg = '#451a03';
      color = '#fde68a';
      border = '#b45309';
      label = 'Requested';
    } else if (s === 'VERIFIED') {
      bg = '#172554';
      color = '#93c5fd';
      border = '#1d4ed8';
      label = 'Verified';
    } else if (s === 'APPROVED') {
      bg = '#064e3b';
      color = '#6ee7b7';
      border = '#059669';
      label = 'Approved for Issue';
    } else if (s === 'RESERVED') {
      bg = '#3b0764';
      color = '#d8b4fe';
      border = '#7e22ce';
      label = 'Reserved';
    } else if (s === 'ISSUED' || s === 'COMPLETED') {
      bg = '#064e3b';
      color = '#6ee7b7';
      border = '#059669';
      label = 'Blood Issued';
    }

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '0.2rem 0.55rem',
          borderRadius: '9999px',
          fontSize: '0.7rem',
          fontWeight: 700,
          backgroundColor: bg,
          color: color,
          border: `1px solid ${border}`,
        }}
      >
        {label}
      </span>
    );
  };

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const patName = r.patient?.name || r.patientName || '';
    return (
      r.requestCode?.toLowerCase().includes(q) ||
      patName.toLowerCase().includes(q) ||
      r.hospitalName?.toLowerCase().includes(q) ||
      r.bloodGroup?.toLowerCase().includes(q)
    );
  });

  const unitsNeeded = selectedRequest ? Number(selectedRequest.unitsRequested || 1) : 1;
  const isFullyIssued = selectedRequest?.status === 'ISSUED' || selectedRequest?.status === 'COMPLETED';

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem', color: '#f8fafc' }}>
      {/* Top Header */}
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
            <Boxes style={{ width: '28px', height: '28px', color: '#f43f5e' }} />
            Blood Request & Issue Desk
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
            Select matching tested blood units from inventory, execute authorized issuance, and collect counter payments.
          </p>
        </div>

        <Link
          href="/receptionist/patients/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
          }}
        >
          <Plus style={{ width: '16px', height: '16px' }} />
          + Intake New Patient
        </Link>
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

      {/* Main Split Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Blood Requests Queue */}
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
            <div style={{ position: 'relative' }}>
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
                placeholder="Search requests, patient name, case #..."
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
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {['ALL', 'REQUESTED', 'APPROVED', 'RESERVED', 'ISSUED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    border: '1px solid',
                    backgroundColor: filterStatus === st ? '#dc2626' : '#020617',
                    color: filterStatus === st ? '#ffffff' : '#94a3b8',
                    borderColor: filterStatus === st ? '#dc2626' : '#1e293b',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Requests List */}
          {loadingRequests ? (
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
              Loading blood requests...
            </div>
          ) : filteredRequests.length === 0 ? (
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
              No matching blood requests found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '720px', overflowY: 'auto' }}>
              {filteredRequests.map((req) => {
                const isSelected = (selectedRequest?._id || selectedRequest?.id) === (req._id || req.id);
                const patName = req.patient?.name || req.patientName || 'Walk-in Patient';

                return (
                  <div
                    key={req._id || req.id}
                    onClick={() => setSelectedRequest(req)}
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
                            {req.requestCode}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: '#450a0a',
                              color: '#fda4af',
                              border: '1px solid #9f1239',
                            }}
                          >
                            {req.bloodGroup}
                          </span>
                          {getStatusBadge(req.status)}
                        </div>

                        <h4 style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem', margin: '0.4rem 0 0 0' }}>
                          {patName}
                        </h4>

                        <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: '0.2rem 0 0 0' }}>
                          {req.componentType?.replace(/_/g, ' ')} • {req.unitsRequested} unit(s)
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
                        color: '#94a3b8',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Building style={{ width: '13px', height: '13px', color: '#64748b' }} />
                        {req.hospitalName}
                      </span>
                      <span style={{ color: '#64748b' }}>
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Blood Units Selection & Issue Desk */}
        <div style={{ minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {selectedRequest ? (
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                minWidth: 0,
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              {/* Selected Request Header */}
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
                      {selectedRequest.requestCode}
                    </span>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: '#450a0a',
                        color: '#fda4af',
                        border: '1px solid #9f1239',
                      }}
                    >
                      {selectedRequest.bloodGroup}
                    </span>
                    {getStatusBadge(selectedRequest.status)}
                  </div>

                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: '0.35rem 0 0 0' }}>
                    {selectedRequest.patient?.name || selectedRequest.patientName}
                  </h2>

                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                    Hospital: {selectedRequest.hospitalName} • Case #{selectedRequest.patient?.hospitalCaseNumber || selectedRequest.hospitalCaseNumber || 'N/A'} • Attending: Dr. {selectedRequest.doctorName}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Component & Quantity
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f43f5e', fontFamily: 'monospace' }}>
                    {selectedRequest.unitsRequested} × {selectedRequest.componentType?.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {/* CORE SECTION: Available Matching Tested Blood Units */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Droplet style={{ width: '18px', height: '18px', color: '#f43f5e' }} />
                      Available Tested Blood Units ({selectedRequest.bloodGroup} {selectedRequest.componentType?.replace(/_/g, ' ')})
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                      Select the eligible tested units to issue for this patient request.
                    </p>
                  </div>

                  <div
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#020617',
                      border: '1px solid #1e293b',
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                    }}
                  >
                    Stock Available: <strong style={{ color: matchingUnits.length > 0 ? '#6ee7b7' : '#fca5a5' }}>{matchingUnits.length} units</strong>
                  </div>
                </div>

                {loadingDesk ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', backgroundColor: '#020617', borderRadius: '8px' }}>
                    <Clock style={{ width: '24px', height: '24px', margin: '0 auto 0.5rem auto', color: '#f43f5e' }} />
                    Querying tested inventory matching {selectedRequest.bloodGroup}...
                  </div>
                ) : matchingUnits.length === 0 ? (
                  <div
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      backgroundColor: '#020617',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      color: '#94a3b8',
                    }}
                  >
                    <AlertTriangle style={{ width: '32px', height: '32px', margin: '0 auto 0.5rem auto', color: '#f59e0b' }} />
                    <p style={{ fontWeight: 600, color: '#ffffff', margin: 0 }}>
                      No available tested units found for {selectedRequest.bloodGroup} {selectedRequest.componentType?.replace(/_/g, ' ')}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.35rem 0 0 0' }}>
                      Ensure whole blood units of this group have passed lab screening and are in AVAILABLE status.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      overflowX: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      display: 'block',
                    }}
                  >
                    {/* Mobile Swipe Hint */}
                    <div
                      style={{
                        padding: '0.45rem 0.75rem',
                        backgroundColor: '#131e33',
                        borderBottom: '1px solid #1e293b',
                        fontSize: '0.725rem',
                        color: '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <span>👉 Swipe table horizontally to view Storage Rack, Expiry Date & Status</span>
                    </div>

                    <table
                      style={{
                        width: '100%',
                        minWidth: '600px',
                        borderCollapse: 'collapse',
                        textAlign: 'left',
                        fontSize: '0.8rem',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor: '#020617',
                            borderBottom: '1px solid #1e293b',
                            color: '#94a3b8',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <th style={{ padding: '0.65rem 0.85rem', width: '40px', textAlign: 'center' }}>Select</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Unit Code</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Component / Group</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Storage Rack</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Expiry Date</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchingUnits.map((unit) => {
                          const unitId = unit.inventoryId || unit._id || unit.id;
                          const isSelected = selectedInventoryIds.includes(unitId);

                          return (
                            <tr
                              key={unitId}
                              onClick={() => !isFullyIssued && toggleUnitSelection(unitId, unitsNeeded)}
                              style={{
                                borderBottom: '1px solid #1e293b',
                                backgroundColor: isSelected ? 'rgba(244, 63, 94, 0.12)' : '#0f172a',
                                cursor: isFullyIssued ? 'default' : 'pointer',
                                transition: 'background-color 0.15s ease',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isFullyIssued}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleUnitSelection(unitId, unitsNeeded);
                                  }}
                                  style={{ cursor: isFullyIssued ? 'not-allowed' : 'pointer' }}
                                />
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'monospace', fontWeight: 700, color: '#ffffff' }}>
                                {unit.unitCode || unit.barcode || unit.unitNumber || unitId.slice(-8)}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>
                                <span style={{ fontWeight: 700, color: '#fda4af' }}>{unit.bloodGroup || selectedRequest.bloodGroup}</span>{' '}
                                {(unit.componentType || selectedRequest.componentType)?.replace(/_/g, ' ')}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <Thermometer style={{ width: '13px', height: '13px', color: '#64748b' }} />
                                  {unit.storageLocation || 'Main Cold Storage'}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                {(() => {
                                  const exp = getUnitExpiryInfo(
                                    unit.expiryDate,
                                    (unit as any).collectionDate,
                                    unit.componentType || selectedRequest.componentType,
                                    unit.unitCode || unit.barcode,
                                  );
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          color: exp.isExpired ? '#f87171' : '#ffffff',
                                          fontSize: '0.75rem',
                                        }}
                                      >
                                        {exp.formattedDate}
                                      </span>
                                      {exp.expiryDate && (
                                        <span
                                          style={{
                                            fontSize: '0.65rem',
                                            color: exp.isExpired
                                              ? '#fca5a5'
                                              : exp.isExpiringSoon
                                              ? '#fcd34d'
                                              : '#86efac',
                                            backgroundColor: exp.isExpired
                                              ? 'rgba(239, 68, 68, 0.2)'
                                              : exp.isExpiringSoon
                                              ? 'rgba(245, 158, 11, 0.2)'
                                              : 'rgba(34, 197, 94, 0.15)',
                                            padding: '0.05rem 0.35rem',
                                            borderRadius: '4px',
                                            fontWeight: 700,
                                            width: 'fit-content',
                                          }}
                                        >
                                          {exp.statusText}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    backgroundColor: '#064e3b',
                                    color: '#6ee7b7',
                                    border: '1px solid #059669',
                                  }}
                                >
                                  <Check style={{ width: '10px', height: '10px' }} />
                                  AVAILABLE
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Selection & Action Bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    marginTop: '0.5rem',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                      Selected: {selectedInventoryIds.length} / {unitsNeeded} unit(s)
                    </span>
                    {selectedInventoryIds.length === unitsNeeded && !isFullyIssued && (
                      <span style={{ color: '#6ee7b7', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 600 }}>
                        ✓ Ready for physical issuance
                      </span>
                    )}
                    {isFullyIssued && (
                      <span style={{ color: '#6ee7b7', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 600 }}>
                        ✓ Request is already issued
                      </span>
                    )}
                  </div>

                  <div>
                    {isFullyIssued ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedRequest) return;
                          const reqId = selectedRequest._id || selectedRequest.id;
                          try {
                            const invList = await fetchInvoices({ limit: 50 });
                            const found = invList.find((i: any) => (i.bloodRequestId === reqId || i.requestCode === selectedRequest.requestCode));
                            if (found) {
                              setActiveInvoice(found);
                              const totalAmt = found.outstandingAmount ?? found.netPayable ?? found.totalAmount ?? 0;
                              setCollectAmount(totalAmt);
                              setReferenceNumber(`CASH-${Date.now().toString().slice(-6)}`);
                              setPaymentNotes('Counter payment collection');
                              setPaymentModalError(null);
                              setIsPaymentModalOpen(true);
                            } else {
                              setErrorMsg('Invoice for this issued blood request was not found.');
                            }
                          } catch (err: any) {
                            setErrorMsg(err.message || 'Failed to open payment modal.');
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.65rem 1.4rem',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#059669',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(5, 150, 105, 0.4)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Receipt style={{ width: '16px', height: '16px' }} />
                        Collect Payment & Print Receipt
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={selectedInventoryIds.length === 0}
                        onClick={handleOpenIssueModal}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.65rem 1.4rem',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: selectedInventoryIds.length > 0 ? '#dc2626' : '#334155',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: selectedInventoryIds.length > 0 ? 'pointer' : 'not-allowed',
                          boxShadow: selectedInventoryIds.length > 0 ? '0 4px 12px rgba(220, 38, 38, 0.4)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <FileCheck style={{ width: '16px', height: '16px' }} />
                        Issue Selected Blood Units & Generate Bill
                      </button>
                    )}
                  </div>
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
              <Boxes style={{ width: '42px', height: '42px', margin: '0 auto 0.75rem auto', color: '#334155' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1', margin: 0 }}>Select a blood request</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.35rem auto 0 auto', maxWidth: '380px' }}>
                Select any patient request from the queue to view matching available tested inventory units and issue them.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Confirm Blood Issue */}
      {isIssueModalOpen && selectedRequest && (
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
                <FileCheck style={{ width: '20px', height: '20px', color: '#f43f5e' }} />
                <h3 style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.1rem', margin: 0 }}>
                  Confirm Blood Unit Issuance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsIssueModalOpen(false);
                  setModalErrorMsg(null);
                }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {modalErrorMsg && (
              <div
                style={{
                  backgroundColor: '#450a0a',
                  border: '1px solid #dc2626',
                  color: '#fca5a5',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle style={{ width: '18px', height: '18px', flexShrink: 0, color: '#ef4444' }} />
                <span>{modalErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleConfirmIssueAndBill} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: '8px',
                  backgroundColor: '#020617',
                  border: '1px solid #1e293b',
                  fontSize: '0.8rem',
                }}
              >
                <p style={{ margin: '0 0 0.35rem 0', color: '#ffffff', fontWeight: 700 }}>
                  Request: {selectedRequest.requestCode} ({selectedRequest.bloodGroup} {selectedRequest.componentType?.replace(/_/g, ' ')})
                </p>
                <p style={{ margin: '0 0 0.2rem 0', color: '#94a3b8' }}>
                  Patient: <strong style={{ color: '#ffffff' }}>{selectedRequest.patient?.name || selectedRequest.patientName}</strong> • {selectedRequest.hospitalName}
                </p>
                <p style={{ margin: 0, color: '#6ee7b7', fontWeight: 600 }}>
                  Units to Issue: {Math.min(selectedInventoryIds.length, unitsNeeded)} unit(s) (of {unitsNeeded} requested)
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Recipient / Authorized Collector Name *
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Patient / Ward Attendant Name"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Issue Remarks
                </label>
                <textarea
                  rows={2}
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="Clinical issue notes or counter remarks..."
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
                  onClick={() => {
                    setIsIssueModalOpen(false);
                    setModalErrorMsg(null);
                  }}
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
                  disabled={issuingLoading}
                  style={{
                    padding: '0.55rem 1.25rem',
                    backgroundColor: issuingLoading ? '#991b1b' : '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: 'none',
                    cursor: issuingLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                    opacity: issuingLoading ? 0.7 : 1,
                  }}
                >
                  {issuingLoading ? 'Issuing & Creating Bill...' : 'Confirm Issue & Open Receipt Desk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINTABLE OFFICIAL BILL & RECEIPT VOUCHER */}
      {isPaymentModalOpen && activeInvoice && (
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
              maxWidth: '760px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '94vh',
              overflowY: 'auto',
              color: '#0f172a',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {/* Top Action Bar (Hidden during Print) */}
            <div
              className="no-print"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '0.85rem',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
                Printable Official Bill & Receipt Voucher
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    padding: '0.45rem 1rem',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.825rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                  }}
                >
                  <Printer style={{ width: '15px', height: '15px' }} />
                  Print Bill
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPaymentModalOpen(false);
                    setPaymentModalError(null);
                    setGeneratedReceipt(null);
                  }}
                  style={{
                    padding: '0.45rem 0.85rem',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.825rem',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {paymentModalError && (
              <div
                className="no-print"
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.825rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <AlertTriangle style={{ width: '18px', height: '18px', flexShrink: 0, color: '#dc2626' }} />
                <span>{paymentModalError}</span>
              </div>
            )}

            {/* Printable Receipt Body */}
            <div id="printable-receipt" style={{ color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  REGIONAL BLOOD TRANSFUSION CENTER
                </h2>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>
                  Licensed under Drugs & Cosmetics Act • NABH Accredited Facility
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.1rem' }}>
                  National Blood Processing & Compatibility Testing Service Invoice
                </div>
              </div>

              {/* Metadata 2-Column Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', lineHeight: 1.6 }}>
                  <div><strong>Invoice #:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{activeInvoice.invoiceNumber}</span></div>
                  <div><strong>Issue Code:</strong> <span style={{ fontFamily: 'monospace' }}>{activeInvoice.issueCode || 'N/A'}</span></div>
                  <div><strong>Date & Time:</strong> {new Date(activeInvoice.invoiceDate || activeInvoice.createdAt).toLocaleString('en-IN')}</div>
                  <div><strong>Billed By:</strong> {activeInvoice.billedByName || 'Front Desk Finance Receptionist'}</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', lineHeight: 1.6 }}>
                  <div><strong>Patient:</strong> {activeInvoice.patient?.name || selectedRequest?.patient?.name || selectedRequest?.patientName} ({activeInvoice.patient?.age || selectedRequest?.patient?.age || 35}y, {activeInvoice.patient?.gender || selectedRequest?.patient?.gender || 'MALE'})</div>
                  <div><strong>Hospital:</strong> {activeInvoice.hospitalName || selectedRequest?.hospitalName || 'ccccc'}</div>
                  <div><strong>Physician:</strong> {activeInvoice.doctorName || selectedRequest?.doctorName || 'N/A'}</div>
                  {(activeInvoice.patient?.hospitalCaseNumber || selectedRequest?.hospitalCaseNumber) && (
                    <div><strong>Case / IPD #:</strong> {activeInvoice.patient?.hospitalCaseNumber || selectedRequest?.hospitalCaseNumber}</div>
                  )}
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', display: 'block', marginBottom: '1.25rem' }}>
                <table style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Blood Component & Unit Code</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Base Processing</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Crossmatching</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Total Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeInvoice.items && activeInvoice.items.length > 0 ? (
                      activeInvoice.items.map((item: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <strong>{item.bloodGroup} {item.componentType?.replace(/_/g, ' ')}</strong> • Unit Code: <span style={{ fontFamily: 'monospace' }}>{item.unitCode}</span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>{formatINR(item.baseProcessingFee)}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>{formatINR(item.crossmatchFee)}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatINR(item.lineTotal)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr style={{ borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <strong>{selectedRequest?.bloodGroup} {selectedRequest?.componentType?.replace(/_/g, ' ')}</strong> • {selectedRequest?.unitsRequested || 1} unit(s)
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>{formatINR((activeInvoice.subtotal || 5250) * 0.8)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>{formatINR((activeInvoice.subtotal || 5250) * 0.2)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatINR(activeInvoice.netPayable || activeInvoice.totalAmount || 5250)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div style={{ marginLeft: 'auto', maxWidth: 360, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                  <span>Gross Processing Subtotal:</span>
                  <span style={{ fontWeight: 600 }}>{formatINR(activeInvoice.subtotal ?? activeInvoice.netPayable)}</span>
                </div>
                {Number(activeInvoice.waiverAmount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', color: '#16a34a' }}>
                    <span>Approved Concessions / Waivers:</span>
                    <span style={{ fontWeight: 600 }}>-{formatINR(activeInvoice.waiverAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '1px solid #cbd5e1', fontWeight: 700 }}>
                  <span>Net Payable Amount:</span>
                  <span>{formatINR(activeInvoice.netPayable ?? activeInvoice.totalAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', color: '#059669', fontWeight: 600 }}>
                  <span>Amount Received:</span>
                  <span>
                    {generatedReceipt
                      ? formatINR(Number(collectAmount))
                      : formatINR(activeInvoice.collectedAmount || 0)}
                  </span>
                </div>
                {generatedReceipt && (
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#059669', marginTop: '-0.2rem' }}>
                    Mode: {paymentMethod} • Ref: {referenceNumber || 'N/A'}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '2px solid #0f172a', fontWeight: 800 }}>
                  <span>Outstanding Balance:</span>
                  <span style={{ color: (generatedReceipt ? 0 : (activeInvoice.outstandingAmount ?? activeInvoice.netPayable)) > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatINR(generatedReceipt ? 0 : (activeInvoice.outstandingAmount ?? activeInvoice.netPayable))}
                  </span>
                </div>
              </div>

              {/* Statutory Footnote & Stamp */}
              <div style={{ paddingTop: '1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem' }}>
                <div style={{ maxWidth: 440 }}>
                  <p style={{ margin: '0 0 0.25rem 0', lineHeight: 1.4 }}>
                    <strong>Statutory Regulatory Notice:</strong> Under National Blood Transfusion Council regulations, charges are strictly cost-recovery processing fees for donor screening, viral marker testing, grouping, and storage. Blood cannot be commercially sold.
                  </p>
                  <p style={{ margin: 0 }}>This is a computer-generated authorized voucher.</p>
                </div>
                <div style={{ textAlign: 'center', width: 150 }}>
                  {generatedReceipt ? (
                    <div style={{ border: '2px solid #059669', color: '#059669', borderRadius: '6px', padding: '0.35rem 0.5rem', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                      ✓ PAID & RECEIVED
                    </div>
                  ) : (
                    <div style={{ height: 35 }} />
                  )}
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '0.25rem', fontWeight: 600, color: '#334155' }}>
                    Authorized Cashier
                  </div>
                </div>
              </div>
            </div>

            {/* Counter Payment Collection Input Form (Hidden during Print) */}
            {!generatedReceipt && (
              <form
                onSubmit={handleRecordPayment}
                className="no-print"
                style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  <CreditCard style={{ width: '18px', height: '18px', color: '#dc2626' }} />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    Receive Counter Payment
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Amount to Collect (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={collectAmount}
                      onChange={(e) => setCollectAmount(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Reference / UTR / Auth #
                    </label>
                    <input
                      type="text"
                      required
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g. CASH-123456 or UPI-Ref"
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Payment Mode
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
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
                            padding: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            border: isSelected ? '2px solid #059669' : '1px solid #cbd5e1',
                            backgroundColor: isSelected ? '#ecfdf5' : '#ffffff',
                            color: isSelected ? '#047857' : '#475569',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {m.replace(/_/g, ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', paddingTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentModalOpen(false);
                      setPaymentModalError(null);
                    }}
                    style={{
                      padding: '0.55rem 1rem',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    Pay Later
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    style={{
                      padding: '0.55rem 1.4rem',
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: submittingPayment ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                      opacity: submittingPayment ? 0.7 : 1,
                    }}
                  >
                    {submittingPayment ? 'Recording Collection...' : 'Record Payment & Print Official Receipt'}
                  </button>
                </div>
              </form>
            )}

            {/* Print Styles */}
            <style jsx global>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-receipt,
                #printable-receipt * {
                  visibility: visible !important;
                }
                #printable-receipt {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  padding: 1rem !important;
                  margin: 0 !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}
