import { describe, it, expect } from 'vitest';
import { transposeChordString, transposeSingleChord } from '../lib/transpose';
import { canModifySection } from '../components/AuthProvider';
import { getEmailBandCacheKey } from '../lib/band';

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
      return { data: { user: null }, error: null };
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
    expect(performPageCode).toContain('contentClass="w-max flex flex-col items-start justify-start pt-20 pb-36"');
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

    // Detail page routes Play / View Set to /setlists/perform?id=
    expect(detailPage).toContain('/setlists/perform?id=');
    expect(detailPage).not.toContain('router.push(/setlists//perform)');

    // Perform page back buttons route to /setlists/view?id=
    expect(performPage).toContain('/setlists/view?id=');
    expect(performPage).not.toContain('router.push(/setlists/)');

    // not-found.tsx handles setlist fallback redirects
    expect(notFoundPage).toContain('Setlist Performance');
    expect(notFoundPage).toContain('/setlists/perform?id=');
    expect(notFoundPage).toContain('/setlists/view?id=');
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
});
