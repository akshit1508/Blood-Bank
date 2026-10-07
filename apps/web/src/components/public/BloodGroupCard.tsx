import React from 'react';

interface BloodGroupCardProps {
  bloodGroup: string;
  statusLabel?: string;
  units?: number | null;
  lastUpdated?: string | null;
}

export default function BloodGroupCard({
  bloodGroup,
  statusLabel = 'Data Pending Phase 3',
  units = null,
  lastUpdated = null,
}: BloodGroupCardProps) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.25rem',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: '#dc2626',
            letterSpacing: '0.02em',
          }}
        >
          {bloodGroup}
        </span>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#0369a1',
            backgroundColor: '#e0f2fe',
            padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
          }}
        >
          Blood Group
        </span>
      </div>

      <div style={{ margin: '0.5rem 0' }}>
        {units !== null ? (
          <div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{units}</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '0.35rem' }}>Units</span>
          </div>
        ) : (
          <div
            style={{
              fontSize: '0.825rem',
              color: '#64748b',
              backgroundColor: '#f8fafc',
              padding: '0.45rem 0.65rem',
              borderRadius: '6px',
              border: '1px dashed #cbd5e1',
            }}
          >
            {statusLabel}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid #f1f5f9',
          fontSize: '0.75rem',
          color: '#94a3b8',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Tested Stock</span>
        <span>{lastUpdated ? `Updated: ${lastUpdated}` : 'Live in Phase 3'}</span>
      </div>
    </div>
  );
}
