import React from 'react';

const COMPONENT_LABELS: Record<string, string> = {
  WHOLE_BLOOD: 'Whole Blood',
  PRBC: 'PRBC (Packed Red Cells)',
  FFP: 'FFP (Fresh Frozen Plasma)',
  PLATELETS: 'Platelets',
};

interface BloodGroupCardProps {
  bloodGroup: string;
  statusLabel?: string;
  totalUnits?: number | null;
  availability?: 'AVAILABLE' | 'NOT_AVAILABLE';
  components?: Array<{
    componentType: string;
    availableUnits: number;
    availability: 'AVAILABLE' | 'NOT_AVAILABLE';
  }>;
  lastUpdated?: string | null;
}

export default function BloodGroupCard({
  bloodGroup,
  statusLabel,
  totalUnits = null,
  availability,
  components = [],
  lastUpdated = null,
}: BloodGroupCardProps) {
  const isAvailable = availability === 'AVAILABLE' || (totalUnits !== null && totalUnits > 0);

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div>
        {/* Top Header: Blood Group & Availability Pill */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <span
            style={{
              fontSize: '1.75rem',
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
              fontWeight: 700,
              color: isAvailable ? '#166534' : '#475569',
              backgroundColor: isAvailable ? '#dcfce7' : '#f1f5f9',
              border: isAvailable ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
            }}
          >
            {isAvailable ? 'Currently Available' : 'Not Currently Available'}
          </span>
        </div>

        {/* Total Available Units display */}
        <div style={{ margin: '0.5rem 0' }}>
          {totalUnits !== null ? (
            <div>
              <span
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: isAvailable ? '#0f172a' : '#94a3b8',
                }}
              >
                {totalUnits}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '0.35rem' }}>
                Available Units
              </span>
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
              {statusLabel || 'Loading availability...'}
            </div>
          )}
        </div>

        {/* Component breakdown */}
        {components.length > 0 && (
          <div
            style={{
              marginTop: '0.85rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#94a3b8',
                marginBottom: '0.2rem',
              }}
            >
              Component Breakdown
            </span>
            {components.map((c) => {
              const label = COMPONENT_LABELS[c.componentType] || c.componentType;
              const hasStock = c.availableUnits > 0;
              return (
                <div
                  key={c.componentType}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.775rem',
                    color: hasStock ? '#334155' : '#94a3b8',
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      fontWeight: hasStock ? 700 : 500,
                      color: hasStock ? '#0f172a' : '#94a3b8',
                    }}
                  >
                    {c.availableUnits} unit{c.availableUnits !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: Facility safety standard indicator */}
      <div
        style={{
          marginTop: '0.85rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid #f1f5f9',
          fontSize: '0.725rem',
          color: '#94a3b8',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Tested Stock</span>
        <span>{lastUpdated ? `Refreshed: ${new Date(lastUpdated).toLocaleTimeString()}` : 'Real-time Stock'}</span>
      </div>
    </div>
  );
}
