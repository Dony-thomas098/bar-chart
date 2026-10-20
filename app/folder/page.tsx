'use client';

import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { FolderBrowser } from '@/components/FolderBrowser';
import { getFolder, Folder } from '@/lib/storage';
import { useParams, useSearchParams } from 'next/navigation';
import { LogoLoading } from '@/components/LogoLoading';

function FolderPageContent() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const folderId = (params?.id as string) || searchParams?.get('id') || '';

  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!folderId) {
      setLoading(false);
      return;
    }
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

export default function FolderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <LogoLoading variant="card" statusText="Loading..." />
        </main>
      </div>
    }>
      <FolderPageContent />
    </Suspense>
  );
}
