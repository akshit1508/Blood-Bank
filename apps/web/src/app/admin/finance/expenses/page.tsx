'use client';

import React from 'react';
import ExpenseDirectoryContent from '@/components/admin/finance/ExpenseDirectoryContent';

export default function AdminExpensesPage() {
  return <ExpenseDirectoryContent portalRole="ADMIN" />;
}
