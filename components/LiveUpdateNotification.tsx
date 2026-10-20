'use client';

import { useEffect, useState } from 'react';
import { subscribeLiveUpdate, applyLiveUpdateNow, LiveUpdateState } from '@/lib/liveUpdate';
import { Zap, RefreshCw, X, ArrowUpCircle } from 'lucide-react';

export function LiveUpdateNotification() {
  const [state, setState] = useState<LiveUpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeLiveUpdate((newState) => {
      setState(newState);
      if (newState.updateReady) {
        setDismissed(false); // Reset dismissed when a new update arrives
      }
    });
    return () => unsubscribe();
  }, []);

  if (!state || dismissed) return null;

  // 1. When an update is ready to be applied
  if (state.updateReady) {
    return (
      <aside 
        aria-label="App update ready notification"
        className="fixed bottom-[calc(max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px))+82px)] left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px] z-[999] animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
      >
        <div className="bg-[#17171C]/95 backdrop-blur-xl border border-[#FF5A00]/40 rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_24px_rgba(255,90,0,0.2)] flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FF5A00]/15 border border-[#FF5A00]/30 flex items-center justify-center shrink-0">
                <Zap size={16} className="text-[#FF5A00] fill-[#FF5A00]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Update Ready
                </h4>
                <p className="text-xs text-[#8C8A93]">
                  A new version of Chordly was downloaded.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss update notification"
              className="p-1 text-[#8C8A93] hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isApplying}
              onClick={async () => {
                setIsApplying(true);
                await applyLiveUpdateNow();
              }}
              className="flex-1 h-9 rounded-xl bg-gradient-to-r from-[#FF5A00] to-[#FF5C7A] text-white text-xs font-bold shadow-[0_4px_16px_rgba(255,90,0,0.35)] hover:brightness-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Restarting...</span>
                </>
              ) : (
                <>
                  <ArrowUpCircle size={14} />
                  <span>Restart to Apply</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="px-3 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#8C8A93] hover:text-white transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // 2. Optional: Discreet download progress pill when downloading large bundle
  if (state.isDownloading && state.downloadProgress > 0 && state.downloadProgress < 100) {
    return (
      <div 
        role="status" 
        aria-live="polite"
        className="fixed top-[calc(env(safe-area-inset-top,0px)+12px)] right-4 z-50 bg-[#17171C]/90 backdrop-blur-md border border-[#33333C] rounded-full px-3 py-1 text-[11px] font-semibold text-[#8C8A93] flex items-center gap-2 shadow-lg animate-in fade-in duration-200"
      >
        <RefreshCw size={12} className="animate-spin text-[#FF5A00]" />
        <span>Updating Chordly ({state.downloadProgress}%)</span>
      </div>
    );
  }

  return null;
}
