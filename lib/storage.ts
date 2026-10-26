import { supabase } from './supabase';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Line } from './chart-types';
import type { Lyric } from './lyrics';

export type { Line, Lyric };

export type Chart = {
  id: string;
  title: string;
  tempo: number | null;
  time_sig: string | null;
  lines: Line[];
  semitone_offset: number;
  prefer_flats: boolean;
  folder_id: string | null;
  created_by: string;
  updated_at: string;
  is_bookmarked?: boolean;
  band_id?: string | null;
};

export type Folder = {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  updated_at: string;
  kind: 'chart' | 'lyrics';
  band_id?: string | null;
};

export const DEFAULT_CHURCH_BAND_ID = '9ca7fef8-a0e0-4587-a329-0444c4b27f70';

/** Resolve PostgREST filter string for scoping queries to a band */
export function getBandFilter(activeBandId: string | null | undefined): string | null {
  if (!activeBandId) return null;
  if (activeBandId === DEFAULT_CHURCH_BAND_ID) {
    return `band_id.eq.${activeBandId},band_id.is.null`;
  }
  return `band_id.eq.${activeBandId}`;
}

interface BarChartDB extends DBSchema {
  charts: {
    key: string;
    value: Chart;
  };
  lyrics: {
    key: string;
    value: Lyric; 
  };
  folders: {
    key: string;
    value: Folder;
  };
  pending_saves: {
    key: string;
    value: {
      id: string;
      type: 'chart' | 'folder' | 'lyrics';
      data: Chart | Folder | Lyric | null;
      action: 'upsert' | 'delete';
      retry_count?: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<BarChartDB>> | null = null;
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
  dbPromise = openDB<BarChartDB>('bar-chart-db', 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('charts', { keyPath: 'id' });
        db.createObjectStore('folders', { keyPath: 'id' });
        db.createObjectStore('pending_saves', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('lyrics')) {
          db.createObjectStore('lyrics', { keyPath: 'id' });
        }
      }
      // Add version 3 catch-all just in case
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('lyrics')) {
          db.createObjectStore('lyrics', { keyPath: 'id' });
        }
      }
    },
    blocked() {
      console.warn('[Storage] IndexedDB upgrade blocked by another open tab.');
    },
    blocking() {
      console.warn('[Storage] IndexedDB connection is blocking a newer version in another tab.');
    },
    terminated() {
      console.warn('[Storage] IndexedDB connection terminated abnormally.');
    },
  }).catch((err) => {
    console.warn('[Storage] IndexedDB initialization failed:', err);
    throw err;
  });
}

export const getDBPromise = () => dbPromise;

// Utility to check network and guest mode state
export const isOnline = () => {
  if (typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true') {
    return false;
  }
  return typeof navigator !== 'undefined' && navigator.onLine;
};

// Mutex lock to prevent concurrent flushes
let isFlushingPendingSaves = false;

// Flush pending saves when coming back online or logging in
export async function flushPendingSaves() {
  if (!dbPromise || !isOnline() || isFlushingPendingSaves) return;
  isFlushingPendingSaves = true;
  try {
    const db = await dbPromise;
    if (!db) return;
    const pending = await db.getAll('pending_saves');
    for (const item of pending) {
      let success = false;
      if (item.action === 'upsert' && item.data) {
        if (item.type === 'chart') {
          const { custom_text, type, ...dbPayload } = item.data as Chart & { custom_text?: unknown; type?: unknown };
          const { error } = await supabase.from('charts').upsert(dbPayload);
          if (!error) success = true;
          else console.warn('[Storage] flushPendingSaves chart error:', error);
        } else if (item.type === 'lyrics') {
          const { type, ...dbPayload } = item.data as Lyric & { type?: unknown };
          const { error } = await supabase.from('lyrics').upsert(dbPayload);
          if (!error) success = true;
          else console.warn('[Storage] flushPendingSaves lyrics error:', error);
        } else if (item.type === 'folder') {
          const { error } = await supabase.from('folders').upsert(item.data as Folder);
          if (!error) success = true;
          else console.warn('[Storage] flushPendingSaves folder error:', error);
        }
      } else if (item.action === 'delete') {
        if (item.type === 'chart') {
          await supabase.from('setlist_items').delete().eq('item_id', item.id);
          const { error } = await supabase.from('charts').delete().eq('id', item.id);
          if (!error) success = true;
        } else if (item.type === 'lyrics') {
          await supabase.from('setlist_items').delete().eq('item_id', item.id);
          const { error } = await supabase.from('lyrics').delete().eq('id', item.id);
          if (!error) success = true;
        } else if (item.type === 'folder') {
          const { error } = await supabase.from('folders').delete().eq('id', item.id);
          if (!error) success = true;
        }
      }
      if (success) {
        await db.delete('pending_saves', item.id);
      } else {
        const retries = (item.retry_count || 0) + 1;
        if (retries >= 5) {
          console.error(`[Storage] flushPendingSaves: item ${item.id} (${item.type}) exceeded 5 retries. Quarantining.`);
          await db.delete('pending_saves', item.id);
        } else {
          await db.put('pending_saves', { ...item, retry_count: retries });
        }
      }
    }
  } catch (err) {
    console.warn('[Storage] flushPendingSaves error:', err);
  } finally {
    isFlushingPendingSaves = false;
  }
}

/** Get number of items queued in pending_saves */
export async function getPendingSavesCount(): Promise<number> {
  if (!dbPromise) return 0;
  try {
    const db = await dbPromise;
    if (!db) return 0;
    return await db.count('pending_saves');
  } catch (err) {
    console.warn('[Storage] getPendingSavesCount error:', err);
    return 0;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', flushPendingSaves);
}

// Cache updating utilities — exported so OfflineSyncContext can use them for realtime event handling
export async function cacheChart(chart: Chart) {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    if (db) await db.put('charts', chart);
  } catch (err) {
    console.warn('[Storage] Failed to cache chart:', err);
  }
}

export async function cacheFolder(folder: Folder) {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    if (db) await db.put('folders', folder);
  } catch (err) {
    console.warn('[Storage] Failed to cache folder:', err);
  }
}

export async function cacheLyric(lyric: Lyric) {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    if (db) await db.put('lyrics', lyric);
  } catch (err) {
    console.warn('[Storage] Failed to cache lyric:', err);
  }
}

export async function deleteFromCache(id: string, store: 'charts' | 'lyrics' | 'folders') {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    if (db) await db.delete(store, id);
  } catch (err) {
    console.warn('[Storage] Failed to delete from cache:', err);
  }
}

/** Clear all cached data belonging to a specific band from IndexedDB */
export async function clearBandCache(bandId?: string | null) {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    if (!db) return;

    const [allCharts, allLyrics, allFolders] = await Promise.all([
      db.getAll('charts'),
      db.getAll('lyrics'),
      db.getAll('folders'),
    ]);

    const isTargetBand = (itemBandId?: string | null) => {
      if (!bandId) return true;
      if (itemBandId === bandId) return true;
      if (bandId === DEFAULT_CHURCH_BAND_ID && !itemBandId) return true;
      return false;
    };

    const chartTx = db.transaction('charts', 'readwrite');
    for (const c of allCharts) {
      if (isTargetBand(c.band_id)) {
        await chartTx.store.delete(c.id);
      }
    }
    await chartTx.done;

    const lyricTx = db.transaction('lyrics', 'readwrite');
    for (const l of allLyrics) {
      if (isTargetBand(l.band_id)) {
        await lyricTx.store.delete(l.id);
      }
    }
    await lyricTx.done;

    const folderTx = db.transaction('folders', 'readwrite');
    for (const f of allFolders) {
      if (isTargetBand(f.band_id)) {
        await folderTx.store.delete(f.id);
      }
    }
    await folderTx.done;

    // Also clean up any pending_saves that belong to that band if not in guest mode
    const isGuest = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
    if (!isGuest) {
      const allPending = await db.getAll('pending_saves');
      const pendingTx = db.transaction('pending_saves', 'readwrite');
      for (const p of allPending) {
        if (p.data && (!bandId || isTargetBand(p.data.band_id))) {
          await pendingTx.store.delete(p.id);
        }
      }
      await pendingTx.done;
    }
  } catch (err) {
    console.warn('[Storage] clearBandCache error:', err);
  }
}

// --- Data Access Layer ---

export async function listFolderFromCache(
  folderId: string | null,
  kind: 'chart' | 'lyrics' = 'chart',
  bandId?: string | null
) {
  if (!dbPromise) return { folders: [], charts: [] };
  const db = await dbPromise;
  if (!db) return { folders: [], charts: [] };

  const isGuestMode = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);

  const allFolders = await db.getAll('folders');
  const allItems = await db.getAll(kind === 'chart' ? 'charts' : 'lyrics');

  const matchesBand = (itemBandId: string | null | undefined) => {
    if (isGuestMode) return true;
    if (!activeBandId) return false;
    if (activeBandId === DEFAULT_CHURCH_BAND_ID) return itemBandId === activeBandId || !itemBandId;
    return itemBandId === activeBandId;
  };

  const folders = allFolders
    .filter((f) => f.parent_id === folderId && f.kind === kind && !f.name.startsWith('__TRASH__:') && matchesBand(f.band_id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const items = allItems.filter((c) => c.folder_id === folderId && !c.title.startsWith('__TRASH__:') && matchesBand(c.band_id));

  return {
    folders,
    charts: items.map((c) => ({
      id: c.id,
      title: c.title,
      updated_at: c.updated_at,
      is_bookmarked: c.is_bookmarked,
      created_by: c.created_by,
      band_id: c.band_id,
      type: kind,
    })),
  };
}

export async function listFolder(
  folderId: string | null,
  kind: 'chart' | 'lyrics' = 'chart',
  bandId?: string | null
) {
  // Always retrieve local cached items first as baseline
  const local = await listFolderFromCache(folderId, kind, bandId);
  const isGuestMode = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);

  // If in guest mode, purely return local cached items (offline-only)
  if (isGuestMode) {
    return local;
  }

  // Users with no band see nothing from bands
  if (!activeBandId) {
    return local;
  }

  // Attempt online fetch if online OR if local cache is currently empty
  const shouldAttemptOnline = isOnline();

  if (shouldAttemptOnline) {
    try {
      const bandFilter = getBandFilter(activeBandId);

      let foldersQuery = supabase
        .from('folders')
        .select('*')
        .eq('kind', kind)
        .order('name', { ascending: true })
        .not('name', 'like', '__TRASH__:%');

      if (bandFilter) {
        foldersQuery = foldersQuery.or(bandFilter);
      }

      if (folderId) {
        foldersQuery = foldersQuery.eq('parent_id', folderId);
      } else {
        foldersQuery = foldersQuery.is('parent_id', null);
      }

      let itemsQuery;
      if (kind === 'chart') {
        itemsQuery = supabase
          .from('charts')
          .select('id, title, updated_at, is_bookmarked, created_by, band_id')
          .order('updated_at', { ascending: false })
          .not('title', 'like', '__TRASH__:%');
      } else {
        itemsQuery = supabase
          .from('lyrics')
          .select('id, title, updated_at, is_bookmarked, created_by, band_id')
          .order('updated_at', { ascending: false })
          .not('title', 'like', '__TRASH__:%');
      }
      
      if (bandFilter) {
        itemsQuery = itemsQuery.or(bandFilter);
      }

      if (folderId) {
        itemsQuery = itemsQuery.eq('folder_id', folderId);
      } else {
        itemsQuery = itemsQuery.is('folder_id', null);
      }

      // Race against an 8s timeout for mobile networks (cold SSL / DNS)
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 8000));
      const [foldersRes, itemsRes] = await Promise.race([
        Promise.all([foldersQuery, itemsQuery]),
        timeoutPromise,
      ]);

      if (foldersRes.error) throw foldersRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const onlineFolders: Folder[] = foldersRes.data || [];
      const onlineItems = itemsRes.data || [];

      const folderMap = new Map<string, Folder>();
      const itemMap = new Map<string, any>();

      // 1. Foundation: Always populate local cached items so catalog never disappears
      local.folders.forEach(f => folderMap.set(f.id, f));
      local.charts.forEach(c => itemMap.set(c.id, c));

      // 2. Include any pending offline saves
      if (dbPromise) {
        try {
          const db = await dbPromise;
          const pending = await db.getAll('pending_saves');
          const pendingUpserts = new Set(pending.filter(p => p.action === 'upsert').map(p => p.id));
          local.charts.filter(c => pendingUpserts.has(c.id)).forEach(c => itemMap.set(c.id, c));
          local.folders.filter(f => pendingUpserts.has(f.id)).forEach(f => folderMap.set(f.id, f));
        } catch {}
      }

      // 3. Authoritative overlay: Fresh online items take priority
      onlineFolders.forEach(f => folderMap.set(f.id, f));
      onlineItems.forEach(c => itemMap.set(c.id, { ...c, type: kind }));

      // 4. Update local cache with latest online data
      if (dbPromise) {
        try {
          const db = await dbPromise;
          if (onlineFolders.length > 0) {
            const tx = db.transaction('folders', 'readwrite');
            onlineFolders.forEach((f) => tx.store.put(f));
          }
          // Only prune local items if onlineItems is a confirmed non-empty set of authoritative items
          if (onlineItems.length > 0) {
            const onlineIds = new Set(onlineItems.map(i => i.id));
            const storeName = kind === 'chart' ? 'charts' : 'lyrics';
            const pending = await db.getAll('pending_saves');
            const pendingIds = new Set(pending.map(p => p.id));
            for (const localItem of local.charts) {
              if (!onlineIds.has(localItem.id) && !pendingIds.has(localItem.id) && !localItem.title.startsWith('__TRASH__:')) {
                await db.delete(storeName, localItem.id);
              }
            }
          }
        } catch {}
      }

      // Flush any queued offline saves in the background
      flushPendingSaves().catch(() => {});

      return {
        folders: Array.from(folderMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        charts: Array.from(itemMap.values()),
      };
    } catch (e) {
      console.warn('[Storage] listFolder online fetch failed or timed out, using local cache:', e);
      return local;
    }
  } else {
    return local;
  }
}

export async function createFolder(
  parentId: string | null,
  name: string,
  kind: 'chart' | 'lyrics' = 'chart',
  bandId?: string | null
) {
  const { data: { user } } = await supabase.auth.getUser();
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);

  const folder: Folder = {
    id: crypto.randomUUID(),
    name,
    parent_id: parentId,
    created_by: user?.id || '',
    band_id: activeBandId || null,
    updated_at: new Date().toISOString(),
    kind,
  };

  if (isOnline()) {
    await supabase.from('folders').insert(folder);
  } else if (dbPromise) {
    const db = await dbPromise;
    await db.put('pending_saves', { id: folder.id, type: 'folder', data: folder, action: 'upsert' });
  }
  await cacheFolder(folder);
  return folder;
}


export async function renameEntry(id: string, type: 'folder' | 'chart' | 'lyrics', newName: string) {
  const updated_at = new Date().toISOString();
  const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';

  if (isOnline()) {
    try {
      if (type === 'folder') {
        await supabase.from('folders').update({ name: newName, updated_at }).eq('id', id);
      } else if (type === 'chart') {
        await supabase.from('charts').update({ title: newName, updated_at }).eq('id', id);
      } else if (type === 'lyrics') {
        await supabase.from('lyrics').update({ title: newName, updated_at }).eq('id', id);
      }
    } catch (err) {
      console.warn('[Storage] Supabase renameEntry error:', err);
    }
  }

  if (dbPromise) {
    try {
      const db = await dbPromise;
      const existing = await db.get(storeName, id);
      if (existing) {
        const updated = type === 'folder' ? { ...existing, name: newName, updated_at } : { ...existing, title: newName, updated_at };
        await db.put(storeName, updated);
        if (!isOnline()) {
          await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
        }
      }
    } catch (err) {
      console.warn('[Storage] DB renameEntry error:', err);
    }
  }
}

export async function toggleBookmark(id: string, type: 'chart' | 'lyrics', is_bookmarked: boolean) {
  const updated_at = new Date().toISOString();
  const storeName = type === 'chart' ? 'charts' : 'lyrics';

  if (isOnline()) {
    try {
      if (type === 'chart') {
        await supabase.from('charts').update({ is_bookmarked, updated_at }).eq('id', id);
      } else if (type === 'lyrics') {
        await supabase.from('lyrics').update({ is_bookmarked, updated_at }).eq('id', id);
      }
    } catch (err) {
      console.warn('[Storage] Supabase toggleBookmark error:', err);
    }
  }

  if (dbPromise) {
    try {
      const db = await dbPromise;
      const existing = await db.get(storeName, id);
      if (existing) {
        const updated = { ...existing, is_bookmarked, updated_at };
        await db.put(storeName, updated);
        if (!isOnline()) {
          await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
        }
      }
    } catch (err) {
      console.warn('[Storage] DB toggleBookmark error:', err);
    }
  }
}

export async function deleteEntry(id: string, type: 'folder' | 'chart' | 'lyrics') {
  const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';

  // 1. Delete from Supabase if online
  if (isOnline()) {
    try {
      if (type === 'folder') {
        // Cascade delete lyrics inside this folder
        await supabase.from('lyrics').delete().eq('folder_id', id);
        // Find charts in this folder to clean up referencing setlist_items
        const { data: folderCharts } = await supabase.from('charts').select('id').eq('folder_id', id);
        if (folderCharts && folderCharts.length > 0) {
          const chartIds = folderCharts.map(c => c.id);
          await supabase.from('setlist_items').delete().in('item_id', chartIds);
          await supabase.from('charts').delete().eq('folder_id', id);
        }
        // Subfolders
        await supabase.from('folders').delete().eq('parent_id', id);
        // Delete folder itself
        const { error } = await supabase.from('folders').delete().eq('id', id);
        if (error) console.warn('[Storage] Supabase delete folder error:', error);
      } else if (type === 'chart') {
        // Clean up setlist_items referencing this chart first
        await supabase.from('setlist_items').delete().eq('item_id', id);
        const { error } = await supabase.from('charts').delete().eq('id', id);
        if (error) console.warn('[Storage] Supabase delete chart error:', error);
      } else if (type === 'lyrics') {
        // Clean up setlist_items referencing this lyric first
        await supabase.from('setlist_items').delete().eq('item_id', id);
        const { error } = await supabase.from('lyrics').delete().eq('id', id);
        if (error) console.warn('[Storage] Supabase delete lyrics error:', error);
      }
    } catch (err) {
      console.warn('[Storage] Supabase deleteEntry error:', err);
    }
  }

  // 2. ALWAYS delete from local IndexedDB
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.delete(storeName, id);

      if (type === 'folder') {
        // Cascade delete all nested folders, charts, and lyrics from IndexedDB
        const allFolders = await db.getAll('folders');
        const allCharts = await db.getAll('charts');
        const allLyrics = await db.getAll('lyrics');

        const folderIdsToDelete = new Set<string>([id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const f of allFolders) {
            if (f.parent_id && folderIdsToDelete.has(f.parent_id) && !folderIdsToDelete.has(f.id)) {
              folderIdsToDelete.add(f.id);
              changed = true;
            }
          }
        }

        const childChartIds: string[] = [];
        for (const c of allCharts) {
          if (c.folder_id && folderIdsToDelete.has(c.folder_id)) {
            childChartIds.push(c.id);
            await db.delete('charts', c.id);
          }
        }
        const childLyricIds: string[] = [];
        for (const l of allLyrics) {
          if (l.folder_id && folderIdsToDelete.has(l.folder_id)) {
            childLyricIds.push(l.id);
            await db.delete('lyrics', l.id);
          }
        }
        for (const fId of folderIdsToDelete) {
          await db.delete('folders', fId);
        }

        if (!isOnline()) {
          for (const fId of folderIdsToDelete) {
            await db.put('pending_saves', { id: fId, type: 'folder', data: null, action: 'delete' });
          }
          for (const cId of childChartIds) {
            await db.put('pending_saves', { id: cId, type: 'chart', data: null, action: 'delete' });
          }
          for (const lId of childLyricIds) {
            await db.put('pending_saves', { id: lId, type: 'lyrics', data: null, action: 'delete' });
          }
        } else {
          for (const fId of folderIdsToDelete) {
            await db.delete('pending_saves', fId);
          }
          for (const cId of childChartIds) {
            await db.delete('pending_saves', cId);
          }
          for (const lId of childLyricIds) {
            await db.delete('pending_saves', lId);
          }
        }
      } else {
        if (!isOnline()) {
          await db.put('pending_saves', { id, type, data: null, action: 'delete' });
        } else {
          await db.delete('pending_saves', id);
        }
      }
    } catch (err) {
      console.warn('[Storage] DB deleteEntry error:', err);
    }
  }
}

export async function moveToTrash(id: string, type: 'folder' | 'chart' | 'lyrics') {
  const updated_at = new Date().toISOString();
  const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';

  let existingName = '';
  let existingParentId: string | null = null;
  let existingItem: Folder | Chart | Lyric | null = null;

  if (isOnline()) {
    try {
      if (type === 'folder') {
        const { data } = await supabase.from('folders').select('*').eq('id', id).maybeSingle();
        if (data) { existingName = data.name; existingParentId = data.parent_id; existingItem = data; }
      } else if (type === 'chart') {
        const { data } = await supabase.from('charts').select('*').eq('id', id).maybeSingle();
        if (data) { existingName = data.title; existingParentId = data.folder_id; existingItem = data; }
      } else if (type === 'lyrics') {
        const { data } = await supabase.from('lyrics').select('*').eq('id', id).maybeSingle();
        if (data) { existingName = data.title; existingParentId = data.folder_id; existingItem = data; }
      }
    } catch (err) {
      console.warn('[Storage] Supabase get for trash error:', err);
    }
  }

  // Fallback to local DB if not found in Supabase or if offline
  if (!existingName && dbPromise) {
    try {
      const db = await dbPromise;
      const existing = await db.get(storeName, id);
      if (existing) {
        existingItem = existing;
        if (type === 'folder') {
          existingName = (existing as Folder).name;
          existingParentId = (existing as Folder).parent_id;
        } else {
          existingName = (existing as Chart | Lyric).title;
          existingParentId = (existing as Chart | Lyric).folder_id ?? null;
        }
      }
    } catch (err) {
      console.warn('[Storage] DB get for trash error:', err);
    }
  }

  if (!existingName) return;

  // Strip existing __TRASH__: prefix to prevent duplicate nesting (__TRASH__:root:__TRASH__:...)
  if (existingName.startsWith('__TRASH__:')) {
    const p = existingName.split(':');
    if (p.length >= 3) {
      existingParentId = p[1] === 'root' ? null : p[1];
      existingName = p.slice(2).join(':');
    } else if (p.length === 2) {
      existingParentId = null;
      existingName = p[1];
    }
  }

  const trashedName = `__TRASH__:${existingParentId || 'root'}:${existingName}`;

  if (isOnline()) {
    try {
      if (type === 'folder') {
        await supabase.from('folders').update({ name: trashedName, parent_id: null, updated_at }).eq('id', id);
      } else if (type === 'chart') {
        await supabase.from('charts').update({ title: trashedName, folder_id: null, updated_at }).eq('id', id);
      } else if (type === 'lyrics') {
        await supabase.from('lyrics').update({ title: trashedName, folder_id: null, updated_at }).eq('id', id);
      }
    } catch (err) {
      console.warn('[Storage] Supabase moveToTrash error:', err);
    }
  }

  // ALWAYS update local IndexedDB cache
  if (dbPromise) {
    try {
      const db = await dbPromise;
      const existing = (await db.get(storeName, id)) || existingItem;
      const updated = existing ? { ...existing, updated_at } : ({ id, updated_at } as unknown as Folder | Chart | Lyric);
      if (type === 'folder') {
        (updated as Folder).name = trashedName;
        (updated as Folder).parent_id = null;
      } else {
        (updated as Chart | Lyric).title = trashedName;
        (updated as Chart | Lyric).folder_id = null;
      }
      await db.put(storeName, updated);
      if (!isOnline()) {
        await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
      }

      // If trashing a folder, cascade trash to all child charts and lyrics so they don't leak into Recent/Search
      if (type === 'folder') {
        const allFolders = await db.getAll('folders');
        const allCharts = await db.getAll('charts');
        const allLyrics = await db.getAll('lyrics');

        const folderIdsToTrash = new Set<string>([id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const f of allFolders) {
            if (f.parent_id && folderIdsToTrash.has(f.parent_id) && !folderIdsToTrash.has(f.id)) {
              folderIdsToTrash.add(f.id);
              changed = true;
            }
          }
        }

        for (const c of allCharts) {
          if (c.folder_id && folderIdsToTrash.has(c.folder_id) && !c.title.startsWith('__TRASH__:')) {
            const trashedChildTitle = `__TRASH__:${c.folder_id}:${c.title}`;
            const updatedChild = { ...c, title: trashedChildTitle, updated_at };
            await db.put('charts', updatedChild);
            if (isOnline()) {
              await supabase.from('charts').update({ title: trashedChildTitle, updated_at }).eq('id', c.id);
            } else {
              await db.put('pending_saves', { id: c.id, type: 'chart', data: updatedChild, action: 'upsert' });
            }
          }
        }

        for (const l of allLyrics) {
          if (l.folder_id && folderIdsToTrash.has(l.folder_id) && !l.title.startsWith('__TRASH__:')) {
            const trashedChildTitle = `__TRASH__:${l.folder_id}:${l.title}`;
            const updatedChild = { ...l, title: trashedChildTitle, updated_at };
            await db.put('lyrics', updatedChild);
            if (isOnline()) {
              await supabase.from('lyrics').update({ title: trashedChildTitle, updated_at }).eq('id', l.id);
            } else {
              await db.put('pending_saves', { id: l.id, type: 'lyrics', data: updatedChild, action: 'upsert' });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Storage] DB moveToTrash error:', err);
    }
  }
}

export async function restoreFromTrash(id: string, type: 'folder' | 'chart' | 'lyrics', trashedName: string) {
  const updated_at = new Date().toISOString();
  const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';

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

  // Verify whether originalParentId exists in folders; if not (e.g. parent was deleted), fallback to root (null)
  let finalParentId = originalParentId;
  if (finalParentId) {
    let folderExists = false;
    if (isOnline()) {
      try {
        const { data } = await supabase.from('folders').select('id, name').eq('id', finalParentId).maybeSingle();
        if (data && !data.name.startsWith('__TRASH__:')) {
          folderExists = true;
        }
      } catch {}
    }
    if (!folderExists && dbPromise) {
      try {
        const db = await dbPromise;
        const localFolder = await db.get('folders', finalParentId);
        if (localFolder && !localFolder.name.startsWith('__TRASH__:')) {
          folderExists = true;
        }
      } catch {}
    }
    if (!folderExists) {
      finalParentId = null;
    }
  }

  let itemData: Folder | Chart | Lyric | null = null;

  if (isOnline()) {
    try {
      if (type === 'folder') {
        const { data, error } = await supabase.from('folders').update({ name: originalName, parent_id: finalParentId, updated_at }).eq('id', id).select().maybeSingle();
        if (data) itemData = data;
        if (error) console.warn('[Storage] Supabase restore folder error:', error);
      } else if (type === 'chart') {
        const { data, error } = await supabase.from('charts').update({ title: originalName, folder_id: finalParentId, updated_at }).eq('id', id).select().maybeSingle();
        if (data) itemData = data;
        if (error) console.warn('[Storage] Supabase restore chart error:', error);
      } else if (type === 'lyrics') {
        const { data, error } = await supabase.from('lyrics').update({ title: originalName, folder_id: finalParentId, updated_at }).eq('id', id).select().maybeSingle();
        if (data) itemData = data;
        if (error) console.warn('[Storage] Supabase restore lyrics error:', error);
      }
    } catch (err) {
      console.warn('[Storage] Supabase restoreFromTrash error:', err);
    }
  }

  // ALWAYS update local IndexedDB cache
  if (dbPromise) {
    try {
      const db = await dbPromise;
      if (db) {
        const existing = (await db.get(storeName, id)) || itemData;
        const updated = existing ? { ...existing, updated_at } : ({ id, updated_at } as unknown as Folder | Chart | Lyric);
        if (type === 'folder') {
          (updated as Folder).name = originalName;
          (updated as Folder).parent_id = finalParentId;
        } else {
          (updated as Chart | Lyric).title = originalName;
          (updated as Chart | Lyric).folder_id = finalParentId;
        }
        await db.put(storeName, updated);
        if (!isOnline()) {
          await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
        } else {
          await db.delete('pending_saves', id);
        }

        // If restoring a folder, restore its child charts and lyrics that were trashed with it
        if (type === 'folder') {
          const allCharts = await db.getAll('charts');
          const allLyrics = await db.getAll('lyrics');
          const prefix = `__TRASH__:${id}:`;

          for (const c of allCharts) {
            if (c.title.startsWith(prefix)) {
              const restoredChildTitle = c.title.slice(prefix.length);
              const restoredChild = { ...c, title: restoredChildTitle, folder_id: id, updated_at };
              await db.put('charts', restoredChild);
              if (isOnline()) {
                await supabase.from('charts').update({ title: restoredChildTitle, folder_id: id, updated_at }).eq('id', c.id);
              } else {
                await db.put('pending_saves', { id: c.id, type: 'chart', data: restoredChild, action: 'upsert' });
              }
            }
          }

          for (const l of allLyrics) {
            if (l.title.startsWith(prefix)) {
              const restoredChildTitle = l.title.slice(prefix.length);
              const restoredChild = { ...l, title: restoredChildTitle, folder_id: id, updated_at };
              await db.put('lyrics', restoredChild);
              if (isOnline()) {
                await supabase.from('lyrics').update({ title: restoredChildTitle, folder_id: id, updated_at }).eq('id', l.id);
              } else {
                await db.put('pending_saves', { id: l.id, type: 'lyrics', data: restoredChild, action: 'upsert' });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Storage] DB restoreFromTrash error:', err);
    }
  }
}

export async function listTrash(bandId?: string | null) {
  const isGuestMode = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);

  const folderMap = new Map<string, Folder>();
  const itemMap = new Map<string, { id: string; title: string; updated_at: string; type: 'chart' | 'lyrics'; created_by?: string; band_id?: string | null }>();

  const matchesBand = (itemBandId: string | null | undefined) => {
    if (isGuestMode) return true;
    if (!activeBandId) return false;
    if (activeBandId === DEFAULT_CHURCH_BAND_ID) return itemBandId === activeBandId || !itemBandId;
    return itemBandId === activeBandId;
  };

  // 1. Read from local IndexedDB first
  if (dbPromise) {
    try {
      const db = await dbPromise;
      const allFolders = await db.getAll('folders');
      const allCharts = await db.getAll('charts');
      const allLyrics = await db.getAll('lyrics');

      allFolders.filter((f) => f.name && f.name.startsWith('__TRASH__:') && matchesBand(f.band_id)).forEach(f => folderMap.set(f.id, f));
      allCharts.filter((c) => c.title && c.title.startsWith('__TRASH__:') && matchesBand(c.band_id)).forEach(c => itemMap.set(c.id, { id: c.id, title: c.title, updated_at: c.updated_at, type: 'chart', created_by: c.created_by, band_id: c.band_id }));
      allLyrics.filter((l) => l.title && l.title.startsWith('__TRASH__:') && matchesBand(l.band_id)).forEach(l => itemMap.set(l.id, { id: l.id, title: l.title, updated_at: l.updated_at, type: 'lyrics', created_by: l.created_by, band_id: l.band_id }));
    } catch (err) {
      console.warn('[Storage] listTrash IndexedDB read error:', err);
    }
  }

  // 2. If online, fetch from Supabase and merge
  if (isOnline() && !isGuestMode && activeBandId) {
    try {
      const bandFilter = getBandFilter(activeBandId);
      let fQ = supabase.from('folders').select('*').like('name', '__TRASH__:%').order('updated_at', { ascending: false });
      let cQ = supabase.from('charts').select('id, title, updated_at, created_by, band_id').like('title', '__TRASH__:%').order('updated_at', { ascending: false });
      let lQ = supabase.from('lyrics').select('id, title, updated_at, created_by, band_id').like('title', '__TRASH__:%').order('updated_at', { ascending: false });
      if (bandFilter) {
        fQ = fQ.or(bandFilter);
        cQ = cQ.or(bandFilter);
        lQ = lQ.or(bandFilter);
      }
      const [foldersRes, chartsRes, lyricsRes] = await Promise.all([fQ, cQ, lQ]);

      if (foldersRes.data) {
        foldersRes.data.forEach((f: Folder) => folderMap.set(f.id, f));
      }
      if (chartsRes.data) {
        chartsRes.data.forEach((c: { id: string; title: string; updated_at: string; created_by: string; band_id?: string | null }) => itemMap.set(c.id, { id: c.id, title: c.title, updated_at: c.updated_at, type: 'chart', created_by: c.created_by, band_id: c.band_id }));
      }
      if (lyricsRes.data) {
        lyricsRes.data.forEach((l: { id: string; title: string; updated_at: string; created_by: string; band_id?: string | null }) => itemMap.set(l.id, { id: l.id, title: l.title, updated_at: l.updated_at, type: 'lyrics', created_by: l.created_by, band_id: l.band_id }));
      }
    } catch (err) {
      console.warn('[Storage] listTrash Supabase read error:', err);
    }
  }

  // 3. Exclude any items that are pending deletion
  if (dbPromise) {
    try {
      const db = await dbPromise;
      const pending = await db.getAll('pending_saves');
      const pendingDeletes = new Set(pending.filter(p => p.action === 'delete').map(p => p.id));
      for (const id of pendingDeletes) {
        folderMap.delete(id);
        itemMap.delete(id);
      }
    } catch {}
  }

  const folders = Array.from(folderMap.values()).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const charts = Array.from(itemMap.values()).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return { folders, charts };
}

export async function isDescendantFolder(
  folderId: string,
  potentialAncestorId: string,
  foldersList?: Folder[]
): Promise<boolean> {
  if (folderId === potentialAncestorId) return true;
  const allFolders = foldersList || (await getAllFolders());
  const folderMap = new Map(allFolders.map(f => [f.id, f]));
  let curr = folderMap.get(folderId);
  const visited = new Set<string>();
  while (curr && curr.parent_id) {
    if (visited.has(curr.id)) break;
    visited.add(curr.id);
    if (curr.parent_id === potentialAncestorId) return true;
    curr = folderMap.get(curr.parent_id);
  }
  return false;
}

export async function moveEntry(id: string, type: 'folder' | 'chart' | 'lyrics', newParentId: string | null): Promise<boolean> {
  if (type === 'folder') {
    if (newParentId === id) {
      console.warn('[Storage] Cannot move folder into itself');
      return false;
    }
    if (newParentId !== null) {
      const isDescendant = await isDescendantFolder(newParentId, id);
      if (isDescendant) {
        console.warn('[Storage] Cannot move folder into its own child/descendant');
        return false;
      }
    }
  }

  const updated_at = new Date().toISOString();
  const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';

  if (isOnline()) {
    try {
      if (type === 'folder') {
        const { error } = await supabase.from('folders').update({ parent_id: newParentId, updated_at }).eq('id', id);
        if (error) console.warn('[Storage] Supabase moveEntry error:', error);
      } else if (type === 'chart') {
        const { error } = await supabase.from('charts').update({ folder_id: newParentId, updated_at }).eq('id', id);
        if (error) console.warn('[Storage] Supabase moveEntry error:', error);
      } else if (type === 'lyrics') {
        const { error } = await supabase.from('lyrics').update({ folder_id: newParentId, updated_at }).eq('id', id);
        if (error) console.warn('[Storage] Supabase moveEntry error:', error);
      }
    } catch (err) {
      console.warn('[Storage] Supabase moveEntry error:', err);
    }
  }

  if (dbPromise) {
    try {
      const db = await dbPromise;
      if (db) {
        const existing = await db.get(storeName, id);
        if (existing) {
          const updated = { ...existing, updated_at };
          if (type === 'folder') (updated as Folder).parent_id = newParentId;
          else (updated as Chart | Lyric).folder_id = newParentId;
          await db.put(storeName, updated);
          if (!isOnline()) {
            await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
          }
        }
      }
    } catch (err) {
      console.warn('[Storage] DB moveEntry error:', err);
    }
  }
  return true;
}

export async function saveChart(chart: Chart) {
  chart.updated_at = new Date().toISOString();
  if (!chart.band_id && typeof window !== 'undefined') {
    const activeBandId = localStorage.getItem('chord-grid-band-id');
    if (activeBandId) {
      chart.band_id = activeBandId;
    }
  }
  try {
    await cacheChart(chart);
  } catch (err) {
    console.warn('[Storage] Error caching chart locally:', err);
  }
  let savedOnline = false;
  if (isOnline()) {
    try {
      const { custom_text, type, ...dbPayload } = chart as Chart & { custom_text?: unknown; type?: unknown };
      const { error } = await supabase.from('charts').upsert(dbPayload);
      if (!error) {
        savedOnline = true;
      }
    } catch (err) {
      console.warn('[Storage] Network error saving chart, queueing pending save:', err);
    }
  }
  if (savedOnline && dbPromise) {
    try {
      const db = await dbPromise;
      if (db) {
        await db.delete('pending_saves', chart.id);
      }
    } catch {}
  }
  if (!savedOnline && dbPromise) {
    try {
      const db = await dbPromise;
      if (db) {
        await db.put('pending_saves', { id: chart.id, type: 'chart', data: chart, action: 'upsert' });
      }
    } catch (err) {
      console.warn('[Storage] Failed to queue pending save:', err);
    }
  }
  return { savedOnline };
}

export async function readChart(id: string, bypassCache = false): Promise<Chart | null> {
  // 1. Try local IndexedDB cache first for instant (<5ms) rendering
  if (!bypassCache && dbPromise) {
    try {
      const db = await dbPromise;
      const cached = await db.get('charts', id);
      if (cached) {
        // Fetch in background to update cache if online
        if (isOnline()) {
          (async () => {
            try {
              if (db) {
                const pending = await db.get('pending_saves', id);
                if (pending) return; // Do not overwrite with stale cloud data if we have pending local changes
              }
              const { data } = await supabase.from('charts').select('*').eq('id', id).single();
              if (data) {
                const cloudTime = new Date(data.updated_at || 0).getTime();
                const cachedTime = new Date(cached.updated_at || 0).getTime();
                if (cloudTime > cachedTime) {
                  await cacheChart(data);
                }
              }
            } catch {}
          })();
        }
        return cached;
      }
    } catch {}
  }

  // 2. If not cached locally or bypassCache, fetch online with timeout
  if (isOnline()) {
    try {
      const fetchPromise = supabase.from('charts').select('*').eq('id', id).single();
      const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
      if (!error && data) {
        await cacheChart(data);
        return data;
      }
    } catch (err) {
      console.warn('[Storage] Network error reading chart, falling back to local storage:', err);
    }
  }
  if (dbPromise) {
    const db = await dbPromise;
    return (await db.get('charts', id)) || null;
  }
  return null;
}

export async function getRecentCharts(limit: number = 5, bandId?: string | null) {
  const isGuestMode = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);

  if (isOnline() && !isGuestMode && activeBandId) {
    const bandFilter = getBandFilter(activeBandId);
    let cQ = supabase
      .from('charts')
      .select('id, title, updated_at, is_bookmarked, band_id')
      .not('title', 'like', '__TRASH__:%')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (bandFilter) cQ = cQ.or(bandFilter);
    const { data } = await cQ;
    return data || [];
  } else if (dbPromise) {
    const db = await dbPromise;
    const allCharts = await db.getAll('charts');
    return allCharts
      .filter(c => !c.title.startsWith('__TRASH__:') && (isGuestMode || (activeBandId && (activeBandId === DEFAULT_CHURCH_BAND_ID ? (c.band_id === activeBandId || !c.band_id) : c.band_id === activeBandId))))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);
  }
  return [];
}

export async function getAllFolders(kind?: 'chart' | 'lyrics', bandId?: string | null): Promise<Folder[]> {
  const isGuestMode = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);

  if (isOnline() && !isGuestMode && activeBandId) {
    const bandFilter = getBandFilter(activeBandId);
    let query = supabase.from('folders').select('*').not('name', 'like', '__TRASH__:%');
    if (bandFilter) query = query.or(bandFilter);
    if (kind) query = query.eq('kind', kind);
    const { data } = await query;
    return data || [];
  } else if (dbPromise) {
    const db = await dbPromise;
    const all = await db.getAll('folders');
    const filtered = all.filter(f => !f.name.startsWith('__TRASH__:') && (isGuestMode || (activeBandId && (activeBandId === DEFAULT_CHURCH_BAND_ID ? (f.band_id === activeBandId || !f.band_id) : f.band_id === activeBandId))));
    if (kind) return filtered.filter(f => f.kind === kind);
    return filtered;
  }
  return [];
}

export async function getFolder(id: string): Promise<Folder | null> {
  if (isOnline()) {
    const { data } = await supabase.from('folders').select('*').eq('id', id).single();
    if (data && dbPromise) {
      const db = await dbPromise;
      await db.put('folders', data);
    }
    return data;
  } else if (dbPromise) {
    const db = await dbPromise;
    return (await db.get('folders', id)) || null;
  }
  return null;
}

export async function getBookmarks(bandId?: string | null) {
  const isGuestMode = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);

  if (isOnline() && !isGuestMode && activeBandId) {
    const bandFilter = getBandFilter(activeBandId);
    let cQ = supabase.from('charts').select('id, title, updated_at, is_bookmarked, band_id').eq('is_bookmarked', true).not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false });
    let lQ = supabase.from('lyrics').select('id, title, updated_at, is_bookmarked, band_id').eq('is_bookmarked', true).not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false });
    if (bandFilter) {
      cQ = cQ.or(bandFilter);
      lQ = lQ.or(bandFilter);
    }
    const [{ data: charts }, { data: lyrics }] = await Promise.all([cQ, lQ]);
    const all = [
      ...(charts || []).map((c) => ({ ...c, type: 'chart' as const })),
      ...(lyrics || []).map((l) => ({ ...l, type: 'lyrics' as const }))
    ];
    return all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } else if (dbPromise) {
    const db = await dbPromise;
    const charts = await db.getAll('charts');
    const lyrics = await db.getAll('lyrics');
    const all = [
      ...charts.filter(c => c.is_bookmarked && !c.title.startsWith('__TRASH__:') && (isGuestMode || (activeBandId && (activeBandId === DEFAULT_CHURCH_BAND_ID ? (c.band_id === activeBandId || !c.band_id) : c.band_id === activeBandId)))).map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at, is_bookmarked: c.is_bookmarked, type: 'chart' as const })),
      ...lyrics.filter(l => l.is_bookmarked && !l.title.startsWith('__TRASH__:') && (isGuestMode || (activeBandId && (activeBandId === DEFAULT_CHURCH_BAND_ID ? (l.band_id === activeBandId || !l.band_id) : l.band_id === activeBandId)))).map((l) => ({ id: l.id, title: l.title, updated_at: l.updated_at, is_bookmarked: l.is_bookmarked, type: 'lyrics' as const }))
    ];
    return all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }
  return [];
}

export async function searchAll(
  query: string,
  rootFolderId: string | null = null,
  kind: 'chart' | 'lyrics' = 'chart',
  includeFolders: boolean = true,
  bandId?: string | null
) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];

  const isGuestMode = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);

  const folders = await getAllFolders(undefined, activeBandId);
  const folderMap = new Map(folders.map(f => [f.id, f]));

  // Helper to build location path
  const buildPath = (parentId: string | null) => {
    const parts: string[] = [];
    let curr = parentId ? folderMap.get(parentId) : null;
    while (curr) {
      parts.unshift(curr.name);
      curr = curr.parent_id ? folderMap.get(curr.parent_id) : null;
    }
    return parts.length > 0 ? 'Home / ' + parts.join(' / ') : 'Home';
  };

  const isChildOfRoot = (parentId: string | null): boolean => {
    if (!rootFolderId) return true;
    let curr = parentId ? folderMap.get(parentId) : null;
    while (curr) {
      if (curr.id === rootFolderId) return true;
      curr = curr.parent_id ? folderMap.get(curr.parent_id) : null;
    }
    return false;
  };

  // 1. Matching Folders (1st Priority, sorted alphabetically A-Z)
  type SearchFolderResult = Folder & {
    title: string;
    type: 'folder';
    path: string;
  };
  let matchingFolders: SearchFolderResult[] = [];
  if (includeFolders) {
    let rawFolders: Folder[] = [];
    if (isOnline() && !isGuestMode && activeBandId) {
      try {
        const bandFilter = getBandFilter(activeBandId);
        let fQ = supabase
          .from('folders')
          .select('*')
          .eq('kind', kind)
          .ilike('name', `%${query.trim()}%`)
          .not('name', 'like', '__TRASH__:%');
        if (bandFilter) fQ = fQ.or(bandFilter);
        const { data } = await fQ;
        rawFolders = data || [];
      } catch (err) {
        console.warn('[Storage] Search folders online failed:', err);
      }
    }
    if (rawFolders.length === 0 && dbPromise) {
      try {
        const db = await dbPromise;
        const allDbFolders = await db.getAll('folders');
        rawFolders = allDbFolders.filter(
          f => f.kind === kind && !f.name.startsWith('__TRASH__:') && (isGuestMode || (activeBandId && (activeBandId === DEFAULT_CHURCH_BAND_ID ? (f.band_id === activeBandId || !f.band_id) : f.band_id === activeBandId))) && f.name.toLowerCase().includes(cleanQuery)
        );
      } catch {}
    }

    matchingFolders = rawFolders
      .filter(f => isChildOfRoot(f.parent_id) || (rootFolderId && f.id === rootFolderId))
      .map(f => ({
        ...f,
        title: f.name,
        name: f.name,
        type: 'folder' as const,
        path: buildPath(f.parent_id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  // 2. Matching Charts & Files (sorted alphabetically A-Z)
  let rawItems: Array<{
    id: string;
    title: string;
    updated_at: string;
    folder_id: string | null;
    is_bookmarked?: boolean;
    created_by: string;
    band_id?: string | null;
  }> = [];
  if (isOnline() && !isGuestMode && activeBandId) {
    try {
      const tableName = kind === 'chart' ? 'charts' : 'lyrics';
      const bandFilter = getBandFilter(activeBandId);
      let iQ = supabase
        .from(tableName)
        .select('id, title, updated_at, folder_id, is_bookmarked, created_by, band_id')
        .ilike('title', `%${query.trim()}%`)
        .not('title', 'like', '__TRASH__:%');
      if (bandFilter) iQ = iQ.or(bandFilter);
      const { data } = await iQ;
      rawItems = data || [];
    } catch (err) {
      console.warn('[Storage] Search items online failed:', err);
    }
  }
  if (rawItems.length === 0 && dbPromise) {
    try {
      const db = await dbPromise;
      const allDbItems = await db.getAll(kind === 'chart' ? 'charts' : 'lyrics');
      rawItems = allDbItems.filter(
        c => !c.title.startsWith('__TRASH__:') && (isGuestMode || (activeBandId && (activeBandId === DEFAULT_CHURCH_BAND_ID ? (c.band_id === activeBandId || !c.band_id) : c.band_id === activeBandId))) && c.title.toLowerCase().includes(cleanQuery)
      );
    } catch {}
  }

  const matchingItems = rawItems
    .filter(c => isChildOfRoot(c.folder_id) || (rootFolderId && c.folder_id === rootFolderId))
    .map(c => ({
      ...c,
      name: c.title,
      type: kind,
      path: buildPath(c.folder_id),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

  // Folders first (1st Priority, A-Z), then charts/files (A-Z)
  return [...matchingFolders, ...matchingItems];
}

export async function exportChart(id: string) {
  const chart = await readChart(id);
  if (!chart) return;
  const blob = new Blob([JSON.stringify(chart, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${chart.title || 'export'}.barchart`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importChart(file: File, targetFolderId: string | null) {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        if (!content || !content.trim()) {
          reject(new Error('File is empty'));
          return;
        }
        let chartData: Partial<Chart>;
        try {
          chartData = JSON.parse(content) as Partial<Chart>;
        } catch (parseErr) {
          reject(new Error('Invalid JSON format in imported chart'));
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        const activeBandId = typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null;
        const newChart: Chart = {
          title: 'Untitled Chart',
          tempo: null,
          time_sig: '4/4',
          lines: [],
          semitone_offset: 0,
          prefer_flats: false,
          ...chartData,
          id: crypto.randomUUID(), // always assign a new id
          folder_id: targetFolderId,
          created_by: user?.id || '',
          band_id: activeBandId || null,
          updated_at: new Date().toISOString(),
        };
        await saveChart(newChart);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

export async function saveLyrics(lyrics: Lyric) {
  lyrics.updated_at = new Date().toISOString();
  if (!lyrics.band_id && typeof window !== 'undefined') {
    const activeBandId = localStorage.getItem('chord-grid-band-id');
    if (activeBandId) {
      lyrics.band_id = activeBandId;
    }
  }
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.put('lyrics', lyrics);
    } catch {}
  }
  let savedOnline = false;
  if (isOnline()) {
    try {
      const { type, ...dbPayload } = lyrics;
      const { error } = await supabase.from('lyrics').upsert(dbPayload);
      if (!error) {
        savedOnline = true;
      } else {
        console.warn('[Storage] Failed to save lyrics online, queuing offline:', error);
      }
    } catch (err) {
      console.warn('[Storage] Network error saving lyrics:', err);
    }
  }
  if (!savedOnline && dbPromise) {
    const db = await dbPromise;
    await db.put('pending_saves', { id: lyrics.id, type: 'lyrics', data: lyrics, action: 'upsert' });
  }
}

export async function readLyrics(id: string): Promise<any | null> {
  if (isOnline()) {
    const { data } = await supabase.from('lyrics').select('*').eq('id', id).single();
    if (data && dbPromise) {
      const db = await dbPromise;
      await db.put('lyrics', data);
    }
    return data;
  } else if (dbPromise) {
    const db = await dbPromise;
    return (await db.get('lyrics', id)) || null;
  }
  return null;
}

export async function exportLyrics(id: string) {
  const lyrics = await readLyrics(id);
  if (!lyrics) return;
  const blob = new Blob([lyrics.body || ''], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${lyrics.title || 'export'}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importLyrics(file: File, targetFolderId: string | null) {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        
        let title = file.name.replace(/\.(txt|lyrics)$/i, '');
        let body = content;

        // basic heuristic to see if it's JSON from a previous lyrics export
        try {
          const parsed = JSON.parse(content);
          if (parsed.title && parsed.body) {
            title = parsed.title;
            body = parsed.body;
          }
        } catch(e) { }

        const { data: { user } } = await supabase.auth.getUser();
        const activeBandId = typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null;
        const newLyrics = {
          id: crypto.randomUUID(),
          title,
          body,
          folder_id: targetFolderId,
          created_by: user?.id || '',
          band_id: activeBandId || null,
          updated_at: new Date().toISOString(),
        };
        await saveLyrics(newLyrics);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

export async function syncAllOffline(bandId?: string | null): Promise<{ chartsCount: number; lyricsCount: number; foldersCount: number }> {
  if (!isOnline()) {
    return { chartsCount: 0, lyricsCount: 0, foldersCount: 0 };
  }
  const isGuestMode = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
  if (isGuestMode) {
    return { chartsCount: 0, lyricsCount: 0, foldersCount: 0 };
  }
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);
  if (!activeBandId) {
    return { chartsCount: 0, lyricsCount: 0, foldersCount: 0 };
  }
  const bandFilter = getBandFilter(activeBandId);
  if (!bandFilter) {
    return { chartsCount: 0, lyricsCount: 0, foldersCount: 0 };
  }
  try {
    const [{ data: charts }, { data: lyrics }, { data: folders }] = await Promise.all([
      supabase.from('charts').select('*').or(bandFilter).not('title', 'like', '__TRASH__:%'),
      supabase.from('lyrics').select('*').or(bandFilter).not('title', 'like', '__TRASH__:%'),
      supabase.from('folders').select('*').or(bandFilter).not('name', 'like', '__TRASH__:%'),
    ]);

    if (dbPromise) {
      const db = await dbPromise;
      if (charts && charts.length > 0) {
        const tx = db.transaction('charts', 'readwrite');
        for (const c of charts) {
          await tx.store.put(c);
        }
        await tx.done;
      }
      if (lyrics && lyrics.length > 0) {
        const tx = db.transaction('lyrics', 'readwrite');
        for (const l of lyrics) {
          await tx.store.put(l);
        }
        await tx.done;
      }
      if (folders && folders.length > 0) {
        const tx = db.transaction('folders', 'readwrite');
        for (const f of folders) {
          await tx.store.put(f);
        }
        await tx.done;
      }
    }
    return {
      chartsCount: charts?.length || 0,
      lyricsCount: lyrics?.length || 0,
      foldersCount: folders?.length || 0,
    };
  } catch (err) {
    console.warn('[Sync] Full offline sync failed:', err);
    return { chartsCount: 0, lyricsCount: 0, foldersCount: 0 };
  }
}


