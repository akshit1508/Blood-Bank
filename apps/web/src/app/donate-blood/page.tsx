'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/public/PublicLayout';
import PublicPageHeader from '@/components/public/PublicPageHeader';
import {
  BloodGroup,
  Gender,
  registerDonor,
} from '@/lib/donor-api';
import {
  calculateCompletedAge,
  MIN_WHOLE_BLOOD_DONOR_AGE,
  MAX_WHOLE_BLOOD_DONOR_AGE,
  SENIOR_FIRST_TIME_SCREENING_AGE,
} from '@/lib/eligibility';

export default function DonateBloodPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: Gender.MALE,
    bloodGroup: BloodGroup.A_POSITIVE,
    phone: '',
    email: '',
    address: '',
    city: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    consent: false,
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredDonorCode, setRegisteredDonorCode] = useState<string | null>(null);

  // Exact completed age calculation immediately upon entering DOB
  const calculatedAge = useMemo(() => {
    if (!formData.dateOfBirth) return null;
    const birthDate = new Date(formData.dateOfBirth);
    if (isNaN(birthDate.getTime())) return null;
    return calculateCompletedAge(birthDate);
  }, [formData.dateOfBirth]);

  const isAgeInvalid =
    calculatedAge !== null &&
    (calculatedAge < MIN_WHOLE_BLOOD_DONOR_AGE ||
      calculatedAge > MAX_WHOLE_BLOOD_DONOR_AGE);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
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

    // Guardrail: Immediately prevent ineligible age from submitting or reaching backend
    if (isAgeInvalid) {
      if (calculatedAge! < MIN_WHOLE_BLOOD_DONOR_AGE) {
        setErrorMessage(
          'Sorry, you must be at least 18 years old to register as a blood donor.',
        );
      } else {
        setErrorMessage(
          'Based on the blood donation eligibility criteria, donors above 65 years cannot register for whole-blood donation.',
        );
      }
      return;
    }

    if (!formData.consent) {
      setErrorMessage('Please acknowledge the donor registration consent to proceed.');
      return;
    }

    setLoading(true);

    try {
      const response = await registerDonor({
        fullName: formData.fullName.trim(),
        dateOfBirth: formData.dateOfBirth ? formData.dateOfBirth : undefined,
        gender: formData.gender,
        bloodGroup: formData.bloodGroup,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        emergencyContact:
          formData.emergencyContactName.trim() || formData.emergencyContactPhone.trim()
            ? {
                name: formData.emergencyContactName.trim() || undefined,
                phone: formData.emergencyContactPhone.trim() || undefined,
              }
            : undefined,
      });

      setRegisteredDonorCode(response.donorCode);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during donor registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        <PublicPageHeader
          title="Donate Blood"
          subtitle="Register with our blood bank as a potential blood donor."
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Donate Blood' },
          ]}
        />

        {/* High-level Information Section */}
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            lineHeight: 1.6,
            fontSize: '0.925rem',
            color: '#334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem', color: '#dc2626', lineHeight: 1 }}>❤️</span>
            <div>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>
                Voluntary Blood Donor Registration
              </strong>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                Voluntary blood donation helps maintain an adequate and reliable blood supply for hospital emergency rooms, oncology clinics, and trauma surgeries across our community.
              </p>
              <p style={{ margin: '0 0 0.5rem 0', color: '#1e40af', fontSize: '0.85rem', backgroundColor: '#eff6ff', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                ℹ️ <strong>Review &amp; Verification:</strong> After submitting your registration, our team will review your details. You will be notified when your donor registration is verified. You may receive a WhatsApp notification after your registration is reviewed.
              </p>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                <em>Note: Registering here records your interest as a voluntary donor. Actual donor eligibility screening (vitals check and hemoglobin assessment) is conducted in person according to blood bank standard operating procedures prior to every physical collection.</em>
              </p>
            </div>
          </div>
        </section>

        {/* Success Confirmation State */}
        {registeredDonorCode ? (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '10px',
              padding: '2.5rem 2rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2.75rem', marginBottom: '0.5rem', color: '#16a34a' }}>✓</div>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#15803d', fontSize: '1.5rem' }}>
              Donor Registration Submitted
            </h2>
            <p style={{ color: '#166534', margin: '0.5rem 0 1.5rem 0', fontSize: '0.95rem' }}>
              After submitting your registration, our team will review your details. You will be notified when your donor registration is verified. You may receive a WhatsApp notification after your registration is reviewed.
            </p>

            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px dashed #4ade80',
                borderRadius: '8px',
                padding: '1.25rem 2rem',
                display: 'inline-block',
                minWidth: '320px',
                marginBottom: '1.75rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Donor Registration ID
              </span>
              <strong style={{ fontSize: '1.6rem', color: '#0f172a', letterSpacing: '0.08em' }}>
                {registeredDonorCode}
              </strong>
            </div>

            <p style={{ color: '#334155', maxWidth: '520px', margin: '0 auto 2rem auto', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Our staff may contact you regarding donor screening and future donation opportunities at our centre or upcoming mobile drives.
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/"
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '0.7rem 1.4rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Back to Dashboard
              </Link>
              <button
                onClick={() => {
                  setRegisteredDonorCode(null);
                  setFormData({
                    fullName: '',
                    dateOfBirth: '',
                    gender: Gender.MALE,
                    bloodGroup: BloodGroup.A_POSITIVE,
                    phone: '',
                    email: '',
                    address: '',
                    city: '',
                    emergencyContactName: '',
                    emergencyContactPhone: '',
                    consent: false,
                  });
                }}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  padding: '0.7rem 1.4rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Register Another Donor
              </button>
            </div>
          </div>
        ) : (
          /* Registration Form */
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
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  marginBottom: '1.5rem',
                  fontSize: '0.9rem',
                }}
              >
                <strong>Registration Error: </strong> {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* SECTION 1 — Personal Information */}
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
                  1. Personal Information
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Full Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      required
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="e.g. Michael Robert Vance"
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
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 0.75rem',
                        border: isAgeInvalid
                          ? '1px solid #ef4444'
                          : '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {calculatedAge !== null && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
                        {calculatedAge < MIN_WHOLE_BLOOD_DONOR_AGE ? (
                          <div style={{ color: '#dc2626', fontWeight: 600 }}>
                            ⚠️ Sorry, you must be at least 18 years old to register as a blood donor. (Current age: {calculatedAge} years)
                          </div>
                        ) : calculatedAge > MAX_WHOLE_BLOOD_DONOR_AGE ? (
                          <div style={{ color: '#dc2626', fontWeight: 600 }}>
                            ⚠️ Based on the blood donation eligibility criteria, donors above 65 years cannot register for whole-blood donation. (Current age: {calculatedAge} years)
                          </div>
                        ) : calculatedAge > SENIOR_FIRST_TIME_SCREENING_AGE ? (
                          <div
                            style={{
                              color: '#92400e',
                              backgroundColor: '#fef3c7',
                              padding: '0.4rem 0.6rem',
                              borderRadius: '4px',
                              border: '1px solid #fde68a',
                              lineHeight: 1.4,
                            }}
                          >
                            ℹ️ <strong>Age: {calculatedAge} years.</strong> Additional screening required: Donor registration can be submitted, but final donation eligibility will be determined during blood-bank screening.
                          </div>
                        ) : (
                          <div style={{ color: '#15803d', fontWeight: 500 }}>
                            ✓ Age: {calculatedAge} years (Eligible age for donor registration)
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Gender <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
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
                      <option value={Gender.MALE}>Male</option>
                      <option value={Gender.FEMALE}>Female</option>
                      <option value={Gender.OTHER}>Other</option>
                    </select>
                  </div>

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
                </div>
              </div>

              {/* SECTION 2 — Contact Information */}
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
                  2. Contact Information
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Phone Number <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="e.g. +1 555-0199"
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
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="e.g. michael@example.com"
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
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="e.g. Metro City"
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

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Residential Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Street name, apartment, postal area"
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

              {/* SECTION 3 — Emergency Contact */}
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
                  3. Emergency Contact (Optional)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      name="emergencyContactName"
                      value={formData.emergencyContactName}
                      onChange={handleChange}
                      placeholder="e.g. Sarah Vance"
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
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      name="emergencyContactPhone"
                      value={formData.emergencyContactPhone}
                      onChange={handleChange}
                      placeholder="e.g. +1 555-0188"
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

              {/* Consent and Acknowledgement */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    name="consent"
                    checked={formData.consent}
                    onChange={handleChange}
                    style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                  />
                  <span>
                    I confirm that the information provided is accurate and acknowledge that: <em>&ldquo;The information provided will be used by the blood bank for donor registration and related communication.&rdquo;</em>
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }} className="public-cta-group">
                <button
                  type="submit"
                  disabled={loading || isAgeInvalid}
                  style={{
                    backgroundColor: (loading || isAgeInvalid) ? '#94a3b8' : '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.75rem 2rem',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: (loading || isAgeInvalid) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {loading ? 'Registering Donor...' : 'Register as Donor'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
