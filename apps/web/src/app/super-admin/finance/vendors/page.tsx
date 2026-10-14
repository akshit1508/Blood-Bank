'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminVendorsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/super-admin/finance/expenses');
  }, [router]);

  return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
      <p style={{ fontSize: '1rem', fontWeight: 600 }}>
        The standalone Vendor Directory has been retired. Redirecting to Expenditure Management...
      </p>
    </div>
  );
}
