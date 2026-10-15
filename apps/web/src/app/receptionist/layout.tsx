import React from 'react';
import ReceptionistLayout from '@/components/receptionist/ReceptionistLayout';
import { AdminAuthProvider } from '@/context/AdminAuthContext';

export const metadata = {
  title: 'Finance Receptionist Portal | Blood Bank Management',
  description: 'Front Desk Patient Registration, Blood Issue & Billing Console',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <ReceptionistLayout>{children}</ReceptionistLayout>
    </AdminAuthProvider>
  );
}
