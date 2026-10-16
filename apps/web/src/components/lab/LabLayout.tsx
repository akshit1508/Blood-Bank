'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AdminNavbar from '@/components/admin/AdminNavbar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { AdminRole } from '@/lib/auth-api';

export default function LabLayout({ children }: { children: React.ReactNode }) {
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
            borderTopColor: '#7c3aed',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem',
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
        <div style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
          Verifying Lab Workstation Session...
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
          Checking technician credentials and screening authorization
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
        backgroundColor: '#f8fafc',
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
              background-color: #f8fafc !important;
              color: #0f172a !important;
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
              .lab-main-container {
                padding: 1.25rem 1rem !important;
              }
            }
            @media (max-width: 640px) {
              .lab-main-container {
                padding: 0.75rem 0.5rem !important;
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
          roleOverride={AdminRole.LAB_TECHNICIAN}
        />

        {/* Main Content Viewport */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '2rem',
            boxSizing: 'border-box',
            backgroundColor: '#f8fafc',
            overflowY: 'auto',
          }}
          className="lab-main-container"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
