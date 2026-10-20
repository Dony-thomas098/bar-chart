'use client';

import { Suspense } from 'react';
import ChartEditor from '../[id]/edit/page';

export default function StaticChartEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="w-6 h-6 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChartEditor />
    </Suspense>
  );
}
