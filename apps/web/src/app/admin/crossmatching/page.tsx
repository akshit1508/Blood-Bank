'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  CrossmatchRecord,
  CrossmatchStatus,
  CrossmatchDashboardMetrics,
  fetchCrossmatches,
  fetchCrossmatchMetrics,
} from '@/lib/crossmatching-api';
import CrossmatchDashboardCards from '@/components/crossmatching/CrossmatchDashboardCards';
import RbcCompatibilityReferencePanel from '@/components/crossmatching/RbcCompatibilityReferencePanel';
import StartCrossmatchModal from '@/components/crossmatching/StartCrossmatchModal';

const STATUS_BADGES: Record<
  CrossmatchStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  [CrossmatchStatus.PENDING_SAMPLE_VERIFICATION]: {
    label: 'PENDING SAMPLE',
    bg: '#fef3c7',
    text: '#92400e',
    border: '#fde68a',
  },
  [CrossmatchStatus.SAMPLE_VERIFIED]: {
    label: 'SAMPLE VERIFIED',
    bg: '#eff6ff',
    text: '#1e40af',
    border: '#bfdbfe',
  },
  [CrossmatchStatus.UNIT_SELECTED]: {
    label: 'UNIT ASSIGNED',
    bg: '#ede9fe',
    text: '#6d28d9',
    border: '#ddd6fe',
  },
  [CrossmatchStatus.TESTING_IN_PROGRESS]: {
    label: 'TESTING IN PROGRESS',
    bg: '#f3e8ff',
    text: '#7e22ce',
    border: '#e9d5ff',
  },
  [CrossmatchStatus.RESULT_RECORDED]: {
    label: 'AWAITING AUTHORIZATION',
    bg: '#e0f2fe',
    text: '#0369a1',
    border: '#bae6fd',
  },
  [CrossmatchStatus.AUTHORIZED_COMPATIBLE]: {
    label: 'AUTHORIZED COMPATIBLE',
    bg: '#dcfce7',
    text: '#15803d',
    border: '#86efac',
  },
  [CrossmatchStatus.INCOMPATIBLE]: {
    label: 'INCOMPATIBLE',
    bg: '#fee2e2',
    text: '#b91c1c',
    border: '#fca5a5',
  },
  [CrossmatchStatus.INVALID_SAMPLE]: {
    label: 'INVALID SAMPLE',
    bg: '#ffedd5',
    text: '#c2410c',
    border: '#fed7aa',
  },
  [CrossmatchStatus.INCONCLUSIVE]: {
    label: 'INCONCLUSIVE',
    bg: '#fef9c3',
    text: '#a16207',
    border: '#fef08a',
  },
  [CrossmatchStatus.RESERVED]: {
    label: 'RESERVED',
    bg: '#ccfbf1',
    text: '#0f766e',
    border: '#99f6e4',
  },
  [CrossmatchStatus.ISSUED]: {
    label: 'ISSUED',
    bg: '#f1f5f9',
    text: '#334155',
    border: '#cbd5e1',
  },
  [CrossmatchStatus.CANCELLED]: {
    label: 'CANCELLED',
    bg: '#f8fafc',
    text: '#64748b',
    border: '#e2e8f0',
  },
};

export default function CrossmatchingQueuePage() {
  const pathname = usePathname();
  const { admin } = useAdminAuth();
  const isLabPortal = pathname?.startsWith('/lab') || admin?.role === 'LAB_TECHNICIAN';
  const basePath = isLabPortal ? '/lab' : '/admin';

  const [crossmatches, setCrossmatches] = useState<CrossmatchRecord[]>([]);
  const [metrics, setMetrics] = useState<CrossmatchDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('ALL');
  const [componentFilter, setComponentFilter] = useState('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [showRbcModal, setShowRbcModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetchCrossmatches({
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        patientBloodGroup: bloodGroupFilter !== 'ALL' ? bloodGroupFilter : undefined,
        component: componentFilter !== 'ALL' ? componentFilter : undefined,
        urgency: urgencyFilter !== 'ALL' ? urgencyFilter : undefined,
        page,
        limit: 20,
      });

      setCrossmatches(res.crossmatches);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load crossmatching queue');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, bloodGroupFilter, componentFilter, urgencyFilter, page]);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await fetchCrossmatchMetrics();
      setMetrics(data);
    } catch {
      // Non-fatal
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Read URL search parameter if present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('search');
    if (q) {
      setSearch(q);
    }
  }, []);

  return (
    <div style={{ padding: '0.5rem 0 3rem 0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Crossmatching & Compatibility Workstation
            </h1>
            <span
              style={{
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                padding: '0.2rem 0.55rem',
                borderRadius: '9999px',
                fontSize: '0.725rem',
                fontWeight: 700,
              }}
            >
              Laboratory Pre-Transfusion
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Patient sample verification, serological crossmatching, candidate unit compatibility, and authorized clinical issue
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Reference Button */}
          <button
            type="button"
            onClick={() => setShowRbcModal(true)}
            style={{
              backgroundColor: '#fff1f2',
              color: '#be123c',
              border: '1px solid #fecdd3',
              padding: '0.5rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#be123c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            RBC Compatibility Reference
          </button>

          {/* Start Order Button */}
          <button
            type="button"
            onClick={() => setShowStartModal(true)}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Initiate Crossmatch Order
          </button>
        </div>
      </div>

      {/* Real-time Dashboard Metrics */}
      <CrossmatchDashboardCards metrics={metrics} loading={metricsLoading} />

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.25rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {/* Search Box */}
          <div style={{ gridColumn: 'span 2', position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Crossmatch ID, Patient, Case #, Tube, Unit..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.825rem',
                color: '#0f172a',
                outline: 'none',
              }}
            />
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: '0.65rem', top: '0.65rem' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                color: '#0f172a',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value={CrossmatchStatus.PENDING_SAMPLE_VERIFICATION}>Pending Sample</option>
              <option value={CrossmatchStatus.SAMPLE_VERIFIED}>Sample Verified</option>
              <option value={CrossmatchStatus.UNIT_SELECTED}>Unit Assigned</option>
              <option value={CrossmatchStatus.TESTING_IN_PROGRESS}>Testing In Progress</option>
              <option value={CrossmatchStatus.RESULT_RECORDED}>Awaiting Authorization</option>
              <option value={CrossmatchStatus.AUTHORIZED_COMPATIBLE}>Authorized Compatible</option>
              <option value={CrossmatchStatus.INCOMPATIBLE}>Incompatible</option>
              <option value={CrossmatchStatus.INVALID_SAMPLE}>Invalid Sample</option>
              <option value={CrossmatchStatus.INCONCLUSIVE}>Inconclusive</option>
              <option value={CrossmatchStatus.RESERVED}>Reserved</option>
              <option value={CrossmatchStatus.ISSUED}>Issued</option>
              <option value={CrossmatchStatus.CANCELLED}>Cancelled</option>
            </select>
          </div>

          {/* Patient Blood Group Filter */}
          <div>
            <select
              value={bloodGroupFilter}
              onChange={(e) => {
                setBloodGroupFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                color: '#0f172a',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Patient Groups</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((grp) => (
                <option key={grp} value={grp}>
                  Group {grp}
                </option>
              ))}
            </select>
          </div>

          {/* Component Filter */}
          <div>
            <select
              value={componentFilter}
              onChange={(e) => {
                setComponentFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                color: '#0f172a',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Components</option>
              <option value="PRBC">PRBC (Packed Red Cells)</option>
              <option value="WHOLE_BLOOD">Whole Blood</option>
              <option value="FFP">FFP (Plasma)</option>
              <option value="PLATELETS">Platelets</option>
            </select>
          </div>
        </div>

        {/* Urgency and Total Match Count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Urgency:</span>
            {['ALL', 'CRITICAL_EMERGENCY', 'URGENT', 'ROUTINE'].map((urg) => {
              const active = urgencyFilter === urg;
              return (
                <button
                  key={urg}
                  type="button"
                  onClick={() => {
                    setUrgencyFilter(urg);
                    setPage(1);
                  }}
                  style={{
                    padding: '0.2rem 0.55rem',
                    borderRadius: '4px',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    border: active ? '1px solid #dc2626' : '1px solid #cbd5e1',
                    backgroundColor: active ? '#dc2626' : '#ffffff',
                    color: active ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {urg === 'ALL' ? 'ALL' : urg.replace('_', ' ')}
                </button>
              );
            })}
          </div>

          <div style={{ color: '#64748b' }}>
            Total Matched: <strong style={{ color: '#0f172a' }}>{totalCount}</strong> crossmatch order(s)
          </div>
        </div>
      </div>

      {/* Crossmatching Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {error && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', color: '#475569', textTransform: 'uppercase', fontSize: '0.725rem', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem' }}>Crossmatch & Requisition</th>
                <th style={{ padding: '0.75rem 1rem' }}>Patient Details</th>
                <th style={{ padding: '0.75rem 1rem' }}>Patient Group & Product</th>
                <th style={{ padding: '0.75rem 1rem' }}>Sample Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Assigned Donor Unit</th>
                <th style={{ padding: '0.75rem 1rem' }}>Observed Result</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody style={{ color: '#1e293b' }}>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                    Loading crossmatching queue...
                  </td>
                </tr>
              ) : crossmatches.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>No crossmatch records found.</p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                      Click <strong>Initiate Crossmatch Order</strong> above to link testing to an existing blood request.
                    </p>
                  </td>
                </tr>
              ) : (
                crossmatches.map((item) => {
                  const statusConf = STATUS_BADGES[item.status] || {
                    label: item.status,
                    bg: '#f1f5f9',
                    text: '#475569',
                    border: '#cbd5e1',
                  };

                  return (
                    <tr
                      key={item._id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.1s ease' }}
                    >
                      {/* Crossmatch ID & Request */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <Link
                          href={`${basePath}/crossmatching/${item._id}`}
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            color: '#dc2626',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                            display: 'block',
                          }}
                        >
                          {item.crossmatchCode}
                        </Link>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.725rem', color: '#64748b' }}>
                          {item.requestCode}
                        </span>
                        {item.urgency === 'CRITICAL_EMERGENCY' && (
                          <div style={{ marginTop: '0.2rem' }}>
                            <span style={{ backgroundColor: '#dc2626', color: '#ffffff', padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.65rem', fontWeight: 800 }}>
                              EMERGENCY
                            </span>
                          </div>
                        )}
                        {item.urgency === 'URGENT' && (
                          <div style={{ marginTop: '0.2rem' }}>
                            <span style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.65rem', fontWeight: 800 }}>
                              URGENT
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Patient Details */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <strong style={{ display: 'block', color: '#0f172a' }}>
                          {item.patient?.name}
                        </strong>
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                          {item.patient?.age}y &bull; {item.patient?.gender}
                        </span>
                        <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                          {item.patient?.hospitalName} {item.patient?.hospitalCaseNumber ? `(#${item.patient.hospitalCaseNumber})` : ''}
                        </div>
                      </td>

                      {/* Patient Group & Component */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                          <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 900, fontSize: '0.78rem' }}>
                            {item.patientBloodGroup}
                          </span>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>
                            {item.requestedComponent}
                          </span>
                        </div>
                        <span style={{ color: '#64748b', fontSize: '0.725rem' }}>
                          Requested: <strong>{item.unitsRequested} Unit(s)</strong>
                        </span>
                      </td>

                      {/* Sample Status */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {item.sample?.isSampleValid ? (
                          <div>
                            <span style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.725rem' }}>
                              Tube Verified
                            </span>
                            <div style={{ fontFamily: 'monospace', color: '#475569', fontSize: '0.725rem', marginTop: '0.2rem' }}>
                              {item.sample.sampleId}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.7rem' }}>
                              Ab Screen: <strong>{item.sample.antibodyScreenResult}</strong>
                            </div>
                          </div>
                        ) : item.status === CrossmatchStatus.INVALID_SAMPLE ? (
                          <div>
                            <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.725rem' }}>
                              Sample Rejected
                            </span>
                            <div style={{ color: '#b91c1c', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                              {item.sample?.sampleCondition}
                            </div>
                          </div>
                        ) : (
                          <span style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.725rem' }}>
                            Pending Verification
                          </span>
                        )}
                      </td>

                      {/* Assigned Unit */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {item.selectedUnit?.unitCode ? (
                          <div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                              {item.selectedUnit.unitCode}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                              <span style={{ backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 800, fontSize: '0.7rem' }}>
                                {item.selectedUnit.donorBloodGroup}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                {item.selectedUnit.componentType}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>None assigned</span>
                        )}
                      </td>

                      {/* Observed Result */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {item.laboratoryTest?.crossmatchResult ? (
                          <div>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                fontWeight: 800,
                                fontSize: '0.725rem',
                                backgroundColor:
                                  item.laboratoryTest.crossmatchResult === 'COMPATIBLE'
                                    ? '#dcfce7'
                                    : item.laboratoryTest.crossmatchResult === 'INCOMPATIBLE'
                                    ? '#fee2e2'
                                    : '#f1f5f9',
                                color:
                                  item.laboratoryTest.crossmatchResult === 'COMPATIBLE'
                                    ? '#15803d'
                                    : item.laboratoryTest.crossmatchResult === 'INCOMPATIBLE'
                                    ? '#b91c1c'
                                    : '#475569',
                                border:
                                  item.laboratoryTest.crossmatchResult === 'COMPATIBLE'
                                    ? '1px solid #86efac'
                                    : item.laboratoryTest.crossmatchResult === 'INCOMPATIBLE'
                                    ? '1px solid #fca5a5'
                                    : '1px solid #cbd5e1',
                              }}
                            >
                              {item.laboratoryTest.crossmatchResult}
                            </span>
                            {item.laboratoryTest.reactionGrade && (
                              <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                                Grade: <strong>{item.laboratoryTest.reactionGrade}</strong>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>Not tested</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            backgroundColor: statusConf.bg,
                            color: statusConf.text,
                            border: `1px solid ${statusConf.border}`,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {statusConf.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <Link
                          href={`${basePath}/crossmatching/${item._id}`}
                          style={{
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            textDecoration: 'none',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          Workstation &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              fontSize: '0.75rem',
              color: '#64748b',
            }}
          >
            <div>
              Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total records)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '0.35rem 0.75rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                  fontWeight: 600,
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '0.35rem 0.75rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                  fontWeight: 600,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reference Modal */}
      {showRbcModal && (
        <RbcCompatibilityReferencePanel
          isModal
          onClose={() => setShowRbcModal(false)}
        />
      )}

      {/* Start Crossmatch Modal */}
      {showStartModal && (
        <StartCrossmatchModal
          isOpen={showStartModal}
          onClose={() => setShowStartModal(false)}
          onSuccess={() => {
            loadData();
            loadMetrics();
          }}
        />
      )}
    </div>
  );
}
