'use client';

import React, { useState } from 'react';
import PublicNavbar from './PublicNavbar';
import PublicSidebar from './PublicSidebar';
import PublicFooter from './PublicFooter';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
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
      }}
    >
      {/* Scoped CSS for Public Sidebar & Drawer */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 992px) {
              .public-sidebar {
                position: fixed !important;
                top: 64px !important;
                left: 0 !important;
                bottom: 0 !important;
                height: calc(100vh - 64px) !important;
                z-index: 50 !important;
                transform: translateX(-100%);
                box-shadow: 8px 0 24px rgba(0, 0, 0, 0.15) !important;
                transition: transform 0.25s ease-in-out !important;
              }
              .public-sidebar.sidebar-open {
                transform: translateX(0) !important;
              }
              .public-sidebar-backdrop {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background-color: rgba(15, 23, 42, 0.5) !important;
                backdrop-filter: blur(2px) !important;
                z-index: 45 !important;
              }
            }
          `,
        }}
      />
      {/* Top persistent Navbar */}
      <PublicNavbar
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
        {/* Left persistent Sidebar */}
        <PublicSidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

        {/* Main Content Area */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '2rem 1.5rem',
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
          className="public-main-content"
        >
          {children}
        </main>
      </div>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}
