'use client';

import React, { useState, useEffect, useRef } from 'react';

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const dismiss = () => {
    if (fading) return;
    setFading(true);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
    }
    setTimeout(() => {
      setVisible(false);
    }, 350);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[SplashScreen] Autoplay prevented:', err);
        });
      }
    }

    // Safety fallback: auto-dismiss if video stalls or takes longer than 9.5s (video duration is ~8s)
    const fallbackTimer = setTimeout(() => {
      dismiss();
    }, 9500);

    return () => clearTimeout(fallbackTimer);
  }, []);

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[999999] bg-black overflow-hidden transition-opacity duration-350 ease-out select-none cursor-pointer ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Fullscreen Edge-to-Edge Video - No Letterbox, No Movie Borders */}
      <video
        ref={videoRef}
        src="/splash.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        // @ts-ignore
        webkit-playsinline="true"
        onCanPlay={() => {
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          }
        }}
        onEnded={dismiss}
        onError={(e) => {
          console.error('[SplashScreen] Video playback error:', e);
          setTimeout(dismiss, 500);
        }}
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Skip button in bottom-right corner */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className="absolute bottom-6 right-6 z-10 px-4 py-1.5 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 backdrop-blur-md text-white/90 hover:text-white text-xs font-semibold border border-white/20 transition-all shadow-2xl cursor-pointer"
        aria-label="Skip splash video"
      >
        Skip ›
      </button>
    </div>
  );
}

export default SplashScreen;
