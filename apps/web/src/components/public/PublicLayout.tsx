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
