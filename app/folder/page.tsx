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

  const getInitialFolderId = () => {
    const spId = searchParams?.get('id');
    if (spId) return spId;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const wId = urlParams.get('id');
      if (wId) return wId;
    }
    return (params?.id as string) || '';
  };

  const [resolvedFolderId, setResolvedFolderId] = useState<string>(getInitialFolderId);
  const folderId = resolvedFolderId;

  useEffect(() => {
    const currentId =
      searchParams?.get('id') ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null) ||
      (params?.id as string) ||
      '';
    if (currentId && currentId !== resolvedFolderId) {
      setResolvedFolderId(currentId);
    }
  }, [params, searchParams, resolvedFolderId]);

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
      <LogoLoading
        statusText={folder ? `Loading ${folder.name}` : 'Loading folder'}
      />
    );
  }

  if (!user) {
    return null; // Will redirect in AuthProvider
  }

  return (
    <div className="min-h-screen flex flex-col safe-area-screen">
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
      <LogoLoading statusText="Loading folder" />
    }>
      <FolderPageContent />
    </Suspense>
  );
}
