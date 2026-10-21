'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './ChordlyLoader.module.css';

export interface ChordlyLoaderProps {
  /** Status text displayed below the equalizer. Defaults to 'Synchronizing your catalog' */
  statusText?: string;
  /** Whether loading has completed. Triggers the smooth fade-out once minDisplayMs has elapsed */
  isDone?: boolean;
  /** Minimum time to display the loader before allowing fade-out. Defaults to 900ms */
  minDisplayMs?: number;
  /** Duration of the exit fade in ms. Defaults to 350ms */
  fadeDurationMs?: number;
  /** Callback fired after the fade-out completes */
  onFadeComplete?: () => void;
  /** Additional wrapper CSS classes */
  className?: string;
  /** Override inline styles */
  style?: React.CSSProperties;
}

export function ChordlyLoader({
  statusText = 'Synchronizing your catalog',
  isDone,
  minDisplayMs = 900,
  fadeDurationMs = 350,
  onFadeComplete,
  className = '',
  style,
}: ChordlyLoaderProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [fading, setFading] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const fadeTriggeredRef = useRef(false);
  const onFadeCompleteRef = useRef(onFadeComplete);
  onFadeCompleteRef.current = onFadeComplete;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Min display timer to prevent visual flicker
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDisplayMs);

    return () => clearTimeout(timer);
  }, [minDisplayMs]);

  // 2. Handle completion and smooth fade-out (resilient against parent re-renders)
  useEffect(() => {
    if (isDone === true && minTimeElapsed && !fadeTriggeredRef.current) {
      fadeTriggeredRef.current = true;
      setFading(true);
      timerRef.current = setTimeout(() => {
        onFadeCompleteRef.current?.();
      }, fadeDurationMs);
    }
  }, [isDone, minTimeElapsed, fadeDurationMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 3. 60fps Particle Canvas System (warm musical embers & harmonic floating dust)
  useEffect(() => {
    const cvEl = canvasRef.current;
    const bannerEl = bannerRef.current;
    const stageEl = stageRef.current;
    if (!cvEl || !bannerEl || !stageEl) return;

    const ctx = cvEl.getContext('2d');
    if (!ctx) return;

    const canvas: HTMLCanvasElement = cvEl;
    const banner: HTMLDivElement = bannerEl;
    const stage: HTMLDivElement = stageEl;
    const context: CanvasRenderingContext2D = ctx;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      ox: number;
      oy: number;
      s: number;
      life: number;
      max: number;
      c: string;
    }

    let P: Particle[] = [];
    let t0 = performance.now();
    let last = t0;
    let cx = 0;
    let cy = 0;
    let scale = 1;
    let animId: number;
    let isPaused = false;
    let pauseStartTime = 0;
    let lastSpawn = 0;

    const cols = ['#ffffff', '#ffd9b0', '#f3a05a', '#e8742c', '#ff8a4a'];

    function size() {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      const b = banner.getBoundingClientRect();
      cx = (b.left + b.width / 2 - r.left) * dpr;
      cy = (b.top + b.height / 2 - r.top) * dpr;
      scale = (b.width / 440) * dpr;
    }

    size();
    window.addEventListener('resize', size);

    function spawnEmbers(count: number) {
      if (reduceMotion) return;
      for (let i = 0; i < count; i++) {
        if (P.length >= 75) break;
        const offsetX = (Math.random() - 0.5) * 380 * scale;
        const offsetY = (Math.random() - 0.5) * 120 * scale;
        P.push({
          x: cx + offsetX,
          y: cy + offsetY,
          vx: (Math.random() - 0.5) * 22 * scale,
          vy: -(15 + Math.random() * 35) * scale,
          ox: (Math.random() - 0.5) * 40 * scale,
          oy: -(20 + Math.random() * 45) * scale,
          s: (0.9 + Math.random() * 2.2) * dpr,
          life: 0,
          max: 1.6 + Math.random() * 1.6,
          c: cols[Math.floor(Math.random() * cols.length)],
        });
      }
    }

    function frame(now: number) {
      if (isPaused) {
        animId = requestAnimationFrame(frame);
        return;
      }

      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Periodic spawn
      if (!reduceMotion && now - lastSpawn > 140) {
        lastSpawn = now;
        spawnEmbers(3);
      }

      context.clearRect(0, 0, canvas.width, canvas.height);

      if (P.length) {
        context.globalCompositeOperation = 'lighter';
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i];
          p.life += dt;
          if (p.life > p.max) {
            P.splice(i, 1);
            continue;
          }
          const k = p.life / p.max;
          p.x += (p.vx + Math.sin(p.life * 2 + i) * p.ox * 0.4) * dt;
          p.y += (p.vy + p.oy * 0.3) * dt;

          const alpha = Math.sin(Math.min(k * 3, 1) * Math.PI / 2) * (1 - k);
          context.globalAlpha = Math.max(0, Math.min(1, alpha * 0.85));
          context.fillStyle = p.c;
          context.beginPath();
          context.arc(p.x, p.y, p.s * (1 - k * 0.45), 0, Math.PI * 2);
          context.fill();
        }
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'source-over';
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    // 4. Background pause/resume handling to save CPU/battery
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isPaused = true;
        pauseStartTime = performance.now();
        stage.style.setProperty('--anim-state', 'paused');
      } else {
        if (isPaused) {
          const pauseDuration = performance.now() - pauseStartTime;
          t0 += pauseDuration;
          last = performance.now();
          isPaused = false;
          stage.style.setProperty('--anim-state', 'running');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', size);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Clean status text by trimming trailing dots
  const cleanStatusText = statusText ? statusText.replace(/\.+$/, '') : 'Synchronizing your catalog';

  return (
    <div
      ref={stageRef}
      className={`${styles.stage} ${fading ? styles.fading : ''} ${className}`}
      style={style}
      role="status"
      aria-live="polite"
    >
      {/* 60fps Harmonic Embers Canvas */}
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      {/* Atmospheric Ambient Backglow */}
      <div className={styles.ambientGlow} aria-hidden="true" />

      {/* Main Animated Logo Banner Wrap */}
      <div ref={bannerRef} className={styles.bannerWrap} aria-hidden="true">
        {/* Squircle Soundwave Anchor (left: 11.28%, top: 50%) */}
        <div className={styles.iconAnchor}>
          <div className={`${styles.shockwave} ${styles.shockwave1}`} />
          <div className={`${styles.shockwave} ${styles.shockwave2}`} />
          <div className={`${styles.shockwave} ${styles.shockwave3}`} />
          <div className={`${styles.shockwave} ${styles.shockwave4}`} />
          <div className={styles.coreDotGlow} />
        </div>

        {/* Base Logo Banner Image */}
        <img
          src="/logo-banner.png"
          alt="Chordly"
          className={styles.bannerImg}
          draggable={false}
        />

        {/* Dynamic Specular Sheen Sweep Masked to the Logo Shape */}
        <div className={styles.sheenOverlay}>
          <div className={styles.sheenStreak} />
        </div>
      </div>

      {/* Rhythm Equalizer Mini Bars */}
      <div className={styles.eqWrap} aria-hidden="true">
        <div className={`${styles.eqBar} ${styles.b1}`} />
        <div className={`${styles.eqBar} ${styles.b2}`} />
        <div className={`${styles.eqBar} ${styles.b3}`} />
        <div className={`${styles.eqBar} ${styles.b4}`} />
        <div className={`${styles.eqBar} ${styles.b5}`} />
      </div>

      {/* Status Text with Animated Trailing Dots */}
      <div className={styles.status}>
        {cleanStatusText}
        <i>.</i>
        <i>.</i>
        <i>.</i>
      </div>
    </div>
  );
}

export default ChordlyLoader;
