import { supabase } from './supabase';
import { getDBPromise } from './storage';

export type Lyric = {
  id: string;
  title: string;
  body: string;
  content?: string;
  folder_id: string | null;
  created_by: string;
  updated_at: string;
  is_bookmarked?: boolean;
  type?: string;
  band_id?: string | null;
};

const isOnline = () => {
  if (typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true') {
    return false;
  }
  return typeof navigator !== 'undefined' && navigator.onLine;
};

async function cacheLyric(lyric: Lyric) {
  const dbPromise = getDBPromise();
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('lyrics', lyric);
}

export async function saveLyrics(lyric: Lyric) {
  lyric.updated_at = new Date().toISOString();
  if (!lyric.band_id && typeof window !== 'undefined') {
    const activeBandId = localStorage.getItem('chord-grid-band-id') || '9ca7fef8-a0e0-4587-a329-0444c4b27f70';
    if (activeBandId) {
      lyric.band_id = activeBandId;
    }
  }
  let savedOnline = false;
  if (isOnline()) {
    try {
      const { type, ...dbPayload } = lyric;
      const { error } = await supabase.from('lyrics').upsert(dbPayload);
      if (!error) {
        savedOnline = true;
      }
    } catch (err) {
      console.warn('[Lyrics] Network error saving lyrics, queueing pending save:', err);
    }
  }
  if (!savedOnline) {
    const dbPromise = getDBPromise();
    if (dbPromise) {
      const db = await dbPromise;
      await db.put('pending_saves', { id: lyric.id, type: 'lyrics', data: lyric, action: 'upsert' });
    }
  }
  await cacheLyric(lyric);
}

export async function readLyrics(id: string): Promise<Lyric | null> {
  if (!id || id === 'edit') return null;
  // 1. Try local cache first
  const dbPromise = getDBPromise();
  if (dbPromise) {
    try {
      const db = await dbPromise;
      const cached = await db.get('lyrics', id);
      if (cached) {
        if (isOnline()) {
          (async () => {
            try {
              const { data } = await supabase.from('lyrics').select('*').eq('id', id).maybeSingle();
              if (data) await cacheLyric(data);
            } catch {}
          })();
        }
        return cached;
      }
    } catch {}
  }

  // 2. Fetch from cloud with timeout
  if (isOnline()) {
    try {
      // Ensure active auth session is restored before querying RLS-protected tables
      try {
        await supabase.auth.getSession();
      } catch {}

      let sessionUser: any = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        sessionUser = sessionData?.session?.user || null;
        if (!sessionUser) {
          const { data: userData } = await supabase.auth.getUser();
          sessionUser = userData?.user || null;
        }
      } catch {}

      const fetchPromise = supabase.from('lyrics').select('*').eq('id', id).maybeSingle();
      const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
      if (!error && data) {
        await cacheLyric(data);
        return data;
      }

      // If query failed or returned null and user is logged in, sync band & retry (fixes cold-mount RLS isolation on mobile)
      if ((!data || error) && sessionUser) {
        try {
          const { syncBandForUser } = await import('./band');
          await syncBandForUser(sessionUser);
          const { data: retryData, error: retryError } = await supabase
            .from('lyrics')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (!retryError && retryData) {
            await cacheLyric(retryData);
            return retryData;
          }
        } catch (syncErr) {
          console.warn('[Lyrics] Retrying lyrics read after band sync failed:', syncErr);
        }
      }
    } catch (err) {
      console.warn('[Lyrics] Network error reading lyrics, falling back to local storage:', err);
    }
  }
  if (dbPromise) {
    const db = await dbPromise;
    return (await db.get('lyrics', id)) || null;
  }
  return null;
}

export async function getRecentLyrics(limit: number = 5) {
  if (isOnline()) {
    const { data } = await supabase.from('lyrics').select('id, title, updated_at, is_bookmarked').not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false }).limit(limit);
    return data || [];
  } else {
    const dbPromise = getDBPromise();
    if (dbPromise) {
      const db = await dbPromise;
      const allLyrics = await db.getAll('lyrics');
      return allLyrics.filter(c => !c.title.startsWith('__TRASH__:'))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, limit);
    }
  }
  return [];
}

export async function exportLyrics(id: string) {
  const lyric = await readLyrics(id);
  if (!lyric) return;
  const blob = new Blob([JSON.stringify(lyric, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${lyric.title || 'export'}.lyrics`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importLyrics(file: File, targetFolderId: string | null) {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        if (!content || !content.trim()) {
          reject(new Error('File is empty'));
          return;
        }
        let lyricsData: Partial<Lyric>;
        try {
          lyricsData = JSON.parse(content) as Partial<Lyric>;
        } catch (parseErr) {
          reject(new Error('Invalid JSON format in imported lyrics'));
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        const newLyric: Lyric = {
          title: 'Untitled Lyric',
          body: '',
          ...lyricsData,
          id: crypto.randomUUID(),
          folder_id: targetFolderId,
          created_by: user?.id || '',
          updated_at: new Date().toISOString(),
        };
        await saveLyrics(newLyric);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
