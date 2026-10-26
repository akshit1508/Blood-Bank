'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams, usePathname } from 'next/navigation';
import {
  CrossmatchRecord,
  CrossmatchStatus,
  fetchCrossmatchById,
  reserveCrossmatchUnit,
  issueCrossmatchUnit,
  cancelCrossmatch,
  orderRepeatCrossmatch,
  evaluateComponentCompatibility,
} from '@/lib/crossmatching-api';
import { useAdminAuth } from '@/context/AdminAuthContext';
import RbcCompatibilityReferencePanel from '@/components/crossmatching/RbcCompatibilityReferencePanel';
import SampleVerificationModal from '@/components/crossmatching/SampleVerificationModal';
import UnitSelectionModal from '@/components/crossmatching/UnitSelectionModal';
import TestResultEntryModal from '@/components/crossmatching/TestResultEntryModal';
import ReviewAuthorizationModal from '@/components/crossmatching/ReviewAuthorizationModal';
import AuditTimeline from '@/components/crossmatching/AuditTimeline';

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
    text: '#475569',
    border: '#cbd5e1',
  },
  [CrossmatchStatus.CANCELLED]: {
    label: 'CANCELLED',
    bg: '#f8fafc',
    text: '#94a3b8',
    border: '#e2e8f0',
  },
};

export default function CrossmatchDetailsPage({
  params,
}: {
  params?: { id?: string };
}) {
  const routeParams = useParams();
  const crossmatchId = (routeParams?.id as string) || params?.id || '';
  const router = useRouter();
  const pathname = usePathname();
  const { admin } = useAdminAuth();
  const isLabPortal = pathname?.startsWith('/lab') || admin?.role === 'LAB_TECHNICIAN';
  const basePath = isLabPortal ? '/lab' : '/admin';

  const [crossmatch, setCrossmatch] = useState<CrossmatchRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [showRbcModal, setShowRbcModal] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Inline action states
  const [isReserving, setIsReserving] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);

  const loadRecord = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchCrossmatchById(crossmatchId);
      setCrossmatch(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve crossmatch details');
    } finally {
      setLoading(false);
    }
  }, [crossmatchId]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  const handleReserve = async () => {
    if (
      !confirm(
        'Are you sure you want to officially reserve this authorized compatible unit for the patient requisition?',
      )
    ) {
      return;
    }

    setIsReserving(true);
    setError(null);
    try {
      const updated = await reserveCrossmatchUnit(crossmatchId);
      setCrossmatch(updated);
      setActionSuccess(
        `Blood Unit ${updated.selectedUnit?.unitCode} reserved successfully under Reservation #${updated.reservationCode}`,
      );
    } catch (err: any) {
      setError(err.message || 'Failed to reserve crossmatched unit');
    } finally {
      setIsReserving(false);
    }
  };

  const handleIssue = async () => {
    const recipientName = prompt(
      'Confirm Recipient / Ward Nurse Name for clinical issue:',
      crossmatch?.patient.name || '',
    );
    if (recipientName === null) return;

    setIsIssuing(true);
    setError(null);
    try {
      const updated = await issueCrossmatchUnit(crossmatchId, {
        recipientName: recipientName.trim() || crossmatch?.patient.name,
      });
      setCrossmatch(updated);
      setActionSuccess(
        `Blood Unit ${updated.selectedUnit?.unitCode} issued successfully under Issue Code #${updated.issueCode}`,
      );
    } catch (err: any) {
      setError(err.message || 'Failed to issue crossmatched unit');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleCancel = async () => {
    const reason = prompt('Please specify the cancellation reason:');
    if (!reason || !reason.trim()) return;

    setIsCancelling(true);
    setError(null);
    try {
      const updated = await cancelCrossmatch(crossmatchId, reason.trim());
      setCrossmatch(updated);
      setActionSuccess(`Crossmatch cancelled: ${reason.trim()}`);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel crossmatch');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOrderRepeat = async () => {
    const reason = prompt(
      'Reason for ordering repeat crossmatch (e.g. Inconclusive result, new sample drawn, suspected discrepancy):',
    );
    if (!reason || !reason.trim()) return;

    setIsRepeating(true);
    setError(null);
    try {
      const repeat = await orderRepeatCrossmatch(crossmatchId, reason.trim());
      setActionSuccess(`Repeat crossmatch #${repeat.crossmatchCode} generated successfully.`);
      router.push(`${basePath}/crossmatching/${repeat._id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to order repeat crossmatch');
    } finally {
      setIsRepeating(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: '80px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: '#64748b',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#dc2626',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Loading crossmatching workstation...</span>
      </div>
    );
  }

  if (error && !crossmatch) {
    return (
      <div
        style={{
          maxWidth: '540px',
          margin: '48px auto',
          padding: '32px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            fontSize: '22px',
            fontWeight: 700,
          }}
        >
          !
        </div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
          Crossmatch Record Not Found
        </h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>{error}</p>
        <Link
          href={`${basePath}/crossmatching`}
          style={{
            display: 'inline-block',
            padding: '9px 18px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          ← Return to Crossmatching Queue
        </Link>
      </div>
    );
  }

  if (!crossmatch) return null;

  const compatibilityEval =
    crossmatch.selectedUnit?.donorBloodGroup && crossmatch.requestedComponent
      ? evaluateComponentCompatibility(
          crossmatch.selectedUnit.donorBloodGroup,
          crossmatch.patientBloodGroup,
          crossmatch.requestedComponent,
        )
      : null;

  const isComponentIncompatible = Boolean(compatibilityEval && !compatibilityEval.compatible);

  const currentBadge =
    STATUS_BADGES[crossmatch.status] || {
      label: crossmatch.status,
      bg: '#f1f5f9',
      text: '#475569',
      border: '#cbd5e1',
    };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '14px',
    borderBottom: '1px solid #f1f5f9',
  };

  const stepNumberStyle = (bg: string, color: string): React.CSSProperties => ({
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    backgroundColor: bg,
    color: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '13px',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '60px' }}>
      {/* Top Breadcrumb & Action Banner */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
            <Link
              href={`${basePath}/crossmatching`}
              style={{ color: '#64748b', textDecoration: 'none', fontWeight: 500 }}
            >
              Crossmatching Queue
            </Link>
            <span>/</span>
            <span style={{ fontFamily: 'monospace', color: '#0f172a', fontWeight: 600 }}>
              {crossmatch.crossmatchCode}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 800,
                color: '#0f172a',
                fontFamily: 'monospace',
                letterSpacing: '-0.02em',
              }}
            >
              {crossmatch.crossmatchCode}
            </h1>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: currentBadge.bg,
                color: currentBadge.text,
                border: `1px solid ${currentBadge.border}`,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {currentBadge.label}
            </span>
            {crossmatch.urgency === 'CRITICAL_EMERGENCY' && (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
                }}
              >
                CRITICAL EMERGENCY
              </span>
            )}
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowRbcModal(true)}
            style={{
              padding: '9px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#b91c1c',
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🩸</span> RBC Reference
          </button>

          {/* Step Actions based on workflow stage */}
          {(!crossmatch.sample?.isSampleValid ||
            crossmatch.status === CrossmatchStatus.PENDING_SAMPLE_VERIFICATION) && (
            <button
              type="button"
              onClick={() => setShowSampleModal(true)}
              style={{
                padding: '9px 16px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              Verify Patient Sample
            </button>
          )}

          {crossmatch.sample?.isSampleValid && !crossmatch.selectedUnit?.unitCode && (
            <button
              type="button"
              onClick={() => setShowUnitModal(true)}
              style={{
                padding: '9px 16px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: '#4f46e5',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
              }}
            >
              Select Candidate Unit
            </button>
          )}

          {crossmatch.selectedUnit?.unitCode &&
            [CrossmatchStatus.UNIT_SELECTED, CrossmatchStatus.TESTING_IN_PROGRESS].includes(
              crossmatch.status,
            ) && (
              <button
                type="button"
                onClick={() => setShowResultModal(true)}
                style={{
                  padding: '9px 16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#ffffff',
                  backgroundColor: '#7c3aed',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(124, 58, 237, 0.25)',
                }}
              >
                Record Physical Test
              </button>
            )}

          {crossmatch.status === CrossmatchStatus.RESULT_RECORDED && (
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              style={{
                padding: '9px 16px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: '#16a34a',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
              }}
            >
              Review & Authorize
            </button>
          )}

          {crossmatch.status === CrossmatchStatus.AUTHORIZED_COMPATIBLE && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                disabled={isReserving || isComponentIncompatible}
                onClick={handleReserve}
                title={
                  isComponentIncompatible
                    ? compatibilityEval?.reason
                    : 'Reserve Unit for Patient'
                }
                style={{
                  padding: '9px 16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#ffffff',
                  backgroundColor: isComponentIncompatible ? '#94a3b8' : '#0d9488',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isReserving || isComponentIncompatible ? 'not-allowed' : 'pointer',
                  opacity: isReserving ? 0.6 : 1,
                  boxShadow: isComponentIncompatible
                    ? 'none'
                    : '0 2px 4px rgba(13, 148, 136, 0.25)',
                }}
              >
                {isReserving
                  ? 'Reserving...'
                  : isComponentIncompatible
                  ? 'Reservation Blocked (Component Incompatible)'
                  : 'Reserve Unit for Patient'}
              </button>
              {isComponentIncompatible && (
                <button
                  type="button"
                  onClick={() => setShowUnitModal(true)}
                  style={{
                    padding: '9px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                    backgroundColor: '#dc2626',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                  }}
                >
                  Change Unit
                </button>
              )}
            </div>
          )}

          {crossmatch.status === CrossmatchStatus.RESERVED && (
            <button
              type="button"
              disabled={isIssuing}
              onClick={handleIssue}
              style={{
                padding: '9px 16px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: '#dc2626',
                border: 'none',
                borderRadius: '8px',
                cursor: isIssuing ? 'not-allowed' : 'pointer',
                opacity: isIssuing ? 0.6 : 1,
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
              }}
            >
              {isIssuing ? 'Issuing...' : 'Issue Blood to Ward'}
            </button>
          )}

          {/* Repeat Test Button */}
          {crossmatch.status !== CrossmatchStatus.ISSUED && (
            <button
              type="button"
              disabled={isRepeating}
              onClick={handleOrderRepeat}
              style={{
                padding: '9px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: isRepeating ? 'not-allowed' : 'pointer',
              }}
            >
              {isRepeating ? 'Ordering...' : 'Order Repeat Test'}
            </button>
          )}

          {/* Cancellation Button */}
          {![CrossmatchStatus.ISSUED, CrossmatchStatus.CANCELLED].includes(crossmatch.status) && (
            <button
              type="button"
              disabled={isCancelling}
              onClick={handleCancel}
              style={{
                padding: '9px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#dc2626',
                backgroundColor: '#fff5f5',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                cursor: isCancelling ? 'not-allowed' : 'pointer',
              }}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Action Banners */}
      {actionSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            fontSize: '13px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#16a34a',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '13px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#dc2626',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main 10 Sections Responsive Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Area (Sections 1 through 9) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section 1 & 2: Patient and Blood Request Details */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={stepNumberStyle('#eff6ff', '#2563eb')}>1</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    Patient & Requisition Profile
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                    Section 1 & 2 • Clinical request and historical typing
                  </p>
                </div>
              </div>
              {!isLabPortal ? (
                <Link
                  href="/admin/blood-requests"
                  style={{
                    fontSize: '12px',
                    color: '#dc2626',
                    textDecoration: 'none',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                  }}
                >
                  Req #{crossmatch.requestCode} →
                </Link>
              ) : (
                <span
                  style={{
                    fontSize: '12px',
                    color: '#64748b',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                  }}
                >
                  Req #{crossmatch.requestCode}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '14px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Patient Name:
                </span>
                <strong style={{ color: '#0f172a', fontSize: '13px' }}>{crossmatch.patient.name}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Age & Gender:
                </span>
                <span style={{ color: '#334155' }}>
                  {crossmatch.patient.age} years / {crossmatch.patient.gender}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Patient Blood Group:
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 800,
                    fontSize: '13px',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                  }}
                >
                  {crossmatch.patientBloodGroup}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Requested Product:
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                  }}
                >
                  {crossmatch.requestedComponent} ({crossmatch.unitsRequested} unit(s))
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Hospital Facility:
                </span>
                <span style={{ color: '#334155' }}>
                  {crossmatch.patient.hospitalName || 'Main Hospital'}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Attending Doctor:
                </span>
                <span style={{ color: '#334155' }}>
                  {crossmatch.patient.doctorName || 'Dr. On Duty'}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Hospital Case Number:
                </span>
                <span style={{ fontFamily: 'monospace', color: '#334155' }}>
                  {crossmatch.patient.hospitalCaseNumber || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Priority Urgency:
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      crossmatch.urgency === 'CRITICAL_EMERGENCY' ? '#dc2626' : '#d97706',
                  }}
                >
                  {crossmatch.urgency}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3 & 4: Patient Sample Identification & Antibody Screen */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={stepNumberStyle('#fef3c7', '#d97706')}>2</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    Patient Sample & Pre-Transfusion Testing
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                    Section 3 & 4 • Tube integrity, validity, and alloantibody screening
                  </p>
                </div>
              </div>

              {crossmatch.sample?.isSampleValid ? (
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  Sample Validated
                </span>
              ) : crossmatch.status === CrossmatchStatus.INVALID_SAMPLE ? (
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                  }}
                >
                  Sample Rejected
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSampleModal(true)}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Verify Now
                </button>
              )}
            </div>

            {crossmatch.sample?.sampleId ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '14px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                    Sample Tube ID:
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>
                    {crossmatch.sample.sampleId}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                    Tube Condition:
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        crossmatch.sample.sampleCondition === 'VALID' ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {crossmatch.sample.sampleCondition}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                    Antibody Screen:
                  </span>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      backgroundColor:
                        crossmatch.sample.antibodyScreenResult === 'NEGATIVE'
                          ? '#dcfce7'
                          : '#fee2e2',
                      color:
                        crossmatch.sample.antibodyScreenResult === 'NEGATIVE'
                          ? '#15803d'
                          : '#b91c1c',
                    }}
                  >
                    {crossmatch.sample.antibodyScreenResult}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                    Identity Verification:
                  </span>
                  <span style={{ color: '#334155' }}>
                    {crossmatch.sample.sampleIdentityVerified
                      ? 'Confirmed on Wristband'
                      : 'Unverified'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                    Collected Timestamp:
                  </span>
                  <span style={{ color: '#334155' }}>
                    {crossmatch.sample.sampleCollectedAt
                      ? new Date(crossmatch.sample.sampleCollectedAt).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                    Lab Received:
                  </span>
                  <span style={{ color: '#334155' }}>
                    {crossmatch.sample.sampleReceivedAt
                      ? new Date(crossmatch.sample.sampleReceivedAt).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                    Verified By:
                  </span>
                  <span style={{ color: '#334155' }}>
                    {crossmatch.sample.sampleVerifiedByName || 'Lab Tech'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                    Verified Typing:
                  </span>
                  <strong style={{ color: '#b91c1c' }}>
                    {crossmatch.sample.verifiedAboRh || crossmatch.patientBloodGroup}
                  </strong>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#64748b',
                  textAlign: 'center',
                }}
              >
                Patient sample has not been accessioned or verified. Complete accessioning to proceed to unit selection.
              </div>
            )}

            {crossmatch.sample?.antibodyScreenNotes && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#92400e',
                }}
              >
                <strong>Alloantibody Screening Finding:</strong> {crossmatch.sample.antibodyScreenNotes}
              </div>
            )}
          </div>

          {/* Section 5 & 6: Selected Donor Blood Unit */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={stepNumberStyle('#ede9fe', '#6d28d9')}>3</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    Selected Donor Blood Unit
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                    Section 5 & 6 • Inventory traceability, quarantine release, and ABO/RhD match
                  </p>
                </div>
              </div>

              {crossmatch.selectedUnit?.unitCode ? (
                <button
                  type="button"
                  onClick={() => setShowUnitModal(true)}
                  disabled={['RESERVED', 'ISSUED', 'CANCELLED'].includes(crossmatch.status)}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: ['RESERVED', 'ISSUED', 'CANCELLED'].includes(crossmatch.status)
                      ? 'not-allowed'
                      : 'pointer',
                    opacity: ['RESERVED', 'ISSUED', 'CANCELLED'].includes(crossmatch.status)
                      ? 0.4
                      : 1,
                  }}
                >
                  Change Unit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUnitModal(true)}
                  disabled={!crossmatch.sample?.isSampleValid}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: '#4f46e5',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: !crossmatch.sample?.isSampleValid ? 'not-allowed' : 'pointer',
                    opacity: !crossmatch.sample?.isSampleValid ? 0.4 : 1,
                  }}
                >
                  Select Unit
                </button>
              )}
            </div>

            {crossmatch.selectedUnit?.unitCode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '14px',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Unit Code / Barcode:
                    </span>
                    <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: '#0f172a' }}>
                      {crossmatch.selectedUnit.unitCode}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Donor Blood Group:
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 800,
                        fontSize: '13px',
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                      }}
                    >
                      {crossmatch.selectedUnit.donorBloodGroup}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Component Type:
                    </span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      {crossmatch.selectedUnit.componentType}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      ABO/RhD Compatibility:
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: isComponentIncompatible
                          ? '#fee2e2'
                          : crossmatch.selectedUnit.isAboRhCompatible
                          ? '#dcfce7'
                          : '#fee2e2',
                        color: isComponentIncompatible
                          ? '#b91c1c'
                          : crossmatch.selectedUnit.isAboRhCompatible
                          ? '#15803d'
                          : '#b91c1c',
                        border: isComponentIncompatible
                          ? '1px solid #fca5a5'
                          : 'none',
                      }}
                    >
                      {isComponentIncompatible
                        ? `INCOMPATIBLE FOR ${crossmatch.requestedComponent}`
                        : crossmatch.selectedUnit.isAboRhCompatible
                        ? 'COMPATIBLE GROUP'
                        : 'INCOMPATIBLE GROUP'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Expiry Date:
                    </span>
                    <span style={{ color: '#334155' }}>
                      {crossmatch.selectedUnit.expiryDate
                        ? crossmatch.selectedUnit.expiryDate.slice(0, 10)
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Storage Location:
                    </span>
                    <span style={{ color: '#334155' }}>
                      {crossmatch.selectedUnit.storageLocation || 'Main Blood Bank'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Assigned Timestamp:
                    </span>
                    <span style={{ color: '#334155' }}>
                      {crossmatch.selectedUnit.unitSelectedAt
                        ? new Date(crossmatch.selectedUnit.unitSelectedAt).toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Assigned By:
                    </span>
                    <span style={{ color: '#334155' }}>
                      {crossmatch.selectedUnit.unitSelectedByName || 'Staff'}
                    </span>
                  </div>
                </div>

                {isComponentIncompatible && compatibilityEval && (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fca5a5',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#991b1b',
                      lineHeight: 1.5,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        color: '#b91c1c',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>⚠️</span> COMPONENT INCOMPATIBILITY WARNING
                    </div>
                    <p style={{ margin: 0 }}>{compatibilityEval.reason}</p>
                  </div>
                )}

                {crossmatch.selectedUnit.compatibilityRuleReference && !isComponentIncompatible && (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#1e40af',
                    }}
                  >
                    <strong>Rule Guidance:</strong> {crossmatch.selectedUnit.compatibilityRuleReference}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#64748b',
                  textAlign: 'center',
                }}
              >
                No donor blood unit currently assigned. Inspect available released inventory to select an eligible candidate unit.
              </div>
            )}
          </div>

          {/* Section 7 & 8: Laboratory Crossmatch Test & Review Sign-off */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={stepNumberStyle('#f3e8ff', '#7e22ce')}>4</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    Laboratory Crossmatch & Clinical Authorization
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                    Section 7 & 8 • Physical serological testing, agglutination grading, and supervisory review
                  </p>
                </div>
              </div>

              {crossmatch.laboratoryTest?.crossmatchResult &&
              crossmatch.laboratoryTest.crossmatchResult !== 'PENDING' ? (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    backgroundColor:
                      crossmatch.laboratoryTest.crossmatchResult === 'COMPATIBLE'
                        ? '#dcfce7'
                        : '#fee2e2',
                    color:
                      crossmatch.laboratoryTest.crossmatchResult === 'COMPATIBLE'
                        ? '#15803d'
                        : '#b91c1c',
                    border: `1px solid ${
                      crossmatch.laboratoryTest.crossmatchResult === 'COMPATIBLE'
                        ? '#86efac'
                        : '#fca5a5'
                    }`,
                  }}
                >
                  {crossmatch.laboratoryTest.crossmatchResult}
                </span>
              ) : crossmatch.selectedUnit?.unitCode ? (
                <button
                  type="button"
                  onClick={() => setShowResultModal(true)}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: '#7c3aed',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Record Result
                </button>
              ) : null}
            </div>

            {crossmatch.laboratoryTest?.crossmatchResult &&
            crossmatch.laboratoryTest.crossmatchResult !== 'PENDING' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '14px',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Technique / Method:
                    </span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      {crossmatch.laboratoryTest.testMethod}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Reaction Grade:
                    </span>
                    <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                      {crossmatch.laboratoryTest.reactionGrade || '0'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Testing Date & Time:
                    </span>
                    <span style={{ color: '#334155' }}>
                      {crossmatch.laboratoryTest.testedAt
                        ? new Date(crossmatch.laboratoryTest.testedAt).toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>
                      Testing Technician:
                    </span>
                    <span style={{ color: '#334155' }}>
                      {crossmatch.laboratoryTest.testedByName || 'Lab Technician'}
                    </span>
                  </div>
                </div>

                {crossmatch.laboratoryTest.testPhases &&
                  crossmatch.laboratoryTest.testPhases.length > 0 && (
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                        Validated Procedure Phases:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {crossmatch.laboratoryTest.testPhases.map((phase) => (
                          <span
                            key={phase}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {phase}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {crossmatch.laboratoryTest.testingNotes && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: '#334155',
                      backgroundColor: '#f8fafc',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Laboratory Observations:</strong> {crossmatch.laboratoryTest.testingNotes}
                  </p>
                )}

                {/* Section 8: Review & Authorization Sign-off Box */}
                <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Clinical Supervisory Review & Authorization
                    </span>
                    {crossmatch.status === CrossmatchStatus.RESULT_RECORDED && (
                      <button
                        type="button"
                        onClick={() => setShowReviewModal(true)}
                        style={{
                          padding: '5px 12px',
                          backgroundColor: '#16a34a',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Authorize Release
                      </button>
                    )}
                  </div>

                  {crossmatch.review?.reviewedAt ? (
                    <div
                      style={{
                        padding: '14px 16px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b' }}>Review Decision:</span>
                        <span
                          style={{
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor:
                              crossmatch.review.reviewDecision === 'COMPATIBLE_AUTHORIZED'
                                ? '#dcfce7'
                                : '#fee2e2',
                            color:
                              crossmatch.review.reviewDecision === 'COMPATIBLE_AUTHORIZED'
                                ? '#15803d'
                                : '#b91c1c',
                          }}
                        >
                          {crossmatch.review.reviewDecision}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b' }}>Authorized By:</span>
                        <strong style={{ color: '#0f172a' }}>
                          {crossmatch.review.reviewedByName} ({crossmatch.review.reviewedByRole})
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b' }}>Timestamp:</span>
                        <span style={{ color: '#334155' }}>
                          {new Date(crossmatch.review.reviewedAt).toLocaleString()}
                        </span>
                      </div>
                      {crossmatch.review.reviewNotes && (
                        <p
                          style={{
                            margin: '6px 0 0 0',
                            paddingTop: '8px',
                            borderTop: '1px solid #e2e8f0',
                            color: '#475569',
                            fontStyle: 'italic',
                          }}
                        >
                          &ldquo;{crossmatch.review.reviewNotes}&rdquo;
                        </p>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#92400e',
                      }}
                    >
                      Awaiting supervisory sign-off. Blood unit cannot be reserved or issued until clinical authorization is finalized.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#64748b',
                  textAlign: 'center',
                }}
              >
                Serological crossmatch test has not been recorded yet.
              </div>
            )}
          </div>

          {/* Section 9: Reservation & Blood Issue Status */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={stepNumberStyle('#ccfbf1', '#0f766e')}>5</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    Reservation & Blood Issue Integration
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                    Section 9 • Atomic inventory locking and clinical issue
                  </p>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Inventory Reservation:</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: crossmatch.reservationCode ? '#ccfbf1' : '#f1f5f9',
                      color: crossmatch.reservationCode ? '#0f766e' : '#64748b',
                    }}
                  >
                    {crossmatch.reservationCode ? 'RESERVED' : 'NOT RESERVED'}
                  </span>
                </div>
                {crossmatch.reservationCode ? (
                  <div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#0f172a',
                      }}
                    >
                      {crossmatch.reservationCode}
                    </div>
                    <div style={{ color: '#64748b', marginTop: '4px' }}>
                      Reserved At:{' '}
                      {crossmatch.reservedAt
                        ? new Date(crossmatch.reservedAt).toLocaleString()
                        : 'N/A'}
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, color: '#94a3b8' }}>Unit will be locked atomically upon reservation.</p>
                )}
              </div>

              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Blood Issue Transfusion:</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: crossmatch.issueCode ? '#dcfce7' : '#f1f5f9',
                      color: crossmatch.issueCode ? '#15803d' : '#64748b',
                    }}
                  >
                    {crossmatch.issueCode ? 'COMPLETED ISSUE' : 'AWAITING ISSUE'}
                  </span>
                </div>
                {crossmatch.issueCode ? (
                  <div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#0f172a',
                      }}
                    >
                      {crossmatch.issueCode}
                    </div>
                    <div style={{ color: '#64748b', marginTop: '4px' }}>
                      Delivered:{' '}
                      {crossmatch.issuedAt
                        ? new Date(crossmatch.issuedAt).toLocaleString()
                        : 'N/A'}
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, color: '#94a3b8' }}>
                    Blood issue desk generates invoice and releases unit to recipient ward.
                  </p>
                )}
              </div>
            </div>

            {isComponentIncompatible && compatibilityEval && !crossmatch.reservationCode && (
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fca5a5',
                  borderRadius: '10px',
                  color: '#991b1b',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    color: '#b91c1c',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>⛔</span> CLINICAL SAFETY HOLD — RESERVATION BLOCKED
                </div>
                <p style={{ margin: 0 }}>
                  Although serological crossmatch testing recorded no agglutination (COMPATIBLE), this unit is{' '}
                  <strong>
                    {crossmatch.selectedUnit?.donorBloodGroup} {crossmatch.selectedUnit?.componentType}
                  </strong>{' '}
                  for an <strong>{crossmatch.patientBloodGroup}</strong> patient requisition requesting{' '}
                  <strong>{crossmatch.requestedComponent}</strong>.
                </p>
                <p style={{ margin: '6px 0 0 0', fontWeight: 600 }}>
                  <strong>Safety Policy:</strong> {compatibilityEval.reason}
                </p>
                <p style={{ margin: '6px 0 0 0' }}>
                  Reservation and blood issue are strictly blocked by Blood Bank safety policy. Please click{' '}
                  <button
                    type="button"
                    onClick={() => setShowUnitModal(true)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#b91c1c',
                      fontWeight: 800,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '12px',
                    }}
                  >
                    Change Unit
                  </button>{' '}
                  to re-assign an identical or clinically compliant unit.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Section 10 Complete Audit Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={stepNumberStyle('#fee2e2', '#dc2626')}>10</div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  Append-Only Audit Timeline
                </h3>
              </div>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                {crossmatch.timeline?.length || 0} events
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Complete traceable history of state transitions, actor attribution, and timestamps:
            </p>

            <AuditTimeline timeline={crossmatch.timeline} />
          </div>
        </div>
      </div>

      {/* Modals */}
      {showRbcModal && (
        <RbcCompatibilityReferencePanel
          initialPatientGroup={crossmatch.patientBloodGroup}
          isModal
          onClose={() => setShowRbcModal(false)}
        />
      )}

      {showSampleModal && (
        <SampleVerificationModal
          crossmatchId={crossmatch._id}
          crossmatchCode={crossmatch.crossmatchCode}
          patientName={crossmatch.patient.name}
          initialPatientBloodGroup={crossmatch.patientBloodGroup}
          initialSampleId={crossmatch.sample?.sampleId}
          isOpen={showSampleModal}
          onClose={() => setShowSampleModal(false)}
          onSuccess={() => {
            loadRecord();
            setActionSuccess('Patient sample verified successfully.');
          }}
        />
      )}

      {showUnitModal && (
        <UnitSelectionModal
          crossmatchId={crossmatch._id}
          crossmatchCode={crossmatch.crossmatchCode}
          patientBloodGroup={crossmatch.patientBloodGroup}
          requestedComponent={crossmatch.requestedComponent}
          isOpen={showUnitModal}
          onClose={() => setShowUnitModal(false)}
          onSuccess={() => {
            loadRecord();
            setActionSuccess('Donor unit selected for crossmatch.');
          }}
        />
      )}

      {showResultModal && (
        <TestResultEntryModal
          crossmatchId={crossmatch._id}
          crossmatchCode={crossmatch.crossmatchCode}
          patientName={crossmatch.patient.name}
          patientBloodGroup={crossmatch.patientBloodGroup}
          selectedUnitCode={crossmatch.selectedUnit?.unitCode}
          selectedUnitGroup={crossmatch.selectedUnit?.donorBloodGroup}
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onSuccess={() => {
            loadRecord();
            setActionSuccess('Laboratory test result recorded.');
          }}
        />
      )}

      {showReviewModal && (
        <ReviewAuthorizationModal
          crossmatchId={crossmatch._id}
          crossmatchCode={crossmatch.crossmatchCode}
          patientName={crossmatch.patient.name}
          patientBloodGroup={crossmatch.patientBloodGroup}
          unitCode={crossmatch.selectedUnit?.unitCode || ''}
          unitBloodGroup={crossmatch.selectedUnit?.donorBloodGroup || ''}
          testMethod={crossmatch.laboratoryTest?.testMethod}
          recordedResult={crossmatch.laboratoryTest?.crossmatchResult}
          performedById={crossmatch.laboratoryTest?.testedBy}
          performedByName={crossmatch.laboratoryTest?.testedByName}
          currentUserId={admin?.id || (admin as any)?._id}
          currentUserRole={admin?.role}
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            loadRecord();
            setActionSuccess('Clinical review decision recorded.');
          }}
        />
      )}
    </div>
  );
}
