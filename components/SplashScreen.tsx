"use client";

import React, { useEffect, useState, useRef } from "react";
import { ChordlyLogo } from "./ChordlyLogo";
import styles from "./SplashScreen.module.css";

/** Total duration the splash stays active before smooth fade out starts (in ms) */
const HOLD_MS = 2200;
const HOLD_MS_REDUCED_MOTION = 700;
const FADE_MS = 500;

/**
 * Animated Brand Launch Screen.
 * - Shows ONLY when the app is opened for the first time in a session OR after a hard refresh / reload.
 * - Displays the animated Chordly brand logo (vinyl soundwave arcs + liquid wordmark letter animation).
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
      try {
        document.documentElement.classList.add("no-splash");
      } catch {}
    }, FADE_MS);
  };

  useEffect(() => {
    // 1. Determine if this is the first entry in session OR a hard refresh/reload
    try {
      const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      const isReload =
        (navEntries.length > 0 && navEntries[0].type === "reload") ||
        (typeof performance !== "undefined" && (performance as any).navigation?.type === 1);
      const splashShown = sessionStorage.getItem("chordly_splash_shown");

      if (splashShown && !isReload) {
        // Already shown in this session and NOT a refresh -> dismiss immediately
        setGone(true);
        document.documentElement.classList.add("no-splash");
        return;
      }

      // First entry or reload: mark shown for this session and present splash
      sessionStorage.setItem("chordly_splash_shown", "true");
      document.documentElement.classList.remove("no-splash");
      setGone(false);
    } catch {
      // In case sessionStorage is restricted (incognito/webview security)
      setGone(false);
    }

    // 2. Intercept hard refresh key combos so next load displays splash
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "r" || e.key === "R")) ||
        (e.ctrlKey && e.key === "F5")
      ) {
        try {
          sessionStorage.removeItem("chordly_splash_shown");
        } catch {}
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // 3. Auto dismiss after hold time
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? HOLD_MS_REDUCED_MOTION : HOLD_MS;

    const timer = setTimeout(() => {
      dismiss();
    }, hold);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
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

      {/* Skip button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className="fixed bottom-6 right-6 z-[1000000] px-4 py-1.5 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 backdrop-blur-md text-white/90 hover:text-white text-xs font-semibold border border-white/20 transition-all shadow-2xl cursor-pointer"
        aria-label="Skip intro"
      >
        Skip ›
      </button>
    </div>
  );
}

export default SplashScreen;
