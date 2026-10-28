import React, { useState, useEffect } from 'react';
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
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';

  const [returnToUrl, setReturnToUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get('returnTo');
    if (r && r.startsWith('/admin/replacement-donations')) {
      setReturnToUrl(r);
    }
  }, []);

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: '#ffffff',
          borderBottom: isSuperAdmin ? '1px solid #fde68a' : '1px solid #e2e8f0',
          height: '64px',
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1rem',
          boxShadow: isSuperAdmin ? '0 1px 3px rgba(217, 119, 6, 0.08)' : '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
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
            backgroundColor: isSuperAdmin ? '#fef3c7' : '#f8fafc',
            border: isSuperAdmin ? '1px solid #fde68a' : '1px solid #e2e8f0',
            borderRadius: '8px',
            color: isSuperAdmin ? '#92400e' : '#334155',
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
          {/* Medical Droplet SVG Emblem */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              backgroundColor: isSuperAdmin ? '#d97706' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: isSuperAdmin ? '0 2px 4px rgba(217, 119, 6, 0.3)' : '0 2px 4px rgba(220, 38, 38, 0.25)',
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
                  backgroundColor:
                    admin?.role === 'SUPER_ADMIN'
                      ? '#fef3c7'
                      : admin?.role === 'LAB_TECHNICIAN'
                      ? '#ede9fe'
                      : admin?.role === 'FINANCE_RECEPTIONIST'
                      ? '#ecfdf5'
                      : '#fef2f2',
                  color:
                    admin?.role === 'SUPER_ADMIN'
                      ? '#d97706'
                      : admin?.role === 'LAB_TECHNICIAN'
                      ? '#7c3aed'
                      : admin?.role === 'FINANCE_RECEPTIONIST'
                      ? '#059669'
                      : '#dc2626',
                  border: `1px solid ${
                    admin?.role === 'SUPER_ADMIN'
                      ? '#fde68a'
                      : admin?.role === 'LAB_TECHNICIAN'
                      ? '#ddd6fe'
                      : admin?.role === 'FINANCE_RECEPTIONIST'
                      ? '#a7f3d0'
                      : '#fecaca'
                  }`,
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {admin?.role === 'SUPER_ADMIN'
                  ? 'SUPER ADMIN'
                  : admin?.role === 'LAB_TECHNICIAN'
                  ? 'LAB TECH'
                  : admin?.role === 'FINANCE_RECEPTIONIST'
                  ? 'RECEPTIONIST'
                  : 'ADMIN'}
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
              {admin?.role === 'SUPER_ADMIN'
                ? 'Platform Governance'
                : admin?.role === 'LAB_TECHNICIAN'
                ? 'Screening Workstation'
                : admin?.role === 'FINANCE_RECEPTIONIST'
                ? 'Front Desk & Billing'
                : 'Management Console'}
            </span>
          </div>
        </Link>
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
    {returnToUrl && (
      <div
        style={{
          position: 'sticky',
          top: '64px',
          zIndex: 99,
          backgroundColor: '#eff6ff',
          borderBottom: '1px solid #bfdbfe',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontSize: '12px',
          color: '#1e40af',
          boxShadow: '0 1px 3px rgba(30, 64, 175, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: '800',
              fontSize: '11px',
              letterSpacing: '0.04em',
            }}
          >
            GUIDED REPLACEMENT FLOW
          </span>
          <span style={{ fontWeight: '500' }}>
            You opened this module from Replacement Tracking. When finished, return to the case to continue the workflow.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <Link
            href={returnToUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: '6px',
              fontWeight: '700',
              textDecoration: 'none',
              fontSize: '12px',
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
            }}
          >
            &larr; Return to Replacement Case
          </Link>
          <button
            onClick={() => setReturnToUrl(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px',
              lineHeight: 1,
            }}
            title="Dismiss banner"
          >
            &times;
          </button>
        </div>
      </div>
    )}
  </>
  );
}
