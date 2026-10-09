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
  buildBloodRequestWhatsAppUrl,
} from '@/lib/blood-request-api';

const WhatsAppIcon = ({ size = 15 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

export default function PublicBloodRequestPage() {
  const [formData, setFormData] = useState({
    patientName: '',
    patientAge: '',
    patientGender: 'MALE',
    patientPhone: '',
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
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!submittedRequest?.requestCode) return;
    try {
      await navigator.clipboard.writeText(submittedRequest.requestCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = submittedRequest.requestCode;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
      document.body.removeChild(textArea);
    }
  };

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
          phone: formData.patientPhone.trim() || undefined,
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
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.6rem',
                minWidth: '320px',
                maxWidth: '100%',
                marginBottom: '1rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Unique Request Reference Code
              </span>
              <strong style={{ fontSize: '1.6rem', color: '#0f172a', letterSpacing: '0.08em' }}>
                {submittedRequest.requestCode}
              </strong>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label="Copy Request Code"
                style={{
                  marginTop: '0.25rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: copied ? '#dcfce7' : '#f8fafc',
                  color: copied ? '#15803d' : '#334155',
                  border: '1px solid',
                  borderColor: copied ? '#86efac' : '#cbd5e1',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                }}
              >
                {copied ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Request Code Copied!</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copy Request Code</span>
                  </>
                )}
              </button>
            </div>

            <p style={{ color: '#475569', fontSize: '0.875rem', margin: '0 auto 1.5rem auto', maxWidth: '480px', lineHeight: 1.5 }}>
              Please save your request reference code for future tracking and reference when communicating with the blood bank.
            </p>

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
              {submittedRequest.patient.phone && (
                <div><strong>Patient Phone:</strong> {submittedRequest.patient.phone}</div>
              )}
              <div><strong>Relative / Contact:</strong> {submittedRequest.contactPerson.name} ({submittedRequest.contactPerson.relationship}) — {submittedRequest.contactPerson.phone}</div>
              <div><strong>Blood Group:</strong> <span style={{ color: '#dc2626', fontWeight: 700 }}>{submittedRequest.bloodGroup}</span> ({submittedRequest.componentType})</div>
              <div><strong>Units Requested:</strong> {submittedRequest.unitsRequested} Unit(s)</div>
              <div><strong>Hospital:</strong> {submittedRequest.hospitalName}</div>
              <div><strong>Priority:</strong> {submittedRequest.priority}</div>
            </div>

            <button
              onClick={() => {
                setSubmittedRequest(null);
                setCopied(false);
                setFormData((prev) => ({
                  ...prev,
                  patientName: '',
                  patientAge: '',
                  patientPhone: '',
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
            className="public-form-card"
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
                  <div style={{ gridColumn: '1 / -1' }}>
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

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Patient Phone <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional, for WhatsApp)</span>
                    </label>
                    <input
                      type="tel"
                      name="patientPhone"
                      value={formData.patientPhone}
                      onChange={handleChange}
                      placeholder="e.g. +91 9876543210"
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
                className="public-cta-group"
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
