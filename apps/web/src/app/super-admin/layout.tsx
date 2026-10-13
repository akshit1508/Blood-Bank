import React from 'react';
import SuperAdminLayout from '@/components/super-admin/SuperAdminLayout';
import { AdminAuthProvider } from '@/context/AdminAuthContext';

export const metadata = {
  title: 'Super Admin Portal | Blood Bank Management',
  description: 'Privileged Administration & System Governance',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <SuperAdminLayout>{children}</SuperAdminLayout>
    </AdminAuthProvider>
  );
}
