'use client';

import React, { useState } from 'react';
import {
  SampleCondition,
  AntibodyScreenResult,
  verifyCrossmatchSample,
} from '@/lib/crossmatching-api';

interface SampleVerificationModalProps {
  crossmatchId: string;
  crossmatchCode: string;
  patientName: string;
  initialPatientBloodGroup: string;
  initialSampleId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SampleVerificationModal({
  crossmatchId,
  crossmatchCode,
  patientName,
  initialPatientBloodGroup,
  initialSampleId = '',
  isOpen,
  onClose,
  onSuccess,
}: SampleVerificationModalProps) {
  const [sampleId, setSampleId] = useState(
    initialSampleId || `SMP-${Date.now().toString().slice(-6)}`,
  );
  const [sampleCollectedAt, setSampleCollectedAt] = useState(
    new Date(Date.now() - 3600000).toISOString().slice(0, 16),
  );
  const [sampleReceivedAt, setSampleReceivedAt] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [sampleCondition, setSampleCondition] = useState<SampleCondition>(
    SampleCondition.VALID,
  );
  const [sampleIdentityVerified, setSampleIdentityVerified] = useState(true);
  const [verifiedAboRh, setVerifiedAboRh] = useState(
    initialPatientBloodGroup || 'A+',
  );
  const [antibodyScreenResult, setAntibodyScreenResult] =
    useState<AntibodyScreenResult>(AntibodyScreenResult.NEGATIVE);
  const [antibodyScreenNotes, setAntibodyScreenNotes] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!sampleId.trim()) {
        throw new Error('Unique sample ID is required.');
      }

      await verifyCrossmatchSample(crossmatchId, {
        sampleId: sampleId.trim(),
        sampleCollectedAt,
        sampleReceivedAt,
        sampleCondition,
        sampleIdentityVerified,
        verifiedAboRh,
        antibodyScreenResult,
        antibodyScreenNotes: antibodyScreenNotes.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record sample verification');
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
        {/* Modal Header */}
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
              <span style={{ fontSize: '18px' }}>🧪</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Patient Sample Verification & Accessioning
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Crossmatch <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{crossmatchCode}</span> • Patient:{' '}
              <strong style={{ color: '#ffffff' }}>{patientName}</strong>
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

        {/* Modal Form */}
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <label style={labelStyle}>
                Unique Sample Tube ID <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={sampleId}
                onChange={(e) => setSampleId(e.target.value)}
                placeholder="e.g. SMP-20261026-001"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Verified Patient ABO/Rh Typing <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={verifiedAboRh}
                onChange={(e) => setVerifiedAboRh(e.target.value)}
                style={inputStyle}
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Phlebotomy Collection Time <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={sampleCollectedAt}
                onChange={(e) => setSampleCollectedAt(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Laboratory Receipt Time <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={sampleReceivedAt}
                onChange={(e) => setSampleReceivedAt(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Physical Tube Condition / Integrity <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={sampleCondition}
                onChange={(e) => setSampleCondition(e.target.value as SampleCondition)}
                style={inputStyle}
              >
                <option value={SampleCondition.VALID}>VALID (Intact & Suitable)</option>
                <option value={SampleCondition.HEMOLYZED}>HEMOLYZED (Reject)</option>
                <option value={SampleCondition.LIPEMIC}>LIPEMIC (Reject)</option>
                <option value={SampleCondition.ICTERIC}>ICTERIC (Review)</option>
                <option value={SampleCondition.INSUFFICIENT_VOLUME}>INSUFFICIENT_VOLUME (Reject)</option>
                <option value={SampleCondition.INCORRECTLY_LABELLED}>INCORRECTLY_LABELLED (Reject)</option>
                <option value={SampleCondition.EXPIRED}>EXPIRED (Reject)</option>
                <option value={SampleCondition.CLOTTED}>CLOTTED (Reject)</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Antibody Screening Result <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={antibodyScreenResult}
                onChange={(e) => setAntibodyScreenResult(e.target.value as AntibodyScreenResult)}
                style={inputStyle}
              >
                <option value={AntibodyScreenResult.NEGATIVE}>NEGATIVE (No clinically significant antibodies)</option>
                <option value={AntibodyScreenResult.POSITIVE}>POSITIVE (Alloantibodies detected)</option>
                <option value={AntibodyScreenResult.INCONCLUSIVE}>INCONCLUSIVE (Awaiting workup)</option>
                <option value={AntibodyScreenResult.NOT_PERFORMED}>NOT_PERFORMED</option>
              </select>
            </div>
          </div>

          {antibodyScreenResult === AntibodyScreenResult.POSITIVE && (
            <div
              style={{
                padding: '14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#991b1b',
                  marginBottom: '6px',
                }}
              >
                Identified Alloantibodies / Specificity Notes:
              </label>
              <input
                type="text"
                placeholder="e.g. Anti-K, Anti-D detected; requires antigen-negative donor RBC"
                value={antibodyScreenNotes}
                onChange={(e) => setAntibodyScreenNotes(e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: '#fca5a5',
                }}
              />
            </div>
          )}

          {/* Verification Checkbox */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={sampleIdentityVerified}
                onChange={(e) => setSampleIdentityVerified(e.target.checked)}
                style={{
                  marginTop: '2px',
                  width: '16px',
                  height: '16px',
                  accentColor: '#dc2626',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
                <strong>Chain of Custody Confirmation:</strong> I have physically verified the tube label, patient name, medical record case number, and collection time against the clinical requisition.
              </span>
            </label>
          </div>

          <div>
            <label style={labelStyle}>
              Verification Notes / Accessioning Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record any phlebotomy or accessioning remarks..."
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
              disabled={loading}
              style={{
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: '#dc2626',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
              }}
            >
              {loading ? 'Submitting...' : 'Record Sample Verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
