'use client';

import { Suspense } from 'react';
import SetlistPerformPage from '../[id]/perform/page';

export default function StaticSetlistPerformPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-white">Loading...</div>}>
      <SetlistPerformPage />
    </Suspense>
  );
}
