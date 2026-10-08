import React from 'react';

export function SkeletonBlock({
  width = '100%',
  height = '1rem',
  borderRadius = '6px',
  style = {},
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#e2e8f0',
        animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        ...style,
      }}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBlock width="45%" height="0.8rem" />
        <SkeletonBlock width="32px" height="32px" borderRadius="8px" />
      </div>
      <SkeletonBlock width="60%" height="2rem" />
      <SkeletonBlock width="75%" height="0.75rem" />
    </div>
  );
}

export function ChartSkeleton({ height = '300px' }: { height?: string }) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBlock width="35%" height="1.1rem" />
        <SkeletonBlock width="20%" height="0.85rem" />
      </div>
      <SkeletonBlock width="100%" height={height} borderRadius="8px" />
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <SkeletonBlock width="30%" height="1rem" />
        <SkeletonBlock width="15%" height="0.85rem" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <SkeletonBlock width="25%" height="0.9rem" />
          <SkeletonBlock width="20%" height="0.9rem" />
          <SkeletonBlock width="20%" height="0.9rem" />
          <SkeletonBlock width="20%" height="0.9rem" />
          <SkeletonBlock width="15%" height="0.9rem" />
        </div>
      ))}
    </div>
  );
}
