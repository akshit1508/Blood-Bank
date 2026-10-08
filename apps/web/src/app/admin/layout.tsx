import React from 'react';
import AdminLayout from '@/components/admin/AdminLayout';

export const metadata = {
  title: 'Blood Bank Administration & Operations',
  description: 'Single-center Blood Bank Management Operations Console',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
