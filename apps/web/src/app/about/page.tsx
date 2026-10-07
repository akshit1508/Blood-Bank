import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/public/PublicLayout';
import PublicPageHeader from '@/components/public/PublicPageHeader';

export default function AboutPage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Blood Bank Platform';

  return (
    <PublicLayout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <PublicPageHeader
          title="About Blood Bank"
          subtitle="Dedicated to safe, traceable, and rapid blood component distribution for patient care."
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'About Blood Bank' },
          ]}
        />

        {/* Overview */}
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
            Facility Overview & Purpose
          </h2>
          <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
            {appName} is a specialized, single-centre blood banking and transfusion service. We bridge the critical gap between voluntary blood donors and hospitals, ensuring that compatible and pathogen-screened blood products reach clinical teams without delay.
          </p>
          <p style={{ color: '#475569', lineHeight: 1.6, margin: 0 }}>
            Operating from one physical location allows concentrated laboratory expertise, uninterrupted cold-chain preservation, and strict adherence to blood safety protocols.
          </p>
        </section>

        {/* Services Provided */}
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
            Services Provided
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.35rem' }}>
                Voluntary Blood Donation
              </strong>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                Safe, hygienic on-site phlebotomy suites and organized mobile collection drives.
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.35rem' }}>
                Component Separation
              </strong>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                Centrifugation of whole blood into packed red cells, platelets, and fresh frozen plasma.
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.35rem' }}>
                Laboratory Screening & Serology
              </strong>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                Mandatory immunohematology testing, blood group verification, and infectious disease screening.
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.35rem' }}>
                Emergency Clinical Dispensing
              </strong>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                Digital request intake, unit reservation locks to prevent double allocation, and expedited issuing.
              </p>
            </div>
          </div>
        </section>

        {/* Traceability & Safety */}
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
            Why Traceability & Safety Matter
          </h2>
          <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 1.25rem 0' }}>
            Blood handling is life-critical. Our digital platform guarantees that no blood unit can be issued for patient use unless it has successfully passed the laboratory testing gate and was marked as approved. Unapproved, quarantined, or expired units are strictly locked out of usable inventory.
          </p>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link
              href="/contact"
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '0.7rem 1.5rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                display: 'inline-block',
              }}
            >
              Contact Our Facility &rarr;
            </Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
