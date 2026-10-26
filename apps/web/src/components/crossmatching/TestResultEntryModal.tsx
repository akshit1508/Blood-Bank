'use client';

import React, { useState } from 'react';
import {
  CrossmatchMethod,
  CrossmatchResult,
  recordCrossmatchResult,
} from '@/lib/crossmatching-api';

interface TestResultEntryModalProps {
  crossmatchId: string;
  crossmatchCode: string;
  patientName: string;
  patientBloodGroup: string;
  selectedUnitCode?: string;
  selectedUnitGroup?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TestResultEntryModal({
  crossmatchId,
  crossmatchCode,
  patientName,
  patientBloodGroup,
  selectedUnitCode = '',
  selectedUnitGroup = '',
  isOpen,
  onClose,
  onSuccess,
}: TestResultEntryModalProps) {
  const [testMethod, setTestMethod] = useState<CrossmatchMethod>(
    CrossmatchMethod.GEL_CARD,
  );
  const [testPhases, setTestPhases] = useState<string[]>([
    'IS_PHASE',
    'INCUBATION_37C',
    'AHG_PHASE',
    'AUTOCONTROL_NEGATIVE',
  ]);
  const [crossmatchResult, setCrossmatchResult] = useState<CrossmatchResult>(
    CrossmatchResult.COMPATIBLE,
  );
  const [reactionGrade, setReactionGrade] = useState('0');
  const [testedAt, setTestedAt] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [testingNotes, setTestingNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePhaseToggle = (phase: string) => {
    setTestPhases((prev) =>
      prev.includes(phase) ? prev.filter((p) => p !== phase) : [...prev, phase],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await recordCrossmatchResult(crossmatchId, {
        testMethod,
        testPhases,
        crossmatchResult,
        reactionGrade: reactionGrade || undefined,
        testedAt,
        testingNotes: testingNotes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record laboratory test result');
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
              <span style={{ fontSize: '18px' }}>🔬</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Record Physical Crossmatch Result
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Crossmatch <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{crossmatchCode}</span> • Patient:{' '}
              <strong style={{ color: '#ffffff' }}>{patientName} ({patientBloodGroup})</strong> • Donor Unit:{' '}
              <strong style={{ color: '#ffffff' }}>{selectedUnitCode} ({selectedUnitGroup})</strong>
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <label style={labelStyle}>
                Crossmatch Technique / Methodology <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={testMethod}
                onChange={(e) => setTestMethod(e.target.value as CrossmatchMethod)}
                style={inputStyle}
              >
                <option value={CrossmatchMethod.GEL_CARD}>Gel Card Column Agglutination</option>
                <option value={CrossmatchMethod.AHG_COOMBS}>Tube Anti-Human Globulin (AHG / Coombs)</option>
                <option value={CrossmatchMethod.IMMEDIATE_SPIN}>Immediate Spin (IS) Saline Phase</option>
                <option value={CrossmatchMethod.TUBE_AHG_37C}>Tube Method (IS + 37°C LISS + AHG)</option>
                <option value={CrossmatchMethod.COMPUTERIZED_ELECTRONIC}>Validated Electronic / Computer Crossmatch</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Observed Laboratory Result <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={crossmatchResult}
                onChange={(e) => {
                  const val = e.target.value as CrossmatchResult;
                  setCrossmatchResult(val);
                  if (val === CrossmatchResult.COMPATIBLE) {
                    setReactionGrade('0');
                  } else if (val === CrossmatchResult.INCOMPATIBLE && reactionGrade === '0') {
                    setReactionGrade('3+');
                  }
                }}
                style={{
                  ...inputStyle,
                  fontWeight: 700,
                  backgroundColor:
                    crossmatchResult === CrossmatchResult.COMPATIBLE
                      ? '#f0fdf4'
                      : crossmatchResult === CrossmatchResult.INCOMPATIBLE
                      ? '#fef2f2'
                      : '#ffffff',
                  color:
                    crossmatchResult === CrossmatchResult.COMPATIBLE
                      ? '#166534'
                      : crossmatchResult === CrossmatchResult.INCOMPATIBLE
                      ? '#991b1b'
                      : '#0f172a',
                  borderColor:
                    crossmatchResult === CrossmatchResult.COMPATIBLE
                      ? '#86efac'
                      : crossmatchResult === CrossmatchResult.INCOMPATIBLE
                      ? '#fca5a5'
                      : '#cbd5e1',
                }}
              >
                <option value={CrossmatchResult.COMPATIBLE}>COMPATIBLE (No Agglutination / Hemolysis)</option>
                <option value={CrossmatchResult.INCOMPATIBLE}>INCOMPATIBLE (Agglutination Observed)</option>
                <option value={CrossmatchResult.INCONCLUSIVE}>INCONCLUSIVE (Requires Repeat / Workup)</option>
                <option value={CrossmatchResult.INVALID}>INVALID (Control Failure / Technical Discrepancy)</option>
                <option value={CrossmatchResult.IN_PROGRESS}>IN_PROGRESS (Incubation Ongoing)</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Agglutination Reaction Grade
              </label>
              <select
                value={reactionGrade}
                onChange={(e) => setReactionGrade(e.target.value)}
                style={inputStyle}
              >
                <option value="0">0 (Negative / Complete Smooth Suspension)</option>
                <option value="W+">W+ (Weak Microscopic Agglutination)</option>
                <option value="1+">1+ (Small Agglutinates, Turbid Background)</option>
                <option value="2+">2+ (Medium Agglutinates, Clear Background)</option>
                <option value="3+">3+ (Several Large Agglutinates)</option>
                <option value="4+">4+ (Single Solid Clot / Button)</option>
                <option value="MF">MF (Mixed Field Agglutination)</option>
                <option value="H">H (Complete Hemolysis)</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Observation Date & Time <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={testedAt}
                onChange={(e) => setTestedAt(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Test Phases Checklist */}
          <div>
            <label style={labelStyle}>
              Completed Procedure Phases / Quality Controls:
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '10px',
                padding: '14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              {[
                { id: 'IS_PHASE', label: 'Immediate Spin (Room Temp)' },
                { id: 'INCUBATION_37C', label: '37°C LISS / Albumin Incubation' },
                { id: 'AHG_PHASE', label: 'Anti-Human Globulin (AHG / Coombs)' },
                { id: 'AUTOCONTROL_NEGATIVE', label: 'Autocontrol Verified Negative' },
              ].map((phase) => (
                <label
                  key={phase.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={testPhases.includes(phase.id)}
                    onChange={() => handlePhaseToggle(phase.id)}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: '#dc2626',
                      cursor: 'pointer',
                    }}
                  />
                  <span>{phase.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Microscopic Observations / Laboratory Remarks
            </label>
            <textarea
              rows={2}
              value={testingNotes}
              onChange={(e) => setTestingNotes(e.target.value)}
              placeholder="Record any rouleaux, hemolysis or antibody workup observations..."
              style={{
                ...inputStyle,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Warning for Incompatible */}
          {crossmatchResult === CrossmatchResult.INCOMPATIBLE && (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '12px',
                borderRadius: '8px',
                lineHeight: 1.5,
              }}
            >
              <strong>Patient Safety Alert:</strong> This unit will be marked INCOMPATIBLE. Routine clinical reservation and blood issue will remain permanently blocked for this unit.
            </div>
          )}

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
              {loading ? 'Recording...' : 'Submit Observed Test Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
