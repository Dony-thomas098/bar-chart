'use client';

import { Suspense } from 'react';
import SetlistDetailPage from '../[id]/page';

export default function StaticSetlistDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-white">Loading...</div>}>
      <SetlistDetailPage />
    </Suspense>
  );
}
