'use client';

import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/public/PublicLayout';
import PublicPageHeader from '@/components/public/PublicPageHeader';

export default function ContactPage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Blood Bank Platform';

  return (
    <PublicLayout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <PublicPageHeader
          title="Contact Blood Bank"
          subtitle="Get in touch with our centre for general inquiries, emergency blood requests, or mobile camp scheduling."
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Contact' },
          ]}
        />

        {/* Emergency Guidance Banner */}
        <section
          style={{
            backgroundColor: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '10px',
            padding: '1.75rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <span style={{ fontSize: '2rem', lineHeight: 1 }}>🚨</span>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: '#9f1239' }}>
                Life-Critical Emergency Guidance
              </h2>
              <p style={{ color: '#881337', margin: '0 0 1rem 0', fontSize: '0.9rem', lineHeight: 1.5 }}>
                If you are a doctor, paramedic, or family member requiring emergency blood for an urgent surgery or trauma patient, please submit an emergency request directly or call our 24/7 on-duty dispatch desk.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link
                  href="/blood-request"
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                  }}
                >
                  Submit Emergency Blood Request
                </Link>
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #f87171',
                    color: '#991b1b',
                    padding: '0.55rem 1rem',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>&#9742;</span>
                  <span>Emergency Hotline: Contact details to be configured</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.5rem',
            }}
          >
            <strong style={{ fontSize: '1rem', color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>
              📍 Facility Address
            </strong>
            <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
              Physical facility address to be configured.<br />
              <em>(Single physical blood bank centre)</em>
            </p>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.5rem',
            }}
          >
            <strong style={{ fontSize: '1rem', color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>
              ✉️ General Inquiries
            </strong>
            <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
              Centre telephone, email, and administrative contacts to be configured by the blood bank administrator.
            </p>
          </div>
        </div>

        {/* General Inquiry Form */}
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0f172a' }}>
            Send Us an Inquiry
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>
            For voluntary donor queries, camp organization requests, or feedback:
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert('Inquiry received. A blood bank coordinator will review your message.');
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
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
                  Email or Phone *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. alex@example.com"
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

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Message *
              </label>
              <textarea
                rows={3}
                required
                placeholder="How can our blood bank team assist you?"
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

            <div style={{ textAlign: 'right' }}>
              <button
                type="submit"
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '0.65rem 1.5rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Send Message
              </button>
            </div>
          </form>
        </section>
      </div>
    </PublicLayout>
  );
}
