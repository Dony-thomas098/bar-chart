# Chordly: logo, icons, splash, manifest update

Everything here is laid out in the same folders as your project, so you can copy it straight over.

## Copy these files into your project

| From this folder | To your project | What it does |
|---|---|---|
| `components/ChordlyLogo.tsx` | `components/ChordlyLogo.tsx` | New reusable logo (full, stacked, icon; optional animation) |
| `components/ChordlyLogo.module.css` | `components/ChordlyLogo.module.css` | Its styles and animation |
| `components/Header.tsx` | `components/Header.tsx` | Your header with the new logo. Logic unchanged |
| `components/SplashScreen.tsx` and `SplashScreen.module.css` | `components/` | Animated launch screen (replaces your current one, which I haven't seen) |
| `app/layout.tsx` | `app/layout.tsx` | New icon links and light/dark theme color |
| `app/chart/layout.tsx` | `app/chart/layout.tsx` | Theme color matched to the app |
| `public/*.png`, `public/favicon.ico` | `public/` | Full icon set |
| `public/manifest.json` | `public/manifest.json` | Updated PWA manifest |

## What changed, and why

- **Logo:** `<ChordlyLogo variant="full" | "stacked" | "icon" animate />`. It scales to whatever size you give it with Tailwind (for example `h-9 w-auto`). Colors follow your existing `.dark` class.
- **Header:** the old `<img src="/icon.png">` plus "chord**ly**" text is replaced by the logo. Phones use `h-7`, from `sm` up `h-9`.
- **Splash:** shows the stacked logo on phones and the side-by-side logo on larger screens. It appears first, every time the app opens or the page is fully reloaded (including a hard refresh), and not when you move between screens inside the app. It fades out after 3 seconds and can be skipped by tapping. With "reduce motion" on it is short and still.
- **Manifest:** the old file used `"any maskable"` on one image, which makes Android crop the rounded icon badly. Now there is a separate `any` icon (192, 512) and a proper full-bleed `maskable` icon. `theme_color` and `background_color` are `#09090b`, so the Android launch screen matches your dark theme. Added `id` and `categories`.
- **layout.tsx:** `themeColor` now follows light and dark mode (`#ececee` / `#09090b`). Before, the layout said `#ececee`, the chart layout and manifest said `#080414`, so the browser bar color changed between screens. I also removed the third-party name `piascore` from the SEO keywords. Using another app's brand as a keyword can cause trouble with search engines and trademark claims.
- **Icons:** `icon.png` and 192 / 512 (rounded, transparent corners), `icon-maskable-512x512.png` and `apple-touch-icon.png` (180, full-bleed square, because iOS and Android round the corners themselves), `favicon.ico` and `favicon-32x32.png` (a simpler 3-arc version that stays readable when tiny).

## Things to check yourself

1. Run `npx tsc --noEmit` and `npm run build`. I could only type-check against stand-in types for React and Next, not your real project.
2. Your existing `Sidebar` header: swap its logo for `<ChordlyLogo variant="icon" className="h-9 w-9" />` (I haven't seen that file).
3. Search the project for the old name, "ChordCraft" or "Chord-Grid", in titles, onboarding text, the service worker (`public/sw.js`) cache name, and the install prompt.
4. After deploying, uninstall and reinstall the PWA on a test phone. Installed apps keep the old icon and manifest until then.
5. `public/sw.js` may have cached the old icons. Bump its cache version.
6. Your root viewport has `maximumScale: 1` and `userScalable: false`. That blocks pinch-zoom for people who need larger text, and accessibility checkers flag it. Allowing zoom on screens other than the chart editor would be better. I left it unchanged because it may be deliberate.
