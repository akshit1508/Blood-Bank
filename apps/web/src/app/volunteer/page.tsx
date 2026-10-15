'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/public/PublicLayout';
import PublicPageHeader from '@/components/public/PublicPageHeader';
import {
  publicRegisterVolunteer,
  VolunteerAvailability,
  VolunteerRole,
  VOLUNTEER_ROLE_LABELS,
} from '@/lib/volunteer-api';

export default function VolunteerRegistrationPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    bloodGroup: 'O+',
    gender: 'MALE',
    city: '',
    address: '',
    occupation: '',
    availability: 'WEEKENDS' as VolunteerAvailability,
    skills: '',
    preferredRole: 'GENERAL' as VolunteerRole,
    consent: false,
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<{
    volunteerCode: string;
    message: string;
  } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.fullName.trim()) {
      setErrorMessage('Full name is required.');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMessage('Phone number is required.');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!formData.city.trim()) {
      setErrorMessage('City is required.');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!formData.consent) {
      setErrorMessage('Please confirm your consent to volunteer and be contacted for blood donation drives.');
      return;
    }

    try {
      setLoading(true);
      const res = await publicRegisterVolunteer({
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        bloodGroup: formData.bloodGroup,
        gender: formData.gender,
        city: formData.city.trim(),
        address: formData.address.trim() || undefined,
        occupation: formData.occupation.trim() || undefined,
        availability: formData.availability,
        skills: formData.skills.trim() || undefined,
        preferredRole: formData.preferredRole,
      });

      setSubmittedData({
        volunteerCode: res.volunteerCode,
        message: res.message,
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit volunteer application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem 1rem 3rem 1rem' }}>
        <PublicPageHeader
          title="Become a Volunteer"
          subtitle="Be the lifeline in your community. Join our Voluntary Blood Banking network and empower lifesaving blood donation camps."
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Volunteer With Us', href: '/volunteer' },
          ]}
        />

        {/* Motivational Banner */}
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            color: '#f8fafc',
          }}
        >
          <div
            style={{
              fontSize: '2.5rem',
              backgroundColor: '#881337',
              borderRadius: '12px',
              width: '58px',
              height: '58px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            🤝
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#fecdd3' }}>
              Why Volunteer With Our Blood Bank?
            </h3>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Volunteers assist at mobile collection drives, welcome donors, manage triage and refreshments, and spread community awareness. After submitting this form, our administration team will review your application and connect you with upcoming campaigns in your city.
            </p>
          </div>
        </div>

        {/* Success Confirmation Card */}
        {submittedData ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #10b981',
              borderRadius: '12px',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.1)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                backgroundColor: '#d1fae5',
                color: '#059669',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto 1.25rem auto',
              }}
            >
              ✓
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46', margin: '0 0 0.5rem 0' }}>
              Application Submitted Successfully!
            </h2>
            <p style={{ color: '#475569', fontSize: '0.95rem', margin: '0 0 1.25rem 0', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
              {submittedData.message}
            </p>

            <div
              style={{
                display: 'inline-block',
                backgroundColor: '#f1f5f9',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                marginBottom: '1.75rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                Your Volunteer Application Code
              </span>
              <strong style={{ fontSize: '1.25rem', color: '#0f172a', fontFamily: 'monospace' }}>
                {submittedData.volunteerCode}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Link
                href="/campaigns"
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                View Upcoming Donation Camps →
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSubmittedData(null);
                  setFormData({
                    fullName: '',
                    phone: '',
                    email: '',
                    bloodGroup: 'O+',
                    gender: 'MALE',
                    city: '',
                    address: '',
                    occupation: '',
                    availability: 'WEEKENDS',
                    skills: '',
                    preferredRole: 'GENERAL',
                    consent: false,
                  });
                }}
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Register Another Volunteer
              </button>
            </div>
          </div>
        ) : (
          /* Registration Form */
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.75rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}
          >
            {errorMessage && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  fontSize: '0.875rem',
                }}
              >
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Section 1: Personal Details */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>👤</span> 1. Personal & Contact Information
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      name="fullName"
                      placeholder="e.g. Ananya Sharma"
                      value={formData.fullName}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Phone / Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      name="phone"
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="volunteer@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Blood Group
                    </label>
                    <select
                      name="bloodGroup"
                      value={formData.bloodGroup}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="O+">O Positive (O+)</option>
                      <option value="O-">O Negative (O-)</option>
                      <option value="A+">A Positive (A+)</option>
                      <option value="A-">A Negative (A-)</option>
                      <option value="B+">B Positive (B+)</option>
                      <option value="B-">B Negative (B-)</option>
                      <option value="AB+">AB Positive (AB+)</option>
                      <option value="AB-">AB Negative (AB-)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Gender
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      name="city"
                      placeholder="e.g. Mumbai, Pune, Nagpur"
                      value={formData.city}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Residential Area / Address
                    </label>
                    <input
                      type="text"
                      name="address"
                      placeholder="e.g. Andheri East, Sector 4"
                      value={formData.address}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

              {/* Section 2: Availability & Role */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⏱️</span> 2. Availability & Preferred Volunteer Role
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Availability
                    </label>
                    <select
                      name="availability"
                      value={formData.availability}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="WEEKENDS">Weekends Only (Sat / Sun)</option>
                      <option value="WEEKDAYS">Weekdays</option>
                      <option value="ANYTIME">Anytime / Flexible</option>
                      <option value="ON_CALL">On-Call for Emergency Camps</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Preferred Role in Blood Drives
                    </label>
                    <select
                      name="preferredRole"
                      value={formData.preferredRole}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      {Object.entries(VOLUNTEER_ROLE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Profession / Occupation (Optional)
                    </label>
                    <input
                      type="text"
                      name="occupation"
                      placeholder="e.g. College Student, Nurse, IT Professional, Teacher"
                      value={formData.occupation}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Skills or Prior Experience (Optional)
                    </label>
                    <input
                      type="text"
                      name="skills"
                      placeholder="e.g. First Aid certified, Social Media, Public Speaking"
                      value={formData.skills}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Consent and Submit */}
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="consent"
                    checked={formData.consent}
                    onChange={handleChange}
                    style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.825rem', color: '#475569', lineHeight: 1.45 }}>
                    I agree to register as a voluntary helper for community blood donation drives and consent to being contacted by Blood Bank administrators via WhatsApp / Phone for camp coordination.
                  </span>
                </label>
              </div>

              {errorMessage && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>⚠️</span> {errorMessage}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Link
                  href="/"
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.65rem 1.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                  }}
                >
                  <span>🤝</span> {loading ? 'Submitting Application...' : 'Submit Volunteer Application'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
