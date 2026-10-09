import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Blood Bank Platform | Reliable Blood Support',
  description: 'Production-ready Blood Bank Management & Public Blood Availability Platform for ONE physical centre',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            -webkit-font-smoothing: antialiased;
          }
          a {
            color: inherit;
          }

          /* Responsive styles for Public Layout */
          @media (min-width: 768px) {
            .emergency-badge {
              display: inline-flex !important;
            }
          }

          @media (max-width: 992px) {
            .public-sidebar {
              position: fixed !important;
              top: 64px !important;
              bottom: 0 !important;
              left: 0 !important;
              transform: translateX(-100%);
              box-shadow: 8px 0 24px rgba(0,0,0,0.15) !important;
            }
            .public-sidebar.sidebar-open {
              transform: translateX(0) !important;
            }
            .public-main-content {
              padding: 1rem 0.75rem !important;
            }
            .public-hero-card {
              padding: 1.5rem 1rem !important;
            }
            .public-hero-title {
              font-size: 1.65rem !important;
              line-height: 1.25 !important;
            }
            .public-hero-desc {
              font-size: 0.95rem !important;
            }
            .public-cta-group {
              flex-direction: column !important;
              width: 100% !important;
            }
            .public-cta-group > a, .public-cta-group > button {
              width: 100% !important;
              text-align: center !important;
              justify-content: center !important;
              box-sizing: border-box !important;
            }
            .public-cards-grid {
              grid-template-columns: 1fr !important;
            }
            .public-header-actions {
              width: 100% !important;
              margin-top: 0.5rem !important;
            }
            .public-header-actions > * {
              width: 100% !important;
              justify-content: center !important;
              text-align: center !important;
            }
            .public-form-card {
              padding: 1.25rem 1rem !important;
            }
          }

          @media (max-width: 480px) {
            .public-hero-title {
              font-size: 1.4rem !important;
            }
            .public-brand-subtitle {
              display: none !important;
            }
          }
        `}} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
