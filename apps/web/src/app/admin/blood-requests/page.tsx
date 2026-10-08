'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BloodRequest,
  BloodRequestStatus,
  fetchBloodRequests,
  updateBloodRequestStatus,
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
    <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a' }}>Admin Blood Requests Management</h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Phase 1 Vertical Slice &bull; Real-time intake queue and lifecycle processing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link href="/admin/donors" style={{ backgroundColor: '#0f172a', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Donors Management
          </Link>
          <Link href="/admin/donations" style={{ backgroundColor: '#0f172a', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Donations Management
          </Link>
          <Link href="/admin/testing" style={{ backgroundColor: '#0f172a', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Laboratory Testing
          </Link>
          <Link href="/blood-request" style={{ backgroundColor: '#dc2626', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            + New Public Request
          </Link>
          <Link href="/" style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem' }}>
            Home
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
      </div>
    </div>
  );
}
