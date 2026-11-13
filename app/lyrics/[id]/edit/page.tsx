'use client';

import { useAuth, canModifySection } from '@/components/AuthProvider';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { moveEntry } from '@/lib/storage';
import { saveLyrics, Lyric } from '@/lib/lyrics';
import { FolderPickerModal } from '@/components/FolderPickerModal';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { CornerLeftUp, Folder as FolderIcon, RefreshCw, Cloud, CloudOff, Copy, ChevronLeft, AlertTriangle, RotateCcw, Eye, Check } from 'lucide-react';
import React, { useState, useCallback, useRef } from 'react';

export default function LyricsEditor() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const getInitialLyricId = () => {
    if (params?.id && params.id !== 'edit' && params.id !== 'view' && params.id !== 'demo') return params.id as string;
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

  React.useEffect(() => {
    const currentId =
      (params?.id && params.id !== 'edit' && params.id !== 'view' && params.id !== 'demo' ? (params.id as string) : null) ||
      searchParams?.get('id') ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null) ||
      '';
    if (currentId && currentId !== resolvedLyricId) {
      setResolvedLyricId(currentId);
    }
  }, [params, searchParams, resolvedLyricId]);

  const lyricId = resolvedLyricId;
  const canEdit = canModifySection(profile?.profession, 'lyrics');

  React.useEffect(() => {
    if (!lyricId && !authLoading) {
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('id')) {
        return;
      }
      const newId = crypto.randomUUID();
      const currentUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') : null) || 'guest-user';
      const newLyric: Lyric = {
        id: newId,
        title: 'Untitled Lyrics',
        body: '',
        folder_id: null,
        created_by: currentUserId,
        updated_at: new Date().toISOString(),
      };
      saveLyrics(newLyric).then(() => {
        router.replace(`/lyrics/edit/?id=${newId}`);
      });
    }
  }, [lyricId, authLoading, user, router]);
  
  const { lyric, loading: lyricLoading, saveStatus, collaborators, updateLyric, forceSave } = useLyricsSync(lyricId);
  const [copied, setCopied] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const returnTo = searchParams.get('returnTo');
  const lyricRef = useRef<Lyric | null>(lyric);
  React.useEffect(() => {
    lyricRef.current = lyric;
  }, [lyric]);

  const initialLyricSnapshotRef = useRef<Lyric | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const showUnsavedModalRef = useRef(false);
  React.useEffect(() => {
    showUnsavedModalRef.current = showUnsavedModal;
  }, [showUnsavedModal]);

  React.useEffect(() => {
    if (lyric && !initialLyricSnapshotRef.current) {
      initialLyricSnapshotRef.current = JSON.parse(JSON.stringify(lyric));
    }
  }, [lyric]);

  const hasEdits = useCallback((): boolean => {
    if (!initialLyricSnapshotRef.current || !lyricRef.current) return false;
    const initial = initialLyricSnapshotRef.current;
    const current = lyricRef.current;
    return (
      current.title !== initial.title ||
      current.body !== initial.body ||
      current.folder_id !== initial.folder_id
    );
  }, []);

  const getViewerUrl = useCallback((): string => {
    if (returnTo && returnTo.startsWith('/lyrics/view/?id=')) {
      return returnTo;
    }
    let folderTarget = lyricRef.current?.folder_id
      ? `/lyrics/folder/?id=${encodeURIComponent(lyricRef.current.folder_id)}`
      : '/lyrics';
    if (returnTo && !returnTo.startsWith('/lyrics/view') && !returnTo.startsWith('/lyrics/edit')) {
      folderTarget = returnTo;
    }
    return `/lyrics/view/?id=${encodeURIComponent(lyricId)}&returnTo=${encodeURIComponent(folderTarget)}`;
  }, [lyricId, returnTo]);

  const handleBack = useCallback(() => {
    if (hasEdits()) {
      setShowUnsavedModal(true);
    } else {
      router.push(getViewerUrl());
    }
  }, [hasEdits, getViewerUrl, router]);

  const handleKeepEdits = useCallback(async () => {
    try {
      await forceSave();
    } catch (err) {
      console.warn('[LyricsEditor] Error saving before navigation:', err);
    }
    setShowUnsavedModal(false);
    router.push(getViewerUrl());
  }, [forceSave, getViewerUrl, router]);

  const handleDiscardEdits = useCallback(async () => {
    try {
      if (initialLyricSnapshotRef.current) {
        await saveLyrics(initialLyricSnapshotRef.current);
        updateLyric(initialLyricSnapshotRef.current);
      }
    } catch (err) {
      console.warn('[LyricsEditor] Error reverting edits:', err);
    }
    setShowUnsavedModal(false);
    router.push(getViewerUrl());
  }, [getViewerUrl, router, updateLyric]);

  const handleReviewEdits = useCallback(() => {
    setShowUnsavedModal(false);
  }, []);

  useHardwareBackButton({
    enabled: isFolderPickerOpen || showUnsavedModal,
    onBack: () => {
      if (isFolderPickerOpen) {
        setIsFolderPickerOpen(false);
      } else if (showUnsavedModal) {
        setShowUnsavedModal(false);
      }
    },
    stateKey: 'chordly_lyrics_editor',
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      if (showUnsavedModalRef.current) {
        setShowUnsavedModal(false);
        return;
      }
      if (hasEdits()) {
        try {
          window.history.pushState(null, '', window.location.href);
        } catch {}
        setShowUnsavedModal(true);
      } else {
        router.push(getViewerUrl());
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasEdits, getViewerUrl, router]);

  if (authLoading || lyricLoading) {
    return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;
  }

  if (!lyric) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-white">
        <p>Lyrics not found or access denied.</p>
        <button onClick={() => router.push('/lyrics/')} className="mt-4 px-4 py-2 bg-indigo-600 rounded-md">Go Home</button>
      </div>
    );
  }

  const handleMoveLyrics = async (newFolderId: string | null) => {
    await moveEntry(lyric.id, 'lyrics', newFolderId);
    updateLyric({ folder_id: newFolderId });
  };

  const copyAsText = () => {
    navigator.clipboard.writeText(`${lyric.title}\n\n${lyric.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col text-text-primary relative pb-32">
      <main className="flex-1 overflow-x-hidden p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Top Bar for buttons */}
          <div className="w-full flex justify-between items-center gap-4 mb-4">
            <button 
              type="button"
              onClick={handleBack}
              className="flex px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold tracking-wider uppercase text-text-primary bg-white/70 dark:bg-white/10 border border-glass shadow-sm rounded-full hover:bg-white items-center transition-all active:scale-95 cursor-pointer"
              aria-label="Back"
            >
              <ChevronLeft size={16} className="mr-1" />
              <span>{returnTo && returnTo.includes('/lyrics/view') ? 'Viewer' : returnTo && returnTo.includes('/perform') ? 'Performance' : 'Back'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => setIsFolderPickerOpen(true)}
                className="px-4 py-2 text-sm font-bold tracking-widest uppercase text-text-secondary hover:text-white bg-surface border border-border shadow-md rounded-xl hover:bg-surface-raised flex items-center transition-all"
              >
                <FolderIcon size={16} className="mr-2" /> Move
              </button>
              
              {/* Network Sync Status */}
              {collaborators.length > 0 && (
                <div className="flex -space-x-2">
                  {collaborators.map((email, idx) => (
                    <div key={idx} className="h-8 w-8 rounded-full bg-surface-raised border border-accent-solid shadow-inner flex items-center justify-center text-xs font-bold text-accent-start" title={`${email} is editing`}>
                      {email.charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center text-[10px] font-bold tracking-widest uppercase bg-surface-raised border border-border shadow-inner rounded-xl px-4 py-2 h-full">
                {saveStatus === 'saving' && <span className="text-text-secondary flex items-center"><RefreshCw size={14} className="mr-2 animate-spin" /> Saving</span>}
                {saveStatus === 'saved' && <span className="text-accent-solid flex items-center"><Cloud size={14} className="mr-2" /> Saved</span>}
                {saveStatus === 'offline' && <span className="text-red-500 flex items-center"><CloudOff size={14} className="mr-2" /> Offline</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 bg-surface border border-border shadow-card rounded-3xl p-6 sm:p-10 w-full">
            <div>
              <label className="block text-xs font-bold tracking-widest text-text-secondary uppercase mb-2">Title</label>
              <input 
                value={lyric.title || ''}
                onChange={e => updateLyric({ title: e.target.value })}
                className="bg-surface-raised border border-border shadow-inner rounded-xl px-4 py-3 text-lg sm:text-2xl font-bold text-text-primary focus:outline-none focus:border-accent-solid w-full transition-all"
                placeholder="Untitled Lyrics"
              />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest text-text-secondary uppercase mb-2">Lyrics Body</label>
              <textarea 
                className="w-full h-[50vh] bg-surface-raised border border-border shadow-inner rounded-2xl p-6 font-sans text-[15px] sm:text-[17px] text-text-primary font-medium whitespace-pre-wrap resize-y focus:outline-none focus:border-accent-solid transition-all leading-relaxed"
                value={lyric.body || ''}
                onChange={e => updateLyric({ body: e.target.value })}
                placeholder="Type lyrics here..."
                spellCheck={false}
              />
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={copyAsText}
                className="px-6 py-3 bg-accent-gradient shadow-md text-white hover:brightness-110 rounded-xl transition-all text-sm font-bold tracking-widest uppercase flex items-center"
              >
                {copied ? 'Copied!' : <><Copy size={16} className="mr-2" /> Copy All</>}
              </button>
            </div>
          </div>
        </div>
      </main>
      
      {isFolderPickerOpen && (
        <FolderPickerModal
          isOpen={true}
          onClose={() => setIsFolderPickerOpen(false)}
          onMoveHere={(id) => {
            handleMoveLyrics(id);
            setIsFolderPickerOpen(false);
          }}
          title="Move Lyrics to..."
          excludeIds={[]}
        />
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={handleReviewEdits}
        >
          <div
            className="bg-white/95 dark:bg-[#18181d]/95 backdrop-blur-2xl border border-white/60 dark:border-white/15 shadow-2xl rounded-3xl p-6 sm:p-8 w-full max-w-sm sm:max-w-md flex flex-col gap-4 text-center select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500">
              <AlertTriangle size={30} />
            </div>

            <div>
              <h3 className="text-xl font-bold text-text-primary">Keep Your Edits?</h3>
              <p className="text-xs sm:text-sm text-text-secondary mt-2 leading-relaxed">
                You made changes to these lyrics. Do you want to keep your edits, discard them to prevent accidental changes, or review your work?
              </p>
            </div>

            <div className="flex flex-col gap-2.5 mt-2">
              {/* Option 1: Keep Edits & Exit */}
              <button
                type="button"
                onClick={handleKeepEdits}
                className="w-full py-3 px-4 bg-accent-gradient text-white text-xs sm:text-sm font-bold tracking-wider uppercase rounded-xl hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Check size={16} /> Keep Edits & Exit
              </button>

              {/* Option 2: Discard Edits */}
              <button
                type="button"
                onClick={handleDiscardEdits}
                className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs sm:text-sm font-bold tracking-wider uppercase rounded-xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw size={16} /> Discard Edits
              </button>

              {/* Option 3: Review Changes */}
              <button
                type="button"
                onClick={handleReviewEdits}
                className="w-full py-2.5 px-4 bg-surface hover:bg-surface-raised border border-border text-text-primary text-xs sm:text-sm font-bold rounded-xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Eye size={16} /> Review Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
