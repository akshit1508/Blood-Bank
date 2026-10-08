import React from 'react';
import { ChartSkeleton } from './LoadingSkeleton';

interface RequestStatusDonutProps {
  statusCounts: Record<string, number>;
  loading?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: 'Requested', color: '#f59e0b' },
  VERIFIED: { label: 'Verified', color: '#8b5cf6' },
  APPROVED: { label: 'Approved', color: '#10b981' },
  RESERVED: { label: 'Reserved', color: '#3b82f6' },
  ISSUED: { label: 'Issued', color: '#f97316' },
  COMPLETED: { label: 'Completed', color: '#059669' },
  REJECTED: { label: 'Rejected', color: '#ef4444' },
  CANCELLED: { label: 'Cancelled', color: '#94a3b8' },
};

export default function RequestStatusDonut({
  statusCounts,
  loading = false,
}: RequestStatusDonutProps) {
  if (loading) {
    return <ChartSkeleton height="260px" />;
  }

  // Calculate total
  const entries = Object.entries(statusCounts).filter(([_, count]) => count > 0);
  const total = entries.reduce((sum, [_, count]) => sum + count, 0);

  // SVG parameters
  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 600 }}>
          Request Lifecycle Distribution
        </h3>
        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
          Real-time pipeline across clinical fulfillment states
        </p>
      </div>

      {total === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '0.875rem',
            padding: '2rem 0',
          }}
        >
          No blood requests recorded yet.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            gap: '1.5rem',
            flex: 1,
          }}
        >
          {/* Donut Chart */}
          <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* Background track circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth={strokeWidth}
              />

              {/* Segments */}
              {entries.map(([status, count]) => {
                const percent = count / total;
                const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
                const strokeDashoffset = -circumference * cumulativePercent;
                cumulativePercent += percent;
                const color = STATUS_CONFIG[status]?.color || '#94a3b8';

                return (
                  <circle
                    key={status}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                );
              })}
            </svg>

            {/* Center Content */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                {total}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Total
              </span>
            </div>
          </div>

          {/* Legend Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: '150px' }}>
            {entries.map(([status, count]) => {
              const cfg = STATUS_CONFIG[status] || { label: status, color: '#94a3b8' };
              const percent = Math.round((count / total) * 100);

              return (
                <div
                  key={status}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: cfg.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: '#334155', fontWeight: 500 }}>{cfg.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{count}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>({percent}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
