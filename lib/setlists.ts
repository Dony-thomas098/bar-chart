import { supabase } from './supabase';
import { DEFAULT_CHURCH_BAND_ID, type Line } from './storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Setlist = {
  id: string;
  name: string;
  date: string | null;
  notes: string | null;
  created_by: string;
  updated_at: string;
  band_id?: string | null;
};

export type SetlistItem = {
  id: string;
  setlist_id: string;
  item_type: 'chart' | 'lyrics';
  item_id: string;
  position: number;
  transpose_override: number | null;
  notes: string | null;
  lines_override?: Line[] | null;
  band_id?: string | null;
  // display fields populated by join
  title?: string;
  is_deleted?: boolean;
};

// ─── Setlist CRUD ─────────────────────────────────────────────────────────────

export async function listSetlists(bandId?: string | null): Promise<Setlist[]> {
  const isGuestMode = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);

  if (isGuestMode || !activeBandId) {
    return [];
  }

  const bandFilter = activeBandId === DEFAULT_CHURCH_BAND_ID
    ? `band_id.eq.${activeBandId},band_id.is.null`
    : `band_id.eq.${activeBandId}`;

  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .or(bandFilter)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createSetlist(
  name: string,
  date?: string | null,
  notes?: string | null,
  bandId?: string | null,
): Promise<Setlist> {
  const { data: { user } } = await supabase.auth.getUser();
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);
  const { data, error } = await supabase
    .from('setlists')
    .insert({
      name,
      date: date || null,
      notes: notes || null,
      created_by: user?.id,
      band_id: activeBandId || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSetlist(
  id: string,
  patch: Partial<Pick<Setlist, 'name' | 'date' | 'notes'>>,
): Promise<void> {
  const { error } = await supabase
    .from('setlists')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSetlist(id: string): Promise<void> {
  const { error } = await supabase.from('setlists').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateSetlist(id: string): Promise<Setlist> {
  const { data: { user } } = await supabase.auth.getUser();
  const activeBandId = typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null;

  // Fetch original
  const { data: original, error: fetchErr } = await supabase
    .from('setlists')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchErr || !original) throw fetchErr || new Error('Not found');

  // Fetch items
  const { data: items } = await supabase
    .from('setlist_items')
    .select('*')
    .eq('setlist_id', id)
    .order('position');

  // Insert new setlist
  const { data: newSetlist, error: insErr } = await supabase
    .from('setlists')
    .insert({
      name: `${original.name} (copy)`,
      date: original.date,
      notes: original.notes,
      created_by: user?.id,
      band_id: original.band_id || activeBandId || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (insErr || !newSetlist) throw insErr || new Error('Insert failed');

  // Duplicate items
  if (items && items.length > 0) {
    const newItems = items.map((item: SetlistItem) => ({
      setlist_id: newSetlist.id,
      item_type: item.item_type,
      item_id: item.item_id,
      position: item.position,
      transpose_override: item.transpose_override,
      notes: item.notes,
      lines_override: item.lines_override || null,
      band_id: item.band_id || newSetlist.band_id || activeBandId || null,
    }));
    await supabase.from('setlist_items').insert(newItems);
  }

  return newSetlist;
}

// ─── Setlist Items CRUD ───────────────────────────────────────────────────────

export async function listSetlistItems(setlistId: string): Promise<SetlistItem[]> {
  const { data: rawItems, error } = await supabase
    .from('setlist_items')
    .select('*')
    .eq('setlist_id', setlistId)
    .order('position');
  if (error) throw error;
  if (!rawItems || rawItems.length === 0) return [];

  // Enrich with titles from charts + lyrics
  const chartIds = rawItems.filter(i => i.item_type === 'chart').map(i => i.item_id);
  const lyricsIds = rawItems.filter(i => i.item_type === 'lyrics').map(i => i.item_id);

  const titleMap: Record<string, string> = {};

  if (chartIds.length > 0) {
    const { data: charts } = await supabase
      .from('charts')
      .select('id, title')
      .in('id', chartIds)
      .not('title', 'like', '__TRASH__:%');
    (charts || []).forEach(c => { titleMap[c.id] = c.title; });
  }
  if (lyricsIds.length > 0) {
    const { data: lyrics } = await supabase
      .from('lyrics')
      .select('id, title')
      .in('id', lyricsIds)
      .not('title', 'like', '__TRASH__:%');
    (lyrics || []).forEach(l => { titleMap[l.id] = l.title; });
  }

  return rawItems.map(item => ({
    ...item,
    title: titleMap[item.item_id] || 'Unknown (Item Removed)',
    is_deleted: !titleMap[item.item_id],
  }));
}

export async function addSetlistItems(
  setlistId: string,
  items: Array<{ item_type: 'chart' | 'lyrics'; item_id: string }>,
  startPosition: number,
  bandId?: string | null,
): Promise<SetlistItem[]> {
  const activeBandId = bandId !== undefined ? bandId : (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null);
  const rows = items.map((item, i) => ({
    setlist_id: setlistId,
    item_type: item.item_type,
    item_id: item.item_id,
    position: startPosition + i,
    band_id: activeBandId || null,
  }));
  const { data, error } = await supabase
    .from('setlist_items')
    .insert(rows)
    .select();
  if (error) throw error;
  
  // Bump updated_at on parent setlist
  await supabase
    .from('setlists')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', setlistId);

  return data || [];
}

export async function updateSetlistItem(
  id: string,
  patch: Partial<Pick<SetlistItem, 'transpose_override' | 'notes' | 'lines_override'>>,
): Promise<void> {
  const { error } = await supabase
    .from('setlist_items')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function removeSetlistItem(id: string, setlistId: string): Promise<void> {
  const { error } = await supabase.from('setlist_items').delete().eq('id', id);
  if (error) throw error;
  await supabase
    .from('setlists')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', setlistId);
}

export async function reorderSetlistItems(
  items: Array<{ id: string; position: number }>,
): Promise<void> {
  // Supabase doesn't support bulk update in one shot cleanly, so we use individual updates
  const rows = items.map(({ id, position }) => ({ id, position }));
  // Fire individual updates in parallel and inspect results
  const results = await Promise.all(
    rows.map(({ id, position }) =>
      supabase.from('setlist_items').update({ position }).eq('id', id),
    ),
  );

  for (const { error } of results) {
    if (error) {
      console.error('[Setlists] Failed to reorder setlist items:', error);
      throw new Error(`Failed to update item position: ${error.message}`);
    }
  }
}
