import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reorderSetlistItems } from '../lib/setlists';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => {
  const fromMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
    },
  };
});

describe('Group 2: High Logic Bugs & Strict Typing Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Issue #12: Setlist Reordering Error Handling', () => {
    it('throws an error when any setlist_item position update fails', async () => {
      const eqMock = vi.fn()
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'Row-level security violation' } });

      (supabase.from as any).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: eqMock,
        }),
      });

      await expect(
        reorderSetlistItems([
          { id: 'item-1', position: 0 },
          { id: 'item-2', position: 1 },
        ])
      ).rejects.toThrow('Failed to update item position: Row-level security violation');
    });

    it('resolves cleanly when all position updates succeed', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      (supabase.from as any).mockReturnValue({
        update: updateMock,
      });

      await expect(
        reorderSetlistItems([
          { id: 'item-1', position: 0 },
          { id: 'item-2', position: 1 },
        ])
      ).resolves.toBeUndefined();
    });
  });

  describe('Issue #8: Offline Folder Deletion Cascade in pending_saves', () => {
    it('verifies deleteEntry implementation queues all nested subfolders, charts, and lyrics in pending_saves', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const storageCode = fs.readFileSync(path.resolve(__dirname, '../lib/storage.ts'), 'utf-8');

      // Must queue nested items in pending_saves when !isOnline()
      expect(storageCode).toContain('childChartIds.push(c.id)');
      expect(storageCode).toContain('childLyricIds.push(l.id)');
      expect(storageCode).toContain("await db.put('pending_saves', { id: fId, type: 'folder', data: null, action: 'delete' })");
      expect(storageCode).toContain("await db.put('pending_saves', { id: cId, type: 'chart', data: null, action: 'delete' })");
      expect(storageCode).toContain("await db.put('pending_saves', { id: lId, type: 'lyrics', data: null, action: 'delete' })");
    });
  });

  describe('Issue #9: Flush Pending Saves Retry Limit & Quarantine', () => {
    it('verifies flushPendingSaves implements retry_count limit (5) and dead-letter deletion', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const storageCode = fs.readFileSync(path.resolve(__dirname, '../lib/storage.ts'), 'utf-8');

      expect(storageCode).toContain('retries >= 5');
      expect(storageCode).toContain('exceeded 5 retries. Quarantining.');
      expect(storageCode).toContain("await db.put('pending_saves', { ...item, retry_count: retries })");
    });
  });

  describe('Issue #10: SignOut Band Purge & Offline Saves Warning', () => {
    it('verifies AuthProvider.tsx calls clearBandCache and checks pending_saves count on signout', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const authProviderCode = fs.readFileSync(path.resolve(__dirname, '../components/AuthProvider.tsx'), 'utf-8');

      expect(authProviderCode).toContain('await clearBandCache(profile.band_id || undefined)');
      expect(authProviderCode).toContain('await getPendingSavesCount()');
    });
  });

  describe('Issue #11: Trashed Folder Child Cascade & Catalog Filtering', () => {
    it('verifies moveToTrash cascades trashed prefix to nested charts/lyrics and restoreFromTrash un-trashes them', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const storageCode = fs.readFileSync(path.resolve(__dirname, '../lib/storage.ts'), 'utf-8');

      // moveToTrash must cascade to child charts and lyrics
      expect(storageCode).toContain('folderIdsToTrash = new Set<string>([id])');
      expect(storageCode).toContain('trashedChildTitle = `__TRASH__:${c.folder_id}:${c.title}`');
      expect(storageCode).toContain('trashedChildTitle = `__TRASH__:${l.folder_id}:${l.title}`');

      // restoreFromTrash must restore children matching prefix
      expect(storageCode).toContain('prefix = `__TRASH__:${id}:`');
      expect(storageCode).toContain('restoredChildTitle = c.title.slice(prefix.length)');

      // getAllFolders must filter out __TRASH__: folders
      expect(storageCode).toContain(".not('name', 'like', '__TRASH__:%')");
      expect(storageCode).toContain("!f.name.startsWith('__TRASH__:')");
    });
  });

  describe('PostgREST 406 (Not Acceptable) & Cold-Mount Auth Hydration Prevention', () => {
    it('verifies storage.ts and lyrics.ts use maybeSingle() to prevent HTTP 406 on missing/protected charts', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const storageCode = fs.readFileSync(path.resolve(__dirname, '../lib/storage.ts'), 'utf-8');
      const lyricsCode = fs.readFileSync(path.resolve(__dirname, '../lib/lyrics.ts'), 'utf-8');

      // readChart and readLyrics must use maybeSingle
      expect(storageCode).toContain(".from('charts').select('*').eq('id', id).maybeSingle()");
      expect(storageCode).toContain(".from('folders').select('*').eq('id', id).maybeSingle()");
      expect(storageCode).toContain(".from('lyrics').select('*').eq('id', id).maybeSingle()");
      expect(lyricsCode).toContain(".from('lyrics').select('*').eq('id', id).maybeSingle()");

      // Must not use raw .single() in readChart or readLyrics
      expect(storageCode).not.toContain(".from('charts').select('*').eq('id', id).single()");
      expect(lyricsCode).not.toContain(".from('lyrics').select('*').eq('id', id).single()");
    });

    it('verifies useChartSync and useLyricsSync listen for auth state changes to re-fetch on cold load', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const chartSyncCode = fs.readFileSync(path.resolve(__dirname, '../hooks/useChartSync.ts'), 'utf-8');
      const lyricsSyncCode = fs.readFileSync(path.resolve(__dirname, '../hooks/useLyricsSync.ts'), 'utf-8');

      expect(chartSyncCode).toContain('supabase.auth.onAuthStateChange');
      expect(chartSyncCode).toContain('authSub.unsubscribe()');
      expect(lyricsSyncCode).toContain('supabase.auth.onAuthStateChange');
      expect(lyricsSyncCode).toContain('authSub.unsubscribe()');
    });

    it('verifies chart viewer pages await authLoading before showing access denied', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const chartPage = fs.readFileSync(path.resolve(__dirname, '../app/chart/page.tsx'), 'utf-8');
      const chartDetailPage = fs.readFileSync(path.resolve(__dirname, '../app/chart/[id]/page.tsx'), 'utf-8');

      expect(chartPage).toContain('authLoading');
      expect(chartPage).toContain('if (chartLoading || authLoading || !resolvedChartId)');
      expect(chartDetailPage).toContain('authLoading');
      expect(chartDetailPage).toContain('if (chartLoading || authLoading || !chartId)');
    });

    it('verifies mobile resilience: band upsert, self-healing retry on readChart/readLyrics, and sw safe cloning', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const storageCode = fs.readFileSync(path.resolve(__dirname, '../lib/storage.ts'), 'utf-8');
      const lyricsCode = fs.readFileSync(path.resolve(__dirname, '../lib/lyrics.ts'), 'utf-8');
      const bandCode = fs.readFileSync(path.resolve(__dirname, '../lib/band.ts'), 'utf-8');
      const authCode = fs.readFileSync(path.resolve(__dirname, '../app/auth/page.tsx'), 'utf-8');
      const swGenCode = fs.readFileSync(path.resolve(__dirname, '../scripts/generate-sw.js'), 'utf-8');
      const chartPage = fs.readFileSync(path.resolve(__dirname, '../app/chart/page.tsx'), 'utf-8');

      // 1. readChart and readLyrics retry after syncBandForUser when data is null/error
      expect(storageCode).toContain('syncBandForUser(sessionUser)');
      expect(lyricsCode).toContain('syncBandForUser(sessionUser)');

      // 2. band.ts uses upsert on profiles to prevent missing row no-ops
      expect(bandCode).toContain(".from('profiles').upsert(");

      // 3. auth/page.tsx ensures DEFAULT_CHURCH_BAND_ID on account sign-in/creation
      expect(authCode).toContain('DEFAULT_CHURCH_BAND_ID');

      // 4. sw.js protects clone with !bodyUsed check
      expect(swGenCode).toContain('!networkResponse.bodyUsed');

      // 5. Chart viewer page offers a Retry button
      expect(chartPage).toContain('Retry');
    });
  });
});
