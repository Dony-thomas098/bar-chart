'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { FolderBrowser } from '@/components/FolderBrowser';
import { getFolder, Folder } from '@/lib/storage';
import { useParams } from 'next/navigation';

import { LogoLoading } from '@/components/LogoLoading';

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
        <main className="flex-1 flex flex-col items-center justify-center select-none p-4 animate-in fade-in duration-300">
          <LogoLoading
            variant="card"
            statusText={folder ? `Loading ${folder.name}...` : 'Loading folder...'}
          />
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
