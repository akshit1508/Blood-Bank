'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  searchPatients,
  createBloodRequest,
  attachSupportingDocument,
  verifySupportingDocuments,
  fetchBloodAvailabilitySummary,
  PatientSearchResult,
} from '@/lib/receptionist-api';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const BLOOD_COMPONENTS = [
  { value: 'WHOLE_BLOOD', label: 'Whole Blood (WB)' },
  { value: 'PRBC', label: 'Packed Red Blood Cells (PRBC)' },
  { value: 'FFP', label: 'Fresh Frozen Plasma (FFP)' },
  { value: 'PLATELETS', label: 'Platelet Concentrate' },
];

export default function ReceptionistNewPatientPage() {
  const router = useRouter();

  // Search existing patient state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedExisting, setSelectedExisting] = useState<PatientSearchResult | null>(null);

  // Availability summary for quick check
  const [availability, setAvailability] = useState<any>(null);

  // Form fields
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState<number | ''>('');
  const [patientGender, setPatientGender] = useState('MALE');
  const [patientPhone, setPatientPhone] = useState('');

  const [bloodGroup, setBloodGroup] = useState('O+');
  const [componentType, setComponentType] = useState('PRBC');
  const [unitsRequested, setUnitsRequested] = useState<number>(1);
  const [priority, setPriority] = useState('ROUTINE');

  const [hospitalName, setHospitalName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorContact, setDoctorContact] = useState('');
  const [hospitalCaseNumber, setHospitalCaseNumber] = useState('');
  const [requiredDate, setRequiredDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelationship, setContactRelationship] = useState('Relative');

  const [medicalJustification, setMedicalJustification] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Document Uploads
  const [prescriptionAttached, setPrescriptionAttached] = useState(false);
  const [prescriptionFileName, setPrescriptionFileName] = useState('');
  const [patientIdAttached, setPatientIdAttached] = useState(false);
  const [patientIdFileName, setPatientIdFileName] = useState('');
  const [doctorRequisitionAttached, setDoctorRequisitionAttached] = useState(false);
  const [doctorRequisitionFileName, setDoctorRequisitionFileName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchBloodAvailabilitySummary()
      .then((res) => setAvailability(res))
      .catch(() => {});
  }, []);

  // Search existing patients when typing
  const handleSearchPatient = async (q: string) => {
    setSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const res = await searchPatients(q);
      setSearchResults(res);
    } catch {
      // Silently ignore
    } finally {
      setSearching(false);
    }
  };

  const handleSelectExisting = (patient: PatientSearchResult) => {
    setSelectedExisting(patient);
    setPatientName(patient.name);
    setPatientAge(patient.age);
    setPatientGender(patient.gender);
    setPatientPhone(patient.phone);
    if (patient.bloodGroup) setBloodGroup(patient.bloodGroup);
    if (patient.hospitalName) setHospitalName(patient.hospitalName);
    if (patient.doctorName) setDoctorName(patient.doctorName);
    if (patient.hospitalCaseNumber) setHospitalCaseNumber(patient.hospitalCaseNumber);
    setSearchResults([]);
  };

  const handleClearSelected = () => {
    setSelectedExisting(null);
    setPatientName('');
    setPatientAge('');
    setPatientPhone('');
  };

  // Check available count for selected group & component
  const availableStockCount = React.useMemo(() => {
    if (!availability?.byGroupAndComponent) return 0;
    const groupData = availability.byGroupAndComponent[bloodGroup];
    if (!groupData) return 0;
    return groupData[componentType] || 0;
  }, [availability, bloodGroup, componentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!patientName.trim()) {
      setError('Patient name is required.');
      return;
    }
    if (patientAge === '' || Number(patientAge) < 0) {
      setError('Valid patient age is required.');
      return;
    }
    if (!hospitalName.trim() || !doctorName.trim()) {
      setError('Hospital name and prescribing doctor name are required.');
      return;
    }
    if (!contactName.trim() || !contactPhone.trim()) {
      setError('Contact person details are required for identification.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        patient: {
          name: patientName.trim(),
          age: Number(patientAge),
          gender: patientGender,
          phone: patientPhone.trim() || undefined,
        },
        bloodGroup,
        componentType,
        unitsRequested: Number(unitsRequested),
        hospitalName: hospitalName.trim(),
        doctorName: doctorName.trim(),
        doctorContact: doctorContact.trim() || undefined,
        hospitalCaseNumber: hospitalCaseNumber.trim() || undefined,
        priority,
        contactPerson: {
          name: contactName.trim(),
          phone: contactPhone.trim(),
          relationship: contactRelationship.trim(),
        },
        requiredDate: new Date(requiredDate).toISOString(),
        medicalJustification: medicalJustification.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
      };

      const created = await createBloodRequest(payload);
      const requestId = created._id;

      // Attach documents if provided
      if (prescriptionAttached && requestId) {
        await attachSupportingDocument(requestId, {
          documentType: 'PRESCRIPTION',
          fileName: prescriptionFileName || 'Doctor_Prescription.pdf',
          fileUrl: 'internal://secure-doc/prescription',
          notes: 'Verified by receptionist at registration desk',
        });
      }
      if (patientIdAttached && requestId) {
        await attachSupportingDocument(requestId, {
          documentType: 'PATIENT_ID',
          fileName: patientIdFileName || 'Patient_Identity_Card.pdf',
          fileUrl: 'internal://secure-doc/id',
          notes: 'Identity confirmed against physical card',
        });
      }
      if (doctorRequisitionAttached && requestId) {
        await attachSupportingDocument(requestId, {
          documentType: 'HOSPITAL_LETTER',
          fileName: doctorRequisitionFileName || 'Hospital_Requisition.pdf',
          fileUrl: 'internal://secure-doc/hospital-letter',
          notes: 'Official hospital letterhead verified',
        });
      }

      // If prescription or requisition is attached, mark documents verified so request advances to VERIFIED
      if ((prescriptionAttached || doctorRequisitionAttached) && requestId) {
        await verifySupportingDocuments(requestId, {
          status: 'VERIFIED',
          notes: 'Receptionist verified supporting prescription and patient identity documents.',
        });
      }

      setSuccess(`Request ${created.requestCode} successfully created for ${patientName}! Redirecting to Issue Desk...`);
      setTimeout(() => {
        router.push('/receptionist/requests');
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit blood request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
          Patient Registration & Blood Request Desk
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
          Check in patient arrivals, verify clinical requisitions and supporting documentation, and initiate blood requests.
        </p>
      </div>

      {/* Step 1: Duplicate Prevention Search Bar */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
            🔍 Step 1: Check Existing Patient Record (Prevent Duplicate Registration)
          </label>
          {selectedExisting && (
            <button
              type="button"
              onClick={handleClearSelected}
              style={{
                backgroundColor: 'transparent',
                color: '#f87171',
                border: 'none',
                fontSize: '0.775rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ✕ Clear Selected Patient
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder="Search by phone number, patient name, case number, or request code..."
          value={searchQuery}
          onChange={(e) => handleSearchPatient(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            fontSize: '0.85rem',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />

        {searching && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>Searching database...</div>}

        {/* Search Results Dropdown List */}
        {searchResults.length > 0 && (
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              marginTop: '0.5rem',
              maxHeight: '220px',
              overflowY: 'auto',
            }}
          >
            {searchResults.map((p) => (
              <div
                key={p.patientKey}
                onClick={() => handleSelectExisting(p)}
                style={{
                  padding: '0.65rem 0.85rem',
                  borderBottom: '1px solid #334155',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div>
                  <strong style={{ color: '#f8fafc' }}>{p.name}</strong>{' '}
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    ({p.age}y / {p.gender}) • Phone: {p.phone || 'N/A'} • Case: {p.hospitalCaseNumber || 'N/A'}
                  </span>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Hospital: {p.hospitalName} • Prior Requests: {p.totalRequests}
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  Select Patient
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedExisting && (
          <div
            style={{
              backgroundColor: '#064e3b',
              border: '1px solid #059669',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              marginTop: '0.75rem',
              fontSize: '0.8rem',
              color: '#a7f3d0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              ✓ Linked to existing patient: <strong>{selectedExisting.name}</strong> (Total {selectedExisting.totalRequests} previous requests)
            </span>
            <span style={{ fontFamily: 'monospace', color: '#6ee7b7' }}>Last: {selectedExisting.lastRequestCode}</span>
          </div>
        )}
      </div>

      {error && (
        <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '1rem', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{ backgroundColor: '#064e3b', border: '1px solid #059669', borderRadius: '8px', padding: '1rem', color: '#6ee7b7', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          ✓ {success}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit}>
        {/* Patient Details Section */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 1rem 0' }}>
            Patient Information
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Patient Full Name *</label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Age (Years) *</label>
              <input
                type="number"
                required
                min={0}
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 35"
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Gender *</label>
              <select
                value={patientGender}
                onChange={(e) => setPatientGender(e.target.value)}
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Contact Phone</label>
              <input
                type="tel"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="e.g. +91 9876543210"
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Clinical Request Details Section */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Blood Component & Stock Check
            </h2>

            {/* Live Availability Badge */}
            <div
              style={{
                backgroundColor: availableStockCount > 0 ? '#064e3b' : '#450a0a',
                color: availableStockCount > 0 ? '#6ee7b7' : '#fca5a5',
                border: `1px solid ${availableStockCount > 0 ? '#059669' : '#dc2626'}`,
                padding: '0.3rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {availableStockCount > 0
                ? `✓ ${availableStockCount} unit(s) of ${bloodGroup} ${componentType} available in inventory`
                : `⚠️ 0 units of ${bloodGroup} ${componentType} currently available`}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Blood Group *</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Blood Component *</label>
              <select
                value={componentType}
                onChange={(e) => setComponentType(e.target.value)}
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              >
                {BLOOD_COMPONENTS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Units Requested *</label>
              <input
                type="number"
                required
                min={1}
                max={10}
                value={unitsRequested}
                onChange={(e) => setUnitsRequested(Number(e.target.value))}
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Clinical Priority *</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              >
                <option value="ROUTINE">Routine Schedule</option>
                <option value="URGENT">Urgent (Within 4 hours)</option>
                <option value="CRITICAL_EMERGENCY">Critical Emergency (Immediate)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Hospital & Doctor Info Section */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 1rem 0' }}>
            Hospital & Treating Doctor Information
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Hospital / Clinic Name *</label>
              <input
                type="text"
                required
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="e.g. City General Hospital"
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Prescribing Doctor Name *</label>
              <input
                type="text"
                required
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. A. K. Verma"
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Doctor Contact Phone</label>
              <input
                type="tel"
                value={doctorContact}
                onChange={(e) => setDoctorContact(e.target.value)}
                placeholder="e.g. +91 9123456789"
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Hospital Case / Admission #</label>
              <input
                type="text"
                value={hospitalCaseNumber}
                onChange={(e) => setHospitalCaseNumber(e.target.value)}
                placeholder="e.g. IPD-88214"
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Supporting Document Verification Checklist */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Supporting Document Verification
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>
              Verify required documents prior to blood issuance. Blood cannot be released without clinical prescription.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Prescription */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <input
                  type="checkbox"
                  id="chk-prescription"
                  checked={prescriptionAttached}
                  onChange={(e) => setPrescriptionAttached(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="chk-prescription" style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                  Doctor&apos;s Prescription / Clinical Requisition Slip (Mandatory)
                </label>
              </div>

              {prescriptionAttached && (
                <input
                  type="text"
                  placeholder="Document ref or filename (e.g. Rx_Verma_2026.pdf)"
                  value={prescriptionFileName}
                  onChange={(e) => setPrescriptionFileName(e.target.value)}
                  style={{ backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                />
              )}
            </div>

            {/* Patient ID */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <input
                  type="checkbox"
                  id="chk-id"
                  checked={patientIdAttached}
                  onChange={(e) => setPatientIdAttached(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="chk-id" style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                  Patient Identity Proof (Aadhaar / Voter ID / Hospital Card)
                </label>
              </div>

              {patientIdAttached && (
                <input
                  type="text"
                  placeholder="Document ref or filename (e.g. Aadhaar_Photo.jpg)"
                  value={patientIdFileName}
                  onChange={(e) => setPatientIdFileName(e.target.value)}
                  style={{ backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                />
              )}
            </div>

            {/* Hospital Requisition Letter */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <input
                  type="checkbox"
                  id="chk-letter"
                  checked={doctorRequisitionAttached}
                  onChange={(e) => setDoctorRequisitionAttached(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="chk-letter" style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                  Official Hospital Requisition Letterhead & Crossmatch Request
                </label>
              </div>

              {doctorRequisitionAttached && (
                <input
                  type="text"
                  placeholder="Document ref or filename (e.g. Hospital_Requisition.pdf)"
                  value={doctorRequisitionFileName}
                  onChange={(e) => setDoctorRequisitionFileName(e.target.value)}
                  style={{ backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Contact Person Details */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 1rem 0' }}>
            Accompanying Person / Requester Contact
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Contact Name *</label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Amit Sharma"
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Contact Phone *</label>
              <input
                type="tel"
                required
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="e.g. +91 9876543210"
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Relationship to Patient</label>
              <input
                type="text"
                value={contactRelationship}
                onChange={(e) => setContactRelationship(e.target.value)}
                placeholder="e.g. Brother / Relative / Friend"
                style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Submit Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.65rem 1.25rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.65rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
            }}
          >
            {submitting ? 'Registering & Verifying...' : 'Submit Patient Request & Verify Documents'}
          </button>
        </div>
      </form>
    </div>
  );
}
