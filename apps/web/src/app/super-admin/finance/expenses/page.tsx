'use client';

import React from 'react';
import ExpenseDirectoryContent from '@/components/admin/finance/ExpenseDirectoryContent';

export default function SuperAdminExpensesPage() {
  return <ExpenseDirectoryContent portalRole="SUPER_ADMIN" />;
}
