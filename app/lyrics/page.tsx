'use client';

import { useAuth } from '@/components/AuthProvider';
import { FolderBrowser } from '@/components/FolderBrowser';
import { Header } from '@/components/Header';
import { LogoLoading } from '@/components/LogoLoading';

export default function LyricsHome() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center select-none p-4 animate-in fade-in duration-300">
          <LogoLoading
            variant="card"
            statusText="Loading lyrics..."
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <FolderBrowser folderId={null} kind="lyrics" />
      </main>
    </div>
  );
}
