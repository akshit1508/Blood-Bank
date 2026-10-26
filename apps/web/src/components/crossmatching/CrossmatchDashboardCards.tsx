'use client';

import React from 'react';
import { CrossmatchDashboardMetrics } from '@/lib/crossmatching-api';

interface CrossmatchDashboardCardsProps {
  metrics: CrossmatchDashboardMetrics | null;
  loading?: boolean;
}

export default function CrossmatchDashboardCards({
  metrics,
  loading = false,
}: CrossmatchDashboardCardsProps) {
  const cards = [
    {
      title: 'Pending Sample',
      count: metrics?.pendingSampleVerification ?? 0,
      subtext: 'Awaiting lab accession & verification',
      color: '#b45309',
      bg: '#fffbeb',
      border: '#fde68a',
      iconBg: '#fef3c7',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      title: 'Ready for Testing',
      count: metrics?.sampleVerifiedReady ?? 0,
      subtext: 'Sample valid, awaiting unit selection',
      color: '#1d4ed8',
      bg: '#eff6ff',
      border: '#bfdbfe',
      iconBg: '#dbeafe',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      title: 'Testing In Progress',
      count: metrics?.testingInProgress ?? 0,
      subtext: 'Unit assigned, testing in lab',
      color: '#6d28d9',
      bg: '#f5f3ff',
      border: '#ddd6fe',
      iconBg: '#ede9fe',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3v4" />
          <path d="M15 3v4" />
          <path d="M6 7h12" />
          <path d="M6 7v10a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V7" />
          <circle cx="12" cy="15" r="2" />
        </svg>
      ),
    },
    {
      title: 'Awaiting Authorization',
      count: metrics?.resultRecordedAwaitingReview ?? 0,
      subtext: 'Result recorded, needs review',
      color: '#0369a1',
      bg: '#f0f9ff',
      border: '#bae6fd',
      iconBg: '#e0f2fe',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
    },
    {
      title: 'Authorized Compatible',
      count: metrics?.authorizedCompatibleAwaitingIssue ?? 0,
      subtext: 'Clinically released, ready for issue',
      color: '#15803d',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      iconBg: '#dcfce7',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      title: 'Incompatible Results',
      count: metrics?.incompatibleCount ?? 0,
      subtext: 'Agglutination detected, blocked',
      color: '#b91c1c',
      bg: '#fef2f2',
      border: '#fecaca',
      iconBg: '#fee2e2',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
    },
    {
      title: 'Reserved Units',
      count: metrics?.reservedCount ?? 0,
      subtext: 'Locked atomically for request',
      color: '#0f766e',
      bg: '#f0fdfa',
      border: '#99f6e4',
      iconBg: '#ccfbf1',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    {
      title: 'Issued Transfusions',
      count: metrics?.issuedCount ?? 0,
      subtext: 'Delivered for administration',
      color: '#475569',
      bg: '#f8fafc',
      border: '#cbd5e1',
      iconBg: '#e2e8f0',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1.25rem',
      }}
    >
      {cards.map((card, idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: '#ffffff',
            border: `1px solid ${card.border}`,
            borderLeft: `4px solid ${card.color}`,
            borderRadius: '8px',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {card.title}
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: card.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {card.icon}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.1,
                fontFamily: 'monospace',
              }}
            >
              {loading ? '—' : card.count}
            </div>
            <p
              style={{
                fontSize: '0.725rem',
                color: '#94a3b8',
                marginTop: '0.35rem',
                marginBottom: 0,
                lineHeight: 1.3,
              }}
            >
              {card.subtext}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
