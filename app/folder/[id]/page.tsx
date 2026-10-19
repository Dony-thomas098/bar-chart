'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { FolderBrowser } from '@/components/FolderBrowser';
import { getFolder, Folder } from '@/lib/storage';
import { useParams } from 'next/navigation';

import { ChordlyLogo } from '@/components/ChordlyLogo';

export default function FolderPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const folderId = params.id as string;

  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!folderId) return;
    getFolder(folderId).then(data => {
      setFolder(data);
      setLoading(false);
    });
  }, [folderId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center select-none animate-in fade-in duration-300">
          <div className="relative flex flex-col items-center justify-center">
            <div
              className="absolute -inset-6 rounded-full bg-gradient-to-tr from-orange-500/20 via-rose-500/15 to-amber-500/10 blur-2xl animate-pulse pointer-events-none"
              style={{ animationDuration: '2.6s' }}
            />
            <ChordlyLogo
              variant="stacked"
              animate
              className="relative w-36 sm:w-44 h-auto drop-shadow-sm"
            />
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-text-secondary dark:text-zinc-400 tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <span>Loading folder...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in AuthProvider
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <FolderBrowser folderId={folderId} folderName={folder?.name || 'Unknown Folder'} />
      </main>
    </div>
  );
}
