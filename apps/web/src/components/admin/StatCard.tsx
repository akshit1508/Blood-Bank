import React from 'react';
import Link from 'next/link';
import { StatCardSkeleton } from './LoadingSkeleton';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: string;
  badge?: string;
  badgeType?: 'info' | 'warning' | 'success' | 'danger';
  href?: string;
  loading?: boolean;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  accentColor = '#dc2626',
  badge,
  badgeType = 'info',
  href,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return <StatCardSkeleton />;
  }

  const getBadgeStyle = () => {
    switch (badgeType) {
      case 'success':
        return { bg: '#dcfce7', text: '#15803d', border: '#86efac' };
      case 'warning':
        return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
      case 'danger':
        return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
      default:
        return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' };
    }
  };

  const badgeStyle = getBadgeStyle();

  const cardContent = (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        boxSizing: 'border-box',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        cursor: href ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      className={href ? 'hover-elevate-card' : ''}
    >
      {/* Top subtle accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: accentColor,
        }}
      />

      {/* Header: Label and Icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#64748b',
          }}
        >
          {title}
        </span>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: `${accentColor}12`, // 10% opacity
            color: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.15rem',
          }}
        >
          {icon}
        </div>
      </div>

      {/* Main Metric */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <span
          style={{
            fontSize: '1.85rem',
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </span>
        {badge && (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '0.15rem 0.45rem',
              borderRadius: '9999px',
              backgroundColor: badgeStyle.bg,
              color: badgeStyle.text,
              border: `1px solid ${badgeStyle.border}`,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Subtitle / context */}
      {subtitle && (
        <span
          style={{
            fontSize: '0.75rem',
            color: '#64748b',
            lineHeight: 1.3,
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
