'use client';

import { useAuth } from '@/components/AuthProvider';
import { FolderBrowser } from '@/components/FolderBrowser';
import { Header } from '@/components/Header';
import { LogoLoading } from '@/components/LogoLoading';

export default function LyricsHome() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <LogoLoading
        statusText="Loading lyrics"
      />
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
