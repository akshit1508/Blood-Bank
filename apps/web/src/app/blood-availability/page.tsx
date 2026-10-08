'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/public/PublicLayout';
import PublicPageHeader from '@/components/public/PublicPageHeader';
import BloodGroupCard from '@/components/public/BloodGroupCard';
import {
  PublicBloodAvailabilityData,
  fetchPublicBloodAvailability,
  getFriendlyPublicAvailabilityErrorMessage,
} from '@/lib/blood-availability-api';

const ALL_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const COMPONENT_LABELS: Record<string, string> = {
  WHOLE_BLOOD: 'Whole Blood',
  PRBC: 'PRBC (Packed Red Cells)',
  FFP: 'FFP (Fresh Frozen Plasma)',
  PLATELETS: 'Platelets',
};

const COMPONENT_OPTIONS = [
  { value: '', label: 'All Components' },
  { value: 'WHOLE_BLOOD', label: 'Whole Blood' },
  { value: 'PRBC', label: 'PRBC (Packed Red Cells)' },
  { value: 'FFP', label: 'FFP (Fresh Frozen Plasma)' },
  { value: 'PLATELETS', label: 'Platelets' },
];

export default function BloodAvailabilityPage() {
  const [data, setData] = useState<PublicBloodAvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Client-side filters
  const [filterBloodGroup, setFilterBloodGroup] = useState<string>('');
  const [filterComponent, setFilterComponent] = useState<string>('');

  const loadAvailability = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchPublicBloodAvailability();
      setData(result);
    } catch (err: any) {
      setErrorMessage(getFriendlyPublicAvailabilityErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // Filter groups for rendering
  const filteredGroups = useMemo(() => {
    if (!data?.groups) return [];

    let groups = data.groups;

    if (filterBloodGroup) {
      groups = groups.filter((g) => g.bloodGroup === filterBloodGroup);
    }

    if (filterComponent) {
      groups = groups.map((g) => {
        const filteredComponents = g.components.filter(
          (c) => c.componentType === filterComponent,
        );
        const subTotal = filteredComponents.reduce((acc, c) => acc + c.availableUnits, 0);
        return {
          ...g,
          totalUnits: subTotal,
          availability: (subTotal > 0 ? 'AVAILABLE' : 'NOT_AVAILABLE') as 'AVAILABLE' | 'NOT_AVAILABLE',
          components: filteredComponents,
        };
      });
    }

    return groups;
  }, [data, filterBloodGroup, filterComponent]);

  return (
    <PublicLayout>
      <div style={{ maxWidth: '1080px', margin: '0 auto', paddingBottom: '3rem' }}>
        <PublicPageHeader
          title="Blood Availability"
          subtitle="Real-time verified blood product availability at our facility."
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
                padding: '0.6rem 1.25rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              Request Blood &rarr;
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
            marginBottom: '1.5rem',
            color: '#1e40af',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          <strong>Facility Transparency:</strong> Availability shown is based on current blood-bank inventory. All available units undergo rigorous mandatory laboratory safety testing and screening prior to release.
        </div>

        {/* Live Facility Summary Strip */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                Total Available Stock
              </span>
              <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                {loading ? '...' : `${data?.totalAvailableUnits ?? 0} Units`}
              </span>
            </div>

            {data?.lastUpdated && (
              <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Last Updated
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                  {new Date(data.lastUpdated).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => loadAvailability()}
            disabled={loading}
            style={{
              padding: '0.45rem 0.95rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#334155',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            {loading ? 'Refreshing...' : '↻ Refresh Data'}
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Blood Group Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 600 }}>
                Blood Group:
              </label>
              <select
                value={filterBloodGroup}
                onChange={(e) => setFilterBloodGroup(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                }}
              >
                <option value="">All Blood Groups</option>
                {ALL_BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            {/* Component Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 600 }}>
                Component:
              </label>
              <select
                value={filterComponent}
                onChange={(e) => setFilterComponent(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                }}
              >
                {COMPONENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(filterBloodGroup || filterComponent) && (
            <button
              onClick={() => {
                setFilterBloodGroup('');
                setFilterComponent('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Error State Banner */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '2rem',
              fontSize: '0.875rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong>Error: </strong> {errorMessage}
            </div>
            <button
              onClick={() => loadAvailability()}
              style={{
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                padding: '0.35rem 0.85rem',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '3rem',
              textAlign: 'center',
              color: '#64748b',
              marginBottom: '2.5rem',
            }}
          >
            Loading current blood product availability from the centre...
          </div>
        )}

        {/* Empty State Banner (if 0 available units overall) */}
        {!loading && data && data.totalAvailableUnits === 0 && (
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              marginBottom: '2rem',
              fontSize: '0.875rem',
            }}
          >
            <strong>Notice:</strong> No blood units are currently available in the facility stock. If you require urgent blood products, please submit a blood request or contact the facility directly.
          </div>
        )}

        {/* 8 Blood Groups Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2.5rem',
          }}
        >
          {filteredGroups.map((g) => (
            <BloodGroupCard
              key={g.bloodGroup}
              bloodGroup={g.bloodGroup}
              totalUnits={g.totalUnits}
              availability={g.availability}
              components={g.components}
              lastUpdated={data?.lastUpdated}
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
