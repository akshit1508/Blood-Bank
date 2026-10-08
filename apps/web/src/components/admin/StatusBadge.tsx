import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const normalized = (status || '').toUpperCase();

  const getStyle = (): { bg: string; text: string; border: string; dot: string } => {
    switch (normalized) {
      case 'AVAILABLE':
      case 'APPROVED':
      case 'ACTIVE':
      case 'COMPLETED':
      case 'PASS':
        return {
          bg: '#f0fdf4',
          text: '#166534',
          border: '#bbf7d0',
          dot: '#22c55e',
        };
      case 'RESERVED':
      case 'PROCESSING':
      case 'IN_PROGRESS':
      case 'PENDING':
        return {
          bg: '#eff6ff',
          text: '#1e40af',
          border: '#bfdbfe',
          dot: '#3b82f6',
        };
      case 'ISSUED':
        return {
          bg: '#fff7ed',
          text: '#9a3412',
          border: '#fed7aa',
          dot: '#f97316',
        };
      case 'VERIFIED':
        return {
          bg: '#faf5ff',
          text: '#6b21a8',
          border: '#e9d5ff',
          dot: '#a855f7',
        };
      case 'REQUESTED':
      case 'PENDING_REVIEW':
        return {
          bg: '#fffbeb',
          text: '#92400e',
          border: '#fde68a',
          dot: '#f59e0b',
        };
      case 'EXPIRED':
      case 'DISCARDED':
      case 'REJECTED':
      case 'FAIL':
      case 'CANCELLED':
      case 'INACTIVE':
        return {
          bg: '#fef2f2',
          text: '#991b1b',
          border: '#fecaca',
          dot: '#ef4444',
        };
      default:
        return {
          bg: '#f1f5f9',
          text: '#475569',
          border: '#cbd5e1',
          dot: '#94a3b8',
        };
    }
  };

  const style = getStyle();
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        padding: isSm ? '0.15rem 0.45rem' : '0.25rem 0.6rem',
        borderRadius: '9999px',
        fontSize: isSm ? '0.7rem' : '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: isSm ? '5px' : '6px',
          height: isSm ? '5px' : '6px',
          borderRadius: '50%',
          backgroundColor: style.dot,
        }}
      />
      {normalized}
    </span>
  );
}
