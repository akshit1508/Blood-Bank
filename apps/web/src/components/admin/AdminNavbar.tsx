import React from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/context/AdminAuthContext';

interface AdminNavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function AdminNavbar({
  onToggleSidebar,
}: AdminNavbarProps) {
  const { admin } = useAdminAuth();
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
        padding: '0 1rem',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
      }}
    >
      {/* Left: Brand & Mobile Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Mobile Hamburger Button */}
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Menu"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            color: '#334155',
            cursor: 'pointer',
          }}
          className="admin-mobile-toggle"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Brand Logo & Name */}
        <Link
          href="/admin"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            textDecoration: 'none',
          }}
        >
          {/* Medical Red Droplet SVG Emblem */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              backgroundColor: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                }}
              >
                Blood Bank
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                ADMIN
              </span>
            </div>
            <span
              style={{
                fontSize: '0.725rem',
                color: '#64748b',
                display: 'block',
                lineHeight: 1,
                marginTop: '1px',
              }}
            >
              Management Console
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Global System Status Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          padding: '0.35rem 0.75rem',
          borderRadius: '9999px',
        }}
        className="admin-status-indicator"
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#16a34a',
            display: 'inline-block',
            boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.2)',
          }}
        />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534' }}>
          Internal Operations Console &bull; Authenticated
        </span>
      </div>

      {/* Right: Profile & Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Admin Profile Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Avatar Circle */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: 700,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            {admin?.fullName ? admin.fullName.slice(0, 2).toUpperCase() : 'AD'}
          </div>

          {/* User Details */}
          <div style={{ display: 'flex', flexDirection: 'column' }} className="admin-profile-details">
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>
              {admin?.fullName || 'Administrator'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.2 }}>
              {admin?.email || 'admin@bloodbank.org'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
