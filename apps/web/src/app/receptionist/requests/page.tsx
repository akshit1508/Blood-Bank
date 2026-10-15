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
  User,
  ShieldCheck,
  Droplet,
  ArrowRight,
  Boxes,
  CreditCard,
  FileText,
  Lock,
  Layers,
  ChevronRight,
  Plus,
} from 'lucide-react';
import {
  fetchReceptionistBloodRequests,
  fetchMatchesForRequest,
  createReservationForRequest,
  fetchReservationsForRequest,
  issueBloodFromReservation,
  generateInvoiceForIssue,
  verifySupportingDocuments,
} from '@/lib/receptionist-api';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Issue modal / action state
  const [actionLoading, setActionLoading] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const data = await fetchReceptionistBloodRequests(filterStatus);
      setRequests(data);
      if (preselectedRequestId) {
        const found = data.find((r: any) => r._id === preselectedRequestId || r.id === preselectedRequestId);
        if (found) setSelectedRequest(found);
      } else if (data.length > 0 && !selectedRequest) {
        setSelectedRequest(data[0]);
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

  // Load details when selected request changes
  useEffect(() => {
    if (!selectedRequest) return;
    const reqId = selectedRequest._id || selectedRequest.id;

    async function loadDeskData() {
      setLoadingDesk(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      setSelectedInventoryIds([]);
      try {
        const [reservations, matches] = await Promise.all([
          fetchReservationsForRequest(reqId).catch(() => []),
          selectedRequest.status === 'APPROVED' || selectedRequest.status === 'RESERVED'
            ? fetchMatchesForRequest(reqId).catch(() => ({ matches: [] }))
            : Promise.resolve({ matches: [] }),
        ]);

        setExistingReservations(reservations || []);
        setMatchingUnits(matches?.matches || []);
      } catch (err: any) {
        // Soft error
      } finally {
        setLoadingDesk(false);
      }
    }

    loadDeskData();
  }, [selectedRequest]);

  // Document verification handler
  const handleVerifyDocs = async () => {
    if (!selectedRequest) return;
    const reqId = selectedRequest._id || selectedRequest.id;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await verifySupportingDocuments(reqId, {
        status: 'VERIFIED',
        notes: 'Verified at Reception Desk by Finance Receptionist',
      });
      setSuccessMsg('Supporting documents marked as verified.');
      // Refresh request
      const updated = {
        ...selectedRequest,
        documentVerificationStatus: 'VERIFIED',
      };
      setSelectedRequest(updated);
      setRequests((prev) => prev.map((r) => ((r._id || r.id) === reqId ? updated : r)));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to verify documents.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reservation handler
  const handleCreateReservation = async () => {
    if (!selectedRequest || selectedInventoryIds.length === 0) return;
    const reqId = selectedRequest._id || selectedRequest.id;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await createReservationForRequest(reqId, selectedInventoryIds);
      setSuccessMsg(`Successfully reserved ${selectedInventoryIds.length} blood unit(s).`);
      // Reload desk data
      const [reservations, updatedReqs] = await Promise.all([
        fetchReservationsForRequest(reqId),
        fetchReceptionistBloodRequests(filterStatus),
      ]);
      setExistingReservations(reservations || []);
      setRequests(updatedReqs);
      const curr = updatedReqs.find((r: any) => (r._id || r.id) === reqId);
      if (curr) setSelectedRequest(curr);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reserve blood units.');
    } finally {
      setActionLoading(false);
    }
  };

  // Blood issue execution handler
  const handleExecuteIssue = async (reservationId: string) => {
    if (!selectedRequest) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const issueResult = await issueBloodFromReservation(reservationId, {
        recipientName: recipientName || selectedRequest.patientName,
        notes: notes || 'Blood issued at Receptionist Desk',
      });

      setSuccessMsg('Blood units issued successfully! Generating billing invoice...');

      // Auto-generate invoice for this issue
      try {
        const issueId = issueResult._id || issueResult.id;
        await generateInvoiceForIssue(issueId);
      } catch (invErr) {
        // If invoice already exists or generated automatically, continue
      }

      // Reload
      await loadRequests();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to issue blood units.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.requestCode?.toLowerCase().includes(q) ||
      r.patientName?.toLowerCase().includes(q) ||
      r.hospitalName?.toLowerCase().includes(q) ||
      r.bloodGroup?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800">Pending Lab Approval</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800">Approved • Ready to Reserve</span>;
      case 'RESERVED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-950 text-purple-300 border border-purple-800">Units Reserved</span>;
      case 'ISSUED':
      case 'COMPLETED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">Blood Issued</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">{status}</span>;
    }
  };

  const activeReservation = existingReservations.find((res) => res.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FileCheck className="w-7 h-7 text-rose-500" />
            Blood Request & Issue Desk
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Verify patient intake documents, reserve tested units, and execute authorized blood issues.
          </p>
        </div>

        <Link
          href="/receptionist/patients/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Intake New Patient
        </Link>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg flex items-center gap-3 text-rose-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-lg flex items-center gap-3 text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Requests Queue */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requests..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              {['ALL', 'PENDING', 'APPROVED', 'RESERVED', 'ISSUED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                    filterStatus === st
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loadingRequests ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
              <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
              Loading blood requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-sm">
              No matching blood requests found.
            </div>
          ) : (
            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
              {filteredRequests.map((req) => {
                const isSelected = (selectedRequest?._id || selectedRequest?.id) === (req._id || req.id);
                return (
                  <div
                    key={req._id || req.id}
                    onClick={() => setSelectedRequest(req)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-950/20 border-rose-600/60 ring-1 ring-rose-500/40 shadow-sm'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-rose-400">
                            {req.requestCode}
                          </span>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                            {req.bloodGroup}
                          </span>
                          {getStatusBadge(req.status)}
                        </div>
                        <h4 className="font-semibold text-white text-sm mt-1.5">{req.patientName}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {req.componentType?.replace(/_/g, ' ')} • {req.unitsRequested} unit(s)
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-slate-500 transition-transform ${
                          isSelected ? 'translate-x-1 text-rose-400' : ''
                        }`}
                      />
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span className="truncate max-w-[200px]">{req.hospitalName}</span>
                      <span
                        className={`font-medium ${
                          req.documentVerificationStatus === 'VERIFIED'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {req.documentVerificationStatus === 'VERIFIED'
                          ? '✓ Docs Verified'
                          : '⚠ Docs Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Step-by-Step Issue Desk */}
        <div className="lg:col-span-7">
          {selectedRequest ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              {/* Request Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-800 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg text-white">
                      {selectedRequest.requestCode}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-rose-950 text-rose-300 border border-rose-800">
                      {selectedRequest.bloodGroup}
                    </span>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {selectedRequest.patientName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Hospital: {selectedRequest.hospitalName} • Case #{selectedRequest.hospitalCaseNumber || 'N/A'} • Attending Dr. {selectedRequest.doctorName}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">Component & Quantity</div>
                  <div className="text-base font-bold text-white font-mono">
                    {selectedRequest.unitsRequested} × {selectedRequest.componentType?.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {/* Step 1: Document Verification Status */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-semibold text-white text-sm">Step 1: Document Verification</h3>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      selectedRequest.documentVerificationStatus === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {selectedRequest.documentVerificationStatus || 'PENDING'}
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Required documents: Doctor prescription, Patient photo ID, and Hospital crossmatch request slip.
                </p>

                {selectedRequest.documentVerificationStatus !== 'VERIFIED' ? (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-xs text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Documents not yet verified. Blood cannot be released.
                    </span>
                    <button
                      onClick={handleVerifyDocs}
                      disabled={actionLoading}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? 'Verifying...' : 'Verify Documents Now'}
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Patient identification and prescription verified by reception.
                    </span>
                  </div>
                )}
              </div>

              {/* Step 2: Medical / Lab Authorization Check */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplet className="w-5 h-5 text-rose-400" />
                    <h3 className="font-semibold text-white text-sm">Step 2: Medical & Lab Approval</h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    Medical Officer / Lab Technician
                  </span>
                </div>

                {selectedRequest.status === 'PENDING' ? (
                  <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg text-xs text-amber-300 flex items-start gap-2.5">
                    <Lock className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-semibold">Pending Medical Approval</p>
                      <p className="text-amber-400/90 mt-0.5">
                        This blood request is awaiting laboratory compatibility, crossmatch, and medical officer sign-off.
                        Under blood bank policy, Finance Receptionists cannot override medical testing or advance pending requests.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Medically Approved for issue. Blood compatibility confirmed.</span>
                  </div>
                )}
              </div>

              {/* Step 3: Unit Reservation & Stock Hold */}
              {selectedRequest.status === 'APPROVED' && !activeReservation && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Boxes className="w-5 h-5 text-blue-400" />
                      <h3 className="font-semibold text-white text-sm">Step 3: Reserve Tested Units</h3>
                    </div>
                    <span className="text-xs text-slate-400">
                      Need {selectedRequest.unitsRequested} unit(s)
                    </span>
                  </div>

                  {matchingUnits.length === 0 ? (
                    <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 text-center text-xs text-slate-400">
                      No matching available inventory units found in stock for {selectedRequest.bloodGroup} {selectedRequest.componentType}.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        Select eligible inventory units from quarantine-cleared stock:
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {matchingUnits.map((u: any) => {
                          const isChecked = selectedInventoryIds.includes(u._id || u.id);
                          return (
                            <label
                              key={u._id || u.id}
                              className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-blue-950/40 border-blue-500'
                                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedInventoryIds([...selectedInventoryIds, u._id || u.id]);
                                    } else {
                                      setSelectedInventoryIds(
                                        selectedInventoryIds.filter((id) => id !== (u._id || u.id)),
                                      );
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <span className="font-mono font-bold text-white">
                                    {u.unitNumber || u.barcode}
                                  </span>
                                  <span className="text-slate-400 ml-2">
                                    {u.volumeMl ? `${u.volumeMl}mL` : 'Standard'} • Storage: {u.storageLocation || 'Cold Store'}
                                  </span>
                                </div>
                              </div>
                              <span className="font-semibold text-emerald-400">Available</span>
                            </label>
                          );
                        })}
                      </div>

                      <button
                        onClick={handleCreateReservation}
                        disabled={
                          actionLoading ||
                          selectedInventoryIds.length === 0 ||
                          selectedRequest.documentVerificationStatus !== 'VERIFIED'
                        }
                        className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                      >
                        {actionLoading
                          ? 'Reserving...'
                          : `Reserve Selected Units (${selectedInventoryIds.length} of ${selectedRequest.unitsRequested})`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Issue Blood Units against Active Reservation */}
              {(activeReservation || selectedRequest.status === 'RESERVED') && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-purple-400" />
                      <h3 className="font-semibold text-white text-sm">Step 4: Execute Blood Issue</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      Units Held & Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Recipient / Collector Name
                      </label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder={selectedRequest.patientName}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Handover Notes
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Verified ID at counter, cold box checked..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleExecuteIssue(activeReservation?._id || activeReservation?.id)}
                    disabled={
                      actionLoading ||
                      !activeReservation ||
                      selectedRequest.documentVerificationStatus !== 'VERIFIED'
                    }
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Droplet className="w-4 h-4" />
                    {actionLoading ? 'Issuing Blood...' : 'Confirm & Execute Blood Issue'}
                  </button>
                </div>
              )}

              {/* Step 5: Completed Issue & Billing Transition */}
              {(selectedRequest.status === 'ISSUED' || selectedRequest.status === 'COMPLETED') && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-semibold text-white text-sm">Step 5: Billing & Payment Desk</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Ready for Settlement
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Blood has been successfully issued. Proceed to the billing desk to finalize collection and print the customer receipt.
                  </p>

                  <div className="flex items-center gap-3 pt-2">
                    <Link
                      href={`/receptionist/billing?search=${encodeURIComponent(selectedRequest.requestCode)}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      Proceed to Billing & Payment Desk
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
              <FileCheck className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h3 className="text-base font-medium text-slate-300">Select a blood request</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Choose any active blood request from the left queue to verify patient documents, check availability, reserve stock, and issue blood units.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
