"use client";

import React, { useEffect, useState, useRef } from "react";
import { ChordlyLogo } from "./ChordlyLogo";
import styles from "./SplashScreen.module.css";

/** Total duration the splash stays active before smooth fade out starts (in ms) */
const HOLD_MS = 2500;
const HOLD_MS_REDUCED_MOTION = 800;
const FADE_MS = 500;

/**
 * Animated launch screen.
 * - Shows first, on top of everything, every time the app opens or the page is fully reloaded.
 * - Does NOT show again when navigating between screens inside the app.
 * - Smoothly fades out with hardware-accelerated easing.
 * - Tap anywhere or tap "Skip ›" to smoothly dismiss early.
 */
export function SplashScreen() {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);
  const dismissedRef = useRef(false);

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFading(true);
    setTimeout(() => {
      setGone(true);
    }, FADE_MS);
  };

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? HOLD_MS_REDUCED_MOTION : HOLD_MS;

    // Remaining time accounting for load duration
    const elapsed = performance.now();
    const remaining = Math.max(200, hold - elapsed);

    const timer = setTimeout(() => {
      dismiss();
    }, remaining);

    return () => clearTimeout(timer);
  }, []);

  if (gone) return null;

  return (
    <div
      data-splash
      role="status"
      aria-label="Loading Chordly"
      onClick={dismiss}
      className={`${styles.root} ${fading ? styles.fading : ""} fixed inset-0 z-[999999] grid place-items-center bg-[var(--bg-canvas)] select-none cursor-pointer`}
      style={{
        paddingTop: "max(20px, env(safe-area-inset-top))",
        paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        paddingLeft: "max(20px, env(safe-area-inset-left))",
        paddingRight: "max(20px, env(safe-area-inset-right))",
        touchAction: "manipulation",
      }}
    >
      {/* Mobile stacked logo (phones / narrow screens) */}
      <div className={styles.mobileLogo}>
        <ChordlyLogo variant="stacked" animate className="w-[min(80vw,420px)] h-auto" />
      </div>

      {/* Desktop side-by-side logo (tablets / desktop) */}
      <div className={styles.desktopLogo}>
        <ChordlyLogo variant="full" animate className="w-[min(86vw,820px)] h-auto" />
      </div>

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
