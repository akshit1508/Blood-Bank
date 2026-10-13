import React from 'react';
import ExpenseFormContent from '@/components/admin/finance/ExpenseFormContent';

export default function SuperAdminEditExpensePage({ params }: { params: { id: string } }) {
  return <ExpenseFormContent portalRole="SUPER_ADMIN" expenseId={params.id} />;
}