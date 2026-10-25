# 📋 Chordly Comprehensive Project Audit Report & Resolution Summary

**Date**: October 25, 2026  
**Audited Branch**: `add-band-isolation`  
**Status**: **Completed & Verified** (Lint passed 0 errors, 86 unit tests passing across 7 suites, Static export build 36/36 routes compiled successfully).

---

## 📊 Summary of Resolutions

| Category | Fixed | Skipped | Needs Decision | Total |
|---|---|---|---|---|
| **Part 1: Updates & Dependencies** | 4 | 0 | 3 | **7** |
| **Part 2: Errors & Application Logic** | 12 | 0 | 0 | **12** |
| **Part 3: Security & Access Control** | 5 | 0 | 1 | **6** |
| **Total** | **21** | **0** | **4** | **25** |

---

## 📑 Detailed Findings & Status Table

| # | Part | Severity | File:line | Problem | Status | Resolution Details |
|---|---|---|---|---|---|---|
| 1 | 1 | **Critical** | `package.json:21` | Next.js 16.2.12 has critical/high security advisories (GHSA-p293-qw3h-jr36 RCE, GHSA-2xp9-vwfh-vxw4, GHSA-4jqv-mc3x-m676). | **Fixed** | Upgraded `next` to `16.4.3`. Eliminates Windows unauthenticated RCE and cache poisoning CVEs. |
| 2 | 1 | **High** | `package-lock.json:1` | Transitive dependencies contain vulnerabilities: `brace-expansion` (DoS), `postcss` (XSS), `sharp`. | **Fixed** | Executed `npm audit fix` and updated core dependencies. Transitive advisories resolved. |
| 3 | 1 | **High** | `package.json:27` | `@capacitor/cli@8.5.3` pulls `xcode` -> vulnerable `uuid <11.1.1` buffer bounds check. | **Needs decision** | Tooling only applies to native iOS builds. Kept intact to avoid breaking change until mobile strategy is decided. |
| 4 | 1 | **Medium** | `package.json:14,27` | `@capacitor/core` and `@capacitor/cli` installed but unused since native folders removed in `98658b9`. | **Needs decision** | Left installed per project rule "Ask before adding/removing packages". Ready to safely uninstall upon confirmation. |
| 5 | 1 | **Low** | `package.json:18-24,33,37` | Multiple safe Patch/Minor updates available. | **Fixed** | Updated `react@19.3.1`, `react-dom@19.3.1`, `@supabase/supabase-js@2.118.0`, `idb@8.0.4`, `lucide-react@1.61.0`, `react-zoom-pan-pinch@4.2.0`, `eslint@10.13.0`, `vite@8.3.5`. |
| 6 | 1 | **Medium** | `README.md:90-94` | README claims active native mobile pipelines and `@capawesome/capacitor-live-update`. | **Needs decision** | Documentation notes mobile status. Keep pending final decision on PWA vs native Capacitor wrapper. |
| 7 | 1 | **Low** | `vitest.config.ts:1` | Vite emitted CommonJS/ESM config warning. | **Fixed** | Migrated to `vitest.config.mts` using `import.meta.dirname` and `pool: 'forks'`. Warnings eliminated. |
| 8 | 2 | **High** | `lib/storage.ts:602-621` | Offline folder deletion in `deleteEntry` orphaned nested subfolders, charts, and lyrics in Supabase. | **Fixed** | Updated `deleteEntry` to recursively collect all descendant folders, charts, and lyrics and queue deletions for each in `pending_saves`. |
| 9 | 2 | **Medium** | `lib/storage.ts:107-142` | `flushPendingSaves` looped indefinitely on permanently failing items. | **Fixed** | Added `retry_count` tracking. Items exceeding 5 retries are quarantined with error logging. |
| 10 | 2 | **High** | `components/AuthProvider.tsx:334-367` | Offline `signOut` left previous band items in IndexedDB cache and un-synced saves. | **Fixed** | Added `clearBandCache(profile.band_id)` call on signout and offline pending saves warning log. |
| 11 | 2 | **Medium** | `lib/storage.ts:687-716` | Trashing a folder didn't trash child items; trashed folders leaked into `getAllFolders`. | **Fixed** | `moveToTrash` cascades `__TRASH__:` prefix to nested charts/lyrics, `restoreFromTrash` recovers them, and `getAllFolders` filters trashed folders. |
| 12 | 2 | **High** | `lib/setlists.ts:242-246` | `reorderSetlistItems` silently ignored database errors in `Promise.all`. | **Fixed** | Inspected `{ error }` on each update promise in `reorderSetlistItems` and throw on failure. |
| 13 | 2 | **Medium** | `app/setlists/[id]/perform/page.tsx:294` | Live stage performance showed a blank screen if a song was removed or deleted. | **Fixed** | Rendered user-friendly "Item Unavailable" fallback card with "Skip to Next Song" button. |
| 14 | 2 | **Medium** | `lib/transpose.ts:43` | Transpose skipped parenthesized chords `(C)`, `(Bb/D)`, `[Am7]`, and lowercase roots. | **Fixed** | Updated `transposeChordString` to strip wrapping delimiters `()`, `[]`, capitalize note roots, and re-wrap transposed chords. |
| 15 | 2 | **Low** | `app/chart/[id]/edit/page.tsx:860` | Time signature input allowed division by zero (`0/0`, `4/0`, `12/0`). | **Fixed** | Added validation ensuring numerator is >= 1 and denominator is a power of two (1, 2, 4, 8, 16, 32). |
| 16 | 2 | **Medium** | `hooks/usePerformanceSession.ts:188` | Momentary Wi-Fi / websocket jitter immediately fired `perform-leader-left` on followers. | **Fixed** | Added a 6-second presence debounce before declaring leader disconnected. |
| 17 | 2 | **Low** | `hooks/usePerformanceSession.ts`, `components/OfflineSyncContext.tsx` | `track` and `removeChannel` called as floating promises without `.catch()`. | **Fixed** | Attached `.catch(...)` to all floating channel lifecycle promises. |
| 18 | 2 | **High** | `lib/storage.ts`, `lib/setlists.ts`, `lib/lyrics.ts`, `lib/band.ts` | Over 20 instances of `: any` and `as any` violating project rules. | **Fixed** | Completely eliminated all `: any` and `as any` in `lib/`, replacing with strict TypeScript types (`Line`, `Lyric`, `Chart`, `Folder`). |
| 19 | 2 | **Medium** | `lib/storage.ts:61-79` | Multi-tab IndexedDB open did not implement `blocked`/`blocking` handlers. | **Fixed** | Added `blocked()`, `blocking()`, and `terminated()` event listeners to `openDB`. |
| 20 | 3 | **Critical** | `migrations_locked_down_security.sql:322` | Anon SELECT on `public.profiles` allowed public harvesting of all user accounts and emails. | **Fixed** | Created `migrations_009_lock_profiles_and_bands_enumeration.sql` with `get_email_for_username` RPC and updated `app/auth/page.tsx`. |
| 21 | 3 | **Critical** | `migrations_locked_down_security.sql:296` | Anon SELECT on `public.bands` allowed public harvesting of all bands and secret PINs/codes. | **Fixed** | Created `migrations_009_lock_profiles_and_bands_enumeration.sql` with `get_band_by_code` and `is_band_code_taken` RPCs and updated `lib/band.ts`. |
| 22 | 3 | **High** | `hooks/usePerformanceSession.ts:104` | Broadcast channel `session-${code}` allowed unauthorized participants to spoof leader commands. | **Fixed** | Attached `senderId` to leader broadcasts and added sender validation against active leader presence key. |
| 23 | 3 | **Medium** | `scripts/generate-sw.js:271` | Service Worker did not check `Authorization` headers or `Cache-Control: no-store`. | **Fixed** | Added `request.headers.has('Authorization')` bypass and verified `Cache-Control: no-store` / `private` checks in `scripts/generate-sw.js`. |
| 24 | 3 | **Medium** | `lib/liveUpdate.ts` | Dead stub for OTA updates. | **Needs decision** | Kept safe no-op stub until user approves active mobile live-update strategy. |
| 25 | 3 | **Medium** | `migrations_*.sql` | Migration ordering conflicts and lack of sequential numbering. | **Fixed** | Created sequential `migrations_009_lock_profiles_and_bands_enumeration.sql` and rollback script. |

---

## 🔒 Security Migration Run Instructions

To apply the database enumeration lockdown on your Supabase dashboard:
1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Run [`migrations_009_lock_profiles_and_bands_enumeration.sql`](file:///d:/chord-grid/migrations_009_lock_profiles_and_bands_enumeration.sql).
3. If rollback is ever required, execute [`migrations_009_lock_profiles_and_bands_enumeration_rollback.sql`](file:///d:/chord-grid/migrations_009_lock_profiles_and_bands_enumeration_rollback.sql).

*(Note: The frontend code has built-in fallbacks and remains fully functional both before and after this migration is applied).*

---

## 🧪 Verification Results

1. **Linting**:
   ```
   npm run lint -> 0 errors, 0 warnings
   ```
2. **Unit Tests**:
   ```
   npm test -> 86 passed across 7 test files (100% pass rate)
     - tests/security-fixes.test.ts (5 passed)
     - tests/logic-fixes.test.ts (6 passed)
     - tests/medium-fixes.test.ts (9 passed)
     - tests/band-isolation.test.ts (7 passed)
     - tests/core.test.ts (41 passed)
     - tests/print-fit.test.ts (12 passed)
     - tests/sw-offline.test.ts (6 passed)
   ```
3. **Static Export Build**:
   ```
   npm run build -> Compiled 36/36 static routes in 8.3s, generated service worker precache with 224 assets.
   ```
