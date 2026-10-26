'use client';

import React, { useEffect, useState } from 'react';
import {
  CandidateUnit,
  EligibleUnitsResponse,
  fetchEligibleUnits,
  selectCrossmatchUnit,
} from '@/lib/crossmatching-api';

interface UnitSelectionModalProps {
  crossmatchId: string;
  crossmatchCode: string;
  patientBloodGroup: string;
  requestedComponent: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UnitSelectionModal({
  crossmatchId,
  crossmatchCode,
  patientBloodGroup,
  requestedComponent,
  isOpen,
  onClose,
  onSuccess,
}: UnitSelectionModalProps) {
  const [data, setData] = useState<EligibleUnitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchEligibleUnits(crossmatchId)
      .then((res) => {
        if (isMounted) {
          setData(res);
          const firstEligible = res.candidateUnits.find((u) => u.isEligible);
          if (firstEligible) {
            setSelectedInventoryId(firstEligible.inventoryId);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to inspect eligible inventory units');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [crossmatchId, isOpen]);

  if (!isOpen) return null;

  const handleSelect = async () => {
    if (!selectedInventoryId) return;

    setError(null);
    setSubmitting(true);

    try {
      await selectCrossmatchUnit(crossmatchId, selectedInventoryId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to select donor unit');
    } finally {
      setSubmitting(false);
    }
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
          maxWidth: '820px',
          maxHeight: '90vh',
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
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🩸</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Select Candidate Donor Blood Unit
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Crossmatch <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{crossmatchCode}</span> • Patient Group:{' '}
              <strong style={{ color: '#ffffff' }}>{patientBloodGroup}</strong> • Component:{' '}
              <strong style={{ color: '#ffffff' }}>{requestedComponent}</strong>
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

        {/* Content Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
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

          {/* Banner */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#1e40af',
              lineHeight: 1.5,
            }}
          >
            Units are prioritized according to <strong>FEFO (First-Expired, First-Out)</strong> standards. Candidate units must be quarantined-released, unexpired, and match general ABO/Rh compatibility criteria.
          </div>

          {loading ? (
            <div
              style={{
                padding: '48px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: '#64748b',
                fontSize: '13px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#dc2626',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <span>Inspecting released inventory units...</span>
            </div>
          ) : !data || data.candidateUnits.length === 0 ? (
            <div
              style={{
                padding: '48px 16px',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                No candidate units found in available inventory.
              </p>
              <p style={{ margin: 0, fontSize: '12px' }}>
                Ensure donor blood units have completed mandatory TTI/ABO screening and have been released to inventory.
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '10px',
                }}
              >
                Available Candidates ({data.eligibleCount} eligible / {data.totalStockInspected} total inspected):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.candidateUnits.map((u: CandidateUnit) => {
                  const isSelected = selectedInventoryId === u.inventoryId;
                  return (
                    <div
                      key={u.inventoryId}
                      onClick={() => {
                        if (u.isEligible) {
                          setSelectedInventoryId(u.inventoryId);
                        }
                      }}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: isSelected
                          ? '2px solid #dc2626'
                          : '1px solid #e2e8f0',
                        backgroundColor: !u.isEligible
                          ? '#f8fafc'
                          : isSelected
                          ? '#fff5f5'
                          : '#ffffff',
                        opacity: !u.isEligible ? 0.6 : 1,
                        cursor: u.isEligible ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                          type="radio"
                          name="candidateUnit"
                          disabled={!u.isEligible}
                          checked={isSelected}
                          onChange={() => setSelectedInventoryId(u.inventoryId)}
                          style={{
                            width: '16px',
                            height: '16px',
                            accentColor: '#dc2626',
                            cursor: u.isEligible ? 'pointer' : 'not-allowed',
                          }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '14px',
                                fontWeight: 700,
                                color: '#0f172a',
                              }}
                            >
                              {u.unitCode}
                            </span>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                              }}
                            >
                              {u.bloodGroup}
                            </span>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              {u.componentType}
                            </span>
                            {u.isEligible ? (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #bbf7d0',
                                }}
                              >
                                Eligible for Test
                              </span>
                            ) : (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: '#fef2f2',
                                  color: '#b91c1c',
                                  border: '1px solid #fecaca',
                                }}
                              >
                                Restricted / Ineligible
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                            {u.eligibilityReason}
                          </p>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '12px', color: '#64748b' }}>
                        <div>
                          Expires: <strong style={{ color: '#0f172a' }}>{u.expiryDate ? u.expiryDate.slice(0, 10) : 'N/A'}</strong>
                          {u.daysUntilExpiry !== null && (
                            <span
                              style={{
                                marginLeft: '4px',
                                fontWeight: 700,
                                color: u.daysUntilExpiry < 5 ? '#dc2626' : '#059669',
                              }}
                            >
                              ({u.daysUntilExpiry} days)
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                          Location: {u.storageLocation || 'Main Blood Bank'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSelect}
            disabled={!selectedInventoryId || submitting}
            style={{
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#ffffff',
              backgroundColor: '#dc2626',
              border: 'none',
              borderRadius: '8px',
              cursor: !selectedInventoryId || submitting ? 'not-allowed' : 'pointer',
              opacity: !selectedInventoryId || submitting ? 0.6 : 1,
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
            }}
          >
            {submitting ? 'Assigning...' : 'Assign Selected Unit to Crossmatch'}
          </button>
        </div>
      </div>
    </div>
  );
}
