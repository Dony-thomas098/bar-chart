# Chordly Full-Stack Audit Report

**Application Stack:** Next.js 16 static export, React 19, TypeScript 5, Tailwind CSS v4, Supabase (PostgreSQL & Realtime), IndexedDB via `idb`, Capacitor 8, Capawesome Live Update (OTA), Vitest 5.

---

## 1. Executive Summary & Health Assessment

Chordly is a well-architected progressive chord chart and performance application designed for musicians, bands, and choirs. It features offline-first IndexedDB caching, responsive sheet-music rendering, stage synchronization via Supabase Realtime, and mobile application wrappers via Capacitor.

However, a comprehensive audit of the core engine, database security policies, editor logic, and deployment pipelines revealed **critical security vulnerabilities**, **silent offline data-loss vectors**, and **broken linting/build configurations**:
- **Database RLS Policies Are Wide Open:** All tables (`folders`, `charts`, `lyrics`, `setlists`, `setlist_items`, `bands`, `profiles`) currently allow unauthenticated `anon` users to perform `DELETE`, `UPDATE`, and `INSERT` with `USING (true)` and `WITH CHECK (true)`, allowing anyone on the public internet to erase or alter the entire database.
- **Offline Sync Drops Failed Writes:** `flushPendingSaves()` does not inspect Supabase `{ error }` return values and immediately calls `db.delete('pending_saves', item.id)`, resulting in permanent loss of un-synced offline edits upon network errors or RLS rejections.
- **Setlist Transposition Override Stacking:** When editing a chord chart inside a setlist that has a transposition offset, the offset is saved directly into `lines_override` and then transposed a second time, compounding on every subsequent edit (+2 becomes +4, +6, etc.).
- **Folder Tree Corruption:** `moveEntry` and `FolderPickerModal` do not prevent moving a folder into its own children or itself, causing circular references and orphaned subtree loops.
- **Broken ESLint Configuration:** `package.json` specifies `"eslint-config-next": "^0.2.4"` (an obsolete 2016 package) instead of the official Next.js ESLint configuration, causing `npm run lint` to crash.

---

## 2. Top 5 Systemic Risks

1. **Catastrophic Database Vulnerability (Wide-Open RLS):**  
   `migrations_shared_workspace_realtime.sql` and `migrations_band_workspace.sql` grant complete `ALL` permissions (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) to the public `anon` role with `USING (true)`. Anyone possessing the client anon key (embedded in the client bundle) can wipe out every chart, folder, setlist, and user profile in the database.
2. **Permanent Offline Data Loss:**  
   In `lib/storage.ts::flushPendingSaves()`, pending operations are popped from IndexedDB even if Supabase returns an error, permanently losing user charts created or edited offline. Additionally, `listFolder()` deletes local cached charts not present online without checking if they have pending local saves.
3. **Circular Folder Hierarchy & Orphaned Subtrees:**  
   `moveEntry()` and `FolderPickerModal.tsx` allow moving a folder into itself or any of its descendants, permanently corrupting the folder tree into an unreachable loop.
4. **Cascading Setlist Transposition Multiplier:**  
   In `app/setlists/[id]/perform/page.tsx`, setlist transpose overrides are compounded into `lines_override` and re-transposed on every edit and reload.
5. **OTA Pipeline Desynchronization & Stale Bundles:**  
   `package.json` script `"update:app"` runs `next build` without static export flags, causing `publish-ota.js` to bundle stale artifacts from previous runs. Furthermore, `public/sw.js` caches `update.json` via Stale-While-Revalidate, delaying update discovery.

---

## 3. Comprehensive Audit Findings Table

| # | Section | Severity | File:line | Problem | Why it matters | Fix | Status |
|---|---|---|---|---|---|---|---|
| 1 | Supabase Security | Critical | `migrations_shared_workspace_realtime.sql:130-218` | All catalog tables (`folders`, `charts`, `lyrics`, `setlists`, `setlist_items`) have RLS policies granted `TO authenticated, anon USING (true) WITH CHECK (true)` | Any anonymous visitor or malicious actor can delete, overwrite, or corrupt all catalog data | Restrict mutations to `authenticated` users who belong to the workspace or own the record; restrict anon to read-only or session tokens | Applied to Production (`migrations_locked_down_security.sql`) |
| 2 | Supabase Security | Critical | `migrations_band_workspace.sql:68-115` | Bands and profiles tables permit anonymous insert/update/delete `TO authenticated, anon USING (true)` | Anyone can delete bands, modify admin assignments, or overwrite member profiles | Restrict band modification to authenticated band admins; restrict profile edits to `auth.uid() = id` | Applied to Production (`migrations_locked_down_security.sql`) |
| 3 | Supabase Security | High | `lib/supabase.ts:3-11`, `.github/workflows/build-mobile.yml:12-14` | Hardcoded fallback production Supabase URL and Publishable/Anon keys in code and workflow | Keys are committed to version control; duplicate env vars (`ANON_KEY` vs `PUBLISHABLE_KEY`) | Require environment variables; remove hardcoded project fallbacks; unify environment variable naming | Fixed |
| 4 | Offline Sync | High | `lib/storage.ts:86-112` | `flushPendingSaves()` deletes item from `pending_saves` without checking if Supabase returned `{ error }` | Supabase `.upsert()` / `.delete()` does not throw on error. Failed writes are deleted from local queue and permanently lost | Check `if (res.error) throw res.error;` before `db.delete('pending_saves', item.id)` | Fixed |
| 5 | Offline Sync | High | `lib/storage.ts:234-242` | `listFolder()` deletes local items absent from online response without checking `pending_saves` | Charts/lyrics created offline that have not yet synced are wiped from the local IndexedDB cache | Verify `localItem.id` is not in `pending_saves` before deleting from cache | Fixed |
| 6 | Offline Sync | Medium | `lib/storage.ts:81` | `flushPendingSaves()` lacks a concurrency lock | Simultaneous flushes (e.g. `online` event firing while app resumes or user logs in) cause duplicate network writes and race conditions | Introduce an `isFlushing` mutex lock flag | Fixed |
| 7 | Offline Sync | High | `components/AuthProvider.tsx:279-306` | `signOut()` does not check `getPendingSavesCount()` before signing out | Unsynced offline work is abandoned in IndexedDB and may be purged or attributed to subsequent user accounts | Check pending count, attempt flush, or warn user before clearing session | Fixed |
| 8 | Offline Sync | High | `components/OfflineSyncContext.tsx:125-168` | Realtime change events overwrite local IndexedDB stores even when local pending saves exist | A remote update received while local edits are pending clobbers the user's uncommitted work | Skip cache clobbering if `pending_saves` contains an active unsaved change for the item | Fixed |
| 9 | IndexedDB | Medium | `lib/storage.ts:46-68` | `openDB` promise at top-level has no `.catch()` handler | In private browsing or restricted webviews where IndexedDB is blocked, unhandled rejection crashes script initialization | Catch initialization rejection and fallback gracefully to in-memory/guest state | Fixed |
| 10 | IndexedDB | Medium | `lib/storage.ts:120-142` | `cacheChart`, `cacheFolder`, `cacheLyric` do not catch `QuotaExceededError` | When device storage is full, unhandled rejection crashes caller operations | Wrap `db.put` in try/catch and log quota warnings | Fixed |
| 11 | Library & Folders | High | `lib/storage.ts:746-759` | `moveEntry()` does not check if `newParentId === id` or if `newParentId` is a child/descendant of `id` | Moving a folder into itself or its child creates an infinite cycle, corrupting tree traversal | Recursively verify target is not self or a descendant before allowing move | Fixed |
| 12 | Library & Folders | High | `components/FolderPickerModal.tsx:41-55` | `FolderPickerModal` only excluded `excludeIds` from immediate children, not descendants | Users can navigate into a subfolder of the folder being moved and select "Move Here" | Pass and filter all descendant folder IDs in `excludeIds` | Fixed |
| 13 | Transposition | High | `app/setlists/[id]/perform/page.tsx:330-350` | Setlist transpose override stacks on every edit and reload | Opening the performance editor bakes transpose into `lines_override`, which is then re-transposed on save and reload (+2 -> +4 -> +6) | Store un-transposed base lines in `lines_override` and apply display transposition once | Fixed |
| 14 | Transposition | Medium | `lib/transpose.ts:36-46` | `transposeChordString()` only split on `'/'` and did not handle space-separated chords in a measure | In measures with multiple chords (e.g. `"C G"`), only the first chord was transposed; secondary chords were left untouched | Split by whitespace and slash tokens, transposing every valid chord root | Fixed |
| 15 | Chart Editor | Medium | `app/chart/[id]/edit/page.tsx:192-208` | In `parseTextToLines()`, the header line (`Title TimeSig t=Tempo`) was skipped with `continue;` | Editing the title, tempo, or time signature in the text view was silently discarded | Parse title, time signature, and tempo from the text header line into chart state | Fixed |
| 16 | Chart Editor | Medium | `app/chart/[id]/edit/page.tsx:825-845` | No validation on tempo (`parseInt(e.target.value) \|\| 120`) or `time_sig` inputs | Users could not clear tempo to type numbers smoothly; invalid time signatures broke rendering | Implement smooth typing, numeric clamp (30-300 BPM), and time signature validation | Fixed |
| 17 | Chart Editor | Medium | `components/MobileChordKeypad.tsx:191-224` | `onDeleteBar` was accepted in props but never rendered in the keypad UI | Mobile keypad users could not delete a measure directly from the keypad | Add a "Delete Bar" control button to Row 4 of the keypad | Fixed |
| 18 | Live Stage Sync | Medium | `app/perform/page.tsx:54-62` | `generateCode()` used deprecated `substr` and non-cryptographic `Math.random()` | Room codes could be shorter than 6 characters, predictable, and prone to collisions | Use `crypto.getRandomValues()` with unambiguous character set `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` | Fixed |
| 19 | Live Stage Sync | Medium | `hooks/usePerformanceSession.ts:165-185` | `presence: sync` did not handle leader disconnection | When leader disconnected or locked screen, followers remained stuck with no notification | Detect leader absence in presence sync and dispatch notification event | Fixed |
| 20 | Live Stage Sync | Low | `hooks/usePerformanceSession.ts:210-218` | `request-state` interval captured stale `mode === 'loading'` | Stale closure caused persistent broadcast polling | Use `modeRef.current` and clear interval when no longer loading | Fixed |
| 21 | Setlists | Medium | `lib/setlists.ts:109-116` | `duplicateSetlist()` dropped `lines_override` | Custom per-setlist chart arrangements were stripped when copying a setlist | Include `lines_override: item.lines_override` in duplicated setlist items | Fixed |
| 22 | Setlists | Medium | `app/setlists/[id]/page.tsx:397-408` | `handleDragEnd()` did not catch errors from `reorderSetlistItems()` | If reorder failed on server, UI remained out of sync until reload | Wrap in try/catch and rollback `items` state on failure | Fixed |
| 23 | Setlists | Low | `lib/setlists.ts:158-164` | Deleted/trashed charts displayed as `'Unknown'` without warning | Users had no way to know why a song was missing or how to remove it | Mark deleted items as `is_deleted: true` and display "Unknown (Item Removed)" | Fixed |
| 24 | Service Worker | Medium | `public/sw.js:46-58` | Service worker cached `/update.json` and `/manifest.json` via Stale-While-Revalidate | Mobile app updates were delayed because client received stale manifest | Bypass cache for `update.json` and `manifest.json` | Fixed |
| 25 | Service Worker | Low | `public/sw.js:43-52` | Service worker bypassed `localhost` and `127.0.0.1` completely | Impossible to test offline service worker functionality in local dev | Add `test_sw` query parameter check to allow opt-in local offline testing | Fixed |
| 26 | OTA Pipeline | Medium | `package.json:12` | `"update:app"` script ran `next build --webpack` without `CAPACITOR_BUILD=true` | Running `npm run update:app` did not output to `out/`, packing stale web assets into OTA bundle | Update script to `"npm run build:cap && node scripts/publish-ota.js"` | Fixed |
| 27 | OTA Pipeline | Medium | `scripts/pack-ota.js:46-57` | `update.json` has SHA-256 checksum but no cryptographic signature | Bundle integrity can be verified, but authenticity cannot be cryptographically proven | Add signature verification hook or HMAC token support | Needs decision |
| 28 | Build & Export | High | `package.json:49`, `eslint.config.mjs` | `"eslint-config-next": "^0.2.4"` was an incompatible legacy package crashing ESLint | `npm run lint` failed with `Cannot find module 'eslint-config-next/core-web-vitals'` | Configured direct flat ESLint config using `@next/eslint-plugin-next` | Fixed |
| 29 | Delivery & CI/CD | Medium | `.github/workflows/build-mobile.yml:43-46` | GitHub Actions workflow did not run `npm test` or `npm run lint` before building APK | Broken code or failing tests could be compiled and published as live OTA updates | Added lint and test validation steps prior to build | Fixed |
| 30 | Delivery & CI/CD | Low | `android/app/build.gradle:11` | Android `versionName "1.0"` mismatched with `package.json` (`0.1.0`) | Version tracking mismatch between web/OTA and Google Play / APK | Synchronized Android `versionName` to `"0.1.0"` | Fixed |
| 31 | Accessibility | Medium | `app/layout.tsx:54-64` | `maximumScale: 1, userScalable: false` set in viewport | Prevented low-vision users from zooming UI on mobile (WCAG 1.4.4 violation) | Removed `userScalable: false` and `maximumScale: 1` | Fixed |
| 32 | Repo Hygiene | Low | `.gitignore:45` | Verify `dist-mobile/` (e.g. 14MB APKs and zip bundles) are not tracked | Bloats git repository size and causes merge conflicts | Confirmed `/dist-mobile/` is in `.gitignore` and 0 binaries are tracked | Fixed |
| 33 | General Code | Low | `components/OfflineSyncContext.tsx:209-216` | Realtime channel cleanup was not executed on unmount | Unmounting `OfflineSyncProvider` left dangling Supabase Realtime channel | Called `unsubscribeFromRealtime()` in `useEffect` cleanup return | Fixed |

---

## 4. Manual Verification & Test Procedures

The following manual test procedures verify critical system behaviors across environments:

### 1. Offline Mode & Pending Queue Reliability
1. Open Chordly in Chrome / Edge. Open DevTools -> Network -> Select **Offline**.
2. Create a new chord chart ("Offline Test Chart") with 2 sections and save.
3. Verify the offline status badge indicates "Offline / Cached locally" and chart exists in IndexedDB `charts` and `pending_saves`.
4. Navigate through folders and setlists. Reload the page; confirm the offline chart is loaded from IndexedDB cache and NOT wiped by `listFolder()`.
5. Restore network connection (DevTools -> **Online**). Verify `flushPendingSaves()` automatically fires with the mutex lock and syncs the chart to Supabase. Confirm `pending_saves` count reaches 0.

### 2. Live Stage Sync (Two-Device Test)
1. **Device A (Leader):** Navigate to `/perform`, click **Start Live Session**. Note the generated 6-character room code (e.g. `K9W3MZ`).
2. **Device B (Follower):** Open an incognito window or second browser. Navigate to `/perform/K9W3MZ`.
3. Verify Device B joins as Follower and displays the Leader's active song and index.
4. On Device A, change songs or tap next bar. Confirm Device B follows in real time without lag.
5. On Device A, close the tab or disconnect network. Confirm Device B receives the leader disconnect notification and safely falls back without freezing.

### 3. Android APK & OTA Live Update
1. Run `npm run build:cap` followed by `cd android && ./gradlew assembleDebug`.
2. Install the output APK (`android/app/build/outputs/apk/debug/app-debug.apk`) onto a test Android phone/emulator:
   `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
3. Launch app. Verify splash screen dismisses cleanly, transparent status bar respects safe areas, and Android hardware back button navigates backwards through folders and charts.
4. Publish a test live update: `npm run update:app`. Launch app on device; confirm background download runs without blocking the UI, and the updated bundle is activated smoothly on the next app restart.

### 4. Sheet Music & Printing Layout
1. Navigate to `/printer` or open any chord chart and click **Print / Export**.
2. Select 2-column or 3-column sheet music layout.
3. Trigger browser Print dialog (`Ctrl+P` / `Cmd+P`).
4. Verify print styles: navigation headers, bottom player controls, and floating toolbars are hidden (`@media print`); high-contrast black chords render crisp on white paper; and page breaks avoid splitting section headers.
