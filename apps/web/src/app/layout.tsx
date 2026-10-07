import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Blood Bank Platform | Phase 0 Foundation',
  description: 'Production-ready Blood Bank Management & Public Blood Availability Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, -apple-system, sans-serif', margin: 0, padding: 0, backgroundColor: '#f8fafc', color: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}
