'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { AdminRole } from '@/lib/auth-api';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  roleOverride?: AdminRole;
}

export interface NavItem {
  name: string;
  href?: string;
  icon: React.ReactNode;
  badge?: string;
  isComingSoon?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function AdminSidebar({
  isOpen = false,
  onClose,
  roleOverride,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { admin, logout } = useAdminAuth();

  const currentRole = roleOverride || (admin?.role as AdminRole) || AdminRole.ADMIN;

  // Close sidebar on Escape key when drawer is open
  React.useEffect(() => {
    if (!isOpen || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Icons used across navigation
  const icons = {
    dashboard: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
    analytics: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    donors: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    acquisition: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    donations: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m19 11-4-4-2 2-2-2-4 4" />
        <path d="M5 21v-6" />
        <path d="M19 21v-6" />
        <circle cx="12" cy="7" r="3" />
      </svg>
    ),
    campaigns: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m3 11 18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
    requests: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    testing: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 3v4" />
        <path d="M15 3v4" />
        <path d="M6 7h12" />
        <path d="M6 7v10a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V7" />
        <circle cx="12" cy="15" r="2" />
      </svg>
    ),
    inventory: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
    reservations: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
    bloodIssue: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    finance: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    receipt: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    staff: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    security: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    audit: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    settings: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    history: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 14 14" />
      </svg>
    ),
    queue: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  };

  // Group definitions strictly role-segregated
  let navigationGroups: NavGroup[] = [];

  if (currentRole === AdminRole.SUPER_ADMIN) {
    navigationGroups = [
      {
        label: 'OVERVIEW',
        items: [
          { name: 'Dashboard', href: '/super-admin/dashboard', icon: icons.dashboard },
          { name: 'Analytics & Reports', href: '/admin/dashboard', icon: icons.analytics },
        ],
      },
      {
        label: 'DONOR & COLLECTION',
        items: [
          { name: 'Donor Management', href: '/admin/donors', icon: icons.donors },
          { name: 'Blood Acquisition', href: '/admin/blood-acquisition', icon: icons.acquisition },
          { name: 'Donations Collection', href: '/admin/donations', icon: icons.donations },
          { name: 'Campaigns', href: '/campaigns', icon: icons.campaigns },
        ],
      },
      {
        label: 'BLOOD OPERATIONS',
        items: [
          { name: 'Blood Requests', href: '/admin/blood-requests', icon: icons.requests },
          { name: 'Laboratory Testing', href: '/admin/testing', icon: icons.testing },
          { name: 'Inventory Management', href: '/admin/inventory', icon: icons.inventory },
          { name: 'Reservations', href: '/admin/blood-requests', icon: icons.reservations, badge: 'In Requests' },
          { name: 'Blood Issue', href: '/admin/blood-requests', icon: icons.bloodIssue, badge: 'In Requests' },
        ],
      },
      {
        label: 'FINANCE',
        items: [
          { name: 'Expenditure Management', href: '/super-admin/finance/expenses', icon: icons.finance },
          { name: 'Disbursements & Payments', href: '/super-admin/finance/payments', icon: icons.finance },
          { name: 'Outstanding Dues', href: '/super-admin/finance/dues', icon: icons.analytics },
          { name: 'Acquisition Costing', icon: icons.acquisition, isComingSoon: true, badge: 'Coming Soon' },
          { name: 'Payroll', icon: icons.staff, isComingSoon: true, badge: 'Coming Soon' },
          { name: 'Income & Funding', icon: icons.finance, isComingSoon: true, badge: 'Coming Soon' },
          { name: 'Financial Reports', icon: icons.analytics, isComingSoon: true, badge: 'Coming Soon' },
        ],
      },
      {
        label: 'ADMINISTRATION',
        items: [
          { name: 'Staff Management', href: '/super-admin/admins', icon: icons.staff },
          { name: 'Roles & Permissions', href: '/super-admin/admins', icon: icons.security },
          { name: 'Audit Logs', icon: icons.audit, isComingSoon: true, badge: 'Coming Soon' },
          { name: 'System Settings', icon: icons.settings, isComingSoon: true, badge: 'Coming Soon' },
        ],
      },
    ];
  } else if (currentRole === AdminRole.LAB_TECHNICIAN) {
    navigationGroups = [
      {
        label: 'OVERVIEW',
        items: [
          { name: 'Lab Dashboard', href: '/lab/dashboard', icon: icons.dashboard },
        ],
      },
      {
        label: 'LABORATORY',
        items: [
          { name: 'Testing Queue', href: '/lab/testing', icon: icons.queue },
          { name: 'Pending Tests', href: '/lab/testing?filter=in_progress', icon: icons.testing },
          { name: 'Testing History', href: '/lab/testing?filter=completed', icon: icons.history },
        ],
      },
    ];
  } else {
    // Standard ADMIN (Default Day-to-Day Operations)
    navigationGroups = [
      {
        label: 'OVERVIEW',
        items: [
          { name: 'Dashboard', href: '/admin/dashboard', icon: icons.dashboard },
        ],
      },
      {
        label: 'DONOR & COLLECTION',
        items: [
          { name: 'Donor Management', href: '/admin/donors', icon: icons.donors },
          { name: 'Blood Acquisition', href: '/admin/blood-acquisition', icon: icons.acquisition },
          { name: 'Donations Collection', href: '/admin/donations', icon: icons.donations },
        ],
      },
      {
        label: 'BLOOD OPERATIONS',
        items: [
          { name: 'Blood Requests', href: '/admin/blood-requests', icon: icons.requests },
          { name: 'Laboratory Testing', href: '/admin/testing', icon: icons.testing },
          { name: 'Inventory Management', href: '/admin/inventory', icon: icons.inventory },
        ],
      },
      {
        label: 'FINANCE',
        items: [
          { name: 'Submit Expense', href: '/admin/finance/expenses/new', icon: icons.finance },
        ],
      },
    ];
  }

  const roleLabel =
    currentRole === AdminRole.SUPER_ADMIN
      ? 'SUPER ADMIN'
      : currentRole === AdminRole.LAB_TECHNICIAN
      ? 'LAB TECHNICIAN'
      : 'ADMIN';

  const roleBadgeStyle =
    currentRole === AdminRole.SUPER_ADMIN
      ? { bg: '#fef3c7', text: '#d97706', border: '#fde68a' }
      : currentRole === AdminRole.LAB_TECHNICIAN
      ? { bg: '#ede9fe', text: '#7c3aed', border: '#ddd6fe' }
      : { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 45,
          }}
          className="admin-sidebar-backdrop"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        style={{
          width: '260px',
          minWidth: '260px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: '64px',
          height: 'calc(100vh - 64px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          zIndex: 50,
          transition: 'transform 0.25s ease-in-out',
        }}
        className={`admin-sidebar ${isOpen ? 'sidebar-open' : ''}`}
      >
        {/* Navigation Groups */}
        <div style={{ padding: '1.25rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
          {navigationGroups.map((group) => (
            <div key={group.label}>
              {/* Group Label */}
              <div
                style={{
                  fontSize: '0.675rem',
                  fontWeight: 700,
                  color: '#94a3b8',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '0 0.75rem 0.45rem 0.75rem',
                }}
              >
                {group.label}
              </div>

              {/* Group Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {group.items.map((item, itemIdx) => {
                  if (item.isComingSoon || !item.href) {
                    return (
                      <div
                        key={`${item.name}-${itemIdx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.525rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.825rem',
                          color: '#94a3b8',
                          backgroundColor: 'transparent',
                          cursor: 'not-allowed',
                          userSelect: 'none',
                        }}
                        title={`${item.name} - Planned Roadmap Module`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center' }}>
                            {item.icon}
                          </span>
                          <span>{item.name}</span>
                        </div>
                        {item.badge && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: '#f1f5f9',
                              color: '#64748b',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    );
                  }

                  const isActive =
                    item.href === '/admin/dashboard' || item.href === '/super-admin/dashboard' || item.href === '/lab/dashboard'
                      ? pathname === item.href
                      : pathname === item.href.split('?')[0];

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.525rem 0.75rem',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? '#b91c1c' : '#475569',
                        backgroundColor: isActive ? '#fef2f2' : 'transparent',
                        border: isActive ? '1px solid #fecaca' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                      className="admin-nav-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            color: isActive ? '#dc2626' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {item.icon}
                        </span>
                        <span>{item.name}</span>
                      </div>

                      {item.badge && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            backgroundColor: isActive ? '#dc2626' : '#f1f5f9',
                            color: isActive ? '#ffffff' : '#64748b',
                            border: isActive ? '1px solid #dc2626' : '1px solid #e2e8f0',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer info & Sign Out */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          {/* Active Role Indicator in sidebar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>Active Portal:</span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                backgroundColor: roleBadgeStyle.bg,
                color: roleBadgeStyle.text,
                border: `1px solid ${roleBadgeStyle.border}`,
                padding: '0.12rem 0.45rem',
                borderRadius: '4px',
                letterSpacing: '0.04em',
              }}
            >
              {roleLabel}
            </span>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={() => {
              if (onClose) onClose();
              logout();
            }}
            title="Sign out of portal session"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.55rem 1rem',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fecaca';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fee2e2';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>

          <div style={{ fontSize: '0.725rem', color: '#64748b', lineHeight: 1.4 }}>
            <div><strong>Single-Center Instance</strong></div>
            <div style={{ fontSize: '0.675rem', color: '#94a3b8' }}>v1.0 &bull; Operational System</div>
          </div>
        </div>
      </aside>
    </>
  );
}
