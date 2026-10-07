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

          @media (max-width: 768px) {
            .public-sidebar {
              position: fixed !important;
              top: 64px !important;
              bottom: 0 !important;
              left: 0 !important;
              transform: translateX(-100%);
              box-shadow: 4px 0 12px rgba(0,0,0,0.1);
            }
            .public-sidebar.sidebar-open {
              transform: translateX(0) !important;
            }
            .public-main-content {
              padding: 1.25rem 1rem !important;
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
