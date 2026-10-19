"use client";

import React, { useEffect, useState } from "react";
import { ChordlyLogo } from "./ChordlyLogo";
import styles from "./SplashScreen.module.css";

/** Total time the splash stays on screen, counted from when the page started loading. */
const TOTAL_MS = 3000;
const TOTAL_MS_REDUCED_MOTION = 900;

/**
 * Animated launch screen.
 * - Shows first, on top of everything, every time the app opens or the page is fully reloaded
 *   (including a hard refresh).
 * - Does NOT show again when you move between screens inside the app, because this component
 *   lives in the root layout, which stays mounted.
 * - The fade-out is driven by CSS, so it still happens on time even if the app is slow to load.
 * - Tap anywhere or tap "Skip ›" to dismiss immediately.
 */
export function SplashScreen() {
  const [gone, setGone] = useState(false);

  const dismiss = () => {
    setGone(true);
  };

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const total = reduce ? TOTAL_MS_REDUCED_MOTION : TOTAL_MS;
    // performance.now() = time since the page started loading, so slow starts don't extend the splash.
    const remaining = Math.max(0, total - performance.now());
    const t = window.setTimeout(() => setGone(true), remaining);
    return () => window.clearTimeout(t);
  }, []);

  if (gone) return null;

  return (
    <div
      data-splash
      role="status"
      aria-label="Loading Chordly"
      onClick={dismiss}
      className={`${styles.root} fixed inset-0 z-[999999] grid place-items-center bg-[var(--bg-canvas)] select-none cursor-pointer`}
      style={{
        paddingTop: "max(20px, env(safe-area-inset-top))",
        paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        paddingLeft: "max(20px, env(safe-area-inset-left))",
        paddingRight: "max(20px, env(safe-area-inset-right))",
        touchAction: "manipulation",
      }}
    >
      <ChordlyLogo variant="stacked" animate className="sm:hidden w-[min(80vw,420px)] h-auto" />
      <ChordlyLogo variant="full" animate className="hidden sm:block w-[min(86vw,820px)] h-auto" />

      {/* Skip button kept from current splash screen */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className="absolute bottom-6 right-6 z-10 px-4 py-1.5 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 backdrop-blur-md text-white/90 hover:text-white text-xs font-semibold border border-white/20 transition-all shadow-2xl cursor-pointer"
        aria-label="Skip intro"
      >
        Skip ›
      </button>
    </div>
  );
}

export default SplashScreen;
