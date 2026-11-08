'use client';

import React from 'react';
import { useAuth } from '@/components/AuthProvider';
import { FolderBrowser } from '@/components/FolderBrowser';
import { Header } from '@/components/Header';
import { LogoLoading } from '@/components/LogoLoading';
import { getFolder } from '@/lib/storage';
import { use } from 'react';

export default function LyricsFolderPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { user, loading: authLoading } = useAuth();
  const [folderName, setFolderName] = React.useState<string>('');

  React.useEffect(() => {
    getFolder(params.id)
      .then(f => setFolderName(f?.name || 'Folder'))
      .catch((err) => {
        console.warn('[LyricsFolderId] Error reading folder:', err);
      });
  }, [params.id]);

  if (authLoading) return <LogoLoading statusText="Loading lyrics folder" />;
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col safe-area-screen">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <FolderBrowser folderId={params.id} folderName={folderName} kind="lyrics" />
      </main>
    </div>
  );
}
