import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/public/PublicLayout';
import PublicPageHeader from '@/components/public/PublicPageHeader';

export default function DonateBloodPage() {
  return (
    <PublicLayout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <PublicPageHeader
          title="Donate Blood"
          subtitle="Join our community of voluntary blood donors and help save lives across our local hospitals."
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Donate Blood' },
          ]}
        />

        {/* Why Donate Section */}
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
            Why Donate Blood?
          </h2>
          <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 1.25rem 0' }}>
            Every two seconds, someone in our region requires blood due to surgery, trauma, obstetrics complications, or chronic medical conditions. Because blood products cannot be manufactured artificially, our single facility relies entirely on the altruism of voluntary community donors.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1rem',
            }}
          >
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem' }}>
              <strong style={{ color: '#991b1b', display: 'block', marginBottom: '0.25rem' }}>
                Save Up to Three Lives
              </strong>
              <span style={{ fontSize: '0.85rem', color: '#7f1d1d', lineHeight: 1.4 }}>
                One standard whole blood donation can be separated into red cells, plasma, and platelets to help multiple patients.
              </span>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem' }}>
              <strong style={{ color: '#166534', display: 'block', marginBottom: '0.25rem' }}>
                Safe & Regulated
              </strong>
              <span style={{ fontSize: '0.85rem', color: '#14532d', lineHeight: 1.4 }}>
                All collection equipment is sterile, single-use, and handled by trained phlebotomists adhering to stringent clinical standards.
              </span>
            </div>
          </div>
        </section>

        {/* What Happens After Registration */}
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '2rem',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
            What Happens After Registration?
          </h2>

          <ol style={{ paddingLeft: '1.25rem', margin: 0, color: '#334155', lineHeight: 1.7, fontSize: '0.95rem' }}>
            <li>
              <strong>Medical Screening & Vitals:</strong> A medical officer checks your pulse, blood pressure, temperature, and hemoglobin level to ensure donation is safe for you.
            </li>
            <li>
              <strong>Physical Collection:</strong> A standard 350ml or 450ml donation takes approximately 8-10 minutes under sterile supervision.
            </li>
            <li>
              <strong>Laboratory Testing:</strong> Every unit is rigorously screened for mandatory infectious disease markers and ABO/Rh blood grouping before entering active inventory.
            </li>
            <li>
              <strong>Clinical Issuance:</strong> Approved units are cross-matched and issued to patients in urgent need.
            </li>
          </ol>
        </section>

        {/* Registration CTA / Placeholder */}
        <section
          style={{
            backgroundColor: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '10px',
            padding: '2.5rem',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>❤️</span>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0f172a' }}>
            Register as a Voluntary Donor
          </h2>
          <p style={{ color: '#64748b', maxWidth: '520px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Online donor self-registration and appointment booking are scheduled for integration in Phase 2. Visit our centre in person or check back soon to register online.
          </p>

          <button
            type="button"
            disabled
            style={{
              backgroundColor: '#e2e8f0',
              color: '#64748b',
              border: '1px solid #cbd5e1',
              padding: '0.75rem 1.75rem',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'not-allowed',
            }}
          >
            Online Registration (Available in Phase 2)
          </button>
        </section>
      </div>
    </PublicLayout>
  );
}
