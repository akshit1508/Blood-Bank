import React from 'react';

export default function HomePage() {
  return (
    <main style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1.5rem', lineHeight: 1.6 }}>
      <header style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <h1 style={{ color: '#dc2626', margin: 0, fontSize: '2rem' }}>Blood Bank Management Platform</h1>
        <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '1.1rem' }}>
          Foundation & Documentation Status — Phase 0
        </p>
      </header>

      <section style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.3rem', color: '#1e293b' }}>System Foundation Active</h2>
        <p>
          The monorepo foundation, architecture, and comprehensive project documentation have been established.
        </p>
        <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '6px', fontSize: '0.9rem' }}>
          <strong>Architecture:</strong> Next.js (Web Frontend) &rarr; REST API &rarr; NestJS (Backend Services) &rarr; Mongoose &rarr; MongoDB
        </div>
        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
          <em>Note: Business features (Blood Requests, Donors, Inventory, Donations, Testing, Campaigns) are not active in Phase 0 and will be delivered sequentially as vertical slices.</em>
        </p>
      </section>
    </main>
  );
}
