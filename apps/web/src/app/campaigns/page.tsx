import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/public/PublicLayout';
import PublicPageHeader from '@/components/public/PublicPageHeader';

export default function CampaignsPage() {
  return (
    <PublicLayout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <PublicPageHeader
          title="Blood Donation Camps"
          subtitle="Mobile community blood collection drives and outreach events organized by our blood bank."
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Blood Donation Camps' },
          ]}
        />

        {/* Overview banner */}
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.75rem',
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0f172a' }}>
            Community Mobile Blood Drives
          </h2>
          <p style={{ color: '#475569', lineHeight: 1.6, margin: 0, fontSize: '0.925rem' }}>
            Our mobile phlebotomy team regularly visits universities, corporate campuses, community centers, and religious institutions to conduct voluntary blood donation drives.
          </p>
        </section>

        {/* Upcoming Camps Section */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
            Upcoming Camps
          </h2>

          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              padding: '3rem 2rem',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📅</span>
            <strong style={{ display: 'block', color: '#334155', fontSize: '1.05rem', marginBottom: '0.35rem' }}>
              No upcoming camps scheduled at this time.
            </strong>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>
              Check back frequently as new mobile donation drives are scheduled by our team.
            </p>
          </div>
        </section>

        {/* Past Camps Section */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
            Past Campaigns Archive
          </h2>

          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.9rem',
            }}
          >
            Past campaign metrics and collection summaries will be published shortly.
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
