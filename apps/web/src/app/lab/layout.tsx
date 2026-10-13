import React from 'react';
import LabLayout from '@/components/lab/LabLayout';
import { AdminAuthProvider } from '@/context/AdminAuthContext';

export const metadata = {
  title: 'Lab Technician Portal | Blood Bank Management',
  description: 'Clinical Blood Screening & Workstation Console',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <LabLayout>{children}</LabLayout>
    </AdminAuthProvider>
  );
}
