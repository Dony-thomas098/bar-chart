'use client';

import { Menu, ArrowLeft } from 'lucide-react';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from './Sidebar';
import { ChordlyLogo } from './ChordlyLogo';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function Header() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleBack = useCallback(() => {
    const returnTo = searchParams?.get('returnTo');
    if (returnTo) {
      router.push(returnTo);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    // Context-sensitive fallback
    if (pathname.startsWith('/lyrics')) {
      router.push('/lyrics/');
    } else if (pathname.startsWith('/setlists')) {
      router.push('/setlists/');
    } else if (pathname.startsWith('/folder')) {
      router.push('/folder/');
    } else {
      router.push('/');
    }
  }, [router, searchParams, pathname]);

  // Hide on auth / login page or full-screen performance screens
  if (
    pathname === '/auth' ||
    pathname.startsWith('/auth') ||
    (pathname.startsWith('/perform/') && pathname.split('/').length === 3) ||
    (pathname.includes('/perform') && pathname.split('/').length >= 4)
  ) {
    return null;
  }

  return (
    <>
      <header
        className="sticky top-0 z-40 no-print transition-colors bg-[var(--bg-canvas)]/80 dark:bg-[var(--bg-canvas)]/80 backdrop-blur-xl"
        style={{
          paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px)) + 14px)',
          paddingLeft: 'max(env(safe-area-inset-left, 0px), var(--safe-area-inset-left, 0px))',
          paddingRight: 'max(env(safe-area-inset-right, 0px), var(--safe-area-inset-right, 0px))',
          paddingBottom: '8px',
        }}
      >
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative flex items-center justify-between min-h-[56px] h-14">
            
            {/* Left: Hamburger menu + Brand Logo (both mobile & desktop) + Desktop Back Button */}
            <div className="flex items-center gap-2 sm:gap-3 z-10">
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-text-primary hover:bg-white/60 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                aria-label="Open Navigation Menu"
              >
                <Menu size={22} className="stroke-[2.2]" />
              </button>

              {/* Brand logo (mobile h-7, desktop h-9) */}
              <Link href="/" aria-label="Chordly home" className="flex items-center select-none cursor-pointer">
                <ChordlyLogo variant="full" className="h-7 sm:h-9 w-auto aspect-[1239/302]" />
              </Link>

              {/* Desktop-only in-app Back button */}
              <button
                type="button"
                onClick={handleBack}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-text-primary border border-black/5 dark:border-white/10 shadow-xs transition-all active:scale-95 cursor-pointer select-none"
                title="Go back"
                aria-label="Go back"
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
