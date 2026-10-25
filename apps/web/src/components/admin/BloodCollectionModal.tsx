'use client';

import React, { useState, useEffect } from 'react';
import { Donor, DonorScreening, fetchActiveScreeningForDonor } from '@/lib/donor-api';
import { calculateCompletedAge } from '@/lib/eligibility';
import {
  recordBloodCollection,
  CollectionResult,
  DonationType,
} from '@/lib/donation-api';

interface BloodCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  donor: Donor | null;
  campaignId?: string;
  onSuccess: (result: CollectionResult) => void;
  onOpenScreening?: (donor: Donor) => void;
}

const BAG_TYPE_OPTIONS = [
  { value: 'SINGLE_350ML', label: 'CPDA-1 Single Bag (350 mL)', defaultVol: 350, minWeight: 45 },
  { value: 'DOUBLE_350ML', label: 'CPDA-1 Double Bag (350 mL - PRBC + FFP)', defaultVol: 350, minWeight: 45 },
  { value: 'DOUBLE_450ML', label: 'CPDA-1 Double Bag (450 mL - PRBC + FFP)', defaultVol: 450, minWeight: 50 },
  { value: 'TRIPLE_450ML', label: 'CPDA-1 Triple Bag (450 mL - PRBC + Platelet + FFP)', defaultVol: 450, minWeight: 50 },
  { value: 'QUADRUPLE_SAGM_450ML', label: 'SAGM Quadruple Bag (450 mL with additive solution)', defaultVol: 450, minWeight: 50 },
];

export default function BloodCollectionModal({
  isOpen,
  onClose,
  donor,
  campaignId,
  onSuccess,
  onOpenScreening,
}: BloodCollectionModalProps) {
  // Screening verification state
  const [checkingScreening, setCheckingScreening] = useState(true);
  const [activeScreening, setActiveScreening] = useState<DonorScreening | null>(null);
  const [screeningError, setScreeningError] = useState<string | null>(null);

  // Form State
  const [bagType, setBagType] = useState('TRIPLE_450ML');
  const [collectedVolumeMl, setCollectedVolumeMl] = useState<number>(450);
  const [venipunctureSite, setVenipunctureSite] = useState('LEFT_ANTECUBITAL_FOSSA');
  const [collectionOutcome, setCollectionOutcome] = useState('SUCCESSFUL');
  const [adverseReaction, setAdverseReaction] = useState('NONE');
  const [adverseReactionNotes, setAdverseReactionNotes] = useState('');
  const [bagIntegrity, setBagIntegrity] = useState('INTACT');
  const [collectionLocation, setCollectionLocation] = useState(
    campaignId ? 'CAMPAIGN_SITE' : 'CENTRAL_BLOOD_BANK',
  );
  const [notes, setNotes] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Fetch active screening whenever modal opens or donor changes
  useEffect(() => {
    if (!isOpen || !donor) {
      setActiveScreening(null);
      setScreeningError(null);
      return;
    }

    let isMounted = true;
    setCheckingScreening(true);
    setScreeningError(null);
    setSubmissionError(null);

    fetchActiveScreeningForDonor(donor._id)
      .then((screening) => {
        if (!isMounted) return;
        setActiveScreening(screening);
        if (!screening) {
          setScreeningError(
            'No valid pre-donation clinical screening found for today. Donor must pass medical screening before blood collection.',
          );
        } else if (screening.collectionStatus === 'COLLECTED') {
          setScreeningError(
            `Screening ${screening.screeningCode} has already been used for collection. A fresh screening is required.`,
          );
        } else if (screening.decision !== 'SELECTED') {
          setScreeningError(
            `Donor screening decision is '${screening.decision}'. Only 'SELECTED' donors can proceed to phlebotomy.`,
          );
        } else {
          // Auto-adjust bag type and volume based on donor weight
          if (screening.vitals && screening.vitals.weightKg < 50) {
            setBagType('CPDA_SINGLE_350');
            setCollectedVolumeMl(350);
          } else {
            setBagType('CPDA_TRIPLE_450');
            setCollectedVolumeMl(450);
          }
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setScreeningError(err.message || 'Failed to verify pre-donation screening status');
      })
      .finally(() => {
        if (isMounted) setCheckingScreening(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, donor]);

  if (!isOpen || !donor) return null;

  const donorWeight = activeScreening?.vitals?.weightKg || 60;
  const isWeightUnder50 = donorWeight < 50;

  const handleBagTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setBagType(selected);
    const bagConfig = BAG_TYPE_OPTIONS.find((b) => b.value === selected);
    if (bagConfig) {
      setCollectedVolumeMl(bagConfig.defaultVol);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScreening || activeScreening.decision !== 'SELECTED') {
      setSubmissionError('Cannot record blood collection without an approved clinical screening.');
      return;
    }

    if (isWeightUnder50 && collectedVolumeMl > 350) {
      setSubmissionError(
        `Safety Violation: Donor weighs ${donorWeight} kg (< 50 kg). Maximum allowable collection volume is 350 mL per NBTC guidelines.`,
      );
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);

    try {
      const result = await recordBloodCollection({
        donorId: donor._id,
        screeningId: activeScreening._id,
        donationType: DonationType.WHOLE_BLOOD,
        campaignId: campaignId || undefined,
        bagType,
        collectedVolumeMl: Number(collectedVolumeMl),
        venipunctureSite,
        collectionOutcome,
        adverseReaction,
        adverseReactionNotes: adverseReaction !== 'NONE' ? adverseReactionNotes.trim() : undefined,
        bagIntegrity,
        collectionLocation,
        notes: notes.trim() || undefined,
      });

      onSuccess(result);
      onClose();
    } catch (err: any) {
      setSubmissionError(err.message || 'Failed to record collection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '680px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#881337',
            color: '#ffffff',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🩸</span> Record Blood Collection (Phlebotomy)
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#fecdd3' }}>
              Phase 2: Chair-side bag registration, venipuncture & safety checklist
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Donor Summary Card */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.85rem 1.1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Donor Name</span>
              <strong style={{ color: '#0f172a' }}>{donor.fullName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Donor Code</span>
              <strong style={{ color: '#0f172a' }}>{donor.donorCode}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Blood Group</span>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  fontWeight: 800,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                }}
              >
                {donor.bloodGroup}
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Age / Gender</span>
              <strong>{donor.dateOfBirth ? `${calculateCompletedAge(donor.dateOfBirth)} yrs` : 'Age N/A'} / {donor.gender}</strong>
            </div>
          </div>

          {/* Screening Verification Banner */}
          {checkingScreening ? (
            <div
              style={{
                padding: '0.85rem',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #bfdbfe', borderTopColor: '#1d4ed8', borderRadius: '50%' }} />
              Verifying donor screening & clinical clearance...
            </div>
          ) : screeningError ? (
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                <span>⛔</span> Mandatory Clinical Screening Required
              </div>
              <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.4 }}>{screeningError}</p>
              {onOpenScreening && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenScreening(donor);
                  }}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>📋</span> Perform Clinical Screening Now
                </button>
              )}
            </div>
          ) : activeScreening ? (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                fontSize: '0.8rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>✓</span> Screening Approved: {activeScreening.screeningCode}
                </strong>
                <span style={{ color: '#15803d', fontSize: '0.75rem' }}>
                  Weight: <strong>{activeScreening.vitals?.weightKg} kg</strong> | Hb:{' '}
                  <strong>{activeScreening.vitals?.hemoglobinGdl} g/dL</strong> | BP:{' '}
                  <strong>{activeScreening.vitals?.bloodPressureSystolic}/{activeScreening.vitals?.bloodPressureDiastolic} mmHg</strong>
                </span>
              </div>
              <span
                style={{
                  backgroundColor: '#dcfce7',
                  border: '1px solid #86efac',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              >
                CLEARED FOR COLLECTION
              </span>
            </div>
          ) : null}

          {/* Form */}
          {!checkingScreening && activeScreening && activeScreening.decision === 'SELECTED' && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Submission Error Banner */}
              {submissionError && (
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #f87171',
                    color: '#991b1b',
                    fontSize: '0.85rem',
                  }}
                >
                  <strong>Collection Error:</strong> {submissionError}
                </div>
              )}

              {/* Bag & Volume Section */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  backgroundColor: '#ffffff',
                }}
              >
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                  1. Blood Bag & Target Volume
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Blood Bag Type *
                    </label>
                    <select
                      value={bagType}
                      onChange={handleBagTypeChange}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      {BAG_TYPE_OPTIONS.map((opt) => (
                        <option
                          key={opt.value}
                          value={opt.value}
                          disabled={isWeightUnder50 && opt.minWeight > 45}
                        >
                          {opt.label} {isWeightUnder50 && opt.minWeight > 45 ? '(Weight < 50 kg locked)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Collected Volume (mL) *
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setCollectedVolumeMl(350)}
                        style={{
                          flex: 1,
                          padding: '0.45rem',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: collectedVolumeMl === 350 ? '#dc2626' : '#cbd5e1',
                          backgroundColor: collectedVolumeMl === 350 ? '#fef2f2' : '#ffffff',
                          color: collectedVolumeMl === 350 ? '#dc2626' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        350 mL
                      </button>
                      <button
                        type="button"
                        disabled={isWeightUnder50}
                        onClick={() => setCollectedVolumeMl(450)}
                        style={{
                          flex: 1,
                          padding: '0.45rem',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: collectedVolumeMl === 450 ? '#dc2626' : '#cbd5e1',
                          backgroundColor: collectedVolumeMl === 450 ? '#fef2f2' : '#ffffff',
                          color: collectedVolumeMl === 450 ? '#dc2626' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: isWeightUnder50 ? 'not-allowed' : 'pointer',
                          opacity: isWeightUnder50 ? 0.4 : 1,
                        }}
                        title={isWeightUnder50 ? 'Weight < 50kg restricted to 350mL' : ''}
                      >
                        450 mL
                      </button>
                    </div>
                    {isWeightUnder50 && (
                      <span style={{ fontSize: '0.7rem', color: '#b45309', marginTop: '0.25rem', display: 'block' }}>
                        ⚠ NBTC Rule: Donor weighs {donorWeight} kg (&lt; 50 kg) — 350 mL maximum.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Venipuncture & Chair-side Procedure */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  backgroundColor: '#ffffff',
                }}
              >
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                  2. Phlebotomy Procedure & Quality Inspection
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Venipuncture Site
                    </label>
                    <select
                      value={venipunctureSite}
                      onChange={(e) => setVenipunctureSite(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                      }}
                    >
                      <option value="LEFT_ANTECUBITAL_FOSSA">Left Antecubital Fossa</option>
                      <option value="RIGHT_ANTECUBITAL_FOSSA">Right Antecubital Fossa</option>
                      <option value="OTHER">Other / Alternative Vein</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Collection Outcome *
                    </label>
                    <select
                      value={collectionOutcome}
                      onChange={(e) => setCollectionOutcome(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: collectionOutcome === 'SUCCESSFUL' ? '#166534' : '#b91c1c',
                      }}
                    >
                      <option value="SUCCESSFUL">Successful Full Collection</option>
                      <option value="UNDER_COLLECTION">Under-Collection (&lt; 90% volume)</option>
                      <option value="FAILED_VENIPUNCTURE">Failed Venipuncture</option>
                      <option value="INCOMPLETE">Incomplete / Donor Discomfort</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Bag Physical Integrity *
                    </label>
                    <select
                      value={bagIntegrity}
                      onChange={(e) => setBagIntegrity(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: bagIntegrity === 'INTACT' ? '#166534' : '#dc2626',
                      }}
                    >
                      <option value="INTACT">Intact (No leak, ports sealed)</option>
                      <option value="LEAKAGE_DETECTED">Leakage Detected (Discard Unit)</option>
                      <option value="DEFECTIVE_PORT">Defective Port / Tubing</option>
                      <option value="CLOTTED">Clotted Bag</option>
                      <option value="LABEL_DAMAGED">Label / Bag Defaced</option>
                    </select>
                  </div>
                </div>

                {bagIntegrity !== 'INTACT' && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.6rem 0.85rem',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      color: '#b91c1c',
                      fontSize: '0.75rem',
                    }}
                  >
                    ⚠ <strong>Safety Invariant:</strong> Units flagged with integrity defects (leakage, clots) are automatically marked as REJECTED and discarded safely.
                  </div>
                )}
              </div>

              {/* Adverse Reactions & Safety */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  backgroundColor: '#ffffff',
                }}
              >
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                  3. Adverse Donor Reaction & Vigilance
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Adverse Reaction Event
                    </label>
                    <select
                      value={adverseReaction}
                      onChange={(e) => setAdverseReaction(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        fontWeight: adverseReaction === 'NONE' ? 400 : 700,
                        color: adverseReaction === 'NONE' ? '#0f172a' : '#b91c1c',
                      }}
                    >
                      <option value="NONE">None (Uneventful donation)</option>
                      <option value="VASOVAGAL_MILD">Mild Vasovagal (Sweating, pallor, dizziness)</option>
                      <option value="VASOVAGAL_SEVERE">Severe Vasovagal (Loss of consciousness)</option>
                      <option value="HEMATOMA">Hematoma at puncture site</option>
                      <option value="ARTERIAL_PUNCTURE">Accidental Arterial Puncture</option>
                      <option value="ALLERGIC">Allergic reaction to antiseptic</option>
                      <option value="SYNCOPE_WITH_INJURY">Syncope with fall / injury</option>
                      <option value="OTHER">Other adverse reaction</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Collection Location
                    </label>
                    <input
                      type="text"
                      value={collectionLocation}
                      onChange={(e) => setCollectionLocation(e.target.value)}
                      placeholder="e.g. Blood Centre Chair 1"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                </div>

                {adverseReaction !== 'NONE' && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c', marginBottom: '0.25rem' }}>
                      Clinical Action Taken & First Aid Given *
                    </label>
                    <textarea
                      rows={2}
                      value={adverseReactionNotes}
                      onChange={(e) => setAdverseReactionNotes(e.target.value)}
                      placeholder="Describe immediate response (e.g. Elevate legs, oral fluids, cold compress, recovery duration)..."
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #f87171',
                        fontSize: '0.85rem',
                        backgroundColor: '#fff5f5',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Phlebotomist Confirmation Notice */}
              <div
                style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.75rem',
                  color: '#475569',
                  lineHeight: 1.4,
                }}
              >
                🔒 <strong>Regulatory & Audit Traceability:</strong> Submitting will create an auditable donation record, generate a unique barcode (<code>BAG-YYYYMMDD-XXXX</code>), queue the unit for mandatory 5-TTI infectious screening, and lock the unit from routine issue until authorized laboratory clearance.
              </div>

              {/* Bottom Error Display (Visible when scrolled to bottom) */}
              {submissionError && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #f87171',
                    color: '#991b1b',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>⚠️</span>
                  <div>
                    <strong>Collection Error:</strong> {submissionError}
                  </div>
                </div>
              )}

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.55rem 1.35rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#881337',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(136, 19, 55, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {submitting ? 'Recording Collection...' : '✓ Authorize & Record Collection'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
