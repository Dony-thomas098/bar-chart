'use client';

import { useAuth } from '@/components/AuthProvider';
import { FolderBrowser } from '@/components/FolderBrowser';
import { Header } from '@/components/Header';
import { LogoLoading } from '@/components/LogoLoading';

export default function Home() {
  const { user, profile, loading } = useAuth();

  if (loading || !user) {
    return <LogoLoading variant="fullscreen" statusText="Synchronizing your catalog..." />;
  }

  // If the user's profession is singing, home screen is the lyrics section
  // If instruments / default, home screen is the chord page
  const isSinger = profile?.profession === 'singing';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <FolderBrowser 
          key={isSinger ? 'lyrics-home' : 'chords-home'} 
          folderId={null} 
          kind={isSinger ? 'lyrics' : 'chart'} 
        />
      </main>
    </div>
  );
}
