'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { listTrash, deleteEntry, restoreFromTrash, Folder } from '@/lib/storage';
import { useAuth } from '@/components/AuthProvider';
import { Folder as FolderIcon, FileText, Trash2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Check } from 'lucide-react';
import { Header } from '@/components/Header';
import { GlassCard, PillButton, IconButton } from '@/components/ui/primitives';

type TrashItem = {
  id: string;
  type: 'folder' | 'chart';
  originalName: string;
  trashedName: string;
  updatedAt: string;
};

export default function TrashPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [charts, setCharts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Long-press tracking
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Modals state
  const [restoreItem, setRestoreItem] = useState<{ id: string, type: 'folder' | 'chart', trashedName: string, originalName: string } | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string, type: 'folder' | 'chart', originalName: string } | null>(null);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  const [deleteAllModal, setDeleteAllModal] = useState(false);

  const getOriginalName = (trashedName: string) => {
    const parts = trashedName.split(':');
    return parts.length >= 3 ? parts.slice(2).join(':') : trashedName;
  };

  // Build a flat list of all trash items for easier selection handling
  const allItems: TrashItem[] = [
    ...folders.map(f => ({
      id: f.id,
      type: 'folder' as const,
      originalName: getOriginalName(f.name),
      trashedName: f.name,
      updatedAt: f.updated_at,
    })),
    ...charts.map(c => ({
      id: c.id,
      type: 'chart' as const,
      originalName: getOriginalName(c.title),
      trashedName: c.title,
      updatedAt: c.updated_at,
    })),
  ];

  const loadContents = async () => {
    setLoading(true);
    try {
      const res = await listTrash();
      setFolders(res.folders);
      setCharts(res.charts);
    } catch (err) {
      console.error('Failed to load trash contents', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadContents();
    }
  }, [user, authLoading]);

  // Exit selection mode when all items are deselected
  useEffect(() => {
    if (selectionMode && selectedIds.size === 0) {
      // Keep mode active — user might want to select more
    }
  }, [selectionMode, selectedIds]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allItems.map(item => item.id)));
  }, [allItems]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Long-press handlers
  const handlePointerDown = useCallback((id: string) => {
    longPressTriggered.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (!selectionMode) {
        setSelectionMode(true);
      }
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }, 500); // 500ms long press
  }, [selectionMode]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleItemClick = useCallback((id: string) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return; // Don't handle click if long-press was triggered
    }
    if (selectionMode) {
      toggleSelect(id);
    }
  }, [selectionMode, toggleSelect]);

  // Single item actions (non-selection mode)
  const executeDelete = async () => {
    if (!deleteItem) return;
    const itemToDelete = deleteItem;
    setDeleteItem(null);
    if (itemToDelete.type === 'folder') {
      setFolders(prev => prev.filter(f => f.id !== itemToDelete.id));
    } else {
      setCharts(prev => prev.filter(c => c.id !== itemToDelete.id));
    }
    try {
      await deleteEntry(itemToDelete.id, itemToDelete.type);
    } catch (err) {
      console.error('Delete from trash error:', err);
    } finally {
      loadContents();
    }
  };

  const executeRestore = async () => {
    if (!restoreItem) return;
    const itemToRestore = restoreItem;
    setRestoreItem(null);
    if (itemToRestore.type === 'folder') {
      setFolders(prev => prev.filter(f => f.id !== itemToRestore.id));
    } else {
      setCharts(prev => prev.filter(c => c.id !== itemToRestore.id));
    }
    try {
      await restoreFromTrash(itemToRestore.id, itemToRestore.type, itemToRestore.trashedName);
    } catch (err) {
      console.error('Restore from trash error:', err);
    } finally {
      loadContents();
    }
  };

  // Bulk delete selected items
  const executeBulkDelete = async () => {
    const idsToDelete = new Set(selectedIds);
    setFolders(prev => prev.filter(f => !idsToDelete.has(f.id)));
    setCharts(prev => prev.filter(c => !idsToDelete.has(c.id)));
    setBulkDeleteModal(false);
    exitSelectionMode();

    const promises = allItems
      .filter(item => idsToDelete.has(item.id))
      .map(item => deleteEntry(item.id, item.type));
    try {
      await Promise.all(promises);
    } catch (err) {
      console.error('Bulk delete from trash error:', err);
    } finally {
      loadContents();
    }
  };

  // Delete ALL items in trash
  const executeDeleteAll = async () => {
    setFolders([]);
    setCharts([]);
    setDeleteAllModal(false);
    exitSelectionMode();

    const promises = allItems.map(item => deleteEntry(item.id, item.type));
    try {
      await Promise.all(promises);
    } catch (err) {
      console.error('Delete all from trash error:', err);
    } finally {
      loadContents();
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-text-secondary font-medium">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <GlassCard className="p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">Access Denied</h2>
          <p className="text-text-secondary mb-6 text-xs">Please log in to view your trash.</p>
          <PillButton onClick={() => router.push('/login')} variant="primary-dark" className="w-full py-3 text-sm">
            Go to Login
          </PillButton>
        </GlassCard>
      </div>
    );
  }

  const isAllSelected = allItems.length > 0 && selectedIds.size === allItems.length;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-4 pt-[max(env(safe-area-inset-top,1.5rem),1.5rem)] pb-36">
        {/* Title + Actions Row */}
        <div className="flex items-center gap-3 mb-4 mt-2">
          <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 text-red-500 shadow-inner-glass">
            <Trash2 size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">Trash</h1>
            <p className="text-xs text-text-secondary font-medium">
              {selectionMode
                ? `${selectedIds.size} of ${allItems.length} selected`
                : 'Items moved to trash can be restored or permanently removed.'}
            </p>
          </div>
        </div>

        {/* Selection Toolbar */}
        {selectionMode && (
          <div className="sticky top-14 z-30 mb-4 animate-in slide-in-from-top duration-200">
            <div className="bg-white/55 dark:bg-[#1c1c20]/55 backdrop-blur-2xl saturate-[180%] rounded-2xl border border-white/60 dark:border-white/15 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] px-4 py-2.5 flex items-center gap-2 flex-wrap">
              {/* Select All / Deselect All */}
              <button
                onClick={isAllSelected ? deselectAll : selectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-text-primary active:scale-95 cursor-pointer"
              >
                {isAllSelected ? (
                  <><XCircle size={14} /> Deselect All</>
                ) : (
                  <><CheckCircle2 size={14} /> Select All</>
                )}
              </button>

              <div className="flex-1" />

              {/* Delete Selected */}
              <button
                onClick={() => setBulkDeleteModal(true)}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
              >
                <Trash2 size={14} />
                Delete ({selectedIds.size})
              </button>

              {/* Cancel */}
              <button
                onClick={exitSelectionMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-text-secondary active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete All Button (shown when items exist and not in selection mode) */}
        {!selectionMode && allItems.length > 0 && (
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={() => {
                setSelectionMode(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-text-secondary active:scale-95 cursor-pointer"
            >
              <CheckCircle2 size={14} />
              Select
            </button>
            <button
              onClick={() => setDeleteAllModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 active:scale-95 cursor-pointer"
            >
              <Trash2 size={14} />
              Empty Trash
            </button>
          </div>
        )}

        <div>
          {loading ? (
            <div className="p-16 text-center text-text-secondary font-medium">Loading…</div>
          ) : folders.length === 0 && charts.length === 0 ? (
            <GlassCard className="p-16 text-center max-w-md mx-auto my-12">
              <div className="mx-auto h-20 w-20 bg-white/70 dark:bg-white/10 rounded-full shadow-inner-glass border border-glass flex items-center justify-center mb-5 text-text-muted">
                <Trash2 size={32} strokeWidth={2} className="opacity-50" />
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1 tracking-tight">Trash is empty</h3>
              <p className="text-xs text-text-secondary">Items you move to trash will appear here.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {folders.map(folder => {
                const originalName = getOriginalName(folder.name);
                const isSelected = selectedIds.has(folder.id);
                return (
                  <div
                    key={folder.id}
                    onPointerDown={() => handlePointerDown(folder.id)}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerLeave}
                    onClick={() => handleItemClick(folder.id)}
                    className="select-none"
                  >
                    <GlassCard className={`p-5 flex flex-col items-center justify-center group relative transition-all duration-200 ${
                      isSelected ? 'ring-2 ring-orange-500 bg-orange-500/5 dark:bg-orange-500/10' : ''
                    } ${selectionMode ? 'cursor-pointer active:scale-[0.97]' : ''}`}>
                      {/* Selection checkbox */}
                      {selectionMode && (
                        <div className={`absolute top-2.5 left-2.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isSelected
                            ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30 scale-100'
                            : 'bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 scale-90'
                        }`}>
                          {isSelected && <Check size={14} className="stroke-[3]" />}
                        </div>
                      )}

                      {/* Action buttons (only in non-selection mode) */}
                      {!selectionMode && (
                        <div className="absolute top-2.5 right-2.5 flex space-x-1">
                          <IconButton
                            icon={<RefreshCw size={14} />}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              setRestoreItem({ id: folder.id, type: 'folder', trashedName: folder.name, originalName });
                            }}
                            variant="glass"
                            aria-label="Restore"
                            className="w-8 h-8"
                          />
                          <IconButton
                            icon={<Trash2 size={14} />}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              setDeleteItem({ id: folder.id, type: 'folder', originalName });
                            }}
                            variant="glass"
                            aria-label="Delete Permanently"
                            className="w-8 h-8 text-red-500 hover:text-red-600"
                          />
                        </div>
                      )}

                      <div className={`w-16 h-16 bg-white/80 dark:bg-white/10 rounded-full flex items-center justify-center mb-3.5 mt-3 shadow-inner-glass border border-glass transition-opacity ${selectionMode && !isSelected ? 'opacity-50' : 'opacity-70'}`}>
                        <FolderIcon size={24} className="text-text-secondary" />
                      </div>
                      <p className="text-sm font-bold text-text-primary text-center w-full truncate tracking-tight">{originalName}</p>
                      <p className="text-[10px] text-text-muted mt-1">Deleted: {new Date(folder.updated_at).toLocaleDateString()}</p>
                    </GlassCard>
                  </div>
                );
              })}
              
              {charts.map(chart => {
                const originalName = getOriginalName(chart.title);
                const isSelected = selectedIds.has(chart.id);
                return (
                  <div
                    key={chart.id}
                    onPointerDown={() => handlePointerDown(chart.id)}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerLeave}
                    onClick={() => handleItemClick(chart.id)}
                    className="select-none"
                  >
                    <GlassCard className={`p-5 flex flex-col items-center justify-center group relative transition-all duration-200 ${
                      isSelected ? 'ring-2 ring-orange-500 bg-orange-500/5 dark:bg-orange-500/10' : ''
                    } ${selectionMode ? 'cursor-pointer active:scale-[0.97]' : ''}`}>
                      {/* Selection checkbox */}
                      {selectionMode && (
                        <div className={`absolute top-2.5 left-2.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isSelected
                            ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30 scale-100'
                            : 'bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 scale-90'
                        }`}>
                          {isSelected && <Check size={14} className="stroke-[3]" />}
                        </div>
                      )}

                      {/* Action buttons (only in non-selection mode) */}
                      {!selectionMode && (
                        <div className="absolute top-2.5 right-2.5 flex space-x-1">
                          <IconButton
                            icon={<RefreshCw size={14} />}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              setRestoreItem({ id: chart.id, type: 'chart', trashedName: chart.title, originalName });
                            }}
                            variant="glass"
                            aria-label="Restore"
                            className="w-8 h-8"
                          />
                          <IconButton
                            icon={<Trash2 size={14} />}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              setDeleteItem({ id: chart.id, type: 'chart', originalName });
                            }}
                            variant="glass"
                            aria-label="Delete Permanently"
                            className="w-8 h-8 text-red-500 hover:text-red-600"
                          />
                        </div>
                      )}

                      <div className={`w-16 h-16 bg-white/80 dark:bg-white/10 rounded-full flex items-center justify-center mb-3.5 mt-3 shadow-inner-glass border border-glass transition-opacity ${selectionMode && !isSelected ? 'opacity-50' : 'opacity-70'}`}>
                        <FileText size={24} className="text-orange-500" />
                      </div>
                      <p className="text-sm font-bold text-text-primary text-center w-full truncate tracking-tight">{originalName}</p>
                      <p className="text-[10px] text-text-muted mt-1">Deleted: {new Date(chart.updated_at).toLocaleDateString()}</p>
                    </GlassCard>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Restore Modal */}
      {restoreItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white/65 dark:bg-[#18181d]/65 backdrop-blur-2xl saturate-[180%] rounded-[32px] p-7 w-full max-w-sm shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mb-5 text-orange-500 shadow-inner-glass">
              <RefreshCw size={24} />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Restore {restoreItem.type}?</h3>
            <p className="text-xs text-text-secondary mb-6 leading-relaxed">
              &quot;{restoreItem.originalName}&quot; will be restored to its original location.
            </p>
            <div className="flex justify-center space-x-3">
              <PillButton onClick={() => setRestoreItem(null)} variant="glass" className="flex-1 py-2.5 text-xs">Cancel</PillButton>
              <PillButton onClick={executeRestore} variant="primary-dark" className="flex-1 py-2.5 text-xs">Restore</PillButton>
            </div>
          </div>
        </div>
      )}

      {/* Single Item Permanent Delete Modal */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white/65 dark:bg-[#18181d]/65 backdrop-blur-2xl saturate-[180%] rounded-[32px] p-7 w-full max-w-sm shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-5 text-red-500 shadow-inner-glass">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Delete Permanently?</h3>
            <p className="text-xs text-text-secondary mb-6 leading-relaxed">
              Are you sure you want to permanently delete &quot;{deleteItem.originalName}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-center space-x-3">
              <PillButton onClick={() => setDeleteItem(null)} variant="glass" className="flex-1 py-2.5 text-xs">Cancel</PillButton>
              <PillButton onClick={executeDelete} variant="danger" className="flex-1 py-2.5 text-xs">Delete</PillButton>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Selected Modal */}
      {bulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white/65 dark:bg-[#18181d]/65 backdrop-blur-2xl saturate-[180%] rounded-[32px] p-7 w-full max-w-sm shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-5 text-red-500 shadow-inner-glass">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Delete {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}?</h3>
            <p className="text-xs text-text-secondary mb-6 leading-relaxed">
              {selectedIds.size === 1
                ? 'This item will be permanently deleted. This action cannot be undone.'
                : `These ${selectedIds.size} items will be permanently deleted. This action cannot be undone.`}
            </p>
            <div className="flex justify-center space-x-3">
              <PillButton onClick={() => setBulkDeleteModal(false)} variant="glass" className="flex-1 py-2.5 text-xs">Cancel</PillButton>
              <PillButton onClick={executeBulkDelete} variant="danger" className="flex-1 py-2.5 text-xs">Delete All</PillButton>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash (Delete All) Modal */}
      {deleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white/65 dark:bg-[#18181d]/65 backdrop-blur-2xl saturate-[180%] rounded-[32px] p-7 w-full max-w-sm shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-5 text-red-500 shadow-inner-glass">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Empty Trash?</h3>
            <p className="text-xs text-text-secondary mb-6 leading-relaxed">
              All {allItems.length} item{allItems.length !== 1 ? 's' : ''} in trash will be permanently deleted. This action cannot be undone.
            </p>
            <div className="flex justify-center space-x-3">
              <PillButton onClick={() => setDeleteAllModal(false)} variant="glass" className="flex-1 py-2.5 text-xs">Cancel</PillButton>
              <PillButton onClick={executeDeleteAll} variant="danger" className="flex-1 py-2.5 text-xs">Empty Trash</PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
