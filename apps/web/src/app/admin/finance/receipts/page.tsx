'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminReceiptsArchivePage() {
  const router = useRouter();

  useEffect(() => {
    // Normal Admin does not have access to receipts archive; redirect to submission form
    router.replace('/admin/finance/expenses/new');
  }, [router]);

  return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
      Redirecting to Expense Submission Form...
    </div>
  );
}