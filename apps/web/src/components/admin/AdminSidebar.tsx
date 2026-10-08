'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function AdminSidebar({
  isOpen = false,
  onClose,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const navigationGroups: NavGroup[] = [
    {
      label: 'OVERVIEW',
      items: [
        {
          name: 'Dashboard',
          href: '/admin',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'DONOR & COLLECTION',
      items: [
        {
          name: 'Donor Management',
          href: '/admin/donors',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          name: 'Donations Collection',
          href: '/admin/donations',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m19 11-4-4-2 2-2-2-4 4" />
              <path d="M5 21v-6" />
              <path d="M19 21v-6" />
              <circle cx="12" cy="7" r="3" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'BLOOD OPERATIONS',
      items: [
        {
          name: 'Blood Requests',
          href: '/admin/blood-requests',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
        },
        {
          name: 'Laboratory Testing',
          href: '/admin/testing',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 3v4" />
              <path d="M15 3v4" />
              <path d="M6 7h12" />
              <path d="M6 7v10a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V7" />
              <circle cx="12" cy="15" r="2" />
            </svg>
          ),
        },
        {
          name: 'Inventory Management',
          href: '/admin/inventory',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
          ),
        },
        {
          name: 'Blood Acquisition',
          href: '/admin/blood-acquisition',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          ),
        },
      ],
    },
  ];

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
        <div style={{ padding: '1.25rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
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
                  padding: '0 0.75rem 0.5rem 0.75rem',
                }}
              >
                {group.label}
              </div>

              {/* Group Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/admin'
                      ? pathname === '/admin'
                      : pathname?.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.75rem',
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
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '9999px',
                            backgroundColor: isActive ? '#dc2626' : '#e2e8f0',
                            color: isActive ? '#ffffff' : '#475569',
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

        {/* Footer info in sidebar */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
            <div><strong>Single-Center Instance</strong></div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>v1.0 &bull; Operational System</div>
          </div>
        </div>
      </aside>
    </>
  );
}
