'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AdminNavbar from '@/components/admin/AdminNavbar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { AdminRole } from '@/lib/auth-api';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { admin, loading, isAuthenticated } = useAdminAuth();

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fffbeb',
          color: '#78350f',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: '3px solid #fde68a',
            borderTopColor: '#d97706',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem',
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#92400e', letterSpacing: '-0.01em' }}>
          Verifying Super Admin Authorization...
        </div>
        <div style={{ fontSize: '0.85rem', color: '#b45309', marginTop: '0.35rem' }}>
          Confirming privileged platform security credentials
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#fffbeb',
        color: '#0f172a',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Responsive Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .admin-mobile-toggle {
              display: none !important;
            }
            .admin-nav-item:hover {
              background-color: #fef3c7 !important;
              color: #92400e !important;
            }
            .admin-table-scroll {
              width: 100% !important;
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch !important;
            }
            @media (max-width: 992px) {
              .admin-mobile-toggle {
                display: inline-flex !important;
              }
              .admin-sidebar {
                position: fixed !important;
                top: 64px !important;
                left: 0 !important;
                bottom: 0 !important;
                transform: translateX(-100%);
                box-shadow: 8px 0 24px rgba(217, 119, 6, 0.12) !important;
              }
              .admin-sidebar.sidebar-open {
                transform: translateX(0) !important;
              }
              .admin-status-indicator {
                display: none !important;
              }
              .admin-profile-details {
                display: none !important;
              }
              .super-admin-main-container {
                padding: 1rem 0.75rem !important;
              }
            }
          `,
        }}
      />

      {/* Top Navbar */}
      <AdminNavbar
        onToggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Body with Sidebar and Main Content */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Left Persistent / Drawer Sidebar matching approved layout */}
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
          roleOverride={AdminRole.SUPER_ADMIN}
        />

        {/* Main Content Viewport */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '2rem',
            boxSizing: 'border-box',
            backgroundColor: '#fffbeb',
            overflowY: 'auto',
          }}
          className="super-admin-main-container"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
