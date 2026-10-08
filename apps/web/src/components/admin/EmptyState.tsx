import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = '📋',
  title,
  description,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div
      style={{
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px dashed #cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          marginBottom: '0.85rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {icon}
      </div>
      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', color: '#0f172a', fontWeight: 600 }}>
        {title}
      </h4>
      <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b', maxWidth: '380px', lineHeight: 1.4 }}>
        {description}
      </p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: '1rem',
            padding: '0.45rem 0.9rem',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
