'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AdminNavbar from '@/components/admin/AdminNavbar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { AdminRole } from '@/lib/auth-api';

export default function ReceptionistLayout({ children }: { children: React.ReactNode }) {
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
          backgroundColor: '#0f172a',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            border: '3px solid #334155',
            borderTopColor: '#059669',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem',
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
        <div style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
          Verifying Front Desk Receptionist Session...
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
          Loading patient desk and billing credentials
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
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'clip',
        backgroundColor: '#0b1120',
        color: '#f8fafc',
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
              background-color: #f8fafc !important;
              color: #0f172a !important;
            }
            /* Universal dropdown and input mobile boundary protection */
            select, input, textarea {
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .receptionist-select-container {
              width: 100% !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
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
                box-shadow: 8px 0 24px rgba(0, 0, 0, 0.15) !important;
                z-index: 95 !important;
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
              .receptionist-main-container {
                padding: 1rem 0.75rem !important;
                width: 100% !important;
                max-width: 100vw !important;
                box-sizing: border-box !important;
              }
            }
          `,
        }}
      />

      {/* Top Navbar: Constant Header on Scroll */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          width: '100%',
        }}
      >
        <AdminNavbar
          onToggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
        />
      </div>

      {/* Body with Sidebar and Main Content */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          width: '100%',
          maxWidth: '100vw',
          position: 'relative',
        }}
      >
        {/* Left Dedicated Receptionist Sidebar */}
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
          roleOverride={AdminRole.FINANCE_RECEPTIONIST}
        />

        {/* Main Content Viewport */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            maxWidth: '100%',
            padding: '2rem',
            boxSizing: 'border-box',
            backgroundColor: '#0b1120',
          }}
          className="receptionist-main-container"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
