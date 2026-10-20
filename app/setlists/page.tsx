'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { listSetlists, createSetlist, deleteSetlist, duplicateSetlist, updateSetlist, type Setlist } from '@/lib/setlists';
import { GlassCard, PillButton, IconButton } from '@/components/ui/primitives';
import {
  ListMusic, Plus, MoreVertical, Trash2, Copy, Pencil, Calendar,
  Music2, CornerLeftUp, X, Check, Play, Radio, ChevronRight,
} from 'lucide-react';

// ─── New Setlist Modal ────────────────────────────────────────────────────────

function NewSetlistModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (s: Setlist) => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const s = await createSetlist(name.trim(), date || null, notes.trim() || null);
      onCreate(s);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white/65 dark:bg-[#18181d]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-t-[32px] sm:rounded-[32px] shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-6 sm:p-7 flex flex-col gap-4 animate-slide-up sm:animate-fade-in">
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
          <h2 className="text-lg font-bold text-text-primary tracking-tight">New Setlist</h2>
          <IconButton icon={<X size={18} />} onClick={onClose} variant="glass" aria-label="Close" />
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
              Name *
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Sunday Service, Gig at The Venue…"
              className="w-full px-4 py-3 bg-white/70 dark:bg-white/[0.06] border border-glass rounded-2xl text-text-primary placeholder:text-text-muted text-sm outline-none focus:ring-2 focus:ring-orange-500/30 transition-all shadow-inner-glass"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
              Date (optional)
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-white/70 dark:bg-white/[0.06] border border-glass rounded-2xl text-text-primary text-sm outline-none focus:ring-2 focus:ring-orange-500/30 transition-all shadow-inner-glass"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Venue, key, special instructions…"
              className="w-full px-4 py-3 bg-white/70 dark:bg-white/[0.06] border border-glass rounded-2xl text-text-primary placeholder:text-text-muted text-sm outline-none focus:ring-2 focus:ring-orange-500/30 transition-all shadow-inner-glass resize-none"
            />
          </div>
        </div>

        <div className="pt-2">
          <PillButton
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            variant="primary-dark"
            className="w-full py-3.5 text-sm"
          >
            {saving ? 'Creating…' : 'Create Setlist'}
          </PillButton>
        </div>
      </div>
    </div>
  );
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────

function RenameModal({ setlist, onClose, onRename }: {
  setlist: Setlist;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(setlist.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await updateSetlist(setlist.id, { name: name.trim() });
    onRename(name.trim());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white/65 dark:bg-[#18181d]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-[28px] shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-6 flex flex-col gap-4 animate-fade-in">
        <h2 className="text-base font-bold text-text-primary">Rename Setlist</h2>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="w-full px-4 py-3 bg-white/70 dark:bg-white/[0.06] border border-glass rounded-2xl text-text-primary text-sm outline-none focus:ring-2 focus:ring-orange-500/30 transition-all shadow-inner-glass"
        />
        <div className="flex gap-2 pt-1">
          <PillButton onClick={onClose} variant="glass" className="flex-1 py-2.5 text-xs">
            Cancel
          </PillButton>
          <PillButton
            onClick={handleSave}
            disabled={!name.trim() || saving}
            variant="primary-dark"
            className="flex-1 py-2.5 text-xs"
          >
            {saving ? 'Saving…' : 'Save'}
          </PillButton>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({ name, onClose, onConfirm }: {
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white/65 dark:bg-[#18181d]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-[28px] shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-6 flex flex-col gap-4 animate-fade-in">
        <h2 className="text-base font-bold text-text-primary">Delete Setlist?</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          <span className="text-text-primary font-semibold">"{name}"</span> will be permanently deleted.
          The underlying charts and lyrics will not be affected.
        </p>
        <div className="flex gap-2 pt-1">
          <PillButton onClick={onClose} variant="glass" className="flex-1 py-2.5 text-xs">
            Cancel
          </PillButton>
          <PillButton
            onClick={onConfirm}
            variant="danger"
            className="flex-1 py-2.5 text-xs"
          >
            Delete
          </PillButton>
        </div>
      </div>
    </div>
  );
}

// ─── Setlist Card ─────────────────────────────────────────────────────────────

function SetlistCard({
  setlist,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onStartPerform,
  onSendToPerformQueue,
}: {
  setlist: Setlist & { songCount?: number };
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStartPerform: () => void;
  onSendToPerformQueue: () => void;
}) {
  const { profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);

  const formattedDate = setlist.date
    ? new Date(setlist.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <GlassCard
      onClick={onOpen}
      interactive
      className={`p-4 sm:p-5 group cursor-pointer relative overflow-visible ${menuOpen ? 'z-40' : 'z-0'}`}
    >
      <div className="flex items-center gap-4">
        {/* Centered Glass Icon Well */}
        <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-orange-500/15 via-rose-500/10 to-amber-500/15 border border-white/60 dark:border-white/10 shadow-inner-glass flex items-center justify-center shrink-0">
          <ListMusic size={24} className="text-orange-600 dark:text-orange-400" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-text-primary text-base truncate tracking-tight">{setlist.name}</p>
          <div className="flex items-center gap-2.5 mt-1 flex-wrap">
            {formattedDate && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-text-secondary">
                <Calendar size={11} className="text-orange-500/70" /> {formattedDate}
              </span>
            )}
            {setlist.songCount !== undefined && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/15">
                {setlist.songCount} song{setlist.songCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted mt-1">
            Updated {new Date(setlist.updated_at).toLocaleDateString()}
          </p>
        </div>

        {/* Actions - Only visible to admin users */}
        {profile?.profession === 'admin' && (
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all sm:opacity-0 sm:group-hover:opacity-100"
              title="Delete Setlist"
            >
              <Trash2 size={17} />
            </button>
            <div className="relative">
              <IconButton
                icon={<MoreVertical size={16} />}
                onClick={e => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDropUp(window.innerHeight - rect.bottom < 260);
                  setMenuOpen(v => !v);
                }}
                variant="glass"
                aria-label="More options"
              />
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className={`absolute right-0 ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'} z-50 min-w-[210px] bg-white/95 dark:bg-[#1e1e24]/95 backdrop-blur-2xl saturate-[180%] border border-slate-200/80 dark:border-white/15 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)] overflow-hidden animate-fade-in p-1.5`}>
                    <button 
                      onClick={e => { e.stopPropagation(); setMenuOpen(false); onStartPerform(); }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-all"
                    >
                      <Play size={14} className="fill-current" /> Start Performance
                    </button>
                    <button 
                      onClick={e => { e.stopPropagation(); setMenuOpen(false); onSendToPerformQueue(); }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all"
                    >
                      <Radio size={14} className="text-sky-500" /> Send to Perform Queue
                    </button>
                    <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] my-1 mx-2" />
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onRename(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all">
                      <Pencil size={14} /> Rename
                    </button>
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onDuplicate(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all">
                      <Copy size={14} /> Duplicate
                    </button>
                    <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] my-1 mx-2" />
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SetlistsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [setlists, setSetlists] = useState<(Setlist & { songCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [renaming, setRenaming] = useState<Setlist | null>(null);
  const [deleting, setDeleting] = useState<Setlist | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSetlists();
      // Fetch item counts in one shot
      const counts: Record<string, number> = {};
      if (data.length > 0) {
        const { data: countRows } = await supabase
          .from('setlist_items')
          .select('setlist_id')
          .in('setlist_id', data.map(s => s.id));
        (countRows || []).forEach((r: any) => {
          counts[r.setlist_id] = (counts[r.setlist_id] || 0) + 1;
        });
      }
      setSetlists(data.map(s => ({ ...s, songCount: counts[s.id] || 0 })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleStartPerform = (s: Setlist & { songCount?: number }) => {
    if (!s.songCount || s.songCount === 0) {
      showToast('Setlist is empty. Add songs first');
      return;
    }
    sessionStorage.setItem(`setlist-leader-${s.id}`, '1');
    router.push(`/setlists/perform?id=${s.id}`);
  };

  const handleSendToPerformQueue = (s: Setlist & { songCount?: number }) => {
    if (!s.songCount || s.songCount === 0) {
      showToast('Setlist is empty. Add songs first');
      return;
    }
    router.push(`/perform?setlistId=${s.id}`);
  };

  const handleCreate = (s: Setlist) => {
    setShowNew(false);
    setSetlists(prev => [{ ...s, songCount: 0 }, ...prev]);
    router.push(`/setlists/view?id=${s.id}`);
  };

  const handleRename = (id: string, name: string) => {
    setSetlists(prev => prev.map(s => s.id === id ? { ...s, name } : s));
    setRenaming(null);
  };

  const handleDuplicate = async (id: string) => {
    const dup = await duplicateSetlist(id);
    setSetlists(prev => [{ ...dup, songCount: 0 }, ...prev]);
  };

  const handleDelete = async (id: string) => {
    setDeleting(null);
    setSetlists(prev => prev.filter(s => s.id !== id));
    try {
      await deleteSetlist(id);
    } catch (err) {
      console.error('Failed to delete setlist:', err);
      // Reload on failure
      const list = await listSetlists();
      setSetlists(list);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 pt-[max(env(safe-area-inset-top,1.5rem),1.5rem)] pb-36">

        {/* Action row */}
        <div className="flex items-center justify-between mb-6 mt-2">
          <div>
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Setlists</h1>
            <p className="text-xs text-text-secondary mt-0.5">Organize charts for gigs and rehearsals</p>
          </div>
          <PillButton
            onClick={() => setShowNew(true)}
            variant="primary-dark"
            icon={<Plus size={16} />}
            className="px-4 py-2.5 text-xs shadow-btn-dark"
          >
            New Setlist
          </PillButton>
        </div>

        {/* List */}
        {loading && (
          <div className="flex flex-col gap-3.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-surface-glass border border-glass rounded-[24px] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && setlists.length === 0 && (
          <GlassCard className="text-center py-20 px-6 my-6">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4 text-orange-500 shadow-inner-glass">
              <ListMusic size={32} />
            </div>
            <p className="font-bold text-lg text-text-primary mb-1 tracking-tight">No setlists yet</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto mb-6">Create your first setlist to group and sequence songs for live performances.</p>
            <PillButton onClick={() => setShowNew(true)} variant="primary-dark" icon={<Plus size={16} />}>
              Create First Setlist
            </PillButton>
          </GlassCard>
        )}

        <div className="flex flex-col gap-3.5">
          {setlists.map(s => (
            <SetlistCard
              key={s.id}
              setlist={s}
              onOpen={() => router.push(`/setlists/view?id=${s.id}`)}
              onRename={() => setRenaming(s)}
              onDuplicate={() => handleDuplicate(s.id)}
              onDelete={() => setDeleting(s)}
              onStartPerform={() => handleStartPerform(s)}
              onSendToPerformQueue={() => handleSendToPerformQueue(s)}
            />
          ))}
        </div>
      </main>

      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed left-1/2 bottom-24 -translate-x-1/2 z-[300] bg-white/70 dark:bg-black/60 border border-white/60 dark:border-white/15 text-text-primary dark:text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl saturate-[180%] flex items-center gap-2 animate-fade-in pointer-events-none">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Modals */}
      {showNew && (
        <NewSetlistModal onClose={() => setShowNew(false)} onCreate={handleCreate} />
      )}
      {renaming && (
        <RenameModal
          setlist={renaming}
          onClose={() => setRenaming(null)}
          onRename={name => handleRename(renaming.id, name)}
        />
      )}
      {deleting && (
        <ConfirmDeleteModal
          name={deleting.name}
          onClose={() => setDeleting(null)}
          onConfirm={() => handleDelete(deleting.id)}
        />
      )}
    </div>
  );
}
