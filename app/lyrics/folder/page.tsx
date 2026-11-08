'use client';

import React, { Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { FolderBrowser } from '@/components/FolderBrowser';
import { Header } from '@/components/Header';
import { LogoLoading } from '@/components/LogoLoading';
import { getFolder } from '@/lib/storage';
import { useParams, useSearchParams } from 'next/navigation';

function LyricsFolderContent() {
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

  const [resolvedFolderId, setResolvedFolderId] = React.useState<string>(getInitialFolderId);
  const folderId = resolvedFolderId;

  React.useEffect(() => {
    const currentId =
      searchParams?.get('id') ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null) ||
      (params?.id as string) ||
      '';
    if (currentId && currentId !== resolvedFolderId) {
      setResolvedFolderId(currentId);
    }
  }, [params, searchParams, resolvedFolderId]);

  const { user, loading: authLoading } = useAuth();
  const [folderName, setFolderName] = React.useState<string>('');

  React.useEffect(() => {
    if (!folderId) return;
    getFolder(folderId)
      .then(f => setFolderName(f?.name || 'Folder'))
      .catch((err) => {
        console.warn('[LyricsFolder] Error reading folder:', err);
      });
  }, [folderId]);

  if (authLoading) {
    return <LogoLoading statusText="Loading lyrics folder" />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col safe-area-screen">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <FolderBrowser folderId={folderId} folderName={folderName} kind="lyrics" />
      </main>
    </div>
  );
}

export default function LyricsFolderPage() {
  return (
    <Suspense fallback={<LogoLoading statusText="Loading lyrics folder" />}>
      <LyricsFolderContent />
    </Suspense>
  );
}
