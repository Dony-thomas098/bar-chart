'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import {
  listSetlistItems, addSetlistItems, updateSetlistItem,
  removeSetlistItem, reorderSetlistItems, updateSetlist,
  type SetlistItem, type Setlist,
} from '@/lib/setlists';
import { readChart, readLyrics } from '@/lib/storage';
import { ChartRenderer } from '@/components/ChartRenderer';
import { SongPickerModal, type PickedItem } from '@/components/SongPickerModal';
import { transposeChart } from '@/lib/transpose';
import { ChartData } from '@/lib/chart-types';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Plus, Printer, Play, MoreVertical, Trash2, Pencil,
  FileText, Music, Music2, CornerLeftUp, X, Minus,
} from 'lucide-react';

// ─── Transpose Stepper Modal ──────────────────────────────────────────────────

function TransposeModal({ item, onClose, onSave }: {
  item: SetlistItem;
  onClose: () => void;
  onSave: (val: number | null) => void;
}) {
  const [val, setVal] = useState<number>(item.transpose_override ?? 0);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xs bg-white/65 dark:bg-[#18181d]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-2xl shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Setlist Transpose</h3>
          <p className="text-[10px] text-text-secondary mt-0.5">
            Applied only within this setlist — doesn't change the original chart.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setVal(v => v - 1)}
            className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-text-primary hover:bg-white/10 transition-all"
          >
            <Minus size={18} />
          </button>
          <span className="text-3xl font-bold text-text-primary w-16 text-center">
            {val > 0 ? `+${val}` : val}
          </span>
          <button
            onClick={() => setVal(v => v + 1)}
            className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-text-primary hover:bg-white/10 transition-all"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onSave(null)}
            className="flex-1 py-2 text-xs font-bold text-text-secondary bg-surface-raised border border-border rounded-xl hover:text-white transition-all"
          >
            Reset
          </button>
          <button
            onClick={() => onSave(val)}
            className="flex-1 py-2 text-xs font-bold text-white bg-accent-gradient rounded-xl hover:brightness-110 transition-all"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Note Edit Modal ──────────────────────────────────────────────────────────

function NoteModal({ item, onClose, onSave }: {
  item: SetlistItem;
  onClose: () => void;
  onSave: (note: string | null) => void;
}) {
  const [note, setNote] = useState(item.notes ?? '');

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white/65 dark:bg-[#18181d]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-2xl shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-5 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-text-primary">Item Note</h3>
        <textarea
          autoFocus
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Capo 2, slow count-in, skip intro…"
          className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-text-primary placeholder-text-secondary outline-none focus:border-accent-solid transition-all resize-none"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs font-bold text-text-secondary bg-surface-raised border border-border rounded-xl hover:text-white transition-all">
            Cancel
          </button>
          <button
            onClick={() => onSave(note.trim() || null)}
            className="flex-1 py-2 text-xs font-bold text-white bg-accent-gradient rounded-xl hover:brightness-110 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

function SortableItemRow({
  item, idx, onSetTranspose, onSetNote, onRemove,
}: {
  item: SetlistItem;
  idx: number;
  onSetTranspose: (item: SetlistItem) => void;
  onSetNote: (item: SetlistItem) => void;
  onRemove: (item: SetlistItem) => void;
}) {
  const { profile } = useAuth();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 50 : (menuOpen ? 40 : 'auto'),
  };

  return (
    <div ref={setNodeRef} style={style} className={`glass-card p-3.5 sm:p-4 flex items-center gap-3 group relative select-none ${menuOpen ? 'z-40' : ''}`}>
      {/* Drag handle - Admin only */}
      {profile?.profession === 'admin' ? (
        <div {...attributes} {...listeners} className="p-1 -ml-1 text-text-muted cursor-grab active:cursor-grabbing hover:text-text-primary touch-none shrink-0" title="Drag to reorder (Admin only)">
          <GripVertical size={18} />
        </div>
      ) : (
        <div className="w-1.5 shrink-0" />
      )}

      {/* Album / Item Cover Thumb */}
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-orange-500 shadow-sm border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
        {item.item_type === 'chart'
          ? <FileText size={18} className="text-white" />
          : <Music size={18} className="text-white" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary truncate">{item.title || 'Untitled'}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span className="text-[10px] text-text-muted font-medium">
            {item.item_type === 'chart' ? 'Chord Chart' : 'Lyrics Sheet'}
          </span>
          {item.transpose_override !== null && item.transpose_override !== undefined && item.transpose_override !== 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/20">
              {item.transpose_override > 0 ? `+${item.transpose_override}` : item.transpose_override}
            </span>
          )}
          {item.notes && (
            <span className="text-[10px] italic text-text-secondary truncate max-w-[180px]">
              • {item.notes}
            </span>
          )}
        </div>
      </div>

      {/* Menu - Only visible to admin users */}
      {profile?.profession === 'admin' && (
        <div className="relative shrink-0">
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setDropUp(window.innerHeight - rect.bottom < 200);
              setMenuOpen(v => !v);
            }}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className={`absolute right-0 ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'} z-50 min-w-[180px] bg-white/95 dark:bg-[#1c1c22]/95 backdrop-blur-2xl saturate-[180%] border border-slate-200/80 dark:border-white/15 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)] py-1.5 animate-in fade-in zoom-in-95 duration-150`}>
              {item.item_type === 'chart' && (
                <button
                  onClick={() => { setMenuOpen(false); onSetTranspose(item); }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-text-primary hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                >
                  <Pencil size={13} className="text-orange-500" /> Set transpose
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); onSetNote(item); }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-text-primary hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                <Pencil size={13} /> {item.notes ? 'Edit note' : 'Add note'}
              </button>
              <div className="h-px bg-border mx-2 my-1" />
              <button
                onClick={() => { setMenuOpen(false); onRemove(item); }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 size={13} /> Remove
              </button>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}

// ─── Print View ───────────────────────────────────────────────────────────────

function PrintView({ setlist, items, charts, lyricsMap }: {
  setlist: Setlist;
  items: SetlistItem[];
  charts: Record<string, ChartData>;
  lyricsMap: Record<string, any>;
}) {
  return (
    <div className="print-only text-black w-full max-w-none m-0 p-0">
      {/* Cover page */}
      <div className="page-break-after w-[min(100%,60rem)] mx-auto px-12 pt-20 pb-16 text-black block">
        <h1 className="text-4xl sm:text-5xl font-extrabold print:!font-bold tracking-normal text-black mb-3">{setlist.name}</h1>
        {setlist.date && (
          <p className="text-xl font-medium text-slate-700 print:text-black mb-2">
            {new Date(setlist.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        {setlist.notes && <p className="text-base text-slate-600 print:text-black mt-2 mb-8 italic">{setlist.notes}</p>}

        <div className="mt-12 border-t-2 border-slate-300 print:border-black pt-8">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700 print:text-black mb-6">Setlist Contents ({items.length} Songs)</p>
          <ol className="space-y-4">
            {items.map((item, i) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 pb-3 border-b border-slate-200 print:border-slate-300 text-lg print:text-base text-black">
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="w-8 shrink-0 text-right font-mono font-bold text-slate-700 print:text-black">{i + 1}.</span>
                  <span className="font-bold tracking-tight print:!tracking-normal text-black text-xl print:text-lg">{item.title}</span>
                  <span className="text-xs font-semibold text-slate-600 print:text-slate-800 uppercase tracking-wider px-2 py-0.5 bg-slate-100 print:bg-transparent rounded">
                    {item.item_type === 'chart' ? 'Chart' : 'Lyrics'}
                  </span>
                </div>
                <div className="flex items-baseline gap-4 shrink-0 text-sm">
                  {item.transpose_override !== null && item.transpose_override !== undefined && item.item_type === 'chart' && item.transpose_override !== 0 && (
                    <span className="font-mono font-bold text-slate-700 print:text-black">
                      Transpose: {item.transpose_override > 0 ? '+' : ''}{item.transpose_override}
                    </span>
                  )}
                  {item.notes && (
                    <span className="italic text-slate-600 print:text-black max-w-xs truncate">
                      {item.notes}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* One page per item */}
      {items.map((item) => {
        if (item.item_type === 'chart') {
          let chart = charts[item.item_id];
          if (!chart) return null;
          if (item.transpose_override) {
            chart = transposeChart(chart, item.transpose_override, chart.prefer_flats);
          }
          return (
            <div key={item.id} className="page-break print:break-before-page w-full max-w-none overflow-visible pt-4">
              {item.notes && (
                <div className="px-8 pt-4 pb-2 text-base font-semibold italic text-black border-b border-slate-200 print:border-slate-300 w-[min(100%,64rem)] mx-auto">
                  Note: {item.notes}
                </div>
              )}
              <ChartRenderer chart={chart} />
            </div>
          );
        } else {
          const lyr = lyricsMap[item.item_id];
          if (!lyr) return null;
          return (
            <div key={item.id} className="page-break print:break-before-page w-full px-8 py-12 print:py-16 text-black flex flex-col items-center text-center">
              <h1 className="text-4xl sm:text-5xl print:!text-4xl font-extrabold print:!font-bold mb-8 text-black text-center tracking-tight print:!tracking-normal">{lyr.title}</h1>
              {item.notes && <p className="text-lg font-semibold italic text-slate-700 print:text-black mb-6 text-center">Note: {item.notes}</p>}
              <pre className="font-sans print:font-sans text-2xl print:!text-2xl leading-[1.8] print:!leading-[1.8] whitespace-pre-wrap text-black text-center w-full max-w-4xl mx-auto font-medium print:!font-medium">{lyr.body}</pre>
            </div>
          );
        }
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SetlistDetailPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const setlistId = (params?.id as string) || searchParams?.get('id') || '';

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [items, setItems] = useState<SetlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Print data
  const [printCharts, setPrintCharts] = useState<Record<string, ChartData>>({});
  const [printLyrics, setPrintLyricsMap] = useState<Record<string, any>>({});

  // Modals
  const [showPicker, setShowPicker] = useState(false);
  const [transposeTarget, setTransposeTarget] = useState<SetlistItem | null>(null);
  const [noteTarget, setNoteTarget] = useState<SetlistItem | null>(null);

  // Inline edit
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [editingDate, setEditingDate] = useState(false);
  const [dateVal, setDateVal] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: sl } = await supabase.from('setlists').select('*').eq('id', setlistId).single();
      if (!sl) { router.push('/setlists'); return; }
      setSetlist(sl);
      setNameVal(sl.name);
      setDateVal(sl.date || '');
      const loaded = await listSetlistItems(setlistId);
      setItems(loaded);
    } finally {
      setLoading(false);
    }
  }, [setlistId, router]);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  useEffect(() => {
    const handleRefresh = () => {
      load();
    };
    window.addEventListener('refresh-setlists', handleRefresh);
    return () => window.removeEventListener('refresh-setlists', handleRefresh);
  }, [load]);

  // Pre-load print data whenever items change
  useEffect(() => {
    const chartItems = items.filter(i => i.item_type === 'chart');
    const lyricsItems = items.filter(i => i.item_type === 'lyrics');
    chartItems.forEach(async item => {
      const chart = await readChart(item.item_id);
      if (chart) setPrintCharts(prev => ({ ...prev, [item.item_id]: chart as ChartData }));
    });
    lyricsItems.forEach(async item => {
      const lyr = await readLyrics(item.item_id);
      if (lyr) setPrintLyricsMap(prev => ({ ...prev, [item.item_id]: lyr }));
    });
  }, [items]);


  // Drag and drop - Admin only
  const handleDragEnd = async (event: any) => {
    if (profile?.profession !== 'admin') return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex(i => i.id === active.id);
    const newIdx = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx).map((item, pos) => ({ ...item, position: pos }));
    setItems(reordered);
    await reorderSetlistItems(reordered.map(i => ({ id: i.id, position: i.position })));
  };

  const handleAddSongs = async (picked: PickedItem[]) => {
    const startPos = items.length;
    const added = await addSetlistItems(
      setlistId,
      picked.map(p => ({ item_type: p.item_type, item_id: p.item_id })),
      startPos,
    );
    // Enrich with titles
    const enriched: SetlistItem[] = added.map((a: any) => {
      const source = picked.find(p => p.item_id === a.item_id);
      return { ...a, title: source?.title || 'Unknown' };
    });
    setItems(prev => [...prev, ...enriched]);
  };

  const handleTransposeSave = async (val: number | null) => {
    if (!transposeTarget) return;
    await updateSetlistItem(transposeTarget.id, { transpose_override: val });
    setItems(prev => prev.map(i => i.id === transposeTarget.id ? { ...i, transpose_override: val } : i));
    setTransposeTarget(null);
  };

  const handleNoteSave = async (note: string | null) => {
    if (!noteTarget) return;
    await updateSetlistItem(noteTarget.id, { notes: note });
    setItems(prev => prev.map(i => i.id === noteTarget.id ? { ...i, notes: note } : i));
    setNoteTarget(null);
  };

  const handleRemove = async (item: SetlistItem) => {
    setItems(prev => prev.filter(i => i.id !== item.id));
    try {
      await removeSetlistItem(item.id, setlistId);
    } catch (err) {
      console.error('Failed to remove item from setlist:', err);
      const loaded = await listSetlistItems(setlistId);
      setItems(loaded);
    }
  };

  const handleNameSave = async () => {
    if (!nameVal.trim() || !setlist) return;
    await updateSetlist(setlist.id, { name: nameVal.trim() });
    setSetlist(s => s ? { ...s, name: nameVal.trim() } : s);
    setEditingName(false);
  };

  const handleDateSave = async () => {
    if (!setlist) return;
    await updateSetlist(setlist.id, { date: dateVal || null });
    setSetlist(s => s ? { ...s, date: dateVal || null } : s);
    setEditingDate(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!setlist) return null;

  return (
    <div className="min-h-screen flex flex-col print:min-h-0 print:block w-full print:w-full print:m-0 print:p-0">
      <div className="no-print print:!hidden">
        <Header />
      </div>

      <main className="flex-1 w-full pb-36 no-print print:!hidden">
        {/* Full-width Warm Orange-Coral Mesh Gradient Hero Header */}
        <div className="hero-mesh-gradient pt-6 pb-20 px-4 sm:px-6 shadow-md relative">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              onClick={() => router.push('/setlists')}
              className="hidden lg:flex w-10 h-10 rounded-full bg-white/30 hover:bg-white/40 active:scale-95 backdrop-blur-md border border-white/40 text-white items-center justify-center transition-all shadow-sm cursor-pointer"
              title="Back to Setlists"
            >
              <CornerLeftUp size={18} />
            </button>
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight drop-shadow-sm truncate max-w-xs sm:max-w-md text-center flex-1">
              {setlist.name}
            </h1>
            <div className="hidden lg:block w-10" />
          </div>
        </div>

        <div className="max-w-xl mx-auto px-4 sm:px-6">
          {/* Overlapping Large Frosted Glass Cover Card */}
          <div className="glass-card -mt-14 p-6 flex flex-col items-center text-center shadow-popover relative z-10">
            {/* Custom Cover Art Graphic */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-tr from-indigo-950 via-purple-900 to-orange-500 p-1 shadow-md border border-white/40 flex flex-col items-center justify-center text-white mb-4 relative overflow-hidden group">
              <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center mb-1.5 shadow-inner">
                <Music2 size={24} className="text-orange-300 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-extrabold tracking-tight text-white/90">Chordly</span>
              <span className="text-[9px] text-white/70 font-semibold truncate max-w-[90%]">{setlist.name}</span>
            </div>

            {/* Set Name (Editable) */}
            {editingName ? (
              <input
                autoFocus
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                className="text-xl sm:text-2xl font-bold text-text-primary bg-transparent border-b-2 border-orange-500 outline-none text-center w-full max-w-xs"
              />
            ) : (
              <h2
                onClick={() => setEditingName(true)}
                className="text-xl sm:text-2xl font-extrabold text-text-primary cursor-pointer hover:text-orange-500 transition-colors tracking-tight"
                title="Click to edit name"
              >
                {setlist.name}
              </h2>
            )}

            {/* Subtitle / Date */}
            {editingDate ? (
              <input
                autoFocus
                type="date"
                value={dateVal}
                onChange={e => setDateVal(e.target.value)}
                onBlur={handleDateSave}
                className="text-xs text-text-muted bg-transparent border-b border-border outline-none mt-1 text-center"
              />
            ) : (
              <p
                onClick={() => setEditingDate(true)}
                className="text-xs text-text-muted mt-1 font-medium cursor-pointer hover:text-orange-500 transition-colors"
                title="Click to edit date"
              >
                {setlist.date
                  ? new Date(setlist.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                  : '+ Add date'}
              </p>
            )}

            {/* Two Action Buttons: Play (Dark Gradient Pill) and Detail (Glass Pill) */}
            <div className="flex items-center gap-3 mt-5 w-full max-w-xs justify-center">
              <button
                disabled={items.length === 0}
                onClick={() => {
                  sessionStorage.setItem(`setlist-leader-${setlistId}`, '1');
                  router.push(`/setlists/${setlistId}/perform`);
                }}
                className="flex-1 py-2.5 px-5 btn-dark-pill flex items-center justify-center gap-2 text-sm disabled:opacity-40 cursor-pointer"
              >
                <Play size={15} className="fill-current" /> Play
              </button>

              <button
                onClick={() => setShowPicker(true)}
                className="flex-1 py-2.5 px-5 btn-glass-pill flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <Plus size={15} /> Add Songs
              </button>
            </div>
          </div>

          {/* "Songs in this Set" Section Heading */}
          <div className="flex items-center justify-between mt-8 mb-4 px-1">
            <h3 className="text-base font-extrabold text-text-primary tracking-tight">
              Songs in this Set
            </h3>
            <span className="text-xs text-text-muted font-bold">
              {items.length} {items.length === 1 ? 'song' : 'songs'}
            </span>
          </div>

          {/* Items list */}
          {items.length === 0 ? (
            <div className="glass-card p-10 text-center text-text-muted flex flex-col items-center">
              <div className="w-14 h-14 icon-well flex items-center justify-center mb-3">
                <Music size={24} className="text-orange-500/60" />
              </div>
              <p className="font-bold text-sm text-text-primary">No songs in this setlist yet</p>
              <p className="text-xs text-text-muted mt-1 max-w-xs mb-4">
                Tap "Add Songs" above to select chord charts and lyrics sheets for this performance.
              </p>
              <button
                onClick={() => setShowPicker(true)}
                className="px-5 py-2.5 rounded-full btn-gradient-orange text-xs font-bold shadow-glow flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} /> Add Songs
              </button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2.5">
                  {items.map((item, idx) => (
                    <SortableItemRow
                      key={item.id}
                      item={item}
                      idx={idx}
                      onSetTranspose={setTransposeTarget}
                      onSetNote={setNoteTarget}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Toolbar secondary actions */}
          {items.length > 0 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => window.print()}
                className="py-2 px-4 glass-pill text-xs font-bold text-text-secondary hover:text-text-primary flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} /> Print Setlist
              </button>
            </div>
          )}
        </div>

        {/* Floating Dark Gradient Pill "View Set / Perform" pinned above bottom nav */}
        {items.length > 0 && (
          <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center pointer-events-none px-4">
            <button
              onClick={() => {
                sessionStorage.setItem(`setlist-leader-${setlistId}`, '1');
                router.push(`/setlists/${setlistId}/perform`);
              }}
              className="pointer-events-auto px-8 py-3 btn-dark-pill shadow-2xl flex items-center gap-2 text-sm font-extrabold cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <Play size={16} className="fill-current" /> View Set
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      {showPicker && (
        <SongPickerModal
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
          onAdd={handleAddSongs}
          existingIds={items.map(i => i.item_id)}
        />
      )}
      {transposeTarget && (
        <TransposeModal
          item={transposeTarget}
          onClose={() => setTransposeTarget(null)}
          onSave={handleTransposeSave}
        />
      )}
      {noteTarget && (
        <NoteModal
          item={noteTarget}
          onClose={() => setNoteTarget(null)}
          onSave={handleNoteSave}
        />
      )}

      {/* Hidden print view */}
      <PrintView
        setlist={setlist}
        items={items}
        charts={printCharts}
        lyricsMap={printLyrics}
      />
    </div>
  );
}

