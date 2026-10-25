'use client';

import React, { useState, useEffect } from 'react';
import {
  Donor,
  DonorScreeningDecision,
  DonorVitals,
  MedicalQuestionnaire,
  CreateDonorScreeningInput,
  createDonorScreening,
} from '@/lib/donor-api';

interface DonorScreeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  donor: Donor | null;
  onSuccess: (screening: any) => void;
}

export default function DonorScreeningModal({
  isOpen,
  onClose,
  donor,
  onSuccess,
}: DonorScreeningModalProps) {
  // Vitals State
  const [weightKg, setWeightKg] = useState<number>(60);
  const [hemoglobinGdl, setHemoglobinGdl] = useState<number>(13.5);
  const [bpSystolic, setBpSystolic] = useState<number>(120);
  const [bpDiastolic, setBpDiastolic] = useState<number>(80);
  const [pulseBpm, setPulseBpm] = useState<number>(76);
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(36.8);
  const [veinAccess, setVeinAccess] = useState<string>('GOOD');
  const [generalAppearance, setGeneralAppearance] = useState<string>('Healthy, alert, afebrile');

  // Questionnaire State
  const [feelingWellToday, setFeelingWellToday] = useState(true);
  const [recentIllnessOrFever, setRecentIllnessOrFever] = useState(false);
  const [takingMedications, setTakingMedications] = useState(false);
  const [medicationDetails, setMedicationDetails] = useState('');
  const [tattooPiercingLast12Months, setTattooPiercingLast12Months] = useState(false);
  const [majorSurgeryOrDentalRecent, setMajorSurgeryOrDentalRecent] = useState(false);
  const [alcoholIntakeLast24Hours, setAlcoholIntakeLast24Hours] = useState(false);
  const [cardiacOrRespiratoryDisease, setCardiacOrRespiratoryDisease] = useState(false);
  const [historyOfJaundiceOrHepatitis, setHistoryOfJaundiceOrHepatitis] = useState(false);
  const [malariaTreatmentOrTravelHistory, setMalariaTreatmentOrTravelHistory] = useState(false);
  const [pregnantOrLactating, setPregnantOrLactating] = useState(false);
  const [healthRemarks, setHealthRemarks] = useState('');

  // Consent & Decision State
  const [consentAcknowledged, setConsentAcknowledged] = useState(true);
  const [donorSignatureConfirmed, setDonorSignatureConfirmed] = useState(true);
  const [decision, setDecision] = useState<DonorScreeningDecision>(DonorScreeningDecision.SELECTED);
  const [deferralReason, setDeferralReason] = useState('');
  const [deferredUntil, setDeferredUntil] = useState('');
  const [decisionRemarks, setDecisionRemarks] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic Vitals Evaluation
  const isWeightValid = weightKg >= 45;
  const isHbValid = hemoglobinGdl >= 12.5;
  const isBpValid = bpSystolic >= 100 && bpSystolic <= 160 && bpDiastolic >= 60 && bpDiastolic <= 100;
  const isPulseValid = pulseBpm >= 60 && pulseBpm <= 100;
  const isTempValid = temperatureCelsius <= 37.5;

  const hasPhysicalDisqualification = !isWeightValid || !isHbValid || !isBpValid || !isPulseValid || !isTempValid;
  const hasQuestionnaireRisk =
    !feelingWellToday ||
    recentIllnessOrFever ||
    tattooPiercingLast12Months ||
    majorSurgeryOrDentalRecent ||
    alcoholIntakeLast24Hours ||
    cardiacOrRespiratoryDisease ||
    historyOfJaundiceOrHepatitis ||
    pregnantOrLactating;

  // Auto-suggest decision when vitals or questionnaire change
  useEffect(() => {
    if (cardiacOrRespiratoryDisease || historyOfJaundiceOrHepatitis) {
      setDecision(DonorScreeningDecision.PERMANENTLY_DEFERRED);
      setDeferralReason('Permanent medical contraindication');
    } else if (hasPhysicalDisqualification || hasQuestionnaireRisk) {
      setDecision(DonorScreeningDecision.TEMPORARILY_DEFERRED);
      const reasons: string[] = [];
      if (!isWeightValid) reasons.push(`Weight below 45kg (${weightKg}kg)`);
      if (!isHbValid) reasons.push(`Hemoglobin below 12.5g/dL (${hemoglobinGdl}g/dL)`);
      if (!isBpValid) reasons.push(`Blood pressure out of range (${bpSystolic}/${bpDiastolic} mmHg)`);
      if (!isPulseValid) reasons.push(`Pulse out of range (${pulseBpm} bpm)`);
      if (!isTempValid) reasons.push(`Temperature exceeds 37.5°C (${temperatureCelsius}°C)`);
      if (alcoholIntakeLast24Hours) reasons.push('Alcohol intake within 24h');
      if (recentIllnessOrFever) reasons.push('Recent illness or fever');
      if (tattooPiercingLast12Months) reasons.push('Tattoo or piercing within 12 months');
      setDeferralReason(reasons.join('; '));
    } else {
      setDecision(DonorScreeningDecision.SELECTED);
      setDeferralReason('');
    }
  }, [
    weightKg,
    hemoglobinGdl,
    bpSystolic,
    bpDiastolic,
    pulseBpm,
    temperatureCelsius,
    feelingWellToday,
    recentIllnessOrFever,
    tattooPiercingLast12Months,
    majorSurgeryOrDentalRecent,
    alcoholIntakeLast24Hours,
    cardiacOrRespiratoryDisease,
    historyOfJaundiceOrHepatitis,
    pregnantOrLactating,
    isWeightValid,
    isHbValid,
    isBpValid,
    isPulseValid,
    isTempValid,
    hasPhysicalDisqualification,
    hasQuestionnaireRisk,
  ]);

  if (!isOpen || !donor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const input: CreateDonorScreeningInput = {
        donorId: donor._id,
        vitals: {
          weightKg: Number(weightKg),
          hemoglobinGdl: Number(hemoglobinGdl),
          bloodPressureSystolic: Number(bpSystolic),
          bloodPressureDiastolic: Number(bpDiastolic),
          pulseBpm: Number(pulseBpm),
          temperatureCelsius: Number(temperatureCelsius),
          veinAccess,
          generalAppearance,
        },
        questionnaire: {
          feelingWellToday,
          recentIllnessOrFever,
          takingMedications,
          medicationDetails: takingMedications ? medicationDetails : undefined,
          tattooPiercingLast12Months,
          majorSurgeryOrDentalRecent,
          alcoholIntakeLast24Hours,
          cardiacOrRespiratoryDisease,
          historyOfJaundiceOrHepatitis,
          malariaTreatmentOrTravelHistory,
          pregnantOrLactating,
          healthRemarks: healthRemarks.trim() || undefined,
        },
        consent: {
          consentAcknowledged,
          donorSignatureConfirmed,
        },
        decision,
        deferralType:
          decision === DonorScreeningDecision.PERMANENTLY_DEFERRED
            ? 'PERMANENT'
            : decision === DonorScreeningDecision.TEMPORARILY_DEFERRED
            ? 'TEMPORARY'
            : undefined,
        deferralReason: deferralReason.trim() || undefined,
        deferredUntil: deferredUntil ? deferredUntil : undefined,
        decisionRemarks: decisionRemarks.trim() || undefined,
      };

      const result = await createDonorScreening(donor._id, input);
      onSuccess(result.screening);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit clinical screening.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '880px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #b91c1c 0%, #be123c 50%, #991b1b 100%)',
            color: '#ffffff',
            padding: '1.25rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                PHASE 2 CLINICAL GATE
              </span>
              <span style={{ fontSize: '0.75rem', color: '#fecdd3' }}>NBTC / DGHS Guidelines</span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
              📋 Pre-Donation Medical Screening & Examination
            </h2>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem', color: '#ffe4e6' }}>
              Donor: <strong style={{ color: '#ffffff' }}>{donor.fullName}</strong> ({donor.donorCode}) • Blood Group: <strong style={{ color: '#ffffff', textDecoration: 'underline' }}>{donor.bloodGroup}</strong> • Gender: <strong>{donor.gender}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1.25rem',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              lineHeight: 1,
              transition: 'background 0.15s ease',
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            backgroundColor: '#ffffff',
          }}
        >
          {errorMessage && (
            <div
              style={{
                padding: '0.85rem 1.15rem',
                backgroundColor: '#fef2f2',
                borderLeft: '4px solid #ef4444',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>⚠️</span>
              <div>
                <strong>Screening Blocked:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* Section 1: Physical Examination (Vitals) */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  1
                </span>
                Physical Examination & Vitals
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Statutory Indian Limits (NBTC)</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '0.85rem',
              }}
            >
              {/* Weight */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Weight (kg) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="30"
                  max="200"
                  required
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '8px',
                    border: isWeightValid ? '1px solid #cbd5e1' : '1.5px solid #ef4444',
                    backgroundColor: isWeightValid ? '#ffffff' : '#fef2f2',
                    color: isWeightValid ? '#0f172a' : '#991b1b',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    marginTop: '0.3rem',
                    color: isWeightValid ? '#16a34a' : '#dc2626',
                  }}
                >
                  {isWeightValid ? '✓ Minimum 45 kg met' : '✗ Below 45 kg: Ineligible'}
                </span>
              </div>

              {/* Hemoglobin */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Hemoglobin (g/dL) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="5"
                  max="25"
                  required
                  value={hemoglobinGdl}
                  onChange={(e) => setHemoglobinGdl(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '8px',
                    border: isHbValid ? '1px solid #cbd5e1' : '1.5px solid #ef4444',
                    backgroundColor: isHbValid ? '#ffffff' : '#fef2f2',
                    color: isHbValid ? '#0f172a' : '#991b1b',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    marginTop: '0.3rem',
                    color: isHbValid ? '#16a34a' : '#dc2626',
                  }}
                >
                  {isHbValid ? '✓ Minimum 12.5 g/dL met' : '✗ Below 12.5: Ineligible'}
                </span>
              </div>

              {/* BP Systolic */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  BP Systolic (mmHg) *
                </label>
                <input
                  type="number"
                  min="60"
                  max="240"
                  required
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
                  Normal: 100-140
                </span>
              </div>

              {/* BP Diastolic */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  BP Diastolic (mmHg) *
                </label>
                <input
                  type="number"
                  min="40"
                  max="140"
                  required
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
                  Normal: 60-90
                </span>
              </div>

              {/* Pulse */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Pulse (bpm) *
                </label>
                <input
                  type="number"
                  min="40"
                  max="180"
                  required
                  value={pulseBpm}
                  onChange={(e) => setPulseBpm(parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    marginTop: '0.3rem',
                    color: isPulseValid ? '#16a34a' : '#d97706',
                  }}
                >
                  {isPulseValid ? '✓ Normal (60-100)' : '⚠️ Out of normal range'}
                </span>
              </div>

              {/* Oral Temp */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Oral Temp (°C) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="35"
                  max="42"
                  required
                  value={temperatureCelsius}
                  onChange={(e) => setTemperatureCelsius(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    marginTop: '0.3rem',
                    color: isTempValid ? '#16a34a' : '#dc2626',
                  }}
                >
                  {isTempValid ? '✓ Afebrile (≤ 37.5°C)' : '✗ Fever detected'}
                </span>
              </div>

              {/* Vein Access */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Vein Prominence
                </label>
                <select
                  value={veinAccess}
                  onChange={(e) => setVeinAccess(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <option value="GOOD">Good (Prominent antecubital)</option>
                  <option value="FAIR">Fair (Palpable)</option>
                  <option value="POOR">Poor (Difficult puncture)</option>
                </select>
              </div>

              {/* General Appearance */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  General Health / Appearance
                </label>
                <input
                  type="text"
                  value={generalAppearance}
                  onChange={(e) => setGeneralAppearance(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Health Questionnaire */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  2
                </span>
                Pre-Donation Medical Risk Questionnaire
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Confidential Medical Record</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {[
                {
                  id: 'wellToday',
                  checked: feelingWellToday,
                  onChange: (v: boolean) => setFeelingWellToday(v),
                  title: 'Feeling well & in good health today?',
                  desc: 'Normal sleep, adequate meal taken within 4 hours.',
                  isRisk: false,
                },
                {
                  id: 'alcohol',
                  checked: alcoholIntakeLast24Hours,
                  onChange: (v: boolean) => setAlcoholIntakeLast24Hours(v),
                  title: 'Alcohol consumption in last 24 hours?',
                  desc: 'Requires minimum 24-hour deferral.',
                  isRisk: true,
                },
                {
                  id: 'illness',
                  checked: recentIllnessOrFever,
                  onChange: (v: boolean) => setRecentIllnessOrFever(v),
                  title: 'Recent fever, sore throat or infection in past 15 days?',
                  desc: 'Deferral until full recovery.',
                  isRisk: true,
                },
                {
                  id: 'tattoo',
                  checked: tattooPiercingLast12Months,
                  onChange: (v: boolean) => setTattooPiercingLast12Months(v),
                  title: 'Tattoo, body piercing or acupuncture in past 12 months?',
                  desc: 'Mandatory 12-month deferral under NBTC.',
                  isRisk: true,
                },
                {
                  id: 'surgery',
                  checked: majorSurgeryOrDentalRecent,
                  onChange: (v: boolean) => setMajorSurgeryOrDentalRecent(v),
                  title: 'Dental extraction (72h) or surgery (6 months)?',
                  desc: 'Clinical deferral period applies.',
                  isRisk: true,
                },
                {
                  id: 'cardiac',
                  checked: cardiacOrRespiratoryDisease,
                  onChange: (v: boolean) => setCardiacOrRespiratoryDisease(v),
                  title: 'Heart disease, epilepsy or asthma on steroid therapy?',
                  desc: 'Permanent deferral for donor safety.',
                  isRisk: true,
                },
                {
                  id: 'jaundice',
                  checked: historyOfJaundiceOrHepatitis,
                  onChange: (v: boolean) => setHistoryOfJaundiceOrHepatitis(v),
                  title: 'History of Jaundice, Hepatitis B/C, or HIV risk?',
                  desc: 'Permanent contraindication.',
                  isRisk: true,
                },
                {
                  id: 'meds',
                  checked: takingMedications,
                  onChange: (v: boolean) => setTakingMedications(v),
                  title: 'Currently taking antibiotics, blood thinners or aspirin?',
                  desc: 'Aspirin: 48h platelet deferral; Antibiotics: 72h.',
                  isRisk: true,
                },
              ].map((q) => (
                <label
                  key={q.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    backgroundColor: q.checked && q.isRisk ? '#fef2f2' : '#ffffff',
                    border: q.checked && q.isRisk ? '1.5px solid #f87171' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={q.checked}
                    onChange={(e) => q.onChange(e.target.checked)}
                    style={{
                      marginTop: '0.15rem',
                      width: '16px',
                      height: '16px',
                      accentColor: '#dc2626',
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: q.checked && q.isRisk ? '#991b1b' : '#1e293b',
                      }}
                    >
                      {q.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                      {q.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {takingMedications && (
              <div style={{ marginTop: '0.85rem' }}>
                <input
                  type="text"
                  placeholder="Specify medication names and dosage..."
                  value={medicationDetails}
                  onChange={(e) => setMedicationDetails(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {/* Section 3: Informed Consent & Clinical Decision */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  3
                </span>
                Clinical Decision & Informed Consent
              </h3>
            </div>

            {/* Informed Consent Confirmation */}
            <div
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                marginBottom: '1rem',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  required
                  checked={consentAcknowledged}
                  onChange={(e) => setConsentAcknowledged(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: '#dc2626',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>
                  Donor has signed the statutory blood donation declaration acknowledging truthfulness of medical history and voluntary informed consent.
                </span>
              </label>
            </div>

            {/* Decision Radio Selector */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.85rem',
                marginBottom: '1rem',
              }}
            >
              {/* Option 1: SELECTED */}
              <label
                onClick={() => setDecision(DonorScreeningDecision.SELECTED)}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: decision === DonorScreeningDecision.SELECTED ? '2px solid #16a34a' : '1px solid #e2e8f0',
                  backgroundColor: decision === DonorScreeningDecision.SELECTED ? '#f0fdf4' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  transition: 'all 0.15s ease',
                  boxShadow: decision === DonorScreeningDecision.SELECTED ? '0 2px 4px rgba(22, 163, 74, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.825rem', color: '#166534' }}>
                    ✓ SELECTED (Approved)
                  </span>
                  <input
                    type="radio"
                    name="decision"
                    value={DonorScreeningDecision.SELECTED}
                    checked={decision === DonorScreeningDecision.SELECTED}
                    onChange={() => setDecision(DonorScreeningDecision.SELECTED)}
                    style={{ accentColor: '#16a34a' }}
                  />
                </div>
                <p style={{ margin: 0, fontSize: '0.725rem', color: '#4b5563' }}>
                  Passed all NBTC examination limits. Proceed to phlebotomy collection.
                </p>
              </label>

              {/* Option 2: TEMPORARILY_DEFERRED */}
              <label
                onClick={() => setDecision(DonorScreeningDecision.TEMPORARILY_DEFERRED)}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: decision === DonorScreeningDecision.TEMPORARILY_DEFERRED ? '2px solid #d97706' : '1px solid #e2e8f0',
                  backgroundColor: decision === DonorScreeningDecision.TEMPORARILY_DEFERRED ? '#fffbeb' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  transition: 'all 0.15s ease',
                  boxShadow: decision === DonorScreeningDecision.TEMPORARILY_DEFERRED ? '0 2px 4px rgba(217, 119, 6, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.825rem', color: '#92400e' }}>
                    ⚠️ TEMPORARY DEFERRAL
                  </span>
                  <input
                    type="radio"
                    name="decision"
                    value={DonorScreeningDecision.TEMPORARILY_DEFERRED}
                    checked={decision === DonorScreeningDecision.TEMPORARILY_DEFERRED}
                    onChange={() => setDecision(DonorScreeningDecision.TEMPORARILY_DEFERRED)}
                    style={{ accentColor: '#d97706' }}
                  />
                </div>
                <p style={{ margin: 0, fontSize: '0.725rem', color: '#4b5563' }}>
                  Temporary condition (low Hb, fever, alcohol, recent tattoo). Re-screen later.
                </p>
              </label>

              {/* Option 3: PERMANENTLY_DEFERRED */}
              <label
                onClick={() => setDecision(DonorScreeningDecision.PERMANENTLY_DEFERRED)}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: decision === DonorScreeningDecision.PERMANENTLY_DEFERRED ? '2px solid #dc2626' : '1px solid #e2e8f0',
                  backgroundColor: decision === DonorScreeningDecision.PERMANENTLY_DEFERRED ? '#fef2f2' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  transition: 'all 0.15s ease',
                  boxShadow: decision === DonorScreeningDecision.PERMANENTLY_DEFERRED ? '0 2px 4px rgba(220, 38, 38, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.825rem', color: '#991b1b' }}>
                    🛑 PERMANENT DEFERRAL
                  </span>
                  <input
                    type="radio"
                    name="decision"
                    value={DonorScreeningDecision.PERMANENTLY_DEFERRED}
                    checked={decision === DonorScreeningDecision.PERMANENTLY_DEFERRED}
                    onChange={() => setDecision(DonorScreeningDecision.PERMANENTLY_DEFERRED)}
                    style={{ accentColor: '#dc2626' }}
                  />
                </div>
                <p style={{ margin: 0, fontSize: '0.725rem', color: '#4b5563' }}>
                  Permanent medical contraindication (e.g. cardiac, chronic hepatitis history).
                </p>
              </label>
            </div>

            {/* Deferral Details (If Deferred) */}
            {decision !== DonorScreeningDecision.SELECTED && (
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#78350f', marginBottom: '0.35rem' }}>
                    Clinical Deferral Reason *
                  </label>
                  <input
                    type="text"
                    required
                    value={deferralReason}
                    onChange={(e) => setDeferralReason(e.target.value)}
                    placeholder="e.g. Low hemoglobin (11.8 g/dL), deferred for 30 days"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      fontSize: '0.825rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                {decision === DonorScreeningDecision.TEMPORARILY_DEFERRED && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#78350f', marginBottom: '0.35rem' }}>
                      Deferred Until Date (Follow-up)
                    </label>
                    <input
                      type="date"
                      value={deferredUntil}
                      onChange={(e) => setDeferredUntil(e.target.value)}
                      style={{
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.825rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Medical Officer Remarks / Clinical Notes
              </label>
              <textarea
                rows={2}
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
                placeholder="Optional clinical notes or instructions..."
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.825rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              paddingTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '0.65rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.65rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: decision === DonorScreeningDecision.SELECTED ? '#16a34a' : '#dc2626',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: decision === DonorScreeningDecision.SELECTED
                  ? '0 2px 4px rgba(22, 163, 74, 0.25)'
                  : '0 2px 4px rgba(220, 38, 38, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'background 0.15s ease',
              }}
            >
              {loading
                ? 'Saving...'
                : decision === DonorScreeningDecision.SELECTED
                ? '✓ Approve & Select for Donation'
                : 'Submit Deferral Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
