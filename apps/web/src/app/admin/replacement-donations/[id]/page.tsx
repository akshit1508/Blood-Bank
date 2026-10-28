'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ReplacementDonation,
  ReplacementTrackingStatus,
  fetchReplacementDonationById,
  syncReplacementStatus,
  cancelReplacementCase,
  updateReplacementNotes,
  linkDonationToReplacement,
} from '@/lib/replacement-donations-api';

const STATUS_COLORS: Record<
  ReplacementTrackingStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  [ReplacementTrackingStatus.DONOR_ASSOCIATED]: {
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#bfdbfe',
    label: 'Donor Associated',
  },
  [ReplacementTrackingStatus.DONATION_SCHEDULED]: {
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#bbf7d0',
    label: 'Donation Scheduled',
  },
  [ReplacementTrackingStatus.DONATION_IN_PROGRESS]: {
    bg: '#fef3c7',
    text: '#b45309',
    border: '#fde68a',
    label: 'Donation In Progress',
  },
  [ReplacementTrackingStatus.DONATION_COLLECTED]: {
    bg: '#ede9fe',
    text: '#6d28d9',
    border: '#ddd6fe',
    label: 'Donation Collected',
  },
  [ReplacementTrackingStatus.TESTING_PENDING]: {
    bg: '#e0e7ff',
    text: '#4338ca',
    border: '#c7d2fe',
    label: 'Testing Pending',
  },
  [ReplacementTrackingStatus.RELEASED_TO_INVENTORY]: {
    bg: '#dcfce7',
    text: '#166534',
    border: '#86efac',
    label: 'Released to Inventory',
  },
  [ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED]: {
    bg: '#fee2e2',
    text: '#b91c1c',
    border: '#fca5a5',
    label: 'Deferred / Rejected',
  },
  [ReplacementTrackingStatus.CANCELLED]: {
    bg: '#f3f4f6',
    text: '#4b5563',
    border: '#d1d5db',
    label: 'Cancelled',
  },
};

export default function ReplacementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [record, setRecord] = useState<ReplacementDonation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Notes editing
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Link donation modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [manualDonationId, setManualDonationId] = useState('');
  const [linkingDonation, setLinkingDonation] = useState(false);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadRecord = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReplacementDonationById(id);
      setRecord(data);
      setNotesValue(data.notes || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load replacement tracking case');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  const handleSync = async () => {
    if (!id) return;
    try {
      setSyncing(true);
      const updated = await syncReplacementStatus(id);
      setRecord(updated);
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    try {
      setSavingNotes(true);
      const updated = await updateReplacementNotes(id, notesValue);
      setRecord(updated);
      setIsEditingNotes(false);
    } catch (err: any) {
      alert(`Failed to save notes: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleLinkDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !manualDonationId.trim()) return;
    try {
      setLinkingDonation(true);
      const updated = await linkDonationToReplacement(id, {
        donationId: manualDonationId.trim(),
      });
      setRecord(updated);
      setShowLinkModal(false);
      setManualDonationId('');
    } catch (err: any) {
      alert(`Failed to link donation: ${err.message}`);
    } finally {
      setLinkingDonation(false);
    }
  };

  const handleCancelCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !cancelReason.trim()) return;
    try {
      setCancelling(true);
      const updated = await cancelReplacementCase(id, {
        cancellationReason: cancelReason.trim(),
      });
      setRecord(updated);
      setShowCancelModal(false);
    } catch (err: any) {
      alert(`Failed to cancel case: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        <p>Loading replacement case details...</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ padding: '24px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px 0' }}>Case Not Found</h2>
          <p style={{ margin: '0 0 16px 0' }}>{error || 'Unable to retrieve tracking record.'}</p>
          <Link
            href="/admin/replacement-donations"
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '13px',
            }}
          >
            Back to Replacement Tracking
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_COLORS[record.status] || {
    bg: '#f1f5f9',
    text: '#475569',
    border: '#cbd5e1',
    label: record.status,
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
        <Link href="/admin/replacement-donations" style={{ color: '#64748b', textDecoration: 'none' }}>
          Replacement Tracking
        </Link>
        <span>/</span>
        <span style={{ color: '#0f172a', fontWeight: '600', fontFamily: 'monospace' }}>{record.trackingCode}</span>
      </div>

      {/* Header Banner */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px 24px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: 0, fontFamily: 'monospace' }}>
              {record.trackingCode}
            </h1>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: statusInfo.bg,
                color: statusInfo.text,
                border: `1px solid ${statusInfo.border}`,
              }}
            >
              {statusInfo.label}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Created on {new Date(record.createdAt).toLocaleString()} by {record.createdByName || 'Staff'} ({record.createdByRole || 'STAFF'})
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleSync}
            disabled={syncing || record.status === ReplacementTrackingStatus.CANCELLED}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155',
              cursor: syncing || record.status === ReplacementTrackingStatus.CANCELLED ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            {syncing ? 'Syncing...' : 'Sync Lifecycle'}
          </button>

          {!record.donationCode && record.status !== ReplacementTrackingStatus.CANCELLED && (
            <button
              onClick={() => setShowLinkModal(true)}
              style={{
                padding: '8px 14px',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Link Donation
            </button>
          )}

          {record.status !== ReplacementTrackingStatus.CANCELLED && (
            <button
              onClick={() => setShowCancelModal(true)}
              style={{
                padding: '8px 14px',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Cancel Case
            </button>
          )}
        </div>
      </div>

      {/* STRICT SEPARATION NOTICE BANNER */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          color: '#1e40af',
          fontSize: '13px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          <strong>Operational Policy:</strong> Replacement tracking tracks relative/donor contributions for record and accounting.
          Patient blood issue is strictly independent and requires eligible inventory, standard compatibility crossmatching, and medical authorization.
        </span>
      </div>

      {/* Grid of Details Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        {/* Card 1: Patient Blood Request */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Blood Request & Patient
            </h3>
            <Link
              href="/admin/blood-requests"
              style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}
            >
              View Requests Desk →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#64748b' }}>Request Code: </span>
              <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{record.requestCode}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Patient Name: </span>
              <strong style={{ color: '#0f172a' }}>{record.patientName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Patient Blood Group: </span>
              <span
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: '700',
                  fontSize: '12px',
                }}
              >
                {record.patientBloodGroup.replace('_', ' ')}
              </span>
            </div>
            {record.patientPhone && (
              <div>
                <span style={{ color: '#64748b' }}>Patient Phone: </span>
                <span style={{ color: '#0f172a' }}>{record.patientPhone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Associated Donor */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Associated Donor
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
              }}
            >
              {record.relationshipToPatient}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#64748b' }}>Donor Code: </span>
              <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{record.donorCode}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Donor Name: </span>
              <strong style={{ color: '#0f172a' }}>{record.donorName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Donor Blood Group: </span>
              <span
                style={{
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: '700',
                  fontSize: '12px',
                }}
              >
                {record.donorBloodGroup.replace('_', ' ')}
              </span>
            </div>
            {record.donorPhone && (
              <div>
                <span style={{ color: '#64748b' }}>Phone: </span>
                <span style={{ color: '#0f172a' }}>{record.donorPhone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Physical Donation & Inventory Lifecycle */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 14px 0' }}>
            Donation & Unit Lifecycle
          </h3>

          {record.donationCode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div>
                <span style={{ color: '#64748b' }}>Linked Donation: </span>
                <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{record.donationCode}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Blood Unit: </span>
                {record.unitCode ? (
                  <strong style={{ fontFamily: 'monospace', color: '#166534' }}>{record.unitCode}</strong>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Awaiting unit creation/laboratory intake</span>
                )}
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Current Status: </span>
                <span
                  style={{
                    fontWeight: '600',
                    color: statusInfo.text,
                    backgroundColor: statusInfo.bg,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {statusInfo.label}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#64748b' }}>
                No physical donation record linked yet.
              </p>
              {record.status !== ReplacementTrackingStatus.CANCELLED && (
                <button
                  onClick={() => setShowLinkModal(true)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Link Donation
                </button>
              )}
            </div>
          )}
        </div>

        {/* Card 4: Internal Notes */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Tracking Notes
            </h3>
            {!isEditingNotes && (
              <button
                onClick={() => setIsEditingNotes(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Edit Notes
              </button>
            )}
          </div>

          {isEditingNotes ? (
            <div>
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '8px',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsEditingNotes(false)}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {savingNotes ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: record.notes ? '#334155' : '#94a3b8', fontStyle: record.notes ? 'normal' : 'italic' }}>
              {record.notes || 'No internal notes added.'}
            </p>
          )}

          {record.cancellationReason && (
            <div style={{ marginTop: '16px', padding: '10px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b', marginBottom: '2px' }}>
                Cancellation Reason:
              </div>
              <div style={{ fontSize: '13px', color: '#b91c1c' }}>{record.cancellationReason}</div>
            </div>
          )}
        </div>
      </div>

      {/* Audit History Timeline */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 16px 0' }}>
          Tracking Audit Timeline
        </h2>

        {record.timeline?.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px' }}>No timeline events recorded.</p>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            {/* Vertical Line */}
            <div
              style={{
                position: 'absolute',
                left: '7px',
                top: '6px',
                bottom: '6px',
                width: '2px',
                backgroundColor: '#e2e8f0',
              }}
            />

            {record.timeline.map((item, idx) => {
              const eventStatusInfo = STATUS_COLORS[item.status] || {
                bg: '#f1f5f9',
                text: '#475569',
                border: '#cbd5e1',
                label: item.status,
              };

              return (
                <div key={idx} style={{ position: 'relative', marginBottom: '20px' }}>
                  {/* Timeline Dot */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-21px',
                      top: '4px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: eventStatusInfo.text,
                      border: '2px solid #ffffff',
                      boxShadow: '0 0 0 2px #e2e8f0',
                    }}
                  />

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>
                        {item.event.replace('_', ' ')}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: eventStatusInfo.bg,
                          color: eventStatusInfo.text,
                        }}
                      >
                        {eventStatusInfo.label}
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#334155' }}>
                      {item.description}
                    </p>

                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      By: <strong>{item.actorName}</strong> ({item.actorRole})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Link Donation */}
      {showLinkModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
              Link Physical Donation Record
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Enter the Donation ID (ObjectId) for donor {record.donorName} ({record.donorCode}).
            </p>

            <form onSubmit={handleLinkDonation}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Donation ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="24-character MongoDB ObjectId"
                  value={manualDonationId}
                  onChange={(e) => setManualDonationId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  disabled={linkingDonation}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkingDonation}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: linkingDonation ? 'not-allowed' : 'pointer',
                  }}
                >
                  {linkingDonation ? 'Linking...' : 'Confirm Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cancel Case */}
      {showCancelModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#b91c1c', margin: '0 0 8px 0' }}>
              Cancel Replacement Case
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Provide a reason for stopping tracking for this replacement case.
            </p>

            <form onSubmit={handleCancelCase}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: cancelling ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cancelling ? 'Cancelling...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
