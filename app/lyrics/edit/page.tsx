'use client';

import { Suspense } from 'react';
import LyricsEditor from '../[id]/edit/page';

export default function StaticLyricsEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="w-6 h-6 border-2 border-accent-start border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LyricsEditor />
    </Suspense>
  );
}
