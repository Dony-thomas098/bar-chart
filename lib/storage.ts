import { supabase } from './supabase';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type Chart = {
  id: string;
  title: string;
  tempo: number | null;
  time_sig: string | null;
  lines: any;
  semitone_offset: number;
  prefer_flats: boolean;
  folder_id: string | null;
  created_by: string;
  updated_at: string;
  is_bookmarked?: boolean;
};

export type Folder = {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  updated_at: string;
  kind: 'chart' | 'lyrics';
};

interface BarChartDB extends DBSchema {
  charts: {
    key: string;
    value: Chart;
  };
  lyrics: {
    key: string;
    value: any; 
  };
  folders: {
    key: string;
    value: Folder;
  };
  pending_saves: {
    key: string;
    value: { id: string; type: 'chart' | 'folder' | 'lyrics'; data: any; action: 'upsert' | 'delete' };
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
  });
}

export const getDBPromise = () => dbPromise;

// Utility to check network and guest mode state
const isOnline = () => {
  if (typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true') {
    return false;
  }
  return typeof navigator !== 'undefined' && navigator.onLine;
};

// Flush pending saves when coming back online or logging in
export async function flushPendingSaves() {
  if (!dbPromise || !isOnline()) return;
  try {
    const db = await dbPromise;
    const pending = await db.getAll('pending_saves');
    for (const item of pending) {
      if (item.action === 'upsert') {
        if (item.type === 'chart') {
          const { custom_text, type, ...dbPayload } = item.data;
          await supabase.from('charts').upsert(dbPayload);
        } else if (item.type === 'lyrics') {
          const { type, ...dbPayload } = item.data;
          await supabase.from('lyrics').upsert(dbPayload);
        } else if (item.type === 'folder') {
          await supabase.from('folders').upsert(item.data);
        }
      } else if (item.action === 'delete') {
        if (item.type === 'chart') {
          await supabase.from('setlist_items').delete().eq('item_id', item.id);
          await supabase.from('charts').delete().eq('id', item.id);
        } else if (item.type === 'lyrics') {
          await supabase.from('setlist_items').delete().eq('item_id', item.id);
          await supabase.from('lyrics').delete().eq('id', item.id);
        } else if (item.type === 'folder') {
          await supabase.from('folders').delete().eq('id', item.id);
        }
      }
      await db.delete('pending_saves', item.id);
    }
  } catch (err) {
    console.warn('[Storage] flushPendingSaves error:', err);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', flushPendingSaves);
}

// Cache updating utilities — exported so OfflineSyncContext can use them for realtime event handling
export async function cacheChart(chart: Chart) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('charts', chart);
}

export async function cacheFolder(folder: Folder) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('folders', folder);
}

export async function cacheLyric(lyric: any) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('lyrics', lyric);
}

export async function deleteFromCache(id: string, store: 'charts' | 'lyrics' | 'folders') {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete(store, id);
}

// --- Data Access Layer ---

export async function listFolderFromCache(folderId: string | null, kind: 'chart' | 'lyrics' = 'chart') {
  if (!dbPromise) return { folders: [], charts: [] };
  const db = await dbPromise;
  const allFolders = await db.getAll('folders');
  const allItems = await db.getAll(kind === 'chart' ? 'charts' : 'lyrics');
  const folders = allFolders
    .filter((f) => f.parent_id === folderId && f.kind === kind && !f.name.startsWith('__TRASH__:'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const items = allItems.filter((c) => c.folder_id === folderId && !c.title.startsWith('__TRASH__:'));
  return {
    folders,
    charts: items.map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at, is_bookmarked: c.is_bookmarked, type: kind })),
  };
}

export async function listFolder(folderId: string | null, kind: 'chart' | 'lyrics' = 'chart') {
  if (isOnline()) {
    try {
      let foldersQuery = supabase.from('folders').select('*').eq('kind', kind).order('name', { ascending: true }).not('name', 'like', '__TRASH__:%');
      if (folderId) {
        foldersQuery = foldersQuery.eq('parent_id', folderId);
      } else {
        foldersQuery = foldersQuery.is('parent_id', null);
      }

      let itemsQuery;
      if (kind === 'chart') {
        itemsQuery = supabase.from('charts').select('id, title, updated_at, is_bookmarked').order('updated_at', { ascending: false }).not('title', 'like', '__TRASH__:%');
      } else {
        itemsQuery = supabase.from('lyrics').select('id, title, updated_at, is_bookmarked').order('updated_at', { ascending: false }).not('title', 'like', '__TRASH__:%');
      }
      
      if (folderId) {
        itemsQuery = itemsQuery.eq('folder_id', folderId);
      } else {
        itemsQuery = itemsQuery.is('folder_id', null);
      }

      // Race against a 3s timeout so tabs never hang indefinitely on slow connection
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 3000));
      const [foldersRes, itemsRes] = await Promise.race([
        Promise.all([foldersQuery, itemsQuery]),
        timeoutPromise,
      ]);

      if (foldersRes.error) throw foldersRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const onlineFolders: Folder[] = foldersRes.data || [];
      const onlineItems = itemsRes.data || [];

      // Also get local cached items
      const local = await listFolderFromCache(folderId, kind);

      const isGuestMode = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';

      const folderMap = new Map<string, Folder>();
      const itemMap = new Map<string, any>();

      if (isGuestMode) {
        local.folders.forEach(f => folderMap.set(f.id, f));
        onlineFolders.forEach(f => folderMap.set(f.id, f));
        local.charts.forEach(c => itemMap.set(c.id, c));
        onlineItems.forEach(c => itemMap.set(c.id, { ...c, type: kind }));
      } else {
        // Authenticated mode: online is authoritative.
        // Include pending offline saves if any
        if (dbPromise) {
          try {
            const db = await dbPromise;
            const pending = await db.getAll('pending_saves');
            const pendingUpserts = new Set(pending.filter(p => p.action === 'upsert').map(p => p.id));
            local.charts.filter(c => pendingUpserts.has(c.id)).forEach(c => itemMap.set(c.id, c));
            local.folders.filter(f => pendingUpserts.has(f.id)).forEach(f => folderMap.set(f.id, f));
          } catch {}
        }
        onlineFolders.forEach(f => folderMap.set(f.id, f));
        onlineItems.forEach(c => itemMap.set(c.id, { ...c, type: kind }));
      }

      // Update local cache with latest online data
      if (dbPromise) {
        try {
          const db = await dbPromise;
          if (onlineFolders.length > 0) {
            const tx = db.transaction('folders', 'readwrite');
            onlineFolders.forEach((f) => tx.store.put(f));
          }
          // Remove any stale local charts in this folder that are no longer online
          const onlineIds = new Set(onlineItems.map(i => i.id));
          const storeName = kind === 'chart' ? 'charts' : 'lyrics';
          for (const localItem of local.charts) {
            if (!onlineIds.has(localItem.id) && !localItem.title.startsWith('__TRASH__:')) {
              await db.delete(storeName, localItem.id);
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
      return listFolderFromCache(folderId, kind);
    }
  } else {
    return listFolderFromCache(folderId, kind);
  }
}

export async function createFolder(parentId: string | null, name: string, kind: 'chart' | 'lyrics' = 'chart') {
  const { data: { user } } = await supabase.auth.getUser();
  const folder: Folder = {
    id: crypto.randomUUID(),
    name,
    parent_id: parentId,
    created_by: user?.id || '',
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

        for (const fId of folderIdsToDelete) {
          await db.delete('folders', fId);
        }
        for (const c of allCharts) {
          if (c.folder_id && folderIdsToDelete.has(c.folder_id)) {
            await db.delete('charts', c.id);
          }
        }
        for (const l of allLyrics) {
          if (l.folder_id && folderIdsToDelete.has(l.folder_id)) {
            await db.delete('lyrics', l.id);
          }
        }
      }

      if (!isOnline()) {
        await db.put('pending_saves', { id, type, data: null, action: 'delete' });
      } else {
        await db.delete('pending_saves', id);
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
  let existingItem: any = null;

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
          existingName = (existing as any).title;
          existingParentId = (existing as any).folder_id;
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
      const updated: any = existing ? { ...existing, updated_at } : { id, updated_at };
      if (type === 'folder') {
        updated.name = trashedName;
        updated.parent_id = null;
      } else {
        updated.title = trashedName;
        updated.folder_id = null;
      }
      await db.put(storeName, updated);
      if (!isOnline()) {
        await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
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

  let itemData: any = null;

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
      const existing = (await db.get(storeName, id)) || itemData;
      const updated: any = existing ? { ...existing, updated_at } : { id, updated_at };
      if (type === 'folder') {
        updated.name = originalName;
        updated.parent_id = finalParentId;
      } else {
        updated.title = originalName;
        updated.folder_id = finalParentId;
      }
      await db.put(storeName, updated);
      if (!isOnline()) {
        await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
      } else {
        await db.delete('pending_saves', id);
      }
    } catch (err) {
      console.warn('[Storage] DB restoreFromTrash error:', err);
    }
  }
}

export async function listTrash() {
  const folderMap = new Map<string, Folder>();
  const itemMap = new Map<string, { id: string; title: string; updated_at: string; type: 'chart' | 'lyrics'; created_by?: string }>();

  // 1. Read from local IndexedDB first
  if (dbPromise) {
    try {
      const db = await dbPromise;
      const allFolders = await db.getAll('folders');
      const allCharts = await db.getAll('charts');
      const allLyrics = await db.getAll('lyrics');

      allFolders.filter((f) => f.name && f.name.startsWith('__TRASH__:')).forEach(f => folderMap.set(f.id, f));
      allCharts.filter((c) => c.title && c.title.startsWith('__TRASH__:')).forEach(c => itemMap.set(c.id, { id: c.id, title: c.title, updated_at: c.updated_at, type: 'chart', created_by: c.created_by }));
      allLyrics.filter((l) => l.title && l.title.startsWith('__TRASH__:')).forEach(l => itemMap.set(l.id, { id: l.id, title: l.title, updated_at: l.updated_at, type: 'lyrics', created_by: l.created_by }));
    } catch (err) {
      console.warn('[Storage] listTrash IndexedDB read error:', err);
    }
  }

  // 2. If online, fetch from Supabase and merge
  if (isOnline()) {
    try {
      const [foldersRes, chartsRes, lyricsRes] = await Promise.all([
        supabase.from('folders').select('*').like('name', '__TRASH__:%').order('updated_at', { ascending: false }),
        supabase.from('charts').select('id, title, updated_at, created_by').like('title', '__TRASH__:%').order('updated_at', { ascending: false }),
        supabase.from('lyrics').select('id, title, updated_at, created_by').like('title', '__TRASH__:%').order('updated_at', { ascending: false }),
      ]);

      if (foldersRes.data) {
        foldersRes.data.forEach((f: Folder) => folderMap.set(f.id, f));
      }
      if (chartsRes.data) {
        chartsRes.data.forEach((c: any) => itemMap.set(c.id, { id: c.id, title: c.title, updated_at: c.updated_at, type: 'chart', created_by: c.created_by }));
      }
      if (lyricsRes.data) {
        lyricsRes.data.forEach((l: any) => itemMap.set(l.id, { id: l.id, title: l.title, updated_at: l.updated_at, type: 'lyrics', created_by: l.created_by }));
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

export async function moveEntry(id: string, type: 'folder' | 'chart' | 'lyrics', newParentId: string | null) {
  const updated_at = new Date().toISOString();
  const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';

  if (isOnline()) {
    try {
      if (type === 'folder') {
        await supabase.from('folders').update({ parent_id: newParentId, updated_at }).eq('id', id);
      } else if (type === 'chart') {
        await supabase.from('charts').update({ folder_id: newParentId, updated_at }).eq('id', id);
      } else if (type === 'lyrics') {
        await supabase.from('lyrics').update({ folder_id: newParentId, updated_at }).eq('id', id);
      }
    } catch (err) {
      console.warn('[Storage] Supabase moveEntry error:', err);
    }
  }

  if (dbPromise) {
    try {
      const db = await dbPromise;
      const existing = await db.get(storeName, id);
      if (existing) {
        const updated: any = { ...existing, updated_at };
        if (type === 'folder') updated.parent_id = newParentId;
        else updated.folder_id = newParentId;
        await db.put(storeName, updated);
        if (!isOnline()) {
          await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
        }
      }
    } catch (err) {
      console.warn('[Storage] DB moveEntry error:', err);
    }
  }
}

export async function saveChart(chart: Chart) {
  chart.updated_at = new Date().toISOString();
  await cacheChart(chart);
  let savedOnline = false;
  if (isOnline()) {
    try {
      const { custom_text, type, ...dbPayload } = chart as any;
      const { error } = await supabase.from('charts').upsert(dbPayload);
      if (!error) {
        savedOnline = true;
      }
    } catch (err) {
      console.warn('[Storage] Network error saving chart, queueing pending save:', err);
    }
  }
  if (!savedOnline && dbPromise) {
    const db = await dbPromise;
    await db.put('pending_saves', { id: chart.id, type: 'chart', data: chart, action: 'upsert' });
  }
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
              const { data } = await supabase.from('charts').select('*').eq('id', id).single();
              if (data) await cacheChart(data);
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

export async function getRecentCharts(limit: number = 5) {
  if (isOnline()) {
    const { data } = await supabase.from('charts').select('id, title, updated_at, is_bookmarked').not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false }).limit(limit);
    return data || [];
  } else if (dbPromise) {
    const db = await dbPromise;
    const allCharts = await db.getAll('charts');
    return allCharts.filter(c => !c.title.startsWith('__TRASH__:'))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, limit);
  }
  return [];
}

export async function getAllFolders(kind?: 'chart' | 'lyrics'): Promise<Folder[]> {
  if (isOnline()) {
    let query = supabase.from('folders').select('*');
    if (kind) query = query.eq('kind', kind);
    const { data } = await query;
    return data || [];
  } else if (dbPromise) {
    const db = await dbPromise;
    const all = await db.getAll('folders');
    if (kind) return all.filter(f => f.kind === kind);
    return all;
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

export async function getBookmarks() {
  if (isOnline()) {
    const [{ data: charts }, { data: lyrics }] = await Promise.all([
      supabase.from('charts').select('id, title, updated_at, is_bookmarked').eq('is_bookmarked', true).not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false }),
      supabase.from('lyrics').select('id, title, updated_at, is_bookmarked').eq('is_bookmarked', true).not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false })
    ]);
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
      ...charts.filter(c => c.is_bookmarked && !c.title.startsWith('__TRASH__:')).map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at, is_bookmarked: c.is_bookmarked, type: 'chart' as const })),
      ...lyrics.filter(l => l.is_bookmarked && !l.title.startsWith('__TRASH__:')).map((l) => ({ id: l.id, title: l.title, updated_at: l.updated_at, is_bookmarked: l.is_bookmarked, type: 'lyrics' as const }))
    ];
    return all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }
  return [];
}

export async function searchAll(
  query: string,
  rootFolderId: string | null = null,
  kind: 'chart' | 'lyrics' = 'chart',
  includeFolders: boolean = true
) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];

  const folders = await getAllFolders();
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
  let matchingFolders: any[] = [];
  if (includeFolders) {
    let rawFolders: Folder[] = [];
    if (isOnline()) {
      try {
        const { data } = await supabase
          .from('folders')
          .select('*')
          .eq('kind', kind)
          .ilike('name', `%${query.trim()}%`)
          .not('name', 'like', '__TRASH__:%');
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
          f => f.kind === kind && !f.name.startsWith('__TRASH__:') && f.name.toLowerCase().includes(cleanQuery)
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
  let rawItems: any[] = [];
  if (isOnline()) {
    try {
      const tableName = kind === 'chart' ? 'charts' : 'lyrics';
      const { data } = await supabase
        .from(tableName)
        .select('id, title, updated_at, folder_id, is_bookmarked')
        .ilike('title', `%${query.trim()}%`)
        .not('title', 'like', '__TRASH__:%');
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
        c => !c.title.startsWith('__TRASH__:') && c.title.toLowerCase().includes(cleanQuery)
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
        let chartData: any;
        try {
          chartData = JSON.parse(content);
        } catch (parseErr) {
          reject(new Error('Invalid JSON format in imported chart'));
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        const newChart: Chart = {
          ...chartData,
          id: crypto.randomUUID(), // always assign a new id
          folder_id: targetFolderId,
          created_by: user?.id || '',
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

export async function saveLyrics(lyrics: any) {
  lyrics.updated_at = new Date().toISOString();
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
        const newLyrics = {
          id: crypto.randomUUID(),
          title,
          body,
          folder_id: targetFolderId,
          created_by: user?.id || '',
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

export async function syncAllOffline(): Promise<{ chartsCount: number; lyricsCount: number; foldersCount: number }> {
  if (!isOnline()) {
    return { chartsCount: 0, lyricsCount: 0, foldersCount: 0 };
  }
  try {
    const [{ data: charts }, { data: lyrics }, { data: folders }] = await Promise.all([
      supabase.from('charts').select('*').not('title', 'like', '__TRASH__:%'),
      supabase.from('lyrics').select('*').not('title', 'like', '__TRASH__:%'),
      supabase.from('folders').select('*').not('name', 'like', '__TRASH__:%'),
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

export function getPendingSavesCount() {
  if (!dbPromise) return Promise.resolve(0);
  return dbPromise.then((db) => db.count('pending_saves'));
}

