'use client';

import React, { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Lyric } from '@/lib/lyrics';

const PiascoreLyricsReader = dynamic(
  () => import('@/components/PiascoreLyricsReader').then((mod) => mod.PiascoreLyricsReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent-start border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading lyrics score...</span>
        </div>
      </div>
    ),
  }
);

function LyricsViewerDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const getInitialLyricId = () => {
    if (params?.id && params.id !== 'edit' && params.id !== 'view' && params.id !== 'demo' && params.id !== 'folder') return params.id as string;
    const spId = searchParams?.get('id');
    if (spId) return spId;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const wId = urlParams.get('id');
      if (wId) return wId;
    }
    return '';
  };

  const [resolvedLyricId, setResolvedLyricId] = useState<string>(getInitialLyricId);
  const lyricId = resolvedLyricId;

  useEffect(() => {
    const currentId =
      (params?.id && params.id !== 'edit' && params.id !== 'view' && params.id !== 'demo' && params.id !== 'folder' ? (params.id as string) : null) ||
      searchParams?.get('id') ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null) ||
      '';
    if (currentId && currentId !== resolvedLyricId) {
      setResolvedLyricId(currentId);
    }
  }, [params, searchParams, resolvedLyricId]);

  useEffect(() => {
    if (lyricId === 'edit') {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      router.replace(`/lyrics/edit/${search}`);
    }
  }, [lyricId, router]);

  const { lyric, loading: lyricLoading } = useLyricsSync(lyricId === 'edit' ? '' : lyricId);

  if (lyricId === 'edit') {
    return null;
  }

  if (lyricLoading || authLoading || !lyricId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent-start border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading lyrics score...</span>
        </div>
      </div>
    );
  }

  if (!lyric) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#121214] text-white gap-4">
        <p className="text-slate-400 text-sm">Lyrics not found or access denied.</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/lyrics/')}
            className="px-5 py-2.5 bg-accent-gradient font-bold rounded-xl text-white hover:brightness-110 transition-all"
          >
            Go to Lyrics Catalog
          </button>
          {!user && (
            <button
              onClick={() => router.push('/auth')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 font-bold rounded-xl text-white transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <PiascoreLyricsReader
      key={lyric.id}
      initialLyric={lyric as Lyric}
      folderId={lyric.folder_id}
    />
  );
}

export default function LyricsViewer() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="w-6 h-6 border-2 border-accent-start border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LyricsViewerDetailContent />
    </Suspense>
  );
}
