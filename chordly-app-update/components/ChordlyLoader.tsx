'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './ChordlyLoader.module.css';

export interface ChordlyLoaderProps {
  /** Status text displayed below the wordmark. Defaults to 'Synchronizing your catalog' */
  statusText?: string;
  /** Whether loading has completed. Triggers the smooth fade-out once minDisplayMs has elapsed */
  isDone?: boolean;
  /** Minimum time to display the loader before allowing fade-out. Defaults to 800ms */
  minDisplayMs?: number;
  /** Duration of the exit fade in ms. Defaults to 300ms */
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
  minDisplayMs = 800,
  fadeDurationMs = 300,
  onFadeComplete,
  className = '',
  style,
}: ChordlyLoaderProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [fading, setFading] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const mountTimeRef = useRef<number>(0);
  const fadeTriggeredRef = useRef(false);

  // 1. Min display timer (minimum 800ms to avoid flashes)
  useEffect(() => {
    mountTimeRef.current = performance.now();
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDisplayMs);

    return () => clearTimeout(timer);
  }, [minDisplayMs]);

  // 2. Handle completion and smooth fade-out
  useEffect(() => {
    if (isDone === true && minTimeElapsed && !fadeTriggeredRef.current) {
      fadeTriggeredRef.current = true;
      setFading(true);
      const timer = setTimeout(() => {
        onFadeComplete?.();
      }, fadeDurationMs);
      return () => clearTimeout(timer);
    }
  }, [isDone, minTimeElapsed, fadeDurationMs, onFadeComplete]);

  // 3. Particle system on canvas (capped at 90 particles, additive blending, DPR <= 2)
  useEffect(() => {
    const cvEl = canvasRef.current;
    const markEl = markRef.current;
    const stageEl = stageRef.current;
    if (!cvEl || !markEl || !stageEl) return;

    const ctx = cvEl.getContext('2d');
    if (!ctx) return;

    const canvas: HTMLCanvasElement = cvEl;
    const mark: HTMLDivElement = markEl;
    const stage: HTMLDivElement = stageEl;
    const context: CanvasRenderingContext2D = ctx;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let P: Array<{
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
    }> = [];

    let fired = false;
    let t0 = performance.now();
    let last = t0;
    let cx = 0;
    let cy = 0;
    let scale = 1;
    let animId: number;
    let isPaused = false;
    let pauseStartTime = 0;

    const cols = ['#ffffff', '#ffd9b0', '#f3a05a', '#e8742c', '#ff8a4a'];

    function size() {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      const m = mark.getBoundingClientRect();
      cx = (m.left + m.width / 2 - r.left) * dpr;
      cy = (m.top + m.height / 2 - r.top) * dpr;
      scale = (m.width / 400) * dpr;
    }

    size();
    window.addEventListener('resize', size);

    function burst() {
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = (30 + Math.random() * 95) * scale;
        P.push({
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          vx: Math.cos(a + 0.9) * (20 + Math.random() * 60) * scale,
          vy: Math.sin(a + 0.9) * (20 + Math.random() * 60) * scale,
          ox: Math.cos(a) * (40 + Math.random() * 140) * scale,
          oy: Math.sin(a) * (40 + Math.random() * 140) * scale,
          s: (0.8 + Math.random() * 2.6) * dpr,
          life: 0,
          max: 1.4 + Math.random() * 1.4,
          c: cols[i % cols.length],
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
      const ph = (now - t0) % 8000;

      if (!reduceMotion) {
        if (ph > 5500 && ph < 5700 && !fired) {
          fired = true;
          burst();
        }
        if (ph < 1000) {
          fired = false;
        }
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
          p.x += (p.vx + p.ox * 0.35) * dt;
          p.y += (p.vy + p.oy * 0.35) * dt;
          context.globalAlpha = Math.sin(Math.min(k * 3, 1) * Math.PI / 2) * (1 - k);
          context.fillStyle = p.c;
          context.beginPath();
          context.arc(p.x, p.y, p.s * (1 - k * 0.5), 0, Math.PI * 2);
          context.fill();
        }
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'source-over';
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    // 4. Background pause/resume handling
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

  // Clean status text by removing trailing periods so three animated dots can follow
  const cleanStatusText = statusText ? statusText.replace(/\.+$/, '') : 'Synchronizing your catalog';

  return (
    <div
      ref={stageRef}
      className={`${styles.stage} ${fading ? styles.fading : ''} ${className}`}
      style={style}
      role="status"
      aria-live="polite"
    >
      {/* 60fps Particle Canvas */}
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      {/* Animated Logo Mark Container */}
      <div ref={markRef} className={styles.markWrap} aria-hidden="true">
        <svg className={styles.mark} viewBox="0 0 400 400">
          <defs>
            <radialGradient id="chordly-core-gradient">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Thin Outer Rings (14% white opacity) */}
          <circle className={styles.thin} cx="200" cy="200" r="138" />
          <circle className={styles.thin} cx="200" cy="200" r="162" />

          {/* Shockwave Rings */}
          <circle className={styles.shock} cx="200" cy="200" r="60" />
          <circle className={`${styles.shock} ${styles.shock2}`} cx="200" cy="200" r="60" />

          {/* Four Concentric Arcs */}
          {/* Outer Arc: r=116, #D9501C, counter-clockwise 6.0s */}
          <circle className={`${styles.arc} ${styles.a4}`} cx="200" cy="200" r="116" pathLength={100} />
          {/* Middle-outer Arc: r=92, #E8742C, clockwise 5.2s */}
          <circle className={`${styles.arc} ${styles.a3}`} cx="200" cy="200" r="92" pathLength={100} />
          {/* Middle-inner Arc: r=68, #F3A05A, counter-clockwise 4.4s */}
          <circle className={`${styles.arc} ${styles.a2}`} cx="200" cy="200" r="68" pathLength={100} />
          {/* Inner Arc: r=44, #F9D3AE, clockwise 3.6s */}
          <circle className={`${styles.arc} ${styles.a1}`} cx="200" cy="200" r="44" pathLength={100} />

          {/* Center Halo & Dot */}
          <circle className={styles.halo} cx="200" cy="200" r="26" fill="url(#chordly-core-gradient)" />
          <circle className={styles.dot} cx="200" cy="200" r="9" />
        </svg>

        {/* Lens-flare horizontal sweep & glowing head blob */}
        <div className={styles.flare}>
          <div className={styles.fl}>
            <i className={styles.flLine} />
            <b className={styles.flBlob} />
          </div>
        </div>
      </div>

      {/* Brand Wordmark */}
      <div className={styles.brand}>
        chord<span>ly</span>
      </div>

      {/* Rhythmic Animated Status Text */}
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
