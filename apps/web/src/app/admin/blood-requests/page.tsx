'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BloodRequest,
  BloodRequestStatus,
  fetchBloodRequests,
  updateBloodRequestStatus,
  fetchBloodRequestMatches,
  BloodRequestMatchData,
  ReservationData,
  ReservationStatus,
  reserveBloodUnits,
  fetchBloodRequestReservations,
  cancelReservation,
  BloodIssueData,
  issueReservedBlood,
  fetchBloodIssuesByRequest,
} from '@/lib/blood-request-api';

const STATUS_OPTIONS = [
  BloodRequestStatus.REQUESTED,
  BloodRequestStatus.VERIFIED,
  BloodRequestStatus.APPROVED,
  BloodRequestStatus.RESERVED,
  BloodRequestStatus.ISSUED,
  BloodRequestStatus.COMPLETED,
  BloodRequestStatus.REJECTED,
  BloodRequestStatus.CANCELLED,
];

// Valid state transitions mapped on the frontend matching backend rules
const ALLOWED_NEXT_STATUSES: Record<BloodRequestStatus, BloodRequestStatus[]> = {
  [BloodRequestStatus.REQUESTED]: [
    BloodRequestStatus.VERIFIED,
    BloodRequestStatus.REJECTED,
    BloodRequestStatus.CANCELLED,
  ],
  [BloodRequestStatus.VERIFIED]: [
    BloodRequestStatus.APPROVED,
    BloodRequestStatus.REJECTED,
    BloodRequestStatus.CANCELLED,
  ],
  [BloodRequestStatus.APPROVED]: [
    BloodRequestStatus.RESERVED,
    BloodRequestStatus.CANCELLED,
  ],
  [BloodRequestStatus.RESERVED]: [
    BloodRequestStatus.APPROVED,
    BloodRequestStatus.ISSUED,
    BloodRequestStatus.CANCELLED,
  ],
  [BloodRequestStatus.ISSUED]: [
    BloodRequestStatus.COMPLETED,
  ],
  [BloodRequestStatus.COMPLETED]: [],
  [BloodRequestStatus.REJECTED]: [],
  [BloodRequestStatus.CANCELLED]: [],
};

export default function AdminBloodRequestsPage() {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null);

  // Matching Inventory state (Phase 6A)
  const [matchData, setMatchData] = useState<BloodRequestMatchData | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Reservation state (Phase 6B)
  const [reservations, setReservations] = useState<ReservationData[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [isReserving, setIsReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserveSuccess, setReserveSuccess] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Blood Issue state (Phase 6C)
  const [bloodIssues, setBloodIssues] = useState<BloodIssueData[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [targetReservationForIssue, setTargetReservationForIssue] = useState<ReservationData | null>(null);
  const [issueRemarks, setIssueRemarks] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueSuccess, setIssueSuccess] = useState<string | null>(null);

  // Cancellation state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [targetReservation, setTargetReservation] = useState<ReservationData | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Status update state in drawer/modal
  const [newStatus, setNewStatus] = useState<BloodRequestStatus | ''>('');
  const [statusReason, setStatusReason] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchBloodRequests({
        status: filterStatus || undefined,
      });
      setRequests(data);
      setSelectedRequest((prev) => {
        if (!prev) return null;
        return data.find((r) => r._id === prev._id) || null;
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch blood requests');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const loadMatches = useCallback(async (requestId: string) => {
    setMatchLoading(true);
    setMatchError(null);
    try {
      const data = await fetchBloodRequestMatches(requestId);
      setMatchData(data);
    } catch (err: any) {
      setMatchError(err.message || 'Failed to retrieve matching inventory units');
      setMatchData(null);
    } finally {
      setMatchLoading(false);
    }
  }, []);

  const loadReservations = useCallback(async (requestId: string) => {
    setReservationsLoading(true);
    try {
      const data = await fetchBloodRequestReservations(requestId);
      setReservations(data);
    } catch {
      setReservations([]);
    } finally {
      setReservationsLoading(false);
    }
  }, []);

  const loadIssues = useCallback(async (requestId: string) => {
    setIssuesLoading(true);
    try {
      const data = await fetchBloodIssuesByRequest(requestId);
      setBloodIssues(data);
    } catch {
      setBloodIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRequest) {
      loadMatches(selectedRequest._id);
      loadReservations(selectedRequest._id);
      loadIssues(selectedRequest._id);
      setSelectedUnitIds([]);
      setReserveError(null);
      setReserveSuccess(null);
      setIssueError(null);
      setIssueSuccess(null);
    } else {
      setMatchData(null);
      setMatchError(null);
      setReservations([]);
      setBloodIssues([]);
      setSelectedUnitIds([]);
    }
  }, [selectedRequest, loadMatches, loadReservations, loadIssues]);

  const toggleUnitSelection = (inventoryId: string, maxAllowed: number) => {
    setSelectedUnitIds((prev) => {
      if (prev.includes(inventoryId)) {
        return prev.filter((id) => id !== inventoryId);
      }
      if (prev.length >= maxAllowed) {
        return prev;
      }
      return [...prev, inventoryId];
    });
  };

  const handleExecuteReservation = async () => {
    if (!selectedRequest || selectedUnitIds.length === 0) return;
    setIsReserving(true);
    setReserveError(null);
    setReserveSuccess(null);

    try {
      const res = await reserveBloodUnits(selectedRequest._id, selectedUnitIds);
      setConfirmModalOpen(false);
      setSelectedUnitIds([]);
      setReserveSuccess(
        `Successfully reserved ${res.reservedUnits.length} blood unit(s). Reservation Code: ${res.reservationCode}`,
      );
      // Refresh requests list, matches and reservations
      await loadRequests();
      await loadMatches(selectedRequest._id);
      await loadReservations(selectedRequest._id);
    } catch (err: any) {
      setReserveError(
        err.message || 'Failed to reserve blood units. The unit may have been reserved concurrently.',
      );
      if (selectedRequest) {
        loadMatches(selectedRequest._id);
      }
    } finally {
      setIsReserving(false);
    }
  };

  const handleOpenCancelModal = (reservation: ReservationData) => {
    setTargetReservation(reservation);
    setCancelReason('');
    setCancelError(null);
    setCancelModalOpen(true);
  };

  const handleExecuteCancellation = async () => {
    if (!targetReservation || !selectedRequest) return;
    setIsCancelling(true);
    setCancelError(null);

    try {
      await cancelReservation(
        targetReservation._id || targetReservation.reservationCode,
        cancelReason.trim() || undefined,
      );
      setCancelModalOpen(false);
      setTargetReservation(null);
      setCancelReason('');
      await loadRequests();
      await loadMatches(selectedRequest._id);
      await loadReservations(selectedRequest._id);
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel reservation');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenIssueModal = (reservation: ReservationData) => {
    setTargetReservationForIssue(reservation);
    setIssueRemarks('');
    setIssueError(null);
    setIssueModalOpen(true);
  };

  const handleExecuteIssue = async () => {
    if (!targetReservationForIssue || !selectedRequest) return;
    setIsIssuing(true);
    setIssueError(null);

    try {
      const res = await issueReservedBlood(
        targetReservationForIssue._id || targetReservationForIssue.reservationCode,
        issueRemarks.trim() || undefined,
        'Lab Admin Staff',
      );
      setIssueModalOpen(false);
      setTargetReservationForIssue(null);
      setIssueRemarks('');
      setIssueSuccess(
        `Blood units successfully issued for ${selectedRequest.requestCode}! Issue Code: ${res.issueCode}`,
      );
      await loadRequests();
      await loadMatches(selectedRequest._id);
      await loadReservations(selectedRequest._id);
      await loadIssues(selectedRequest._id);
    } catch (err: any) {
      setIssueError(err.message || 'Failed to issue blood units');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleOpenDetails = (request: BloodRequest) => {
    setSelectedRequest(request);
    setNewStatus('');
    setStatusReason('');
    setUpdateError(null);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !newStatus) return;

    setUpdateLoading(true);
    setUpdateError(null);

    try {
      const updated = await updateBloodRequestStatus(
        selectedRequest._id,
        newStatus as BloodRequestStatus,
        statusReason.trim() || undefined,
      );

      // Update in local state
      setRequests((prev) =>
        prev.map((r) => (r._id === updated._id ? updated : r)),
      );
      setSelectedRequest(updated);
      setNewStatus('');
      setStatusReason('');
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update status');
    } finally {
      setUpdateLoading(false);
    }
  };

  const getPriorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL_EMERGENCY':
        return { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' };
      case 'URGENT':
        return { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
      default:
        return { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
    }
  };

  const getStatusBadgeStyle = (status: BloodRequestStatus) => {
    switch (status) {
      case BloodRequestStatus.REQUESTED:
        return { backgroundColor: '#e0f2fe', color: '#0369a1' };
      case BloodRequestStatus.VERIFIED:
        return { backgroundColor: '#ede9fe', color: '#6d28d9' };
      case BloodRequestStatus.APPROVED:
        return { backgroundColor: '#dcfce7', color: '#15803d' };
      case BloodRequestStatus.RESERVED:
        return { backgroundColor: '#fef9c3', color: '#854d0e' };
      case BloodRequestStatus.ISSUED:
        return { backgroundColor: '#ffedd5', color: '#c2410c' };
      case BloodRequestStatus.COMPLETED:
        return { backgroundColor: '#d1fae5', color: '#065f46' };
      case BloodRequestStatus.REJECTED:
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case BloodRequestStatus.CANCELLED:
        return { backgroundColor: '#f1f5f9', color: '#64748b' };
    }
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Blood Requests Management</h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Real-time intake queue and lifecycle processing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={loadRequests}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            ↻ Refresh Queue
          </button>
          <Link
            href="/blood-request"
            target="_blank"
            style={{
              backgroundColor: '#dc2626',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
            }}
          >
            + New Public Request
          </Link>
        </div>
      </div>

      {/* Filter and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Filter by Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        <button
          onClick={loadRequests}
          style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ↻ Refresh List
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {errorMessage}
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedRequest ? '1fr 420px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Table View */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              Loading blood requests from backend API...
            </div>
          ) : requests.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              No blood requests found.
              <div style={{ marginTop: '0.5rem' }}>
                <Link href="/blood-request" style={{ color: '#dc2626' }}>
                  Submit the first request via the Public Form
                </Link>
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Request ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Patient</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Group</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Component</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Qty</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Hospital</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Created</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr
                    key={req._id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: selectedRequest?._id === req._id ? '#f0fdf4' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                      {req.requestCode}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {req.patient.name}
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>{req.patient.age}y &bull; {req.patient.gender}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#dc2626' }}>
                      {req.bloodGroup}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                      {req.componentType}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                      {req.unitsRequested}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#334155', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.hospitalName}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ ...getPriorityBadgeStyle(req.priority), padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {req.priority}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ ...getStatusBadgeStyle(req.status), padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {req.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenDetails(req)}
                        style={{
                          background: selectedRequest?._id === req._id ? '#15803d' : '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        {selectedRequest?._id === req._id ? 'Viewing' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Details & Status Transition Side Panel */}
        {selectedRequest && (
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Request Details</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div style={{ fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Reference Code:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{selectedRequest.requestCode}</strong>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Current Status:</span>{' '}
                <span style={{ ...getStatusBadgeStyle(selectedRequest.status), padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                  {selectedRequest.status}
                </span>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Required Date:</span>{' '}
                <strong>{new Date(selectedRequest.requiredDate).toLocaleDateString()}</strong>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0.75rem 0' }} />
              <div><strong>Patient:</strong> {selectedRequest.patient.name} ({selectedRequest.patient.age}y, {selectedRequest.patient.gender})</div>
              <div><strong>Blood Product:</strong> {selectedRequest.bloodGroup} &bull; {selectedRequest.componentType} &bull; {selectedRequest.unitsRequested} Unit(s)</div>
              <div><strong>Hospital:</strong> {selectedRequest.hospitalName} {selectedRequest.hospitalCaseNumber ? `(#${selectedRequest.hospitalCaseNumber})` : ''}</div>
              <div><strong>Attending Doctor:</strong> {selectedRequest.doctorName} {selectedRequest.doctorContact ? `(${selectedRequest.doctorContact})` : ''}</div>
              <div><strong>Requester Contact:</strong> {selectedRequest.contactPerson.name} ({selectedRequest.contactPerson.relationship}) - {selectedRequest.contactPerson.phone}</div>
              {selectedRequest.medicalJustification && (
                <div style={{ marginTop: '0.5rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Justification:</span>
                  {selectedRequest.medicalJustification}
                </div>
              )}
              {selectedRequest.additionalNotes && (
                <div style={{ marginTop: '0.5rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Notes:</span>
                  {selectedRequest.additionalNotes}
                </div>
              )}
              {selectedRequest.statusReason && (
                <div style={{ marginTop: '0.5rem', background: '#fef3c7', padding: '0.5rem', borderRadius: '4px', color: '#92400e' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Status Note:</span>
                  {selectedRequest.statusReason}
                </div>
              )}
            </div>

            {/* Matching Inventory Section (Phase 6A) */}
            <div
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '0.95rem',
                      color: '#0f172a',
                      fontWeight: 600,
                    }}
                  >
                    Matching Inventory
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Available stock matching {selectedRequest.bloodGroup} &bull; {selectedRequest.componentType}
                  </span>
                </div>
                {matchData && !matchLoading && (
                  <span
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      ...(matchData.canFulfill
                        ? { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }
                        : matchData.availableUnits > 0
                        ? { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
                        : { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }),
                    }}
                  >
                    {matchData.canFulfill
                      ? 'CAN FULFILL'
                      : matchData.availableUnits > 0
                      ? 'PARTIALLY AVAILABLE'
                      : 'NO MATCHING UNITS'}
                  </span>
                )}
              </div>

              {matchLoading && (
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#64748b',
                    textAlign: 'center',
                  }}
                >
                  Checking matching inventory units...
                </div>
              )}

              {matchError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                  }}
                >
                  {matchError}
                </div>
              )}

              {!matchLoading && !matchError && matchData && (
                <div>
                  {/* Summary Metric Chips */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.5rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        background: '#f1f5f9',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>
                        Requested
                      </span>
                      <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                        {matchData.unitsRequested} Unit(s)
                      </strong>
                    </div>
                    <div
                      style={{
                        background: matchData.canFulfill ? '#ecfdf5' : matchData.availableUnits > 0 ? '#fffbeb' : '#fef2f2',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>
                        Available
                      </span>
                      <strong
                        style={{
                          fontSize: '0.95rem',
                          color: matchData.canFulfill ? '#15803d' : matchData.availableUnits > 0 ? '#b45309' : '#b91c1c',
                        }}
                      >
                        {matchData.availableUnits} Unit(s)
                      </strong>
                    </div>
                    <div
                      style={{
                        background: '#f1f5f9',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>
                        Matching Spec
                      </span>
                      <strong style={{ fontSize: '0.8rem', color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedRequest.bloodGroup} &bull; {selectedRequest.componentType}
                      </strong>
                    </div>
                  </div>

                  {/* Matching Units List */}
                  {matchData.matchingUnits.length === 0 ? (
                    <div
                      style={{
                        background: '#fff1f2',
                        border: '1px solid #fecdd3',
                        color: '#9f1239',
                        padding: '0.65rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                      }}
                    >
                      No approved inventory units currently in AVAILABLE status match this blood group and component.
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          maxHeight: '180px',
                          overflowY: 'auto',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                              <th style={{ padding: '0.4rem 0.5rem', color: '#475569', width: '32px' }}></th>
                              <th style={{ padding: '0.4rem 0.5rem', color: '#475569' }}>Unit Code</th>
                              <th style={{ padding: '0.4rem 0.5rem', color: '#475569' }}>Expiry</th>
                              <th style={{ padding: '0.4rem 0.5rem', color: '#475569' }}>Storage</th>
                              <th style={{ padding: '0.4rem 0.5rem', color: '#475569' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchData.matchingUnits.map((unit) => {
                              const activeReservations = reservations.filter(
                                (r) => r.status === ReservationStatus.ACTIVE,
                              );
                              const totalReservedUnits = activeReservations.reduce(
                                (sum, r) => sum + r.reservedUnits.length,
                                0,
                              );
                              const remainingNeeded = Math.max(
                                0,
                                selectedRequest.unitsRequested - totalReservedUnits,
                              );
                              const isChecked = selectedUnitIds.includes(unit.inventoryId);
                              const isMaxReached =
                                !isChecked && selectedUnitIds.length >= remainingNeeded;

                              return (
                                <tr
                                  key={unit.inventoryId}
                                  style={{
                                    borderBottom: '1px solid #f1f5f9',
                                    background: isChecked ? '#eff6ff' : 'transparent',
                                  }}
                                >
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={isMaxReached || remainingNeeded === 0}
                                      onChange={() =>
                                        toggleUnitSelection(unit.inventoryId, remainingNeeded)
                                      }
                                      style={{ cursor: isMaxReached ? 'not-allowed' : 'pointer' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#0f172a' }}>
                                    {unit.unitCode}
                                  </td>
                                  <td style={{ padding: '0.4rem 0.5rem', color: '#334155' }}>
                                    {unit.expiryDate
                                      ? new Date(unit.expiryDate).toLocaleDateString()
                                      : 'Not set'}
                                  </td>
                                  <td style={{ padding: '0.4rem 0.5rem', color: '#475569' }}>
                                    {unit.storageLocation}
                                  </td>
                                  <td style={{ padding: '0.4rem 0.5rem' }}>
                                    <span
                                      style={{
                                        background: '#dcfce7',
                                        color: '#15803d',
                                        padding: '0.15rem 0.35rem',
                                        borderRadius: '3px',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {unit.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Reservation Action Bar */}
                      {(() => {
                        const activeReservations = reservations.filter(
                          (r) => r.status === ReservationStatus.ACTIVE,
                        );
                        const totalReservedUnits = activeReservations.reduce(
                          (sum, r) => sum + r.reservedUnits.length,
                          0,
                        );
                        const remainingNeeded = Math.max(
                          0,
                          selectedRequest.unitsRequested - totalReservedUnits,
                        );
                        const isEligibleToReserve =
                          selectedRequest.status === BloodRequestStatus.APPROVED ||
                          (selectedRequest.status === BloodRequestStatus.RESERVED &&
                            remainingNeeded > 0);

                        return (
                          <div style={{ marginTop: '0.75rem' }}>
                            {remainingNeeded > 0 ? (
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '0.6rem 0.75rem',
                                  background: '#f8fafc',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                <div>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
                                    Selected: {selectedUnitIds.length} / {remainingNeeded} unit(s)
                                  </span>
                                  {!isEligibleToReserve && (
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#b45309' }}>
                                      Request must be APPROVED to reserve units (Current: {selectedRequest.status}).
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  disabled={selectedUnitIds.length === 0 || !isEligibleToReserve || isReserving}
                                  onClick={() => setConfirmModalOpen(true)}
                                  style={{
                                    background:
                                      selectedUnitIds.length > 0 && isEligibleToReserve
                                        ? '#2563eb'
                                        : '#94a3b8',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '0.45rem 0.9rem',
                                    borderRadius: '4px',
                                    cursor:
                                      selectedUnitIds.length > 0 && isEligibleToReserve
                                        ? 'pointer'
                                        : 'not-allowed',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  Reserve Selected Units ({selectedUnitIds.length})
                                </button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  background: '#f0fdf4',
                                  border: '1px solid #bbf7d0',
                                  color: '#166534',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 500,
                                }}
                              >
                                All requested units ({selectedRequest.unitsRequested}) are currently reserved.
                              </div>
                            )}

                            {reserveSuccess && (
                              <div
                                style={{
                                  marginTop: '0.5rem',
                                  background: '#f0fdf4',
                                  border: '1px solid #86efac',
                                  color: '#15803d',
                                  padding: '0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                }}
                              >
                                {reserveSuccess}
                              </div>
                            )}

                            {reserveError && (
                              <div
                                style={{
                                  marginTop: '0.5rem',
                                  background: '#fef2f2',
                                  border: '1px solid #fca5a5',
                                  color: '#991b1b',
                                  padding: '0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                }}
                              >
                                {reserveError}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: '#64748b',
                      marginTop: '0.5rem',
                      fontStyle: 'italic',
                    }}
                  >
                    Reservation temporarily commits units to this request. Blood issue and transfusion are handled separately.
                  </div>
                </div>
              )}
            </div>

            {/* Active Reservations Section (Phase 6B) */}
            {reservations.length > 0 && (
              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', fontWeight: 600 }}>
                    Reservations ({reservations.length})
                  </h3>
                  {reservationsLoading && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Refreshing...</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {reservations.map((res) => (
                    <div
                      key={res.reservationCode}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '0.65rem 0.75rem',
                        background: res.status === ReservationStatus.ACTIVE ? '#f8fafc' : '#f1f5f9',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                            {res.reservationCode}
                          </strong>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '0.5rem' }}>
                            {new Date(res.reservedAt).toLocaleString()}
                          </span>
                        </div>
                        <span
                          style={{
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            ...(res.status === ReservationStatus.ACTIVE
                              ? { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' }
                              : { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }),
                          }}
                        >
                          {res.status}
                        </span>
                      </div>

                      {/* Units */}
                      <div style={{ fontSize: '0.75rem', color: '#334155', marginBottom: '0.5rem' }}>
                        {res.reservedUnits.map((u) => (
                          <span
                            key={u.unitCode}
                            style={{
                              display: 'inline-block',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '3px',
                              padding: '0.15rem 0.4rem',
                              marginRight: '0.35rem',
                              marginTop: '0.2rem',
                            }}
                          >
                            <strong>{u.unitCode}</strong> ({u.bloodGroup} &bull; {u.componentType})
                          </span>
                        ))}
                      </div>

                      {res.status === ReservationStatus.CANCELLED && res.cancellationReason && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.35rem' }}>
                          Reason: {res.cancellationReason}
                        </div>
                      )}

                      {/* Actions */}
                      {res.status === ReservationStatus.ACTIVE && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenCancelModal(res)}
                            style={{
                              background: 'transparent',
                              border: '1px solid #f87171',
                              color: '#b91c1c',
                              padding: '0.25rem 0.55rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                            }}
                          >
                            Cancel Reservation
                          </button>
                          {selectedRequest.status === BloodRequestStatus.RESERVED && (
                            <button
                              type="button"
                              onClick={() => handleOpenIssueModal(res)}
                              style={{
                                background: '#ea580c',
                                border: '1px solid #c2410c',
                                color: '#ffffff',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.725rem',
                                fontWeight: 600,
                              }}
                            >
                              Issue Reserved Blood
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Issued Blood Units Section (Phase 6C) */}
            {bloodIssues.length > 0 && (
              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', fontWeight: 600 }}>
                    Official Blood Issue Records ({bloodIssues.length})
                  </h3>
                  {issuesLoading && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Refreshing...</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {bloodIssues.map((issue) => (
                    <div
                      key={issue.issueCode}
                      style={{
                        border: '1px solid #fdba74',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        background: '#fff7ed',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <div>
                          <strong style={{ fontSize: '0.875rem', color: '#9a3412' }}>
                            {issue.issueCode}
                          </strong>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '0.5rem' }}>
                            {new Date(issue.issuedAt).toLocaleString()}
                          </span>
                        </div>
                        <span
                          style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: '#ffedd5',
                            color: '#c2410c',
                            border: '1px solid #fed7aa',
                          }}
                        >
                          ISSUED / {issue.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '0.35rem' }}>
                        <strong>Reservation Ref:</strong> {issue.reservationCode}
                        {issue.issuedBy && <span> &bull; <strong>Issued By:</strong> {issue.issuedBy}</span>}
                      </div>

                      {issue.remarks && (
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '0.35rem' }}>
                          <strong>Remarks:</strong> {issue.remarks}
                        </div>
                      )}

                      <div style={{ fontSize: '0.75rem', color: '#334155', marginTop: '0.4rem' }}>
                        <strong>Issued Units:</strong>
                        <div style={{ marginTop: '0.2rem' }}>
                          {issue.issuedUnits.map((u) => (
                            <span
                              key={u.unitCode}
                              style={{
                                display: 'inline-block',
                                background: '#ffffff',
                                border: '1px solid #f97316',
                                color: '#9a3412',
                                borderRadius: '3px',
                                padding: '0.15rem 0.4rem',
                                marginRight: '0.35rem',
                                marginTop: '0.2rem',
                                fontSize: '0.75rem',
                              }}
                            >
                              <strong>{u.unitCode}</strong> ({u.bloodGroup} &bull; {u.componentType})
                            </span>
                          ))}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: '#7c2d12',
                          marginTop: '0.5rem',
                          fontStyle: 'italic',
                          borderTop: '1px dashed #fed7aa',
                          paddingTop: '0.35rem',
                        }}
                      >
                        Notice: Units have been officially issued from inventory for this request. (Clinical transfusion takes place at bedside).
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {issueSuccess && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#15803d',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                }}
              >
                {issueSuccess}
              </div>
            )}

            {/* Lifecycle Status Transition Form */}
            <form onSubmit={handleUpdateStatus} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#1e293b' }}>
                Advance Request Lifecycle
              </h3>

              {updateError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  {updateError}
                </div>
              )}

              {ALLOWED_NEXT_STATUSES[selectedRequest.status]?.length === 0 ? (
                <div style={{ background: '#f1f5f9', color: '#64748b', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'center' }}>
                  Terminal State Reached ({selectedRequest.status}). No further transitions allowed.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                      Allowed Next Status:
                    </label>
                    <select
                      value={newStatus}
                      required
                      onChange={(e) => setNewStatus(e.target.value as BloodRequestStatus)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      <option value="">Select Next Status</option>
                      {ALLOWED_NEXT_STATUSES[selectedRequest.status]?.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                      Audit Reason / Operational Remarks:
                    </label>
                    <input
                      type="text"
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      placeholder="e.g. Doctor prescription verified"
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updateLoading || !newStatus}
                    style={{
                      width: '100%',
                      background: updateLoading || !newStatus ? '#94a3b8' : '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.55rem',
                      borderRadius: '4px',
                      cursor: updateLoading || !newStatus ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  >
                    {updateLoading ? 'Updating Status...' : 'Apply Status Transition'}
                  </button>
                </>
              )}
            </form>
          </div>
        )}

        {/* Reservation Confirmation Modal */}
        {confirmModalOpen && selectedRequest && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                padding: '1.5rem',
                maxWidth: '480px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#0f172a' }}>
                Confirm Blood Unit Reservation
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                You are about to reserve {selectedUnitIds.length} blood unit(s) for blood request{' '}
                <strong>{selectedRequest.requestCode}</strong>.
              </p>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                }}
              >
                <div><strong>Blood Group:</strong> {selectedRequest.bloodGroup}</div>
                <div><strong>Component:</strong> {selectedRequest.componentType}</div>
                <div><strong>Units to Reserve:</strong> {selectedUnitIds.length}</div>
                <div style={{ marginTop: '0.35rem' }}>
                  <strong>Selected Units:</strong>{' '}
                  {matchData?.matchingUnits
                    .filter((u) => selectedUnitIds.includes(u.inventoryId))
                    .map((u) => u.unitCode)
                    .join(', ')}
                </div>
              </div>

              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  marginBottom: '1.25rem',
                }}
              >
                <strong>Operational Hold Notice:</strong> These units will no longer be available for other
                requests until this reservation is cancelled or expires. (Blood is NOT issued or transfused at this stage).
              </div>

              {reserveError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    marginBottom: '1rem',
                  }}
                >
                  {reserveError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  disabled={isReserving}
                  onClick={() => setConfirmModalOpen(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: isReserving ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isReserving}
                  onClick={handleExecuteReservation}
                  style={{
                    background: isReserving ? '#93c5fd' : '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '4px',
                    cursor: isReserving ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  {isReserving ? 'Reserving...' : 'Confirm Reservation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancellation Modal */}
        {cancelModalOpen && targetReservation && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                padding: '1.5rem',
                maxWidth: '460px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#991b1b' }}>
                Cancel Blood Reservation
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                Cancel reservation <strong>{targetReservation.reservationCode}</strong>? Held blood units
                will immediately be released back to <strong>AVAILABLE</strong> inventory.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.35rem' }}>
                  Cancellation Reason (Optional audit remark):
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Doctor adjusted dosage, procedure rescheduled"
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {cancelError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    marginBottom: '1rem',
                  }}
                >
                  {cancelError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setCancelModalOpen(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: isCancelling ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  Keep Reservation
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleExecuteCancellation}
                  style={{
                    background: isCancelling ? '#fca5a5' : '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '4px',
                    cursor: isCancelling ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Issue Confirmation Modal (Phase 6C) */}
        {issueModalOpen && targetReservationForIssue && selectedRequest && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                padding: '1.5rem',
                maxWidth: '480px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#c2410c' }}>
                Issue Reserved Blood Units
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                You are executing the official issuance of {targetReservationForIssue.reservedUnits.length} reserved
                blood unit(s) for request <strong>{selectedRequest.requestCode}</strong> (Reservation Ref: <strong>{targetReservationForIssue.reservationCode}</strong>).
              </p>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                }}
              >
                <div><strong>Blood Group:</strong> {selectedRequest.bloodGroup}</div>
                <div><strong>Component:</strong> {selectedRequest.componentType}</div>
                <div><strong>Hospital:</strong> {selectedRequest.hospitalName}</div>
                <div><strong>Patient:</strong> {selectedRequest.patient.name} ({selectedRequest.patient.age}y, {selectedRequest.patient.gender})</div>
                <div style={{ marginTop: '0.35rem' }}>
                  <strong>Units to Issue:</strong>{' '}
                  {targetReservationForIssue.reservedUnits.map((u) => u.unitCode).join(', ')}
                </div>
              </div>

              <div
                style={{
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  color: '#9a3412',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                }}
              >
                <strong>Operational Issuance Notice:</strong> After issuance, these blood units will permanently transition
                to <strong>ISSUED</strong> status and are removed from available inventory.
                <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', fontStyle: 'italic' }}>
                  (Blood is NOT transfused or administered at this stage; transfusion is managed at bedside).
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.35rem' }}>
                  Operational Remarks / Recipient (Optional audit remark):
                </label>
                <input
                  type="text"
                  value={issueRemarks}
                  onChange={(e) => setIssueRemarks(e.target.value)}
                  placeholder="e.g. Handed to OT Nurse / Dispatch ID"
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {issueError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    marginBottom: '1rem',
                  }}
                >
                  {issueError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  disabled={isIssuing}
                  onClick={() => setIssueModalOpen(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: isIssuing ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isIssuing}
                  onClick={handleExecuteIssue}
                  style={{
                    background: isIssuing ? '#fdba74' : '#ea580c',
                    border: 'none',
                    color: '#ffffff',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '4px',
                    cursor: isIssuing ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  {isIssuing ? 'Issuing Blood...' : 'Confirm & Issue Blood'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
