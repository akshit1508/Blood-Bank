'use client';

import React from 'react';
import CrossmatchDetailsPage from '@/app/admin/crossmatching/[id]/page';

export default function LabCrossmatchDetailsPage({
  params,
}: {
  params?: { id?: string };
}) {
  return <CrossmatchDetailsPage params={params} />;
}
