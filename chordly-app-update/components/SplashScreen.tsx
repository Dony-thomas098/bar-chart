"use client";

import { useEffect, useState } from "react";
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
 * - Tap anywhere to skip.
 */
export function SplashScreen() {
  const [gone, setGone] = useState(false);

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
      onClick={() => setGone(true)}
      className={`${styles.root} fixed inset-0 z-[9999] grid place-items-center bg-[var(--bg-canvas)]`}
      style={{
        paddingTop: "max(20px, env(safe-area-inset-top))",
        paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        paddingLeft: "max(20px, env(safe-area-inset-left))",
        paddingRight: "max(20px, env(safe-area-inset-right))",
      }}
    >
      <ChordlyLogo variant="stacked" animate className="sm:hidden w-[min(80vw,420px)] h-auto" />
      <ChordlyLogo variant="full" animate className="hidden sm:block w-[min(86vw,820px)] h-auto" />
    </div>
  );
}

export default SplashScreen;
