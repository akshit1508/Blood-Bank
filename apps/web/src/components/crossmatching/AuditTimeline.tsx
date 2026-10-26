'use client';

import React from 'react';
import { TimelineEntry } from '@/lib/crossmatching-api';

interface AuditTimelineProps {
  timeline: TimelineEntry[];
}

export default function AuditTimeline({ timeline = [] }: AuditTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return (
      <div
        style={{
          padding: '24px 0',
          textAlign: 'center',
          fontSize: '12px',
          color: '#94a3b8',
        }}
      >
        No audit history recorded yet.
      </div>
    );
  }

  const sorted = [...timeline].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Vertical line indicator */}
      <div
        style={{
          position: 'absolute',
          left: '7px',
          top: '8px',
          bottom: '8px',
          width: '2px',
          backgroundColor: '#e2e8f0',
        }}
      />

      {sorted.map((item, idx) => (
        <div key={idx} style={{ position: 'relative' }}>
          {/* Dot */}
          <div
            style={{
              position: 'absolute',
              left: '-24px',
              top: '4px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              border: '3px solid #dc2626',
              boxSizing: 'border-box',
            }}
          />

          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontWeight: 700,
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {item.action}
                </span>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    backgroundColor: '#e2e8f0',
                    color: '#334155',
                  }}
                >
                  {item.fromStatus} → {item.toStatus}
                </span>
              </div>
              <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '11px' }}>
                {new Date(item.timestamp).toLocaleString()}
              </span>
            </div>

            <div
              style={{
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#64748b',
              }}
            >
              <span>By:</span>
              <strong style={{ color: '#334155' }}>{item.actorName}</strong>
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  fontSize: '10px',
                  fontWeight: 600,
                }}
              >
                {item.actorRole}
              </span>
            </div>

            {item.notes && (
              <p
                style={{
                  margin: '8px 0 0 0',
                  fontSize: '12px',
                  color: '#334155',
                  backgroundColor: '#ffffff',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  lineHeight: 1.5,
                }}
              >
                {item.notes}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
