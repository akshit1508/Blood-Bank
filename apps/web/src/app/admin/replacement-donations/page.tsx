'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ReplacementDonation,
  ReplacementMetrics,
  ReplacementTrackingStatus,
  ReplacementDonorRelationship,
  fetchReplacementMetrics,
  fetchReplacementDonations,
  createReplacementCase,
  linkDonationToReplacement,
  syncReplacementStatus,
  cancelReplacementCase,
} from '@/lib/replacement-donations-api';
import { fetchBloodRequests, BloodRequest } from '@/lib/blood-request-api';
import { fetchDonors, Donor, BloodGroup } from '@/lib/donor-api';
import { fetchDonations, Donation } from '@/lib/donation-api';

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

export default function ReplacementDonationsPage() {
  const [metrics, setMetrics] = useState<ReplacementMetrics | null>(null);
  const [cases, setCases] = useState<ReplacementDonation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ReplacementDonation | null>(null);

  // Load Data
  const loadMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true);
      const data = await fetchReplacementMetrics();
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to load replacement metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchReplacementDonations({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        page,
        limit: 10,
      });
      setCases(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load replacement donation cases');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleSync = async (id: string) => {
    try {
      await syncReplacementStatus(id);
      loadCases();
      loadMetrics();
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Banner / Breadcrumb & Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#0f172a',
              margin: '0 0 4px 0',
            }}
          >
            Replacement Donation Tracking
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            Track relatives&apos; and associated donors&apos; donations against patient blood requests.
            Separate from patient blood issue.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Track Replacement Donor
        </button>
      </div>

      {/* Metrics Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <MetricCard
          label="Active Cases"
          value={metrics?.activeCases ?? 0}
          subtext="In progress or testing"
          color="#2563eb"
          loading={metricsLoading}
        />
        <MetricCard
          label="Associated Donors"
          value={metrics?.associatedDonors ?? 0}
          subtext="Unique donors linked"
          color="#7c3aed"
          loading={metricsLoading}
        />
        <MetricCard
          label="In Progress"
          value={metrics?.donationsInProgress ?? 0}
          subtext="Scheduled or collecting"
          color="#d97706"
          loading={metricsLoading}
        />
        <MetricCard
          label="Collected / Testing"
          value={metrics?.donationsCollected ?? 0}
          subtext="Awaiting lab results"
          color="#0891b2"
          loading={metricsLoading}
        />
        <MetricCard
          label="Released to Inventory"
          value={metrics?.releasedDonations ?? 0}
          subtext="Passed testing"
          color="#16a34a"
          loading={metricsLoading}
        />
        <MetricCard
          label="Deferred / Cancelled"
          value={(metrics?.deferredOrRejected ?? 0) + (metrics?.cancelledCases ?? 0)}
          subtext="Deferred, rejected, stopped"
          color="#dc2626"
          loading={metricsLoading}
        />
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', flex: 1 }}>
          <div style={{ minWidth: '260px', flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by Tracking ID, Request Code, Donor, Patient..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
              }}
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              style={{ position: 'absolute', left: '12px', top: '12px' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '9px 14px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#334155',
              backgroundColor: '#ffffff',
            }}
          >
            <option value="">All Statuses</option>
            {Object.values(ReplacementTrackingStatus).map((st) => (
              <option key={st} value={st}>
                {STATUS_COLORS[st]?.label || st}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setSearch('');
            setStatusFilter('');
            setPage(1);
          }}
          style={{
            padding: '9px 14px',
            backgroundColor: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#475569',
            cursor: 'pointer',
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Cases Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div
              style={{
                display: 'inline-block',
                width: '32px',
                height: '32px',
                border: '3px solid #f1f5f9',
                borderTopColor: '#dc2626',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '12px',
              }}
            />
            <p style={{ margin: 0, fontSize: '14px' }}>Loading replacement tracking records...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
            <p style={{ fontWeight: '600', margin: '0 0 8px 0' }}>Error Loading Records</p>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px 0' }}>{error}</p>
            <button
              onClick={loadCases}
              style={{
                padding: '8px 16px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Retry
            </button>
          </div>
        ) : cases.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              style={{ margin: '0 auto 12px auto' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#334155', margin: '0 0 4px 0' }}>
              No Replacement Cases Found
            </h3>
            <p style={{ fontSize: '13px', margin: '0 0 16px 0' }}>
              {search || statusFilter
                ? 'Try adjusting your search criteria or filters.'
                : 'Associate replacement donors against blood requests to start tracking.'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
              }}
            >
              Associate Replacement Donor
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Tracking ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Patient & Request</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Associated Donor</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Donation & Unit</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Tracking Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Created</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const statusInfo = STATUS_COLORS[c.status] || {
                    bg: '#f1f5f9',
                    text: '#475569',
                    border: '#cbd5e1',
                    label: c.status,
                  };
                  return (
                    <tr
                      key={c._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <Link
                          href={`/admin/replacement-donations/${c._id}`}
                          style={{
                            fontWeight: '600',
                            color: '#dc2626',
                            textDecoration: 'none',
                            fontFamily: 'monospace',
                          }}
                        >
                          {c.trackingCode}
                        </Link>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{c.patientName}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          <span style={{ fontFamily: 'monospace' }}>{c.requestCode}</span>
                          <span style={{ margin: '0 4px' }}>•</span>
                          <span
                            style={{
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: '600',
                              fontSize: '11px',
                            }}
                          >
                            {c.patientBloodGroup.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{c.donorName}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          <span style={{ fontFamily: 'monospace' }}>{c.donorCode}</span>
                          <span style={{ margin: '0 4px' }}>•</span>
                          <span
                            style={{
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: '600',
                              fontSize: '11px',
                            }}
                          >
                            {c.donorBloodGroup.replace('_', ' ')}
                          </span>
                          <span style={{ margin: '0 4px' }}>•</span>
                          <span>{c.relationshipToPatient}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {c.donationCode ? (
                          <div>
                            <div style={{ fontFamily: 'monospace', color: '#1e293b', fontWeight: '500' }}>
                              {c.donationCode}
                            </div>
                            {c.unitCode ? (
                              <div style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>
                                Unit: {c.unitCode}
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#64748b' }}>No unit linked yet</div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedCase(c);
                              setShowLinkModal(true);
                            }}
                            disabled={c.status === ReplacementTrackingStatus.CANCELLED}
                            style={{
                              fontSize: '12px',
                              padding: '4px 8px',
                              backgroundColor: '#f8fafc',
                              border: '1px dashed #cbd5e1',
                              borderRadius: '4px',
                              color: '#3b82f6',
                              cursor:
                                c.status === ReplacementTrackingStatus.CANCELLED ? 'not-allowed' : 'pointer',
                              fontWeight: '500',
                            }}
                          >
                            + Link Donation
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
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
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px' }}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleSync(c._id)}
                            title="Sync status with lab/inventory records"
                            style={{
                              padding: '5px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              color: '#64748b',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                          </button>
                          <Link
                            href={`/admin/replacement-donations/${c._id}`}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              color: '#334155',
                              textDecoration: 'none',
                              fontWeight: '600',
                              fontSize: '12px',
                            }}
                          >
                            Details
                          </Link>
                          {c.status !== ReplacementTrackingStatus.CANCELLED && (
                            <button
                              onClick={() => {
                                setSelectedCase(c);
                                setShowCancelModal(true);
                              }}
                              style={{
                                padding: '5px 8px',
                                backgroundColor: '#fff',
                                border: '1px solid #fecaca',
                                borderRadius: '4px',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontWeight: '500',
                                fontSize: '12px',
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {total > 10 && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}
          >
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing {(page - 1) * 10 + 1} - {Math.min(page * 10, total)} of {total} cases
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '5px 12px',
                  backgroundColor: page <= 1 ? '#f1f5f9' : '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: page <= 1 ? '#94a3b8' : '#334155',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '5px 12px',
                  backgroundColor: page >= totalPages ? '#f1f5f9' : '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: page >= totalPages ? '#94a3b8' : '#334155',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Create / Associate Replacement Case */}
      {showCreateModal && (
        <CreateReplacementModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadCases();
            loadMetrics();
          }}
        />
      )}

      {/* Modal 2: Link Donation Modal */}
      {showLinkModal && selectedCase && (
        <LinkDonationModal
          replacementCase={selectedCase}
          onClose={() => {
            setShowLinkModal(false);
            setSelectedCase(null);
          }}
          onSuccess={() => {
            setShowLinkModal(false);
            setSelectedCase(null);
            loadCases();
            loadMetrics();
          }}
        />
      )}

      {/* Modal 3: Cancel Case Modal */}
      {showCancelModal && selectedCase && (
        <CancelCaseModal
          replacementCase={selectedCase}
          onClose={() => {
            setShowCancelModal(false);
            setSelectedCase(null);
          }}
          onSuccess={() => {
            setShowCancelModal(false);
            setSelectedCase(null);
            loadCases();
            loadMetrics();
          }}
        />
      )}
    </div>
  );
}

// Subcomponent: Metric Card
function MetricCard({
  label,
  value,
  subtext,
  color,
  loading,
}: {
  label: string;
  value: number;
  subtext: string;
  color: string;
  loading: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        borderLeft: `4px solid ${color}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: '500', color: '#64748b', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
        {loading ? '...' : value}
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{subtext}</div>
    </div>
  );
}

// Modal Component: Create Replacement Tracking Case
function CreateReplacementModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [bloodRequests, setBloodRequests] = useState<BloodRequest[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [donorMode, setDonorMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [selectedDonorId, setSelectedDonorId] = useState('');
  const [relationship, setRelationship] = useState<ReplacementDonorRelationship>(
    ReplacementDonorRelationship.FAMILY,
  );
  const [notes, setNotes] = useState('');

  // New Donor Fields
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newBloodGroup, setNewBloodGroup] = useState<string>(BloodGroup.O_POSITIVE);
  const [newGender, setNewGender] = useState('MALE');
  const [newDob, setNewDob] = useState('1995-01-01');

  useEffect(() => {
    async function loadFormOptions() {
      try {
        setLoadingInitial(true);
        const [reqList, donorList] = await Promise.all([
          fetchBloodRequests(),
          fetchDonors(),
        ]);
        setBloodRequests(Array.isArray(reqList) ? reqList : []);
        setDonors(Array.isArray(donorList) ? donorList : []);
        if (Array.isArray(reqList) && reqList.length > 0) {
          setSelectedRequestId(reqList[0]._id);
        }
        if (Array.isArray(donorList) && donorList.length > 0) {
          setSelectedDonorId(donorList[0]._id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load requests or donors');
      } finally {
        setLoadingInitial(false);
      }
    }
    loadFormOptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestId) {
      setError('Please select a Blood Request');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: any = {
        bloodRequestId: selectedRequestId,
        relationshipToPatient: relationship,
        notes: notes || undefined,
      };

      if (donorMode === 'EXISTING') {
        if (!selectedDonorId) {
          setError('Please select an existing donor');
          setSubmitting(false);
          return;
        }
        payload.donorId = selectedDonorId;
      } else {
        if (!newFullName.trim() || !newPhone.trim()) {
          setError('Full name and phone are required for new donor');
          setSubmitting(false);
          return;
        }
        payload.newDonor = {
          fullName: newFullName.trim(),
          phone: newPhone.trim(),
          bloodGroup: newBloodGroup,
          gender: newGender,
          dateOfBirth: newDob,
        };
      }

      await createReplacementCase(payload);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create replacement tracking case');
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
              Associate Replacement Donor
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Link a relative or replacement donor against an existing patient blood request.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {loadingInitial ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            Loading patient requests and donor records...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Step 1: Blood Request */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Select Blood Request *
              </label>
              <select
                value={selectedRequestId}
                onChange={(e) => setSelectedRequestId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              >
                {bloodRequests.map((req) => (
                  <option key={req._id} value={req._id}>
                    {req.requestCode} — {req.patient?.name} ({req.bloodGroup?.replace('_', ' ')}) • {req.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Donor Selection Mode */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Donor Selection Mode
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setDonorMode('EXISTING')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    border: donorMode === 'EXISTING' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    backgroundColor: donorMode === 'EXISTING' ? '#fef2f2' : '#ffffff',
                    color: donorMode === 'EXISTING' ? '#dc2626' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Select Existing Donor
                </button>
                <button
                  type="button"
                  onClick={() => setDonorMode('NEW')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    border: donorMode === 'NEW' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    backgroundColor: donorMode === 'NEW' ? '#fef2f2' : '#ffffff',
                    color: donorMode === 'NEW' ? '#dc2626' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Register New Donor
                </button>
              </div>
            </div>

            {/* Existing Donor Dropdown */}
            {donorMode === 'EXISTING' ? (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Choose Donor *
                </label>
                <select
                  value={selectedDonorId}
                  onChange={(e) => setSelectedDonorId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                >
                  {donors.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.donorCode} — {d.fullName} ({d.bloodGroup?.replace('_', ' ')}) • {d.phone} • Deferral: {d.deferralStatus || 'NONE'}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              /* New Donor Fields */
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '10px' }}>
                  New Donor Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      required
                      placeholder="e.g. Ramesh Kumar"
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      required
                      placeholder="10-digit number"
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                      Blood Group *
                    </label>
                    <select
                      value={newBloodGroup}
                      onChange={(e) => setNewBloodGroup(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    >
                      {Object.values(BloodGroup).map((bg) => (
                        <option key={bg} value={bg}>
                          {bg.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                      Gender *
                    </label>
                    <select
                      value={newGender}
                      onChange={(e) => setNewGender(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      value={newDob}
                      onChange={(e) => setNewDob(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '7px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Relationship */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Relationship to Patient *
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as ReplacementDonorRelationship)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              >
                {Object.values(ReplacementDonorRelationship).map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Internal Tracking Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Patient's brother, scheduled to donate this afternoon"
                rows={3}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Associating...' : 'Create Tracking Case'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Modal Component: Link Donation to Tracking Case
function LinkDonationModal({
  replacementCase,
  onClose,
  onSuccess,
}: {
  replacementCase: ReplacementDonation;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [selectedDonationId, setSelectedDonationId] = useState('');
  const [manualDonationId, setManualDonationId] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDonorDonations() {
      try {
        setLoading(true);
        const res = await fetchDonations({
          donorId: replacementCase.donorId,
          limit: 20,
        });
        setDonations(res.items || []);
        if (res.items?.length > 0) {
          setSelectedDonationId(res.items[0]._id);
        } else {
          setUseManual(true);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load donations for donor');
        setUseManual(true);
      } finally {
        setLoading(false);
      }
    }
    loadDonorDonations();
  }, [replacementCase.donorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const donationIdToLink = useManual ? manualDonationId.trim() : selectedDonationId;
    if (!donationIdToLink) {
      setError('Please provide a valid donation ID');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await linkDonationToReplacement(replacementCase._id, {
        donationId: donationIdToLink,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to link donation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
          maxWidth: '520px',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
              Link Physical Donation
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Tracking Case: <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{replacementCase.trackingCode}</span>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            padding: '12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          <div>
            <strong>Associated Donor:</strong> {replacementCase.donorName} ({replacementCase.donorCode})
          </div>
          <div>
            <strong>Patient Blood Request:</strong> {replacementCase.requestCode} ({replacementCase.patientName})
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
            Checking donations recorded for {replacementCase.donorName}...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {!useManual && donations.length > 0 ? (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Select Recorded Donation
                </label>
                <select
                  value={selectedDonationId}
                  onChange={(e) => setSelectedDonationId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                >
                  {donations.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.donationCode} — {new Date(d.donationDate).toLocaleDateString()} ({d.status}) • {d.quantity} unit
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: '6px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => setUseManual(true)}
                    style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Enter Donation ID manually
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Donation Record ID *
                </label>
                <input
                  type="text"
                  placeholder="24-character MongoDB ObjectId"
                  value={manualDonationId}
                  onChange={(e) => setManualDonationId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                  }}
                />
                {donations.length > 0 && (
                  <div style={{ marginTop: '6px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setUseManual(false)}
                      style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Pick from donor&apos;s donations
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Whole blood unit collected in morning camp"
                rows={2}
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
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Linking...' : 'Confirm Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Modal Component: Cancel Case Modal
function CancelCaseModal({
  replacementCase,
  onClose,
  onSuccess,
}: {
  replacementCase: ReplacementDonation;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Cancellation reason is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await cancelReplacementCase(replacementCase._id, {
        cancellationReason: reason.trim(),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel replacement case');
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#b91c1c', margin: '0 0 8px 0' }}>
          Cancel Replacement Tracking Case
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
          Are you sure you want to cancel tracking for case{' '}
          <strong style={{ fontFamily: 'monospace' }}>{replacementCase.trackingCode}</strong>? This will record the case as
          cancelled in audit history.
        </p>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Cancellation Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Donor unavailable, decided not to proceed, or family arranged other alternative"
              required
              rows={3}
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
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '9px 16px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '9px 18px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
