import React from 'react';
import Link from 'next/link';

interface PublicNavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function PublicNavbar({ onToggleSidebar, isSidebarOpen }: PublicNavbarProps) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Blood Bank Platform';

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      {/* Left: Mobile hamburger & Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#334155',
              padding: 0,
            }}
          >
            {isSidebarOpen ? (
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>&times;</span>
            ) : (
              <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>&#9776;</span>
            )}
          </button>
        )}

        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          {/* Blood Drop SVG Icon */}
          <div
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#fee2e2',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="#dc2626"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>

          <div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.2,
              }}
            >
              {appName}
            </div>
            <div
              style={{
                fontSize: '0.725rem',
                color: '#64748b',
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              Blood Collection & Distribution Centre
            </div>
          </div>
        </Link>
      </div>

      {/* Right: Emergency Contact / Helpline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.825rem',
            color: '#b91c1c',
            backgroundColor: '#fef2f2',
            padding: '0.4rem 0.85rem',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            fontWeight: 600,
          }}
          className="emergency-badge"
        >
          <span style={{ fontSize: '0.9rem' }}>&#9742;</span>
          <span>Emergency Support: 24/7 Helpline</span>
        </div>
      </div>
    </header>
  );
}
