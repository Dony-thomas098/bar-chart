'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Music, Radio, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const path = window.location.pathname;

    // 1. Check for /perform/CODE (e.g. /perform/C6H6BG) -> Redirect to /perform/stage/?code=CODE
    const performMatch = path.match(/^\/perform\/([A-Za-z0-9]{4,12})/i);
    if (performMatch && performMatch[1].toLowerCase() !== 'stage' && performMatch[1].toLowerCase() !== 'demo') {
      const target = `/perform/stage/?code=${performMatch[1].toUpperCase()}`;
      setRedirecting(true);
      setRedirectTarget(`Live Stage Session ${performMatch[1].toUpperCase()}`);
      router.replace(target);
      return;
    }

    // 2. Check for /chart/ID/edit -> Redirect to /chart/edit/?id=ID
    const chartEditMatch = path.match(/^\/chart\/([A-Za-z0-9_-]{8,})\/edit/i);
    if (chartEditMatch && chartEditMatch[1].toLowerCase() !== 'demo') {
      const target = `/chart/edit/?id=${chartEditMatch[1]}`;
      setRedirecting(true);
      setRedirectTarget('Chart Editor');
      router.replace(target);
      return;
    }

    // 3. Check for /chart/ID -> Redirect to /chart/?id=ID
    const chartMatch = path.match(/^\/chart\/([A-Za-z0-9_-]{8,})/i);
    if (chartMatch && chartMatch[1].toLowerCase() !== 'demo' && chartMatch[1].toLowerCase() !== 'edit') {
      const target = `/chart/?id=${chartMatch[1]}`;
      setRedirecting(true);
      setRedirectTarget('Chord Chart');
      router.replace(target);
      return;
    }

    // 4. Check for /folder/ID -> Redirect to /folder/?id=ID
    const folderMatch = path.match(/^\/folder\/([A-Za-z0-9_-]{8,})/i);
    if (folderMatch && folderMatch[1].toLowerCase() !== 'demo') {
      const target = `/folder/?id=${folderMatch[1]}`;
      setRedirecting(true);
      setRedirectTarget('Folder');
      router.replace(target);
      return;
    }

    // 5. Check for /lyrics/ID/edit -> Redirect to /lyrics/edit/?id=ID
    const lyricsEditMatch = path.match(/^\/lyrics\/([A-Za-z0-9_-]{8,})\/edit/i);
    if (lyricsEditMatch && lyricsEditMatch[1].toLowerCase() !== 'demo') {
      const target = `/lyrics/edit/?id=${lyricsEditMatch[1]}`;
      setRedirecting(true);
      setRedirectTarget('Lyrics Editor');
      router.replace(target);
      return;
    }

    // 6. Check for /lyrics/ID -> Redirect to /lyrics/view/?id=ID
    const lyricsMatch = path.match(/^\/lyrics\/([A-Za-z0-9_-]{8,})/i);
    if (lyricsMatch && lyricsMatch[1].toLowerCase() !== 'demo' && lyricsMatch[1].toLowerCase() !== 'edit' && lyricsMatch[1].toLowerCase() !== 'folder') {
      const target = `/lyrics/view/?id=${lyricsMatch[1]}`;
      setRedirecting(true);
      setRedirectTarget('Lyrics');
      router.replace(target);
      return;
    }

    // 7. Check for /setlists/ID/perform -> Redirect to /setlists/perform?id=ID
    const setlistPerformMatch = path.match(/^\/setlists\/([A-Za-z0-9_-]{4,})\/perform/i);
    if (setlistPerformMatch && setlistPerformMatch[1].toLowerCase() !== 'demo') {
      const target = `/setlists/perform?id=${setlistPerformMatch[1]}`;
      setRedirecting(true);
      setRedirectTarget('Setlist Performance');
      router.replace(target);
      return;
    }

    // 8. Check for /setlists/ID -> Redirect to /setlists/view?id=ID
    const setlistMatch = path.match(/^\/setlists\/([A-Za-z0-9_-]{4,})/i);
    if (setlistMatch && setlistMatch[1].toLowerCase() !== 'demo' && setlistMatch[1].toLowerCase() !== 'view' && setlistMatch[1].toLowerCase() !== 'perform') {
      const target = `/setlists/view?id=${setlistMatch[1]}`;
      setRedirecting(true);
      setRedirectTarget('Setlist');
      router.replace(target);
      return;
    }
  }, [router]);

  if (redirecting) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#121214] text-white gap-4">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-300">
          Connecting to {redirectTarget || 'session'}...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] text-text-primary p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-6 shadow-lg shadow-orange-500/10">
        <Music size={28} />
      </div>

      <h1 className="text-4xl font-extrabold tracking-tight mb-2">404</h1>
      <p className="text-lg font-semibold text-text-primary mb-2">Page Not Found</p>
      <p className="text-xs text-text-secondary max-w-sm mb-8 leading-relaxed font-medium">
        The chart, setlist, or stage session you are looking for does not exist or has been moved.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-btn-dark hover:brightness-110 text-white rounded-xl font-bold text-xs shadow-btn-dark transition-all"
        >
          <Home size={14} />
          Back to Catalog
        </Link>
        <Link
          href="/perform"
          className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-white/70 dark:bg-white/[0.08] border border-glass hover:bg-white/90 text-text-primary rounded-xl font-bold text-xs transition-all"
        >
          <Radio size={14} />
          Join Stage
        </Link>
      </div>
    </div>
  );
}
