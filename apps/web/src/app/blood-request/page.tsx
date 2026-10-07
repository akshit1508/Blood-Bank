'use client';

import React, { useState } from 'react';
import PublicLayout from '@/components/public/PublicLayout';
import PublicPageHeader from '@/components/public/PublicPageHeader';
import {
  BloodComponent,
  BloodGroup,
  RequestPriority,
  createBloodRequest,
  BloodRequest,
} from '@/lib/blood-request-api';

export default function PublicBloodRequestPage() {
  const [formData, setFormData] = useState({
    patientName: '',
    patientAge: '',
    patientGender: 'MALE',
    bloodGroup: BloodGroup.A_POSITIVE,
    componentType: BloodComponent.WHOLE_BLOOD,
    unitsRequested: '1',
    hospitalName: '',
    doctorName: '',
    doctorContact: '',
    hospitalCaseNumber: '',
    priority: RequestPriority.ROUTINE,
    contactName: '',
    contactPhone: '',
    contactRelationship: '',
    requiredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    medicalJustification: '',
    additionalNotes: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] =
    useState<BloodRequest | null>(null);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await createBloodRequest({
        patient: {
          name: formData.patientName.trim(),
          age: Number(formData.patientAge),
          gender: formData.patientGender,
        },
        bloodGroup: formData.bloodGroup,
        componentType: formData.componentType,
        unitsRequested: Number(formData.unitsRequested),
        hospitalName: formData.hospitalName.trim(),
        doctorName: formData.doctorName.trim(),
        doctorContact: formData.doctorContact.trim() || undefined,
        hospitalCaseNumber: formData.hospitalCaseNumber.trim() || undefined,
        priority: formData.priority,
        contactPerson: {
          name: formData.contactName.trim(),
          phone: formData.contactPhone.trim(),
          relationship: formData.contactRelationship.trim(),
        },
        requiredDate: formData.requiredDate,
        medicalJustification:
          formData.medicalJustification.trim() || undefined,
        additionalNotes: formData.additionalNotes.trim() || undefined,
      });

      setSubmittedRequest(response);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <PublicPageHeader
          title="Blood Request"
          subtitle="Submit an emergency or scheduled blood request directly to our blood bank centre. No public login required."
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Blood Request' },
          ]}
        />

        {/* Success State */}
        {submittedRequest ? (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '10px',
              padding: '2.5rem 2rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2.75rem', marginBottom: '0.5rem', color: '#16a34a' }}>✓</div>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#15803d', fontSize: '1.5rem' }}>
              Blood Request Submitted Successfully
            </h2>
            <p style={{ color: '#166534', margin: '0.5rem 0 1.5rem 0', fontSize: '0.95rem' }}>
              Your request has been registered in the system with status <strong>{submittedRequest.status}</strong>.
            </p>

            <div
              style={{
                background: '#ffffff',
                border: '1px dashed #4ade80',
                borderRadius: '8px',
                padding: '1.25rem 2rem',
                display: 'inline-block',
                minWidth: '320px',
                marginBottom: '1.75rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Unique Request Reference Code
              </span>
              <strong style={{ fontSize: '1.6rem', color: '#0f172a', letterSpacing: '0.08em' }}>
                {submittedRequest.requestCode}
              </strong>
            </div>

            <div
              style={{
                textAlign: 'left',
                maxWidth: '480px',
                margin: '0 auto 2rem auto',
                background: '#ffffff',
                padding: '1.25rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              }}
            >
              <div><strong>Patient:</strong> {submittedRequest.patient.name} ({submittedRequest.patient.age}y, {submittedRequest.patient.gender})</div>
              <div><strong>Blood Group:</strong> <span style={{ color: '#dc2626', fontWeight: 700 }}>{submittedRequest.bloodGroup}</span> ({submittedRequest.componentType})</div>
              <div><strong>Units Requested:</strong> {submittedRequest.unitsRequested} Unit(s)</div>
              <div><strong>Hospital:</strong> {submittedRequest.hospitalName}</div>
              <div><strong>Priority:</strong> {submittedRequest.priority}</div>
            </div>

            <button
              onClick={() => {
                setSubmittedRequest(null);
                setFormData((prev) => ({
                  ...prev,
                  patientName: '',
                  patientAge: '',
                  medicalJustification: '',
                  additionalNotes: '',
                }));
              }}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '0.7rem 1.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.95rem',
              }}
            >
              Submit Another Request
            </button>
          </div>
        ) : (
          /* Form Card */
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '2rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            {errorMessage && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  marginBottom: '1.5rem',
                  fontSize: '0.9rem',
                }}
              >
                <strong>Submission Error: </strong> {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Section 1: Patient Information */}
              <div style={{ marginBottom: '2rem' }}>
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  1. Patient Information
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Patient Full Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="patientName"
                      required
                      value={formData.patientName}
                      onChange={handleChange}
                      placeholder="e.g. Jane Doe"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Age <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      name="patientAge"
                      required
                      min="0"
                      max="130"
                      value={formData.patientAge}
                      onChange={handleChange}
                      placeholder="e.g. 34"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Gender <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      name="patientGender"
                      value={formData.patientGender}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Blood Product Requirements */}
              <div style={{ marginBottom: '2rem' }}>
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  2. Blood Product Requirements
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Blood Group <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      name="bloodGroup"
                      value={formData.bloodGroup}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#dc2626',
                        boxSizing: 'border-box',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      {Object.values(BloodGroup).map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Component <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      name="componentType"
                      value={formData.componentType}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <option value={BloodComponent.WHOLE_BLOOD}>Whole Blood</option>
                      <option value={BloodComponent.PRBC}>PRBC (Red Cells)</option>
                      <option value={BloodComponent.FFP}>FFP (Plasma)</option>
                      <option value={BloodComponent.PLATELETS}>Platelets</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Quantity (Units) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      name="unitsRequested"
                      required
                      min="1"
                      max="20"
                      value={formData.unitsRequested}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Priority <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <option value={RequestPriority.ROUTINE}>Routine</option>
                      <option value={RequestPriority.URGENT}>Urgent</option>
                      <option value={RequestPriority.CRITICAL_EMERGENCY}>Critical Emergency</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Required By Date <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    name="requiredDate"
                    required
                    value={formData.requiredDate}
                    onChange={handleChange}
                    style={{
                      maxWidth: '240px',
                      width: '100%',
                      height: '40px',
                      padding: '0 0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Section 3: Hospital & Clinical Details */}
              <div style={{ marginBottom: '2rem' }}>
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  3. Hospital & Clinical Details
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Hospital / Clinic Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="hospitalName"
                      required
                      value={formData.hospitalName}
                      onChange={handleChange}
                      placeholder="e.g. City General Hospital"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Hospital Case / Admission No.
                    </label>
                    <input
                      type="text"
                      name="hospitalCaseNumber"
                      value={formData.hospitalCaseNumber}
                      onChange={handleChange}
                      placeholder="e.g. CAS-9821"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Attending Doctor Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="doctorName"
                      required
                      value={formData.doctorName}
                      onChange={handleChange}
                      placeholder="e.g. Dr. Sarah Jenkins"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Doctor Contact / Pager
                    </label>
                    <input
                      type="text"
                      name="doctorContact"
                      value={formData.doctorContact}
                      onChange={handleChange}
                      placeholder="e.g. +1 (555) 0192"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Requester / Contact Person */}
              <div style={{ marginBottom: '2rem' }}>
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  4. Requester / Contact Person
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Contact Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="contactName"
                      required
                      value={formData.contactName}
                      onChange={handleChange}
                      placeholder="e.g. Robert Doe"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Phone Number <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="tel"
                      name="contactPhone"
                      required
                      value={formData.contactPhone}
                      onChange={handleChange}
                      placeholder="e.g. +1 (555) 0144"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Relationship to Patient <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="contactRelationship"
                      required
                      value={formData.contactRelationship}
                      onChange={handleChange}
                      placeholder="e.g. Spouse / Brother / Self"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Clinical Justification & Notes */}
              <div style={{ marginBottom: '2rem' }}>
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  5. Clinical Justification & Notes
                </h3>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Medical Justification
                  </label>
                  <textarea
                    name="medicalJustification"
                    rows={2}
                    value={formData.medicalJustification}
                    onChange={handleChange}
                    placeholder="e.g. Scheduled emergency surgery / Acute gastrointestinal hemorrhage"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Additional Notes
                  </label>
                  <textarea
                    name="additionalNotes"
                    rows={2}
                    value={formData.additionalNotes}
                    onChange={handleChange}
                    placeholder="Any special handling or rapid delivery requirements"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '1.25rem',
                }}
              >
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    backgroundColor: loading ? '#94a3b8' : '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.75rem 2rem',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {loading ? 'Submitting Blood Request...' : 'Submit Blood Request'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
