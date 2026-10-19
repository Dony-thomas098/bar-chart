'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { Sidebar } from './Sidebar';
import { ChordlyLogo } from './ChordlyLogo';
import { usePathname } from 'next/navigation';

export function Header() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Hide the header/tabs on full-screen performance screens
  const isPerformScreen =
    (pathname.startsWith('/perform/') && pathname.split('/').length === 3) ||
    (pathname.includes('/perform') && pathname.split('/').length >= 4);

  if (isPerformScreen) return null;

  return (
    <>
      <header className="sticky top-0 z-40 no-print transition-colors pt-2 sm:pt-3">
        {/* Transparent over canvas */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative flex items-center justify-between h-13 sm:h-14">
            
            {/* Left: Hamburger menu + Brand Logo (both mobile & desktop) */}
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
            </div>

          </div>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
