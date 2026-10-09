'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AdminNavbar from './AdminNavbar';
import AdminSidebar from './AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { admin, loading, isAuthenticated } = useAdminAuth();

  const isLoginPage = pathname === '/admin/login';

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // If on /admin/login, render standalone without sidebar or header
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show hospital-grade security loading screen while verifying admin session
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
            borderTopColor: '#dc2626',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem',
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
        <div style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
          Verifying Blood Bank Admin Session...
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
          Checking authorization against secure database
        </div>
      </div>
    );
  }

  // If not authenticated, the AdminAuthProvider will redirect to /admin/login
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Inject Admin Shell Responsive Styles */}
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
            .admin-public-link:hover {
              background-color: #f1f5f9 !important;
            }
            .hover-elevate-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04) !important;
              border-color: #cbd5e1 !important;
            }

            /* Responsive split layouts across admin screens */
            @media (max-width: 1024px) {
              .admin-split-grid {
                grid-template-columns: 1fr !important;
              }
              .admin-detail-panel {
                width: 100% !important;
                max-width: 100% !important;
              }
            }

            /* Responsive tables container */
            .admin-table-scroll {
              width: 100%;
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
            }

            /* Responsive modal dialogs & drawers */
            @media (max-width: 768px) {
              .admin-modal-card {
                width: 95vw !important;
                max-width: 95vw !important;
                margin: 0.5rem !important;
                max-height: 92vh !important;
              }
              .admin-drawer-sheet {
                width: 100vw !important;
                max-width: 100vw !important;
              }
              .admin-filter-bar {
                flex-direction: column !important;
                align-items: stretch !important;
              }
              .admin-filter-bar > * {
                width: 100% !important;
              }
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
              .admin-main-container {
                padding: 1rem 0.75rem !important;
              }
            }

            @media (max-width: 640px) {
              .admin-dashboard-kpis {
                grid-template-columns: 1fr !important;
              }
              .admin-dashboard-two-col {
                grid-template-columns: 1fr !important;
              }
              .admin-header-actions {
                flex-direction: column !important;
                align-items: stretch !important;
              }
              .admin-header-actions > * {
                width: 100% !important;
                justify-content: center !important;
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
        {/* Left Persistent / Drawer Sidebar */}
        <AdminSidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

        {/* Main Content Viewport */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '1.75rem 2rem',
            boxSizing: 'border-box',
            backgroundColor: '#f8fafc',
          }}
          className="admin-main-container"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
