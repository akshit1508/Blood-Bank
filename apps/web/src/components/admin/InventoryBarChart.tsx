import React, { useState } from 'react';
import { ChartSkeleton } from './LoadingSkeleton';

interface InventoryBarChartProps {
  data: Record<string, number>;
  componentCounts?: Record<string, number>;
  loading?: boolean;
}

const ALL_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function InventoryBarChart({
  data,
  componentCounts = {},
  loading = false,
}: InventoryBarChartProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  if (loading) {
    return <ChartSkeleton height="260px" />;
  }

  // Calculate maximum count for dynamic scale (minimum scale of 5 for aesthetic layout)
  const counts = ALL_BLOOD_GROUPS.map((bg) => data[bg] || 0);
  const maxCount = Math.max(...counts, 0);
  const yMax = Math.max(5, Math.ceil((maxCount + 1) / 5) * 5);
  const totalAvailable = counts.reduce((sum, c) => sum + c, 0);

  // SVG Chart Dimensions
  const chartHeight = 200;
  const chartWidth = 560;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  // Grid tick values (3-4 ticks)
  const ticks = [0, Math.round(yMax / 2), yMax];

  const barWidth = 32;
  const groupSpacing = plotWidth / ALL_BLOOD_GROUPS.length;

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 600 }}>
            Available Blood Inventory
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Live laboratory-approved physical stock by ABO / Rh group
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#dc2626',
              lineHeight: 1,
            }}
          >
            {totalAvailable}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
            Units Ready
          </span>
        </div>
      </div>

      {/* Responsive SVG Container */}
      <div style={{ width: '100%', position: 'relative', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {/* Background Grid Lines & Y-Axis Labels */}
          {ticks.map((tickVal) => {
            const y = paddingTop + plotHeight - (tickVal / yMax) * plotHeight;
            return (
              <g key={tickVal}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray={tickVal === 0 ? undefined : '3 3'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {ALL_BLOOD_GROUPS.map((bg, idx) => {
            const count = data[bg] || 0;
            const barHeight = count > 0 ? (count / yMax) * plotHeight : 4;
            const x = paddingLeft + idx * groupSpacing + (groupSpacing - barWidth) / 2;
            const y = paddingTop + plotHeight - barHeight;
            const isHovered = hoveredGroup === bg;
            const hasStock = count > 0;

            return (
              <g
                key={bg}
                onMouseEnter={() => setHoveredGroup(bg)}
                onMouseLeave={() => setHoveredGroup(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Invisible hover trigger area */}
                <rect
                  x={paddingLeft + idx * groupSpacing}
                  y={paddingTop}
                  width={groupSpacing}
                  height={plotHeight}
                  fill="transparent"
                />

                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  ry="4"
                  fill={
                    hasStock
                      ? isHovered
                        ? '#b91c1c'
                        : '#dc2626'
                      : isHovered
                      ? '#cbd5e1'
                      : '#e2e8f0'
                  }
                  style={{ transition: 'all 0.2s ease' }}
                />

                {/* Count Badge over Bar */}
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fill={hasStock ? '#0f172a' : '#94a3b8'}
                  fontSize="11"
                  fontWeight={hasStock ? '700' : '500'}
                  fontFamily="system-ui, sans-serif"
                >
                  {count}
                </text>

                {/* X-Axis Blood Group Label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight - 14}
                  textAnchor="middle"
                  fill={isHovered ? '#0f172a' : '#475569'}
                  fontSize="12"
                  fontWeight={isHovered ? '700' : '600'}
                  fontFamily="system-ui, sans-serif"
                >
                  {bg}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredGroup && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '12px',
              background: '#0f172a',
              color: '#ffffff',
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <strong>{hoveredGroup}</strong>: {data[hoveredGroup] || 0} unit(s) available
          </div>
        )}
      </div>

      {/* Component Type Breakdown Footer */}
      {Object.keys(componentCounts).length > 0 && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '0.75rem',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>
            By Component:
          </span>
          {Object.entries(componentCounts).map(([comp, count]) => {
            const label = comp.replace(/_/g, ' ');
            return (
              <span
                key={comp}
                style={{
                  fontSize: '0.725rem',
                  color: '#334155',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                <strong>{label}</strong>: {count}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
