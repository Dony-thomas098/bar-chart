'use client';

import React, { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Lyric } from '@/lib/lyrics';

import { PiascoreLyricsReader } from '@/components/PiascoreLyricsReader';

function LyricsViewerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const getInitialLyricId = () => {
    if (params?.id && params.id !== 'edit') return params.id as string;
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

  useEffect(() => {
    const currentId =
      (params?.id && params.id !== 'edit' ? (params.id as string) : null) ||
      searchParams?.get('id') ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null) ||
      '';
    if (currentId && currentId !== resolvedLyricId) {
      setResolvedLyricId(currentId);
    }
  }, [params, searchParams, resolvedLyricId]);

  useEffect(() => {
    if (resolvedLyricId === 'edit') {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      router.replace(`/lyrics/edit/${search}`);
    }
  }, [resolvedLyricId, router]);

  const { lyric, loading: lyricLoading } = useLyricsSync(resolvedLyricId === 'edit' ? '' : resolvedLyricId);

  if (resolvedLyricId === 'edit') {
    return null;
  }

  if (lyricLoading) {
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
        <button
          onClick={() => router.push('/lyrics')}
          className="px-5 py-2.5 bg-accent-gradient font-bold rounded-xl text-white hover:brightness-110 transition-all"
        >
          Go to Lyrics Catalog
        </button>
      </div>
    );
  }

  return (
    <PiascoreLyricsReader
      initialLyric={lyric as Lyric}
      folderId={lyric.folder_id}
    />
  );
}

export default function LyricsViewerPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="w-6 h-6 border-2 border-accent-start border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LyricsViewerContent />
    </Suspense>
  );
}
