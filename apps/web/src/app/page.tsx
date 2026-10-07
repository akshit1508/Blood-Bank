import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/public/PublicLayout';
import BloodGroupCard from '@/components/public/BloodGroupCard';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PublicDashboardPage() {
  return (
    <PublicLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        {/* SECTION A — HERO */}
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '2.5rem 2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ maxWidth: '680px' }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#dc2626',
                backgroundColor: '#fee2e2',
                padding: '0.25rem 0.65rem',
                borderRadius: '9999px',
                marginBottom: '1rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Single Centre Blood Bank Service
            </span>
            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.2,
                margin: '0 0 1rem 0',
              }}
            >
              Reliable Blood Support When It Matters Most
            </h1>
            <p
              style={{
                fontSize: '1.05rem',
                color: '#475569',
                lineHeight: 1.6,
                margin: '0 0 1.75rem 0',
              }}
            >
              Access blood availability information, request blood, register as a donor, and learn about our blood bank services.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link
                href="/blood-request"
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>Request Blood</span>
                <span>&rarr;</span>
              </Link>

              <Link
                href="/donate-blood"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                }}
              >
                Donate Blood
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION B — BLOOD AVAILABILITY SUMMARY */}
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Blood Availability
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                Verified inventory overview at our blood bank centre.
              </p>
            </div>

            <Link
              href="/blood-availability"
              style={{
                color: '#dc2626',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              View Full Availability &rarr;
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            {BLOOD_GROUPS.map((bg) => (
              <BloodGroupCard
                key={bg}
                bloodGroup={bg}
                statusLabel="Availability data will appear here"
              />
            ))}
          </div>
        </section>

        {/* SECTION C — ABOUT THE BLOOD BANK */}
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '2rem',
          }}
        >
          <div style={{ maxWidth: '800px' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#0f172a' }}>
              About Our Blood Bank
            </h2>
            <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 1.25rem 0', fontSize: '0.95rem' }}>
              We operate an accredited, dedicated blood collection, testing, storage, and cross-matching facility. Every unit of blood collected follows an uncompromised chain of custody:
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '1.5rem',
              }}
            >
              <span>Donation</span>
              <span style={{ color: '#cbd5e1' }}>&rarr;</span>
              <span>Testing</span>
              <span style={{ color: '#cbd5e1' }}>&rarr;</span>
              <span style={{ color: '#15803d' }}>Approval</span>
              <span style={{ color: '#cbd5e1' }}>&rarr;</span>
              <span>Storage</span>
              <span style={{ color: '#cbd5e1' }}>&rarr;</span>
              <span>Request</span>
              <span style={{ color: '#cbd5e1' }}>&rarr;</span>
              <span style={{ color: '#dc2626' }}>Issue</span>
            </div>

            <Link
              href="/about"
              style={{
                color: '#2563eb',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Learn More About Our Services &rarr;
            </Link>
          </div>
        </section>

        {/* SECTIONS D & E: 2-Column Action Banners */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* SECTION D — EMERGENCY BLOOD REQUEST */}
          <div
            style={{
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '10px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>🚨</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#9f1239' }}>
                Need Blood?
              </h3>
              <p style={{ color: '#881337', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
                Submit a blood request directly to our blood bank centre. No public login is required.
              </p>
            </div>
            <div>
              <Link
                href="/blood-request"
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  display: 'inline-block',
                }}
              >
                Request Blood
              </Link>
            </div>
          </div>

          {/* SECTION E — DONATE BLOOD */}
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>❤️</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#166534' }}>
                Become a Blood Donor
              </h3>
              <p style={{ color: '#14532d', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
                Voluntary blood donors help save lives across our local hospitals. Register your interest in donating blood.
              </p>
            </div>
            <div>
              <Link
                href="/donate-blood"
                style={{
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  display: 'inline-block',
                }}
              >
                Donate Blood
              </Link>
            </div>
          </div>
        </div>

        {/* SECTION F — BLOOD DONATION CAMPS */}
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '2rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Upcoming Blood Donation Camps
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                Mobile community blood drives scheduled by our centre.
              </p>
            </div>

            <Link
              href="/campaigns"
              style={{
                backgroundColor: '#f1f5f9',
                color: '#334155',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              View All Camps
            </Link>
          </div>

          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              padding: '2.5rem',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.5rem' }}>📅</span>
            <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
              No upcoming camps available.
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              Community mobile blood drives will be published here when scheduled.
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
