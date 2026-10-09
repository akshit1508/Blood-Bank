'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/blood-request', label: 'Blood Request', icon: '🩸' },
  { href: '/blood-availability', label: 'Blood Availability', icon: '🔎' },
  { href: '/donate-blood', label: 'Donate Blood', icon: '❤️' },
  { href: '/campaigns', label: 'Blood Donation Camps', icon: '📅' },
  { href: '/about', label: 'About Blood Bank', icon: 'ℹ️' },
  { href: '/contact', label: 'Contact', icon: '📞' },
];

interface PublicSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PublicSidebar({ isOpen, onClose }: PublicSidebarProps) {
  const pathname = usePathname();

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

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            zIndex: 45,
          }}
          className="public-sidebar-backdrop"
        />
      )}

      {/* Sidebar container */}
      <aside
        style={{
          width: '260px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          position: 'sticky',
          top: '64px',
          height: 'calc(100vh - 64px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 38,
          flexShrink: 0,
          transition: 'transform 0.2s ease',
        }}
        className={`public-sidebar ${isOpen ? 'sidebar-open' : ''}`}
      >
        <div style={{ padding: '1rem 0.75rem', flex: 1 }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#94a3b8',
              letterSpacing: '0.05em',
              padding: '0.5rem 0.75rem 0.75rem 0.75rem',
            }}
          >
            Public Services
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname?.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#dc2626' : '#334155',
                    backgroundColor: isActive ? '#fef2f2' : 'transparent',
                    borderLeft: isActive ? '3px solid #dc2626' : '3px solid transparent',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Centre Notice */}
        <div
          style={{
            padding: '1rem',
            margin: '0.75rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '0.775rem',
            color: '#64748b',
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>
            Single Centre Facility
          </strong>
          Official portal for verified public blood availability and direct clinical request submission.
        </div>
      </aside>
    </>
  );
}
