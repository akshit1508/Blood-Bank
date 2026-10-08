import React from 'react';
import Link from 'next/link';

export default function PublicFooter() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Blood Bank Platform';
  const currentYear = 2026;

  return (
    <footer
      style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '2.5rem 1.5rem 1.5rem 1.5rem',
        marginTop: 'auto',
        color: '#64748b',
        fontSize: '0.85rem',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '2rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        {/* Col 1: Brand & Purpose */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ color: '#dc2626', fontSize: '1.25rem' }}>&#10084;</span>
            <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{appName}</strong>
          </div>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Dedicated blood collection, testing, cold-chain storage, and clinical dispensing service for one physical blood bank centre.
          </p>
        </div>

        {/* Col 2: Quick Links */}
        <div>
          <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.75rem' }}>
            Quick Links
          </strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>
              <Link href="/blood-request" style={{ color: '#64748b', textDecoration: 'none' }}>
                Request Blood
              </Link>
            </li>
            <li>
              <Link href="/blood-availability" style={{ color: '#64748b', textDecoration: 'none' }}>
                Blood Availability
              </Link>
            </li>
            <li>
              <Link href="/donate-blood" style={{ color: '#64748b', textDecoration: 'none' }}>
                Donate Blood
              </Link>
            </li>
            <li>
              <Link href="/campaigns" style={{ color: '#64748b', textDecoration: 'none' }}>
                Donation Camps
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3: About & Transparency */}
        <div>
          <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.75rem' }}>
            About the Centre
          </strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>
              <Link href="/about" style={{ color: '#64748b', textDecoration: 'none' }}>
                About Our Services
              </Link>
            </li>
            <li>
              <Link href="/contact" style={{ color: '#64748b', textDecoration: 'none' }}>
                Contact & Emergency Hotline
              </Link>
            </li>
            <li>
              <Link href="/admin/blood-requests" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                Staff Management Portal &rarr;
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 4: Emergency Assistance */}
        <div>
          <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.75rem' }}>
            Emergency Contact
          </strong>
          <p style={{ margin: '0 0 0.5rem 0', lineHeight: 1.5 }}>
            For life-critical emergencies, submit an urgent blood request immediately or contact the on-duty blood bank medical officer.
          </p>
          <div style={{ color: '#b91c1c', fontWeight: 600 }}>
            Emergency Contact: Contact details to be configured
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          paddingTop: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          &copy; {currentYear} {appName}. All rights reserved. Single Facility Platform.
        </div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Secure Blood Product Traceability &bull; Phase 1 Verified
        </div>
      </div>
    </footer>
  );
}
