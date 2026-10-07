import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/public/PublicLayout';
import PublicPageHeader from '@/components/public/PublicPageHeader';
import BloodGroupCard from '@/components/public/BloodGroupCard';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function BloodAvailabilityPage() {
  return (
    <PublicLayout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <PublicPageHeader
          title="Blood Availability"
          subtitle="Check the current availability of blood products at our centre."
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Blood Availability' },
          ]}
          actions={
            <Link
              href="/blood-request"
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '0.6rem 1.2rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                display: 'inline-block',
              }}
            >
              Request Blood
            </Link>
          }
        />

        {/* Informational banner */}
        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '2rem',
            color: '#1e40af',
            fontSize: '0.9rem',
            lineHeight: 1.5,
          }}
        >
          <strong>Single Facility Transparency:</strong> This availability board displays stock counts exclusively for our physical blood bank centre. All available units undergo rigorous mandatory laboratory testing prior to release.
        </div>

        {/* 8 Blood Groups Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2.5rem',
          }}
        >
          {BLOOD_GROUPS.map((bg) => (
            <BloodGroupCard
              key={bg}
              bloodGroup={bg}
              statusLabel="Availability data will appear here"
              units={null}
            />
          ))}
        </div>

        {/* Component Support Section */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0f172a' }}>
            Supported Blood Components
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1rem 0' }}>
            Our laboratory processes collected donations into specific components to maximize clinical efficacy:
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.9rem' }}>Whole Blood</strong>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>For massive hemorrhage and major trauma.</span>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.9rem' }}>PRBC (Packed Red Cells)</strong>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>For severe anemia and surgical recovery.</span>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.9rem' }}>FFP (Fresh Frozen Plasma)</strong>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>For coagulation deficiencies and liver conditions.</span>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.9rem' }}>Platelets</strong>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>For thrombocytopenia and oncology care.</span>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
