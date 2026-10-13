'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LabTestingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/lab/testing');
  }, [router]);

  return null;
}
