"use client";

import React, { useEffect, useState, useRef } from "react";
import { LogoLoading } from "./LogoLoading";
import styles from "./SplashScreen.module.css";

/** Total duration the splash stays active before smooth fade out starts (in ms) */
const HOLD_MS = 2500;
const HOLD_MS_REDUCED_MOTION = 800;
const FADE_MS = 500;

/**
 * Animated launch screen.
 * - Shows ONLY when the app is opened for the first time in a session OR on a hard refresh.
 * - Displays the chosen LogoLoading variant (Matrix, Waves, or Studio Rack).
 * - Smoothly fades out with hardware-accelerated easing.
 * - Tap anywhere or tap "Skip ›" to smoothly dismiss early.
 */
export function SplashScreen() {
  const [shouldShow, setShouldShow] = useState<boolean | null>(null);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);
  const dismissedRef = useRef(false);

  const [loadingVariant, setLoadingVariant] = useState<'rhythm-matrix' | 'harmonic-wave' | 'studio-rack'>('rhythm-matrix');
  const [loadingBpm, setLoadingBpm] = useState<number>(120);
  const [loadingStatus, setLoadingStatus] = useState<string>('Tuning chord progression & harmony...');

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFading(true);
    setTimeout(() => {
      setGone(true);
    }, FADE_MS);
  };

  useEffect(() => {
    // Read saved variant choice from localStorage
    try {
      const savedVariant = localStorage.getItem('chordly_loading_variant');
      if (savedVariant === 'rhythm-matrix' || savedVariant === 'harmonic-wave' || savedVariant === 'studio-rack') {
        setLoadingVariant(savedVariant);
      }
      const savedBpm = localStorage.getItem('chordly_loading_bpm');
      if (savedBpm) setLoadingBpm(Number(savedBpm) || 120);

      const savedStatus = localStorage.getItem('chordly_loading_status');
      if (savedStatus) setLoadingStatus(savedStatus);
    } catch {}

    // Only show on:
    // 1. First time opening the app in this session (sessionStorage empty)
    // 2. Explicit hard refresh (Ctrl+Shift+R / Ctrl+F5)
    try {
      const splashShown = sessionStorage.getItem("chordly_splash_shown");
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const isHardReload = nav?.type === "reload" && (nav.transferSize > 1000 || nav.encodedBodySize > 500);
      const isFirstTime = !splashShown;

      if (!isFirstTime && !isHardReload) {
        setGone(true);
        setShouldShow(false);
        return;
      }

      sessionStorage.setItem("chordly_splash_shown", "true");
      setShouldShow(true);
    } catch {
      setShouldShow(true);
    }

    // Capture Ctrl+Shift+R / Cmd+Shift+R / Ctrl+F5 so next reload will splash
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey || e.key === "F5") && (e.key === "r" || e.key === "R" || e.key === "F5")) {
        try {
          sessionStorage.removeItem("chordly_splash_shown");
        } catch {}
      }
      if (e.key === "F5" && (e.ctrlKey || e.shiftKey)) {
        try {
          sessionStorage.removeItem("chordly_splash_shown");
        } catch {}
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? HOLD_MS_REDUCED_MOTION : HOLD_MS;

    const elapsed = performance.now();
    const remaining = Math.max(200, hold - elapsed);

    const timer = setTimeout(() => {
      dismiss();
    }, remaining);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Suppressed for existing session or already dismissed
  if (gone || shouldShow === false) return null;

  return (
    <div
      data-splash
      role="status"
      aria-label="Loading Chordly"
      onClick={dismiss}
      className={`${styles.root} ${fading ? styles.fading : ""} fixed inset-0 z-[999999] grid place-items-center bg-[#09090b] select-none cursor-pointer`}
      style={{
        paddingTop: "max(20px, env(safe-area-inset-top))",
        paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        paddingLeft: "max(20px, env(safe-area-inset-left))",
        paddingRight: "max(20px, env(safe-area-inset-right))",
        touchAction: "manipulation",
      }}
    >
      <LogoLoading
        variant="fullscreen"
        styleVariant={loadingVariant}
        bpm={loadingBpm}
        statusText={loadingStatus}
      />

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
