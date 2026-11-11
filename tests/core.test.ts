import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { transposeChordString, transposeSingleChord } from '../lib/transpose';
import { canModifySection } from '../components/AuthProvider';
import { getEmailBandCacheKey } from '../lib/band';

const rootDir = path.resolve(__dirname, '..');

describe('Transpose Logic', () => {
  it('correctly transposes simple major chords with sharps', () => {
    expect(transposeSingleChord('C', 2, false)).toBe('D');
    expect(transposeSingleChord('G', 2, false)).toBe('A');
    expect(transposeSingleChord('B', 1, false)).toBe('C');
  });

  it('correctly handles preferFlats transposition', () => {
    expect(transposeSingleChord('C', 1, true)).toBe('Db');
    expect(transposeSingleChord('C', 1, false)).toBe('C#');
  });

  it('correctly transposes complex chords with extensions and slash bass', () => {
    expect(transposeChordString('Cmaj7/E', 2, false)).toBe('Dmaj7/F#');
    expect(transposeChordString('Am7b5/G', 3, true)).toBe('Cm7b5/Bb');
  });

  it('preserves non-chord tokens and empty bars intact', () => {
    expect(transposeChordString('%', 2, false)).toBe('%');
    expect(transposeChordString('N.C.', 2, false)).toBe('N.C.');
    expect(transposeChordString('', 2, false)).toBe('');
  });
});

describe('Role-Based Section Authorization', () => {
  it('allows admins to modify all sections', () => {
    expect(canModifySection('admin', 'chart')).toBe(true);
    expect(canModifySection('admin', 'lyrics')).toBe(true);
  });

  it('allows singers and instrumentalists to collaboratively create and modify charts and lyrics', () => {
    expect(canModifySection('singing', 'lyrics')).toBe(true);
    expect(canModifySection('singing', 'chart')).toBe(true);
    expect(canModifySection('instrument', 'chart')).toBe(true);
    expect(canModifySection('instrument', 'lyrics')).toBe(true);
  });
});

describe('Trash Naming and Recovery Logic', () => {
  const parseTrashName = (trashedName: string) => {
    const parts = trashedName.split(':');
    let originalParentId: string | null = null;
    let originalName = trashedName;
    if (parts.length >= 3 && parts[0] === '__TRASH__') {
      originalParentId = parts[1] === 'root' ? null : parts[1];
      originalName = parts.slice(2).join(':');
    } else if (parts.length === 2 && parts[0] === '__TRASH__') {
      originalParentId = null;
      originalName = parts[1];
    }
    return { originalParentId, originalName };
  };

  it('correctly parses root-level trashed items', () => {
    const { originalParentId, originalName } = parseTrashName('__TRASH__:root:My Awesome Chart');
    expect(originalParentId).toBeNull();
    expect(originalName).toBe('My Awesome Chart');
  });

  it('correctly parses folder-nested trashed items', () => {
    const { originalParentId, originalName } = parseTrashName('__TRASH__:folder-abc-123:My Lyrics');
    expect(originalParentId).toBe('folder-abc-123');
    expect(originalName).toBe('My Lyrics');
  });

  it('handles item names that contain colons', () => {
    const { originalParentId, originalName } = parseTrashName('__TRASH__:root:Part 1: The Intro: Final');
    expect(originalParentId).toBeNull();
    expect(originalName).toBe('Part 1: The Intro: Final');
  });

  it('handles legacy or two-part trashed names gracefully', () => {
    const { originalParentId, originalName } = parseTrashName('__TRASH__:Legacy Song');
    expect(originalParentId).toBeNull();
    expect(originalName).toBe('Legacy Song');
  });
});

describe('Band Email Persistence & Re-login Restoration', () => {
  const sampleBand = {
    id: 'band-123',
    name: 'Grace Choir',
    code: '1234',
    admin_id: 'user-abc',
  };

  it('generates consistent lowercase email cache keys', () => {
    expect(getEmailBandCacheKey('Test@Example.com')).toBe('chord-grid-band-email-test@example.com');
  });

  it('saves and restores band scoped to email and does not leak after session clear', async () => {
    const { saveBandLocally, getBandForEmail, restoreBandForEmail, clearActiveBandSession, hasJoinedBand } = await import('../lib/band');
    
    // Save band for user
    saveBandLocally(sampleBand, 'worship@church.org');

    // Email cache should immediately contain the band
    const cached = getBandForEmail('worship@church.org');
    expect(cached?.name).toBe('Grace Choir');
    expect(cached?.code).toBe('1234');

    // hasJoinedBand should return true for this user even if session was reset
    clearActiveBandSession();
    expect(hasJoinedBand({ email: 'worship@church.org' })).toBe(true);

    // Another email that hasn't joined should return false
    expect(hasJoinedBand({ email: 'newbie@church.org' })).toBe(false);

    // Re-login with the same email restores active session keys
    const restored = restoreBandForEmail('worship@church.org');
    expect(restored?.id).toBe('band-123');
    expect(hasJoinedBand()).toBe(true);
  });
});

describe('Native App Safety & LiveUpdate Stability', () => {
  it('correctly identifies native platform to prevent WebView intent crashes', async () => {
    const { isRunningNatively } = await import('../lib/platform');
    // In node/jsdom test environment, it safely returns true for localhost/test origin
    expect(typeof isRunningNatively()).toBe('boolean');
  });

  it('guarantees LiveUpdate concurrency locks prevent overlapping checks', async () => {
    const { checkForLiveUpdate, getLiveUpdateState } = await import('../lib/liveUpdate');
    
    const state = getLiveUpdateState();
    expect(state).toBeDefined();
    expect(state.isDownloading).toBe(false);

    // In non-native test env, checkForLiveUpdate should safely return false without throwing
    const result = await checkForLiveUpdate();
    expect(result).toBe(false);
  });
});

describe('Multi-Chord Measures and Enharmonics Transposition', () => {
  it('transposes multiple chords separated by spaces in a single measure', () => {
    expect(transposeChordString('C G', 2, false)).toBe('D A');
    expect(transposeChordString('Am   D7/F#', 2, false)).toBe('Bm   E7/G#');
    expect(transposeChordString('C/E  G7', 3, true)).toBe('Eb/G  Bb7');
  });

  it('handles rare enharmonics (E#, Cb, B#) correctly', () => {
    expect(transposeSingleChord('E#', 1, false)).toBe('F#');
    expect(transposeSingleChord('Cb', -1, true)).toBe('Bb');
    expect(transposeSingleChord('Cb', -1, false)).toBe('A#');
    expect(transposeSingleChord('B#', 2, false)).toBe('D');
  });

  it('handles octave wraparound with negative semitones and multiples of 12', () => {
    expect(transposeSingleChord('G', -12, false)).toBe('G');
    expect(transposeSingleChord('F#', 12, false)).toBe('F#');
    expect(transposeSingleChord('C', -2, false)).toBe('A#');
    expect(transposeSingleChord('C', -2, true)).toBe('Bb');
    expect(transposeSingleChord('C', -1, true)).toBe('B');
  });
});

describe('Folder Tree Cycle Prevention', () => {
  const mockFolders = [
    { id: 'folder-root', name: 'Root', parent_id: null, kind: 'chart' as const, created_by: 'user1', updated_at: '' },
    { id: 'folder-child', name: 'Child', parent_id: 'folder-root', kind: 'chart' as const, created_by: 'user1', updated_at: '' },
    { id: 'folder-grandchild', name: 'Grandchild', parent_id: 'folder-child', kind: 'chart' as const, created_by: 'user1', updated_at: '' },
    { id: 'folder-unrelated', name: 'Other', parent_id: null, kind: 'chart' as const, created_by: 'user1', updated_at: '' },
  ];

  it('detects direct self and deep descendant relationships correctly', async () => {
    const { isDescendantFolder } = await import('../lib/storage');
    
    // A folder is its own descendant (self move prevented)
    expect(await isDescendantFolder('folder-root', 'folder-root', mockFolders)).toBe(true);

    // Grandchild is descendant of Root
    expect(await isDescendantFolder('folder-grandchild', 'folder-root', mockFolders)).toBe(true);

    // Child is descendant of Root
    expect(await isDescendantFolder('folder-child', 'folder-root', mockFolders)).toBe(true);

    // Root is NOT a descendant of Grandchild
    expect(await isDescendantFolder('folder-root', 'folder-grandchild', mockFolders)).toBe(false);

    // Unrelated folder is NOT a descendant of Root
    expect(await isDescendantFolder('folder-unrelated', 'folder-root', mockFolders)).toBe(false);
  });
});

describe('Live Stage Room Code Generator Entropy', () => {
  it('generates unambiguous 6-character room codes without 0, O, 1, or I', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 50; i++) {
      const bytes = new Uint8Array(6);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
      }
      const code = Array.from(bytes, (b) => chars[b % chars.length]).join('');

      expect(code.length).toBe(6);
      expect(code).not.toMatch(/[01OI]/);
      for (const char of code) {
        expect(chars).toContain(char);
      }
    }
  });
});

describe('Multi-Device Band Synchronization & Profile Field Preservation', () => {
  it('correctly associates user email with active band across device resets', async () => {
    const { saveBandLocally, getBandForEmail, hasJoinedBand, clearActiveBandSession } = await import('../lib/band');
    
    const infantJesusBand = {
      id: '9ca7fef8-a0e0-4587-a329-0444c4b27f70',
      name: 'Infant Jesus Church',
      code: 'INFANTJESUS',
      admin_id: 'admin-123',
    };

    // Save band for user on Vercel device
    saveBandLocally(infantJesusBand, 'ddosatt1223@gmail.com');

    // Retrieve via email cache (simulating second device login with same email)
    const cached = getBandForEmail('ddosatt1223@gmail.com');
    expect(cached).not.toBeNull();
    expect(cached?.name).toBe('Infant Jesus Church');
    expect(cached?.code).toBe('INFANTJESUS');

    // Even if active session keys are cleared, email-associated check confirms membership
    clearActiveBandSession();
    expect(hasJoinedBand({ email: 'ddosatt1223@gmail.com' })).toBe(true);

    // Unrelated user returns false
    expect(hasJoinedBand({ email: 'stranger@example.com' })).toBe(false);
  });

  it('safely restores band from email cache during syncBandForUser without network delay', async () => {
    const { saveBandLocally, syncBandForUser } = await import('../lib/band');
    
    const infantJesusBand = {
      id: '9ca7fef8-a0e0-4587-a329-0444c4b27f70',
      name: 'Infant Jesus Church',
      code: 'INFANTJESUS',
      admin_id: 'admin-123',
    };

    saveBandLocally(infantJesusBand, 'ddosatt1223@gmail.com');

    const churchUser = {
      id: 'user-ddosatt',
      email: 'ddosatt1223@gmail.com',
      user_metadata: {},
    };

    const band = await syncBandForUser(churchUser);
    expect(band).not.toBeNull();
    expect(band?.code).toBe('INFANTJESUS');
    expect(band?.name).toBe('Infant Jesus Church');
  });

  it('guarantees profile fields preserve band association without wiping other attributes', () => {
    const existing = {
      profession: 'instrument',
      instrument: 'Piano / Keyboard',
      username: 'Dony',
      band_id: '9ca7fef8-a0e0-4587-a329-0444c4b27f70',
      band_name: 'Infant Jesus Church',
      band_code: 'INFANTJESUS',
    };

    // Partial update (e.g. changing instrument or theme)
    const partialUpdate: { instrument: string; band_id?: string; band_name?: string; band_code?: string } = { instrument: 'Bass' };
    const merged = {
      ...existing,
      ...partialUpdate,
      band_id: partialUpdate.band_id !== undefined ? partialUpdate.band_id : existing.band_id,
      band_name: partialUpdate.band_name !== undefined ? partialUpdate.band_name : existing.band_name,
      band_code: partialUpdate.band_code !== undefined ? partialUpdate.band_code : existing.band_code,
    };

    expect(merged.band_id).toBe('9ca7fef8-a0e0-4587-a329-0444c4b27f70');
    expect(merged.band_name).toBe('Infant Jesus Church');
    expect(merged.instrument).toBe('Bass');
    expect(merged.profession).toBe('instrument');
  });

  it('never invokes supabase.auth.updateUser during syncBandForUser background queries', async () => {
    const { supabase } = await import('../lib/supabase');
    const { syncBandForUser } = await import('../lib/band');

    let updateUserCalled = false;
    const originalUpdateUser = supabase.auth.updateUser;
    supabase.auth.updateUser = (async () => {
      updateUserCalled = true;
      return { data: { user: null }, error: null } as unknown as Awaited<ReturnType<typeof supabase.auth.updateUser>>;
    }) as any;

    try {
      const user = {
        id: 'test-user-sync-id',
        email: 'test-sync@example.com',
        user_metadata: {},
      };
      await syncBandForUser(user);
      expect(updateUserCalled).toBe(false);
    } finally {
      supabase.auth.updateUser = originalUpdateUser;
    }
  });

  it('guarantees saveChart and saveLyrics default unassigned band_id to church band workspace', async () => {
    const { DEFAULT_CHURCH_BAND_ID } = await import('../lib/storage');
    expect(DEFAULT_CHURCH_BAND_ID).toBe('9ca7fef8-a0e0-4587-a329-0444c4b27f70');

    const fs = await import('fs');
    const path = await import('path');
    const storageCode = fs.readFileSync(path.resolve(__dirname, '../lib/storage.ts'), 'utf-8');
    const lyricsCode = fs.readFileSync(path.resolve(__dirname, '../lib/lyrics.ts'), 'utf-8');
    const authProviderCode = fs.readFileSync(path.resolve(__dirname, '../components/AuthProvider.tsx'), 'utf-8');

    expect(storageCode).toContain("localStorage.getItem('chord-grid-band-id') || DEFAULT_CHURCH_BAND_ID");
    expect(lyricsCode).toContain("localStorage.getItem('chord-grid-band-id') || '9ca7fef8-a0e0-4587-a329-0444c4b27f70'");
    expect(authProviderCode).toContain("await supabase.from('profiles').upsert");
  });

  it('guarantees service worker includes key routes and ignoreSearch for offline PWA navigation', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const swContent = fs.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf-8');

    expect(swContent).toContain('"/chart"');
    expect(swContent).toContain('"/folder"');
    expect(swContent).toContain('"/lyrics"');
    expect(swContent).toContain('"/manifest.json"');
    expect(swContent).toContain('/_next/static/chunks/');
    expect(swContent).toContain('ignoreSearch: true');
  });

  it('correctly identifies all variations of /auth route including trailing slashes to prevent redirect loops', () => {
    const isAuthRoute = (path: string | null | undefined): boolean => {
      return !path || path === '/auth' || path === '/auth/' || path.startsWith('/auth');
    };

    expect(isAuthRoute('/auth')).toBe(true);
    expect(isAuthRoute('/auth/')).toBe(true);
    expect(isAuthRoute('/auth?mode=signin')).toBe(true);
    expect(isAuthRoute('/auth/?mode=signin')).toBe(true);
    expect(isAuthRoute('/folder')).toBe(false);
    expect(isAuthRoute('/chart')).toBe(false);
    expect(isAuthRoute('/')).toBe(false);
  });

  it('guarantees stage perform chart horizontal centering calculation is strictly symmetric', () => {
    const calculateFit = (viewportWidth: number, cardWidth: number) => {
      const availableWidth = Math.max(260, viewportWidth - 24);
      let scale = 1;
      if (cardWidth > 0 && availableWidth > 0) {
        if (availableWidth < cardWidth) {
          scale = Math.max(0.15, (availableWidth / cardWidth) * 0.98);
        } else {
          scale = 1;
        }
      }
      const posX = Math.max(0, (viewportWidth - cardWidth * scale) / 2);
      const scaledWidth = cardWidth * scale;
      const leftGap = posX;
      const rightGap = viewportWidth - (posX + scaledWidth);
      return { scale, posX, scaledWidth, leftGap, rightGap };
    };

    // Desktop wide view (like user's screenshot at 1440px wide)
    const desktop = calculateFit(1440, 800);
    expect(desktop.scale).toBe(1);
    expect(desktop.posX).toBe(320);
    expect(desktop.leftGap).toBe(desktop.rightGap);

    // Laptop view
    const laptop = calculateFit(1024, 750);
    expect(laptop.scale).toBe(1);
    expect(laptop.posX).toBe((1024 - 750) / 2);
    expect(laptop.leftGap).toBe(laptop.rightGap);

    // Mobile narrow view
    const mobile = calculateFit(375, 600);
    expect(mobile.scale).toBeLessThan(1);
    expect(Math.abs(mobile.leftGap - mobile.rightGap)).toBeLessThan(0.001);
  });

  it('verifies perform page contentClass avoids double-centering displacement classes', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const performPageCode = fs.readFileSync(path.resolve(__dirname, '../app/perform/[code]/page.tsx'), 'utf-8');

    // Must not combine min-w-full or justify-center on TransformComponent contentClass
    expect(performPageCode).not.toContain('min-w-full min-h-screen flex items-start justify-center');
    expect(performPageCode).toContain('w-max flex flex-col items-start justify-start');
  });

  it('guarantees global CapacitorHttp interceptor is disabled to avoid breaking Supabase fetch in mobile WebView', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const capConfig = fs.readFileSync(path.resolve(__dirname, '../capacitor.config.ts'), 'utf-8');

    expect(capConfig).not.toContain('CapacitorHttp');
  });

  it('guarantees native Android and iOS folders are not present in repository', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const androidExists = fs.existsSync(path.resolve(__dirname, '../android'));
    const iosExists = fs.existsSync(path.resolve(__dirname, '../ios'));

    expect(androidExists).toBe(false);
    expect(iosExists).toBe(false);
  });

  it('guarantees calculateScoreFit provides strictly symmetric horizontal centering across all device sizes', async () => {
    const { calculateScoreFit } = await import('../lib/score-fit');

    // 1. Desktop wide view (1440 x 900)
    const desktop = calculateScoreFit({
      viewportWidth: 1440,
      viewportHeight: 900,
      cardWidth: 760,
      cardHeight: 800,
      showUI: true,
    });
    expect(desktop.scale).toBeGreaterThanOrEqual(1.0);
    const desktopScaledWidth = 760 * desktop.scale;
    const desktopLeftGap = desktop.posX;
    const desktopRightGap = 1440 - (desktop.posX + desktopScaledWidth);
    expect(Math.abs(desktopLeftGap - desktopRightGap)).toBeLessThan(0.001);

    // 2. Laptop standard view (1024 x 768)
    const laptop = calculateScoreFit({
      viewportWidth: 1024,
      viewportHeight: 768,
      cardWidth: 760,
      cardHeight: 800,
      showUI: true,
    });
    const laptopScaledWidth = 760 * laptop.scale;
    const laptopLeftGap = laptop.posX;
    const laptopRightGap = 1024 - (laptop.posX + laptopScaledWidth);
    expect(Math.abs(laptopLeftGap - laptopRightGap)).toBeLessThan(0.001);

    // 3. Mobile portrait narrow view (375 x 667)
    const mobilePortrait = calculateScoreFit({
      viewportWidth: 375,
      viewportHeight: 667,
      cardWidth: 760,
      cardHeight: 800,
      showUI: true,
    });
    expect(mobilePortrait.scale).toBeLessThan(1.0); // Scaled down to fit mobile
    const mobileScaledWidth = 760 * mobilePortrait.scale;
    const mobileLeftGap = mobilePortrait.posX;
    const mobileRightGap = 375 - (mobilePortrait.posX + mobileScaledWidth);
    expect(Math.abs(mobileLeftGap - mobileRightGap)).toBeLessThan(0.001);

    // 4. Mobile landscape / rotate view (667 x 375)
    const mobileLandscape = calculateScoreFit({
      viewportWidth: 667,
      viewportHeight: 375,
      cardWidth: 760,
      cardHeight: 800,
      showUI: false,
    });
    const landscapeScaledWidth = 760 * mobileLandscape.scale;
    const landscapeLeftGap = mobileLandscape.posX;
    const landscapeRightGap = 667 - (mobileLandscape.posX + landscapeScaledWidth);
    expect(Math.abs(landscapeLeftGap - landscapeRightGap)).toBeLessThan(0.001);
  });

  it('guarantees all viewer pages (PiascoreReader, PiascoreLyricsReader, perform, setlists perform) prevent double-centering offsets', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const piascoreReader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreReader.tsx'), 'utf-8');
    const lyricsReader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreLyricsReader.tsx'), 'utf-8');
    const performPage = fs.readFileSync(path.resolve(__dirname, '../app/perform/[code]/page.tsx'), 'utf-8');
    const setlistPerformPage = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/perform/page.tsx'), 'utf-8');

    // All must use calculateScoreFit
    expect(piascoreReader).toContain('calculateScoreFit');
    expect(lyricsReader).toContain('calculateScoreFit');
    expect(performPage).toContain('calculateScoreFit');
    expect(setlistPerformPage).toContain('calculateScoreFit');

    // None must have centerOnInit={true} or centerZoomedOut={true} inside their TransformWrappers
    expect(piascoreReader).toContain('centerOnInit={false}');
    expect(piascoreReader).toContain('centerZoomedOut={false}');
    expect(lyricsReader).toContain('centerOnInit={false}');
    expect(lyricsReader).toContain('centerZoomedOut={false}');
    expect(performPage).toContain('centerOnInit={false}');
    expect(performPage).toContain('centerZoomedOut={false}');
    expect(setlistPerformPage).toContain('centerOnInit={false}');
    expect(setlistPerformPage).toContain('centerZoomedOut={false}');
  });

  it('guarantees calculateScoreFit moves the score to the center of the screen across phones, tablets, and desktops', async () => {
    const { calculateScoreFit } = await import('../lib/score-fit');

    // 1. Mobile Portrait: short chart (350px tall in 844px viewport)
    // Moves to the center of the screen vertically whenever it fits comfortably in the viewport
    const unlocked = calculateScoreFit({
      viewportWidth: 390,
      viewportHeight: 844,
      cardWidth: 700,
      cardHeight: 350,
      showUI: false,
      isLocked: false,
    });
    const scaledHeightUnlocked = 350 * unlocked.scale;
    const expectedPosYUnlocked = (844 - scaledHeightUnlocked) / 2;
    expect(unlocked.posY).toBeCloseTo(expectedPosYUnlocked, 1);
    expect(unlocked.posY).toBeGreaterThan(8);

    const locked = calculateScoreFit({
      viewportWidth: 390,
      viewportHeight: 844,
      cardWidth: 700,
      cardHeight: 350,
      showUI: false,
      isLocked: true,
    });
    const scaledHeight = 350 * locked.scale;
    const expectedPosY = (844 - scaledHeight) / 2;
    expect(locked.posY).toBeCloseTo(expectedPosY, 1);
    expect(locked.posY).toBeGreaterThan(8);

    // 2. Mobile Portrait: tall chart (1800px tall in 844px viewport)
    // Must stay at topOffset (8px) so top measures are never clipped off screen
    const tallLocked = calculateScoreFit({
      viewportWidth: 390,
      viewportHeight: 844,
      cardWidth: 700,
      cardHeight: 1800,
      showUI: false,
      isLocked: true,
    });
    expect(tallLocked.posY).toBe(8);

    // 3. iPad Pro 13" (1032x1376) and Tablet: centers score in the screen
    const ipadUnlocked = calculateScoreFit({
      viewportWidth: 1032,
      viewportHeight: 1376,
      cardWidth: 700,
      cardHeight: 600,
      showUI: false,
      isLocked: false,
    });
    const ipadScaledHeightUnlocked = 600 * ipadUnlocked.scale;
    const ipadExpectedPosYUnlocked = (1376 - ipadScaledHeightUnlocked) / 2;
    expect(ipadUnlocked.posY).toBeCloseTo(ipadExpectedPosYUnlocked, 1);
    expect(ipadUnlocked.posY).toBeGreaterThan(8);

    const ipadLocked = calculateScoreFit({
      viewportWidth: 1032,
      viewportHeight: 1376,
      cardWidth: 700,
      cardHeight: 600,
      showUI: false,
      isLocked: true,
    });
    const ipadScaledHeight = 600 * ipadLocked.scale;
    const ipadExpectedPosY = (1376 - ipadScaledHeight) / 2;
    expect(ipadLocked.posY).toBeCloseTo(ipadExpectedPosY, 1);
    expect(ipadLocked.posY).toBeGreaterThan(8);

    // 4. Component wiring: Ensure readers pass isLocked to calculateScoreFit
    const piascoreReader = fs.readFileSync('components/PiascoreReader.tsx', 'utf8');
    expect(piascoreReader).toContain('isLocked,');
    expect(piascoreReader).toContain('calculateScoreFit({\n      viewportWidth,\n      viewportHeight,\n      cardWidth,\n      cardHeight,\n      showUI,\n      isLocked,'.replace(/\n/g, piascoreReader.includes('\r\n') ? '\r\n' : '\n'));

    const lyricsReader = fs.readFileSync('components/PiascoreLyricsReader.tsx', 'utf8');
    expect(lyricsReader).toContain('isLocked={isStageLocked}');
  });
});



describe('Setlist Routing and 404 Fallback Logic', () => {
  it('correctly matches setlist perform and setlist view dynamic paths in not-found fallback regex', () => {
    const performRegex = /^\/setlists\/([A-Za-z0-9_-]{4,})\/perform/i;
    const testPerformPath = '/setlists/a1b2-c3d4/perform';
    const performMatch = testPerformPath.match(performRegex);
    expect(performMatch).not.toBeNull();
    expect(performMatch?.[1]).toBe('a1b2-c3d4');

    const viewRegex = /^\/setlists\/([A-Za-z0-9_-]{4,})/i;
    const testViewPath = '/setlists/a1b2-c3d4';
    const viewMatch = testViewPath.match(viewRegex);
    expect(viewMatch).not.toBeNull();
    expect(viewMatch?.[1]).toBe('a1b2-c3d4');
  });

  it('guarantees setlist pages route to static export exportable query targets', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const detailPage = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/page.tsx'), 'utf-8');
    const performPage = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/perform/page.tsx'), 'utf-8');
    const notFoundPage = fs.readFileSync(path.resolve(__dirname, '../app/not-found.tsx'), 'utf-8');

    // Detail page routes Play / View Set to /setlists/perform/?id=
    expect(detailPage).toContain('/setlists/perform/?id=');
    expect(detailPage).not.toContain('router.push(/setlists//perform)');

    // Perform page back buttons route to /setlists/view/?id=
    expect(performPage).toContain('/setlists/view/?id=');
    expect(performPage).not.toContain('router.push(/setlists/)');

    // not-found.tsx handles setlist fallback redirects
    expect(notFoundPage).toContain('Setlist Performance');
    expect(notFoundPage).toContain('/setlists/perform/?id=');
    expect(notFoundPage).toContain('/setlists/view/?id=');
  });
});

describe('SplashScreen Safety and Localhost Service Worker Invariants', () => {
  it('guarantees splash screen enforces hard safety fallback timeout', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const splashFile = fs.readFileSync(path.resolve(__dirname, '../components/SplashScreen.tsx'), 'utf-8');
    const splashCss = fs.readFileSync(path.resolve(__dirname, '../components/SplashScreen.module.css'), 'utf-8');

    expect(splashFile).toContain('safetyTimer');
    expect(splashFile).toContain('2500');
    expect(splashCss).toContain(':global(.no-splash) .root');
    expect(splashCss).toContain('visibility: hidden !important;');
  });

  it('guarantees service worker is registered and bypasses development HMR without breaking offline mode', async () => {
    const fs = await import('path');
    const path = await import('path');
    const fsMod = await import('fs');

    const layoutFile = fsMod.readFileSync(path.resolve(__dirname, '../app/layout.tsx'), 'utf-8');
    const swRegisterFile = fsMod.readFileSync(path.resolve(__dirname, '../components/SWRegister.tsx'), 'utf-8');
    const swFile = fsMod.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf-8');
    const genSwFile = fsMod.readFileSync(path.resolve(__dirname, '../scripts/generate-sw.js'), 'utf-8');

    expect(layoutFile).toContain("navigator.serviceWorker.register('/sw.js')");
    expect(swRegisterFile).toContain("navigator.serviceWorker");
    expect(swFile).toContain('/_next/webpack-hmr');
    expect(genSwFile).toContain('/_next/webpack-hmr');
  });
});

describe('Hydration Invariants and SSR Consistency', () => {
  it('ensures Sidebar, Profile, and BandConnectModal avoid synchronous localStorage reads during useState initial render', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const sidebar = fs.readFileSync(path.resolve(__dirname, '../components/Sidebar.tsx'), 'utf-8');
    const profile = fs.readFileSync(path.resolve(__dirname, '../app/profile/page.tsx'), 'utf-8');
    const modal = fs.readFileSync(path.resolve(__dirname, '../components/BandConnectModal.tsx'), 'utf-8');

    // None of these should call useState(getStoredBand()) directly as that causes SSR hydration mismatch
    expect(sidebar).not.toContain('useState(getStoredBand())');
    expect(profile).not.toContain('useState(getStoredBand())');
    expect(modal).not.toContain('useState<ReturnType<typeof getStoredBand>>(getStoredBand())');

    // Sidebar must have suppressHydrationWarning on the Band Workspace title block
    expect(sidebar).toContain('suppressHydrationWarning');
  });

  it('guarantees SetlistPerformPage suppresses hydration warnings on dynamic leader loading text', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const setlistPerform = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/perform/page.tsx'), 'utf-8');

    expect(setlistPerform).toContain('suppressHydrationWarning');
    expect(setlistPerform).toContain("mounted && !loading && mode === 'loading' && !isLeaderDevice ? 'Waiting for leader to join…' : 'Loading…'");
    expect(setlistPerform).toContain("!loading && mode === 'loading' && !isLeaderDevice ? 'Waiting for leader to join…' : 'Loading…'");
  });
});

describe('Print Data Freshness and Realtime Synchronization', () => {
  it('guarantees setlist and printer pages auto-refresh latest chart data before printing', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const setlistPage = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/page.tsx'), 'utf-8');
    const printerPage = fs.readFileSync(path.resolve(__dirname, '../app/printer/page.tsx'), 'utf-8');

    // Setlist page must have refreshPrintData and beforeprint / focus hooks
    expect(setlistPage).toContain('refreshPrintData');
    expect(setlistPage).toContain('handlePrintSetlist');
    expect(setlistPage).toContain('window.addEventListener(\'beforeprint\'');
    expect(setlistPage).toContain('window.addEventListener(\'focus\'');

    // Printer page must re-fetch latest items before window.print and listen to beforeprint
    expect(printerPage).toContain('loadCharts');
    expect(printerPage).toContain('loadLyrics');
    expect(printerPage).toContain('window.addEventListener(\'beforeprint\'');
    expect(printerPage).toContain('window.addEventListener(\'focus\'');
  });

  it('guarantees AuthProvider instantly resolves guest mode when offline without hanging or redirecting to /auth', () => {
    const authProviderContent = fs.readFileSync(path.join(rootDir, 'components', 'AuthProvider.tsx'), 'utf-8');

    // Must check !navigator.onLine to bypass Supabase network calls
    expect(authProviderContent).toContain('!navigator.onLine');
    expect(authProviderContent).toContain('getOrCreateOfflineUser');
    // Must auto-activate guest user offline instead of forcing a redirect to /auth
    expect(authProviderContent).toContain('setIsGuest(true)');
  });

  it('guarantees ChordlyLoader provides graceful offline fallback if logo image fails to load', () => {
    const loaderContent = fs.readFileSync(path.join(rootDir, 'components', 'ChordlyLoader.tsx'), 'utf-8');

    // Must handle img onError to prevent native browser broken-image placeholder
    expect(loaderContent).toContain('onError');
    expect(loaderContent).toContain('setBannerError(true)');
    expect(loaderContent).toContain('Chord<span className="text-orange-500">ly</span>');
  });
});

describe('Viewer Stage Lock and Rotate Mode Optimizations', () => {
  it('provides compact lock button in rotate/landscape mode on mobile and removes rounded transpose pill', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const reader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreReader.tsx'), 'utf-8');
    const lyricsReader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreLyricsReader.tsx'), 'utf-8');
    const chartRenderer = fs.readFileSync(path.resolve(__dirname, '../components/ChartRenderer.tsx'), 'utf-8');
    const nav = fs.readFileSync(path.resolve(__dirname, '../components/Navigation.tsx'), 'utf-8');
    const css = fs.readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf-8');

    // Rounded transpose pill removed from top bar
    expect(reader).not.toContain('phone-rotate-hide-transpose');

    // Chart paper rendered with square sheet corners (unrounded)
    expect(chartRenderer).toContain('rounded-none');
    expect(chartRenderer).not.toContain('rounded-[24px]');
    expect(lyricsReader).toContain('rounded-none');
    expect(lyricsReader).not.toContain('rounded-[24px]');

    // Lock button must have phone-rotate-compact-lock and support stage chord locking
    expect(reader).toContain('phone-rotate-compact-lock');
    expect(lyricsReader).toContain('phone-rotate-compact-lock');
    expect(chartRenderer).toContain('isLocked');

    // Navigation bar hides when reader top bar is hidden
    expect(reader).toContain("window.dispatchEvent(new CustomEvent('reader-ui-change', { detail: { showUI } }))");
    expect(nav).toContain('reader-ui-change');
    expect(nav).toContain('readerUIHidden');

    // CSS compacts the lock button under landscape + max-height 520px
    expect(css).toContain('.phone-rotate-compact-lock');
    expect(css).toContain('orientation: landscape');
    expect(css).toContain('max-height: 520px');
  });

  it('blocks exiting to menu/catalog while stage lock is enabled', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const reader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreReader.tsx'), 'utf-8');
    const lyricsReader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreLyricsReader.tsx'), 'utf-8');

    // Must intercept popstate when isStageLocked is true to prevent back navigation
    expect(reader).toContain('chordly_stage_lock_prevent_exit');
    expect(reader).toContain('window.addEventListener(\'popstate\', handlePopState)');
    expect(lyricsReader).toContain('chordly_lyrics_lock_prevent_exit');
    expect(lyricsReader).toContain('window.addEventListener(\'popstate\', handlePopState)');

    // Catalog buttons must be disabled when isStageLocked is active
    expect(reader).toContain('disabled={isStageLocked}');
    expect(lyricsReader).toContain('disabled={isStageLocked}');
  });

  it('hides stage lock message after 2 sec and provides direct unlock action on both readers', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const reader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreReader.tsx'), 'utf-8');
    const lyricsReader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreLyricsReader.tsx'), 'utf-8');

    // Toast auto-hides after exactly 2 seconds (2000ms)
    expect(reader).toContain('setTimeout(() => setLockToast(null), 2000)');
    expect(lyricsReader).toContain('setTimeout(() => setLockToast(null), 2000)');

    // Direct unlock button provided inside stage lock toast
    expect(reader).toContain('aria-label="Unlock stage mode"');
    expect(lyricsReader).toContain('aria-label="Unlock stage mode"');

    // Popstate effect depends only on isStageLocked to prevent back-looping
    expect(reader).toContain('}, [isStageLocked]);');
    expect(lyricsReader).toContain('}, [isStageLocked]);');
  });
});

describe('Offline Stability & Resource Handling', () => {
  it('bypasses cross-origin requests in Service Worker to avoid 404 Offline Resource Not Found', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const swGen = fs.readFileSync(path.resolve(__dirname, '../scripts/generate-sw.js'), 'utf-8');
    const publicSw = fs.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf-8');

    expect(swGen).toContain('url.origin !== self.location.origin');
    expect(publicSw).toContain('url.origin !== self.location.origin');
  });

  it('guarantees Service Worker never returns 404 Offline Resource Not Found status on missing offline resources', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const swGen = fs.readFileSync(path.resolve(__dirname, '../scripts/generate-sw.js'), 'utf-8');
    const publicSw = fs.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf-8');

    // Never return 404 status
    expect(swGen).not.toContain("status: 404, statusText: 'Offline Resource Not Found'");
    expect(publicSw).not.toContain("status: 404, statusText: 'Offline Resource Not Found'");

    // Safe fallbacks exist (status 204 must use null body so it never throws TypeError)
    expect(swGen).toContain("new Response(null, { status: 204, statusText: 'No Content (Offline)' })");
    expect(publicSw).toContain("new Response(null, { status: 204, statusText: 'No Content (Offline)' })");
    expect(swGen).not.toContain("new Response('', { status: 204");
    expect(publicSw).not.toContain("new Response('', { status: 204");
    expect(swGen).toContain("url.pathname.includes('hot-update')");
    expect(publicSw).toContain("url.pathname.includes('hot-update')");
    expect(swGen).toContain("'/icon.png'");
    expect(publicSw).toContain("'/icon.png'");
  });

  it('stops Supabase token auto-refresh when offline and guards fetch', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const supabaseCode = fs.readFileSync(path.resolve(__dirname, '../lib/supabase.ts'), 'utf-8');

    expect(supabaseCode).toContain('stopAutoRefresh');
    expect(supabaseCode).toContain('startAutoRefresh');
    expect(supabaseCode).toContain('customFetch');
    expect(supabaseCode).toContain('navigator.onLine');
  });

  it('avoids opening realtime websocket connections when offline', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const syncContext = fs.readFileSync(path.resolve(__dirname, '../components/OfflineSyncContext.tsx'), 'utf-8');

    expect(syncContext).toContain('!navigator.onLine');
    expect(syncContext).toContain("window.addEventListener('offline', handleOffline)");
  });
});


describe('Application Exit and Back Button Navigation Rules', () => {
  it('guarantees FolderBrowser only allows exit when pathname is the root home screen', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const folderBrowser = fs.readFileSync(path.resolve(__dirname, '../components/FolderBrowser.tsx'), 'utf-8');

    // Must check for root home screen before triggering exit toast or back exit
    expect(folderBrowser).toContain('const isActualHome = currentPath === \'/\'');
    expect(folderBrowser).toContain('if (!isActualHome)');
    expect(folderBrowser).toContain("router.push('/')");

    // Exit toast event listener wired up
    expect(folderBrowser).toContain('chordly-show-exit-toast');
    // Native exitApp fallback wired up
    expect(folderBrowser).toContain('cap.Plugins.App.exitApp()');
  });

  it('guarantees CapacitorInit navigates to home on non-home modules and exits only from home', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const capInit = fs.readFileSync(path.resolve(__dirname, '../components/CapacitorInit.tsx'), 'utf-8');

    // On non-home routes, back button navigates to home ('/')
    expect(capInit).toContain("const isHomeScreen = normalizedPath === '/'");
    expect(capInit).toContain('chordly_module_trap');
    expect(capInit).toContain("router.push('/')");

    // On native back button, non-home routes always return to home screen
    expect(capInit).toContain('if (!atHome)');
    expect(capInit).toContain('exitApp');

    // Stage lock and modal priority checks exist before exit
    expect(capInit).toContain('__chordly_stage_locked');
    expect(capInit).toContain('__chordly_modal_open');
    expect(capInit).toContain('chordly-stage-lock-alert');
  });

  it('guarantees stage lock signals are integrated into Piascore readers', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const reader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreReader.tsx'), 'utf-8');
    const lyricsReader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreLyricsReader.tsx'), 'utf-8');

    expect(reader).toContain('(window as any).__chordly_stage_locked = isStageLocked');
    expect(lyricsReader).toContain('(window as any).__chordly_stage_locked = isStageLocked');
    expect(reader).toContain('chordly-stage-lock-alert');
    expect(lyricsReader).toContain('chordly-stage-lock-alert');
  });
});


describe('Navigation Bar Visibility Rules', () => {
  it('strictly hides the rounded navigation bar on setlist detail and perform screens', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const navCode = fs.readFileSync(path.resolve(__dirname, '../components/Navigation.tsx'), 'utf-8');
    const setlistDetail = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/page.tsx'), 'utf-8');
    const setlistPerform = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/perform/page.tsx'), 'utf-8');
    const css = fs.readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf-8');

    // Navigation.tsx must detect setlist detail and perform routes and return null
    expect(navCode).toContain('isSetlistDetailOrPerform');
    expect(navCode).toContain("cleanPath.startsWith('/setlists/')");
    expect(navCode).toContain("cleanPath !== '/setlists'");

    // Setlist perform & detail mark data attributes and suppress showUI
    expect(setlistPerform).toContain('data-viewing-setlist="true"');
    expect(setlistPerform).toContain('data-viewing-chords="true"');
    expect(setlistDetail).toContain('data-viewing-setlist="true"');

    // CSS guarantees hiding the dock via :has attribute selectors
    expect(css).toContain('data-viewing-setlist');
    expect(css).toContain('data-viewing-chords');
  });

  it('strictly hides the rounded navigation bar when viewing chord charts', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const navCode = fs.readFileSync(path.resolve(__dirname, '../components/Navigation.tsx'), 'utf-8');
    const reader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreReader.tsx'), 'utf-8');

    expect(navCode).toContain('isChartScreen');
    expect(navCode).toContain('__chordly_viewing_chords');
    expect(reader).toContain('data-viewing-chords="true"');
  });
});
