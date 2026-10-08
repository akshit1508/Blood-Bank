'use client';

import React, { useState } from 'react';
import AdminNavbar from './AdminNavbar';
import AdminSidebar from './AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

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
                padding: 1rem !important;
              }
            }

            @media (max-width: 640px) {
              .admin-dashboard-kpis {
                grid-template-columns: 1fr !important;
              }
              .admin-dashboard-two-col {
                grid-template-columns: 1fr !important;
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
