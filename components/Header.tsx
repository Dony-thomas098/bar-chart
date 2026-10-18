'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { Sidebar } from './Sidebar';
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
            
            {/* Left: Hamburger menu (mobile/desktop) + Logo (desktop) */}
            <div className="flex items-center gap-2.5 sm:gap-3 z-10">
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-text-primary hover:bg-white/60 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                aria-label="Open Navigation Menu"
              >
                <Menu size={22} className="stroke-[2.2]" />
              </button>

              {/* Brand Logo for desktop (>= sm) */}
              <Link href="/" className="hidden sm:flex items-center space-x-2.5 group cursor-pointer select-none">
                <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm border border-black/5 dark:border-white/10 flex items-center justify-center bg-white/80 dark:bg-zinc-800 shrink-0">
                  <img src="/icon.png" alt="ChordCraft" className="w-full h-full object-cover" />
                </div>
                <span className="hidden md:inline text-xl font-extrabold tracking-tight text-text-primary">
                  Chord<span className="text-craft-gradient">Craft</span>
                </span>
              </Link>
            </div>

            {/* Mobile Brand Logo (centered on < sm screens) */}
            <Link href="/" className="sm:hidden flex items-center space-x-2 group cursor-pointer select-none">
              <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm border border-black/5 dark:border-white/10 flex items-center justify-center bg-white/80 dark:bg-zinc-800">
                <img src="/icon.png" alt="ChordCraft" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-text-primary">
                Chord<span className="text-craft-gradient">Craft</span>
              </span>
            </Link>

          </div>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
