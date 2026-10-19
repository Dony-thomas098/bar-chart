# Chordly Core Bundle: Header, Layout & Manifest

This folder gathers the core app shell, layout structure, header navigation, and PWA manifest files into a single location for sharing.

---

### Files Included:

1. **`Header.tsx`**
   - **Original Path:** [`components/Header.tsx`](file:///d:/chord-grid/components/Header.tsx)
   - **Description:** Sticky top navigation bar containing the hamburger menu button (drawer trigger), Chordly brand logo, quick shortcuts, and screen-visibility rules (automatically hides during full-screen performance mode).

2. **`layout.tsx`**
   - **Original Path:** [`app/layout.tsx`](file:///d:/chord-grid/app/layout.tsx)
   - **Description:** Root Next.js layout component configuring Google fonts (`Plus Jakarta Sans` & `JetBrains Mono`), PWA metadata, viewport settings, theme hydration script, service worker registration, `SplashScreen`, and core context providers (`AuthProvider`, `OfflineSyncProvider`, `Navigation`, `ThemeSync`, `BackgroundBlobs`).

3. **`chart-layout.tsx`**
   - **Original Path:** [`app/chart/layout.tsx`](file:///d:/chord-grid/app/chart/layout.tsx)
   - **Description:** Sub-layout for chart editor screens configuring user-scalable viewports for live zoom-pan Pinch interaction.

4. **`manifest.json`**
   - **Original Path:** [`public/manifest.json`](file:///d:/chord-grid/public/manifest.json)
   - **Description:** Progressive Web App (PWA) manifest declaring app name, icons (192x192, 512x512 maskable), theme color (`#080414`), standalone display mode, and home screen quick action shortcuts (Library, Perform Mode, Setlists, Lyrics).
