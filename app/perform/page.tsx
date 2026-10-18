'use client';

import React, { useState, useEffect } from 'react';
import { searchAll } from '@/lib/storage';
import { Header } from '@/components/Header';
import { GlassCard, PillButton, IconButton } from '@/components/ui/primitives';
import {
  Play, Search, Plus, Trash2, CornerLeftUp, GripVertical, X,
  Save, BookOpen, ChevronRight, Music2, FolderOpen, Radio,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { listSetlistItems } from '@/lib/setlists';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedSetlist {
  id: string;
  name: string;
  chartIds: string[];
  savedAt: string;
}

interface QueueItem {
  id: string;
  title: string;
  meta: string;
}

const SETLISTS_KEY = 'chord-grid-perform-setlists';

function loadSavedSetlists(): SavedSetlist[] {
  try {
    return JSON.parse(localStorage.getItem(SETLISTS_KEY) || '[]');
  } catch { return []; }
}

function persistSetlists(lists: SavedSetlist[]) {
  localStorage.setItem(SETLISTS_KEY, JSON.stringify(lists));
}

function generateCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableItem({ id, idx, item, onRemove }: { id: string; idx: number; item: QueueItem; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.7 : 1 }}
      className="flex items-center justify-between p-3.5 sm:p-4 bg-white/70 dark:bg-white/[0.06] border border-glass rounded-2xl shadow-sm hover:shadow-glass transition-all group"
    >
      <div className="flex items-center space-x-3 overflow-hidden flex-1">
        <div {...attributes} {...listeners} className="p-1.5 -ml-1 text-text-muted cursor-grab active:cursor-grabbing hover:text-text-primary shrink-0 touch-none">
          <GripVertical size={18} />
        </div>
        <div className="w-8 h-8 bg-btn-dark rounded-full flex items-center justify-center shadow-btn-dark shrink-0">
          <span className="text-white font-bold text-xs">{idx + 1}</span>
        </div>
        <div className="truncate">
          <p className="text-sm font-bold text-text-primary truncate tracking-tight">{item.title}</p>
          <p className="text-[11px] font-medium text-text-secondary">{item.meta}</p>
        </div>
      </div>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(id); }}
        className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors z-10 relative shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ─── Page Content ─────────────────────────────────────────────────────────────

function PerformContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const incomingSetlistId = searchParams.get('setlistId');

  // Queue of { id, title, meta }
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [setlistName, setSetlistName] = useState('My Setlist');
  const [savedSetlists, setSavedSetlists] = useState<SavedSetlist[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Join session
  const [joinCode, setJoinCode] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setSavedSetlists(loadSavedSetlists());
  }, []);

  // Auto-populate when launched from Setlists menu (?setlistId=...)
  useEffect(() => {
    if (!incomingSetlistId) return;
    let isCancelled = false;
    (async () => {
      try {
        const { data: setlistData } = await supabase
          .from('setlists')
          .select('name')
          .eq('id', incomingSetlistId)
          .single();
        if (!isCancelled && setlistData?.name) {
          setSetlistName(setlistData.name);
        }

        const items = await listSetlistItems(incomingSetlistId);
        if (!isCancelled && items && items.length > 0) {
          const queueItems: QueueItem[] = items.map(item => ({
            id: item.item_id,
            title: item.title || 'Untitled',
            meta: item.item_type === 'lyrics' ? 'Lyrics' : (item.transpose_override ? `Transpose: ${item.transpose_override > 0 ? '+' : ''}${item.transpose_override}` : ''),
          }));
          setQueue(queueItems);
        }
      } catch (err) {
        console.error('Failed to load incoming setlist into perform queue', err);
      }
    })();
    return () => { isCancelled = true; };
  }, [incomingSetlistId]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    const t = setTimeout(async () => {
      const res = await searchAll(searchQuery);
      if (!searchQuery.trim()) return;
      setSearchResults(res.filter(r => r.type === 'chart'));
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const addChart = (chart: any) => {
    if (queue.some(q => q.id === chart.id)) return;
    setQueue(prev => [...prev, {
      id: chart.id,
      title: chart.title || 'Untitled',
      meta: chart.time_sig ? `${chart.time_sig} · t=${chart.tempo}` : '',
    }]);
  };

  const removeChart = (id: string) => setQueue(prev => prev.filter(q => q.id !== id));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = queue.findIndex(q => q.id === active.id);
      const newIdx = queue.findIndex(q => q.id === over.id);
      setQueue(prev => arrayMove(prev, oldIdx, newIdx));
    }
  };

  const handleSaveSetlist = () => {
    if (!queue.length) return;
    const newList: SavedSetlist = {
      id: crypto.randomUUID(),
      name: setlistName || 'Untitled Setlist',
      chartIds: queue.map(q => q.id),
      savedAt: new Date().toISOString(),
    };
    const updated = [newList, ...savedSetlists];
    setSavedSetlists(updated);
    persistSetlists(updated);
  };

  const handleLoadSetlist = async (sl: SavedSetlist) => {
    const items: QueueItem[] = sl.chartIds.map(id => ({ id, title: 'Loading...', meta: '' }));
    setQueue(items);
    setSetlistName(sl.name);
    setShowSaved(false);

    const results = await searchAll('');
    const byId = Object.fromEntries(results.map((r: any) => [r.id, r]));
    setQueue(sl.chartIds.map(id => ({
      id,
      title: byId[id]?.title || 'Unknown',
      meta: byId[id]?.time_sig ? `${byId[id].time_sig} · t=${byId[id].tempo}` : '',
    })));
  };

  const handleDeleteSaved = (id: string) => {
    const updated = savedSetlists.filter(s => s.id !== id);
    setSavedSetlists(updated);
    persistSetlists(updated);
  };

  const handleStartSession = () => {
    if (!queue.length) return;
    const code = generateCode();
    sessionStorage.setItem(
      `perform-leader-${code}`,
      JSON.stringify({ chartIds: queue.map(q => q.id), sessionName: setlistName }),
    );
    try {
      localStorage.setItem(
        `perform-active-session-${code}`,
        JSON.stringify({ chartIds: queue.map(q => q.id), sessionName: setlistName, createdAt: Date.now() }),
      );
    } catch {}
    router.push(`/perform/${code}`);
  };

  const handleJoin = () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length === 6) router.push(`/perform/${c}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-4 pt-[max(env(safe-area-inset-top,1.5rem),1.5rem)] pb-36">

        {/* ── Join Live Session Pill Bar ── */}
        <GlassCard className="p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-full bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
              <Radio size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">Join Live Stage</p>
              <p className="text-[11px] text-text-secondary">Enter a 6-digit session code</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="CODE"
              maxLength={6}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              className="px-4 py-2.5 bg-white/70 dark:bg-white/[0.06] border border-glass rounded-full text-text-primary text-center font-mono font-bold text-xs tracking-wider outline-none focus:ring-2 focus:ring-orange-500/30 w-28 shadow-inner-glass uppercase"
            />
            <PillButton
              onClick={handleJoin}
              disabled={joinCode.trim().length !== 6}
              variant="primary-dark"
              className="py-2.5 px-4 text-xs"
            >
              Join
            </PillButton>
          </div>
        </GlassCard>

        {/* ── Search ── */}
        <div className="relative mb-6 z-20">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-text-muted" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-surface-glass backdrop-blur-xl border border-glass rounded-full text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all font-medium shadow-glass text-sm"
            placeholder="Search charts to add to live setlist…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
          />
          {isSearchFocused && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/65 dark:bg-[#1c1c22]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-2xl shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] max-h-72 overflow-y-auto p-2 space-y-1 z-30 animate-fade-in">
              {isSearching && <div className="p-4 text-center text-text-secondary text-sm">Searching…</div>}
              {!isSearching && searchResults.length === 0 && <div className="p-4 text-center text-text-secondary text-sm">No charts found.</div>}
              {searchResults.map(chart => {
                const inQueue = queue.some(q => q.id === chart.id);
                return (
                  <div key={chart.id} onClick={() => !inQueue && addChart(chart)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all group ${!inQueue ? 'cursor-pointer hover:bg-orange-500/10' : 'opacity-60'}`}>
                    <div className="truncate pr-4">
                      <p className="text-sm font-bold text-text-primary truncate group-hover:text-orange-600 transition-colors">{chart.title}</p>
                      <p className="text-[11px] text-text-secondary">{chart.time_sig} · t={chart.tempo}</p>
                    </div>
                    <button disabled={inQueue}
                      className={`shrink-0 px-3 py-1.5 rounded-full flex items-center text-xs font-bold transition-colors ${inQueue ? 'text-text-muted cursor-not-allowed' : 'text-orange-600 bg-orange-500/15 hover:bg-orange-500/25'}`}>
                      {inQueue ? 'Added' : <><Plus size={14} className="mr-1" /> Add</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {isSearchFocused && searchQuery.trim() && <div className="fixed inset-0 z-10" onClick={() => setIsSearchFocused(false)} />}

        {/* ── Queue ── */}
        <GlassCard className="p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2 tracking-tight">
              <Music2 size={18} className="text-orange-500" />
              Live Queue ({queue.length})
            </h2>
            <div className="flex items-center gap-2">
              <PillButton onClick={handleSaveSetlist} disabled={!queue.length} variant="glass" className="py-1.5 px-3 text-xs">
                <Save size={12} className="mr-1.5" /> Save
              </PillButton>
              <PillButton onClick={() => setShowSaved(!showSaved)} variant="glass" className="py-1.5 px-3 text-xs">
                <BookOpen size={12} className="mr-1.5" /> Saved ({savedSetlists.length})
              </PillButton>
            </div>
          </div>

          {/* Saved setlists panel */}
          {showSaved && (
            <div className="mb-5 space-y-2 p-3 bg-white/40 dark:bg-white/[0.03] border border-glass rounded-2xl">
              {savedSetlists.length === 0 && (
                <div className="text-center text-text-secondary text-xs py-4">No saved setlists yet.</div>
              )}
              {savedSetlists.map(sl => (
                <div key={sl.id} className="flex items-center justify-between p-3 bg-white/70 dark:bg-white/[0.05] rounded-xl border border-glass group">
                  <div className="truncate flex-1">
                    <p className="text-sm font-bold text-text-primary truncate">{sl.name}</p>
                    <p className="text-[11px] text-text-secondary">{sl.chartIds.length} charts · {new Date(sl.savedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <button onClick={() => handleLoadSetlist(sl)}
                      className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:opacity-80 px-2.5 py-1 bg-orange-500/15 rounded-lg transition-all">
                      <FolderOpen size={14} />
                    </button>
                    <button onClick={() => handleDeleteSaved(sl.id)} className="text-xs text-text-muted hover:text-red-500 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {queue.length === 0 ? (
            <div className="py-12 text-center bg-white/30 dark:bg-white/[0.02] border border-dashed border-glass rounded-2xl">
              <Music2 size={32} className="text-text-muted mx-auto mb-3 opacity-60" />
              <p className="text-text-secondary text-sm font-medium">Search for charts above to build your live queue.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={queue.map(q => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {queue.map((item, idx) => (
                    <SortableItem key={item.id} id={item.id} idx={idx} item={item} onRemove={removeChart} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </GlassCard>

        {/* ── Start Session Button ── */}
        <PillButton
          onClick={handleStartSession}
          disabled={queue.length === 0}
          variant={queue.length > 0 ? 'primary-dark' : 'glass'}
          className="w-full py-4 text-base font-extrabold shadow-glass-strong"
          icon={<Play size={20} className="fill-current" />}
        >
          Start Live Performance
        </PillButton>
        <p className="text-center text-xs text-text-muted mt-3 font-medium">
          A 6-character code will be generated for stage followers to join and sync.
        </p>
      </main>
    </div>
  );
}

export default function PerformPage() {
  return (
    <React.Suspense fallback={null}>
      <PerformContent />
    </React.Suspense>
  );
}
