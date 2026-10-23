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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 via-rose-700 to-red-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-white/20 rounded-md tracking-wider">
                PHASE 2 CLINICAL GATE
              </span>
              <span className="text-xs text-red-200">NBTC / DGHS Guidelines</span>
            </div>
            <h2 className="text-xl font-bold mt-0.5">Pre-Donation Medical Screening & Examination</h2>
            <p className="text-xs text-red-100">
              Donor: <span className="font-semibold">{donor.fullName}</span> ({donor.donorCode}) • Blood Group: <span className="font-bold underline">{donor.bloodGroup}</span> • Gender: {donor.gender}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-red-800 text-sm">
              <span className="font-semibold">Screening Blocked:</span> {errorMessage}
            </div>
          )}

          {/* Section 1: Physical Examination (Vitals) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">1</span>
                Physical Examination & Vitals
              </h3>
              <span className="text-xs text-slate-500">Statutory Indian Limits (NBTC)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {/* Weight */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:outline-none ${
                    isWeightValid ? 'border-slate-300 focus:ring-emerald-500' : 'border-red-400 bg-red-50 text-red-700 focus:ring-red-500'
                  }`}
                />
                <span className={`text-[11px] font-medium block mt-1 ${isWeightValid ? 'text-emerald-600' : 'text-red-600 font-bold'}`}>
                  {isWeightValid ? '✓ Minimum 45 kg met' : '✗ Below 45 kg: Ineligible'}
                </span>
              </div>

              {/* Hemoglobin */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:outline-none ${
                    isHbValid ? 'border-slate-300 focus:ring-emerald-500' : 'border-red-400 bg-red-50 text-red-700 focus:ring-red-500'
                  }`}
                />
                <span className={`text-[11px] font-medium block mt-1 ${isHbValid ? 'text-emerald-600' : 'text-red-600 font-bold'}`}>
                  {isHbValid ? '✓ Minimum 12.5 g/dL met' : '✗ Below 12.5: Ineligible'}
                </span>
              </div>

              {/* Blood Pressure Systolic */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  BP Systolic (mmHg) *
                </label>
                <input
                  type="number"
                  min="60"
                  max="240"
                  required
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-500 block mt-1">Normal: 100-140</span>
              </div>

              {/* Blood Pressure Diastolic */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  BP Diastolic (mmHg) *
                </label>
                <input
                  type="number"
                  min="40"
                  max="140"
                  required
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-500 block mt-1">Normal: 60-90</span>
              </div>

              {/* Pulse */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pulse (bpm) *
                </label>
                <input
                  type="number"
                  min="40"
                  max="180"
                  required
                  value={pulseBpm}
                  onChange={(e) => setPulseBpm(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className={`text-[11px] block mt-1 ${isPulseValid ? 'text-emerald-600' : 'text-amber-600 font-semibold'}`}>
                  {isPulseValid ? '✓ Normal (60-100)' : '⚠️ Out of normal range'}
                </span>
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className={`text-[11px] block mt-1 ${isTempValid ? 'text-emerald-600' : 'text-red-600 font-bold'}`}>
                  {isTempValid ? '✓ Afebrile (≤ 37.5°C)' : '✗ Fever detected'}
                </span>
              </div>

              {/* Vein Access */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vein Prominence
                </label>
                <select
                  value={veinAccess}
                  onChange={(e) => setVeinAccess(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                >
                  <option value="GOOD">Good (Prominent antecubital)</option>
                  <option value="FAIR">Fair (Palpable)</option>
                  <option value="POOR">Poor (Difficult puncture)</option>
                </select>
              </div>

              {/* General Appearance */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  General Health / Appearance
                </label>
                <input
                  type="text"
                  value={generalAppearance}
                  onChange={(e) => setGeneralAppearance(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Health Questionnaire */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">2</span>
                Pre-Donation Medical Risk Questionnaire
              </h3>
              <span className="text-xs text-slate-500">Confidential Medical Record</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={feelingWellToday}
                  onChange={(e) => setFeelingWellToday(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="font-semibold text-slate-800">Feeling well & in good health today?</span>
                  <p className="text-[11px] text-slate-500">Normal sleep, adequate meal taken within 4 hours.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={alcoholIntakeLast24Hours}
                  onChange={(e) => setAlcoholIntakeLast24Hours(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="font-semibold text-red-800">Alcohol consumption in last 24 hours?</span>
                  <p className="text-[11px] text-slate-500">Requires minimum 24-hour deferral.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={recentIllnessOrFever}
                  onChange={(e) => setRecentIllnessOrFever(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="font-semibold text-slate-800">Recent fever, sore throat or infection in past 15 days?</span>
                  <p className="text-[11px] text-slate-500">Defferal until full recovery.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={tattooPiercingLast12Months}
                  onChange={(e) => setTattooPiercingLast12Months(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="font-semibold text-slate-800">Tattoo, body piercing or acupuncture in past 12 months?</span>
                  <p className="text-[11px] text-slate-500">Mandatory 12-month deferral.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={majorSurgeryOrDentalRecent}
                  onChange={(e) => setMajorSurgeryOrDentalRecent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="font-semibold text-slate-800">Dental extraction (72h) or surgery (6 months)?</span>
                  <p className="text-[11px] text-slate-500">Clinical deferral period.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={cardiacOrRespiratoryDisease}
                  onChange={(e) => setCardiacOrRespiratoryDisease(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="font-semibold text-red-700">Heart disease, epilepsy or asthma on steroid therapy?</span>
                  <p className="text-[11px] text-slate-500">Permanent deferral for donor safety.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={historyOfJaundiceOrHepatitis}
                  onChange={(e) => setHistoryOfJaundiceOrHepatitis(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="font-semibold text-red-700">History of Jaundice, Hepatitis B/C, or HIV risk?</span>
                  <p className="text-[11px] text-slate-500">Permanent contraindication.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={takingMedications}
                  onChange={(e) => setTakingMedications(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="font-semibold text-slate-800">Currently taking antibiotics, blood thinners or aspirin?</span>
                  <p className="text-[11px] text-slate-500">Aspirin: 48h platelet deferral; Antibiotics: 72h.</p>
                </div>
              </label>
            </div>

            {takingMedications && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Specify medication names and dosage..."
                  value={medicationDetails}
                  onChange={(e) => setMedicationDetails(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
            )}
          </div>

          {/* Section 3: Informed Consent & Clinical Decision */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">3</span>
                Clinical Decision & Informed Consent
              </h3>
            </div>

            {/* Informed Consent Confirmation */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 mb-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={consentAcknowledged}
                  onChange={(e) => setConsentAcknowledged(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-red-600"
                />
                <span className="text-xs text-slate-800 font-medium">
                  Donor signed the statutory blood donation declaration acknowledging truthfulness of medical history and voluntary consent.
                </span>
              </label>
            </div>

            {/* Decision Radio Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <label
                className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                  decision === DonorScreeningDecision.SELECTED
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">SELECTED (Approved)</span>
                  <input
                    type="radio"
                    name="decision"
                    value={DonorScreeningDecision.SELECTED}
                    checked={decision === DonorScreeningDecision.SELECTED}
                    onChange={() => setDecision(DonorScreeningDecision.SELECTED)}
                    className="text-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Passed all NBTC examination limits. Proceed to collection.</p>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                  decision === DonorScreeningDecision.TEMPORARILY_DEFERRED
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">TEMPORARY DEFERRAL</span>
                  <input
                    type="radio"
                    name="decision"
                    value={DonorScreeningDecision.TEMPORARILY_DEFERRED}
                    checked={decision === DonorScreeningDecision.TEMPORARILY_DEFERRED}
                    onChange={() => setDecision(DonorScreeningDecision.TEMPORARILY_DEFERRED)}
                    className="text-amber-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Temporary condition (e.g. low Hb, fever, alcohol). Re-screen later.</p>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                  decision === DonorScreeningDecision.PERMANENTLY_DEFERRED
                    ? 'border-red-500 bg-red-50 text-red-900 shadow-sm ring-1 ring-red-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">PERMANENT DEFERRAL</span>
                  <input
                    type="radio"
                    name="decision"
                    value={DonorScreeningDecision.PERMANENTLY_DEFERRED}
                    checked={decision === DonorScreeningDecision.PERMANENTLY_DEFERRED}
                    onChange={() => setDecision(DonorScreeningDecision.PERMANENTLY_DEFERRED)}
                    className="text-red-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Permanent medical contraindication (e.g. cardiac, hepatitis history).</p>
              </label>
            </div>

            {/* Deferral Details (If Deferred) */}
            {decision !== DonorScreeningDecision.SELECTED && (
              <div className="space-y-3 p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clinical Deferral Reason *
                  </label>
                  <input
                    type="text"
                    required
                    value={deferralReason}
                    onChange={(e) => setDeferralReason(e.target.value)}
                    placeholder="e.g. Low hemoglobin (11.8 g/dL), deferred for iron therapy"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                {decision === DonorScreeningDecision.TEMPORARILY_DEFERRED && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Deferred Until Date (Follow-up)
                    </label>
                    <input
                      type="date"
                      value={deferredUntil}
                      onChange={(e) => setDeferredUntil(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Medical Officer Remarks / Clinical Notes
              </label>
              <textarea
                rows={2}
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
                placeholder="Optional clinical notes or instructions..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 text-sm font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 ${
                decision === DonorScreeningDecision.SELECTED
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? 'Saving...' : decision === DonorScreeningDecision.SELECTED ? '✓ Approve & Select for Donation' : 'Submit Deferral Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
