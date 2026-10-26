'use client';

import React, { useState } from 'react';
import {
  ReviewDecision,
  CrossmatchResult,
  reviewCrossmatch,
} from '@/lib/crossmatching-api';

interface ReviewAuthorizationModalProps {
  crossmatchId: string;
  crossmatchCode: string;
  patientName: string;
  patientBloodGroup: string;
  unitCode: string;
  unitBloodGroup: string;
  testMethod?: string;
  recordedResult: CrossmatchResult;
  performedById?: string;
  performedByName?: string;
  currentUserId?: string;
  currentUserRole?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewAuthorizationModal({
  crossmatchId,
  crossmatchCode,
  patientName,
  patientBloodGroup,
  unitCode,
  unitBloodGroup,
  testMethod,
  recordedResult,
  performedById,
  performedByName,
  currentUserId,
  currentUserRole,
  isOpen,
  onClose,
  onSuccess,
}: ReviewAuthorizationModalProps) {
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>(
    recordedResult === CrossmatchResult.COMPATIBLE
      ? ReviewDecision.COMPATIBLE_AUTHORIZED
      : ReviewDecision.INCOMPATIBLE_REJECTED,
  );
  const [reviewNotes, setReviewNotes] = useState('');
  const [checklist, setChecklist] = useState({
    patientIdentityConfirmed: false,
    sampleIntegrityConfirmed: false,
    unitTraceabilityConfirmed: false,
    testingMethodVerified: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Independent review policy check
  const isSameTechnician =
    performedById &&
    currentUserId &&
    performedById === currentUserId &&
    currentUserRole !== 'SUPER_ADMIN';

  const allChecksConfirmed =
    checklist.patientIdentityConfirmed &&
    checklist.sampleIntegrityConfirmed &&
    checklist.unitTraceabilityConfirmed &&
    checklist.testingMethodVerified;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSameTechnician) {
      setError(
        'Independent Review Policy Violation: The laboratory technician who performed this crossmatch test cannot self-authorize the clinical result. A separate reviewing officer or supervisor is required.',
      );
      return;
    }

    if (!allChecksConfirmed) {
      setError('All four clinical verification safety gates must be explicitly confirmed before authorization.');
      return;
    }

    if (!reviewNotes.trim()) {
      setError('Clinical authorization notes and rationale are required.');
      return;
    }

    setLoading(true);

    try {
      await reviewCrossmatch(crossmatchId, {
        reviewDecision,
        reviewNotes: reviewNotes.trim(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review authorization');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    fontSize: '13px',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#334155',
    marginBottom: '6px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📋</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Clinical Review & Authorization
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Crossmatch <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{crossmatchCode}</span> • Performed By:{' '}
              <strong style={{ color: '#ffffff' }}>{performedByName || 'Lab Tech'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {error && (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '12px',
                borderRadius: '8px',
              }}
            >
              {error}
            </div>
          )}

          {/* Independent Review Warning */}
          {isSameTechnician && (
            <div
              style={{
                padding: '14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚠️ Independent Review Violation Block
              </div>
              <p style={{ margin: '0 0 4px 0' }}>
                You are currently logged in as <strong>{performedByName}</strong>, the laboratory technician who executed this physical crossmatch.
              </p>
              <p style={{ margin: 0, color: '#b91c1c' }}>
                Blood safety SOP mandates segregation of duties: An independent laboratory supervisor or Operations Admin must review and authorize this compatibility release.
              </p>
            </div>
          )}

          {/* Clinical Case Summary Card */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              fontSize: '12px',
            }}
          >
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Patient:</span>
              <strong style={{ color: '#0f172a' }}>{patientName} ({patientBloodGroup})</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Donor Blood Unit:</span>
              <strong style={{ color: '#0f172a' }}>{unitCode} ({unitBloodGroup})</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Testing Technique:</span>
              <span style={{ color: '#334155', fontFamily: 'monospace' }}>{testMethod || 'Gel Card'}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Recorded Observed Result:</span>
              <span
                style={{
                  display: 'inline-block',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor:
                    recordedResult === CrossmatchResult.COMPATIBLE ? '#dcfce7' : '#fee2e2',
                  color:
                    recordedResult === CrossmatchResult.COMPATIBLE ? '#15803d' : '#b91c1c',
                  border: `1px solid ${
                    recordedResult === CrossmatchResult.COMPATIBLE ? '#bbf7d0' : '#fecaca'
                  }`,
                }}
              >
                {recordedResult}
              </span>
            </div>
          </div>

          {/* Mandatory Verification Checklist */}
          <div>
            <label
              style={{
                ...labelStyle,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontSize: '11px',
              }}
            >
              Mandatory Reviewer Verification Gates:
            </label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist.patientIdentityConfirmed}
                  onChange={(e) =>
                    setChecklist({ ...checklist, patientIdentityConfirmed: e.target.checked })
                  }
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626', cursor: 'pointer' }}
                />
                <span style={{ color: '#334155' }}>
                  Patient requisition, hospital case number, and ABO/Rh typing confirmed accurate.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist.sampleIntegrityConfirmed}
                  onChange={(e) =>
                    setChecklist({ ...checklist, sampleIntegrityConfirmed: e.target.checked })
                  }
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626', cursor: 'pointer' }}
                />
                <span style={{ color: '#334155' }}>
                  Patient sample accessioning, tube integrity, and antibody screen confirmed.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist.unitTraceabilityConfirmed}
                  onChange={(e) =>
                    setChecklist({ ...checklist, unitTraceabilityConfirmed: e.target.checked })
                  }
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626', cursor: 'pointer' }}
                />
                <span style={{ color: '#334155' }}>
                  Donor unit label, component integrity, quarantine release, and expiry date verified.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist.testingMethodVerified}
                  onChange={(e) =>
                    setChecklist({ ...checklist, testingMethodVerified: e.target.checked })
                  }
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626', cursor: 'pointer' }}
                />
                <span style={{ color: '#334155' }}>
                  Serological/gel methodology, phases, and negative autocontrol validated.
                </span>
              </label>
            </div>
          </div>

          {/* Authorization Decision */}
          <div>
            <label style={labelStyle}>
              Clinical Review Decision <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={reviewDecision}
              onChange={(e) => setReviewDecision(e.target.value as ReviewDecision)}
              style={{
                ...inputStyle,
                fontWeight: 700,
              }}
            >
              {recordedResult === CrossmatchResult.COMPATIBLE && (
                <option value={ReviewDecision.COMPATIBLE_AUTHORIZED}>
                  COMPATIBLE_AUTHORIZED (Authorize Blood Unit for Reservation & Routine Issue)
                </option>
              )}
              <option value={ReviewDecision.INCOMPATIBLE_REJECTED}>
                INCOMPATIBLE_REJECTED (Reject Unit / Incompatible Agglutination Observed)
              </option>
              <option value={ReviewDecision.REPEAT_REQUIRED}>
                REPEAT_REQUIRED (Order Repeat / Confirmatory Crossmatch)
              </option>
              <option value={ReviewDecision.SAFETY_HOLD}>
                SAFETY_HOLD (Safety Hold / Medical Officer Review Required)
              </option>
            </select>
          </div>

          {/* Review Notes */}
          <div>
            <label style={labelStyle}>
              Reviewer Documentation & Clinical Rationale <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="State clinical authorization rationale, confirming absence of agglutination or reason for rejection..."
              style={{
                ...inputStyle,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Footer buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid #e2e8f0',
              marginTop: '8px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isSameTechnician || !allChecksConfirmed}
              style={{
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: '#dc2626',
                border: 'none',
                borderRadius: '8px',
                cursor:
                  loading || isSameTechnician || !allChecksConfirmed
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  loading || isSameTechnician || !allChecksConfirmed ? 0.5 : 1,
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
              }}
            >
              {loading ? 'Submitting...' : 'Sign & Authorize Crossmatch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
