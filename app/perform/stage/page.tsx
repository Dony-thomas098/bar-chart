'use client';

import { Suspense } from 'react';
import PerformancePage from '../[code]/page';

export default function StaticPerformancePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#121214] text-white">Connecting to session...</div>}>
      <PerformancePage />
    </Suspense>
  );
}
