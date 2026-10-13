import React from 'react';
import ExpenseFormContent from '@/components/admin/finance/ExpenseFormContent';

export default function AdminEditExpensePage({ params }: { params: { id: string } }) {
  return <ExpenseFormContent portalRole="ADMIN" expenseId={params.id} />;
}