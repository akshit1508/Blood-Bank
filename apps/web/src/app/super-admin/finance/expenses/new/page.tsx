import React from 'react';
import ExpenseFormContent from '@/components/admin/finance/ExpenseFormContent';

export default function SuperAdminNewExpensePage() {
  return <ExpenseFormContent portalRole="SUPER_ADMIN" />;
}