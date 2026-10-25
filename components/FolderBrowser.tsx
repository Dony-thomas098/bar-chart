'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Folder, Chart, listFolder, listFolderFromCache, createFolder, renameEntry,
  deleteEntry, moveToTrash, moveEntry, saveChart, searchAll, exportChart, toggleBookmark
} from '@/lib/storage';
import { FolderPickerModal } from './FolderPickerModal';
import { LogoLoading } from './LogoLoading';
import { createDefaultLine } from '@/lib/chart-types';
import { seedSampleData } from '@/lib/sampleData';
import { useAuth, canModifySection } from '@/components/AuthProvider';
import { BandConnectModal } from './BandConnectModal';
import { hasJoinedBand, syncBandForUser } from '@/lib/band';
import {
  Folder as FolderIcon, FileText, MoreVertical, Search,
  Plus, CornerLeftUp, Trash2, Edit2, Edit3, CornerRightDown, Download, X,
  FolderPlus, FilePlus, Printer, Star, LayoutGrid, List, Sparkles, Check, Music
} from 'lucide-react';
import './ios-tiles.css';

interface Props {
  folderId: string | null;
  folderName?: string; // Passed if inside a subfolder
  kind?: 'chart' | 'lyrics';
}

export function FolderBrowser({ folderId, folderName, kind = 'chart' }: Props) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canEdit = canModifySection(profile?.profession, kind);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [charts, setCharts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View state (Grid vs List)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const saved = localStorage.getItem('chord-grid-view-mode') as 'grid' | 'list';
    if (saved === 'grid' || saved === 'list') {
      setViewMode(saved);
    }
  }, []);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Memoized alphabetical sorting for folders (A-Z)
  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [folders]);

  // Priority grouping in search: Folders (1st priority, A-Z), then Charts/Files (A-Z)
  const matchingFolders = useMemo(() => {
    return searchResults.filter((item) => item.type === 'folder');
  }, [searchResults]);

  const matchingCharts = useMemo(() => {
    return searchResults.filter((item) => item.type !== 'folder');
  }, [searchResults]);

  // Modals state
  const [moveItem, setMoveItem] = useState<{ id: string, type: 'folder' | 'chart' | 'lyrics' } | null>(null);
  const [isBulkMove, setIsBulkMove] = useState(false);
  const [renameItem, setRenameItem] = useState<{ id: string, type: 'folder' | 'chart' | 'lyrics', currentName: string } | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string, type: 'folder' | 'chart' | 'lyrics', name: string, createdBy?: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [bandModalOpen, setBandModalOpen] = useState(false);

  const bandPromptCheckedRef = useRef(false);

  // Auto-prompt to join or create band when user is signed in with email but hasn't joined a band yet
  useEffect(() => {
    if (user && typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') !== 'true') {
      if (bandPromptCheckedRef.current) return;
      // 1. If user already joined a band (active session, email cache, or metadata), never show prompt
      if (hasJoinedBand(user)) {
        bandPromptCheckedRef.current = true;
        return;
      }

      // 2. If not immediately detected, attempt background Supabase sync for this user's email
      let isCancelled = false;
      bandPromptCheckedRef.current = true;
      syncBandForUser(user).then((band) => {
        if (isCancelled) return;
        // Only prompt if user genuinely has no band associated with their account
        if (!band && !hasJoinedBand(user)) {
          const timer = setTimeout(() => {
            if (!isCancelled && !hasJoinedBand(user)) {
              setBandModalOpen(true);
            }
          }, 1500);
          return () => clearTimeout(timer);
        }
      });

      return () => {
        isCancelled = true;
      };
    }
  }, [user]);

  // Allow triggering band modal from anywhere via custom event
  useEffect(() => {
    const handleOpen = () => setBandModalOpen(true);
    window.addEventListener('open-band-modal', handleOpen);
    return () => window.removeEventListener('open-band-modal', handleOpen);
  }, []);

  // Selection state
  const [selectedItems, setSelectedItems] = useState<{ id: string, type: 'folder' | 'chart' | 'lyrics' }[]>([]);
  const selectedItemsRef = useRef(selectedItems);
  useEffect(() => {
    selectedItemsRef.current = selectedItems;
  }, [selectedItems]);

  // Track if any modal is currently active
  const isModalActive = Boolean(
    createFolderModal ||
    bulkDeleteModal ||
    deleteItem ||
    renameItem ||
    moveItem ||
    isBulkMove ||
    bandModalOpen
  );
  const isModalActiveRef = useRef(isModalActive);
  useEffect(() => {
    isModalActiveRef.current = isModalActive;
  }, [isModalActive]);

  // Exit toast state for double-back to exit on phone
  const [showExitToast, setShowExitToast] = useState(false);
  const exitToastTimer = useRef<NodeJS.Timeout | null>(null);

  // Master Phone Back Button & Gesture Trap
  useEffect(() => {
    // Clean up any lingering #select hash from prior sessions
    if (typeof window !== 'undefined' && window.location.hash === '#select') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    // Pad the history stack so Android back gesture never closes the app on initial back
    try {
      window.history.pushState({ chordCraftTrap: true }, '', window.location.href);
    } catch (e) {
      console.warn('Failed to pad history stack', e);
    }

    let lastBackPressTime = 0;

    const handlePopState = () => {
      // 1. If in SELECTION MODE -> Deselect all items immediately and prevent app close!
      if (selectedItemsRef.current.length > 0) {
        try {
          window.history.pushState({ chordCraftTrap: true }, '', window.location.href);
        } catch {}
        setSelectedItems([]);
        return;
      }

      // 2. If any MODAL is open -> Close modal immediately and prevent app close!
      if (isModalActiveRef.current) {
        try {
          window.history.pushState({ chordCraftTrap: true }, '', window.location.href);
        } catch {}
        setCreateFolderModal(false);
        setBulkDeleteModal(false);
        setDeleteItem(null);
        setRenameItem(null);
        setMoveItem(null);
        setIsBulkMove(false);
        return;
      }

      // 3. If inside a SUBFOLDER -> Navigate up to parent folder!
      if (folderId) {
        try {
          window.history.pushState({ chordCraftTrap: true }, '', window.location.href);
        } catch {}
        router.push(kind === 'lyrics' ? '/lyrics' : '/');
        return;
      }

      // 4. If at ROOT with nothing selected and no modals open:
      // Double-back within 2 seconds exits the app, single back shows toast
      const now = Date.now();
      if (now - lastBackPressTime < 2000) {
        // Confirmed double-back: allow app to close
        window.history.back();
      } else {
        lastBackPressTime = now;
        try {
          window.history.pushState({ chordCraftTrap: true }, '', window.location.href);
        } catch {}
        setShowExitToast(true);
        if (exitToastTimer.current) clearTimeout(exitToastTimer.current);
        exitToastTimer.current = setTimeout(() => {
          setShowExitToast(false);
        }, 2000);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitToastTimer.current) clearTimeout(exitToastTimer.current);
    };
  }, [folderId, kind, router]);

  useEffect(() => {
    const evt = new CustomEvent('selection-change', { detail: selectedItems.length });
    window.dispatchEvent(evt);
    return () => {
      window.dispatchEvent(new CustomEvent('selection-change', { detail: 0 }));
    };
  }, [selectedItems]);

  // Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  const [dropdownHorizontal, setDropdownHorizontal] = useState<'left' | 'right'>('right');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Long press gesture handling
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastLongPressTime = useRef(0);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (id: string, type: 'folder' | 'chart' | 'lyrics', e: React.PointerEvent) => {
    // Only respond to primary touch or left click
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    startPos.current = { x: e.clientX, y: e.clientY };
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    // Only set long-press timer if NOT already in selection mode
    if (selectedItems.length === 0) {
      longPressTimer.current = setTimeout(() => {
        lastLongPressTime.current = Date.now();
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(50); } catch (err) {}
        }
        setSelectedItems([{ id, type }]);
      }, 400);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startPos.current && longPressTimer.current) {
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleCardClick = (id: string, type: 'folder' | 'chart' | 'lyrics', e: React.MouseEvent, onNormalClick: () => void) => {
    // Prevent normal click if user just finished a long-press gesture
    if (Date.now() - lastLongPressTime.current < 600) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // If in selection mode, clicking anywhere on the card toggles its selection
    if (selectedItems.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedItems(prev => {
        const exists = prev.some(i => i.id === id);
        if (exists) return prev.filter(i => i.id !== id);
        return [...prev, { id, type }];
      });
      return;
    }

    onNormalClick();
  };



  const loadContents = async () => {
    // 1. Instant local cache load (< 5ms)
    try {
      const cached = await listFolderFromCache(folderId, kind);
      if (cached && (cached.folders.length > 0 || cached.charts.length > 0)) {
        setFolders(cached.folders);
        setCharts(cached.charts);
        setLoading(false);
      }
    } catch {}

    // 2. Fetch fresh updates from cloud
    try {
      const res = await listFolder(folderId, kind);
      setFolders(res?.folders || []);
      setCharts(res?.charts || []);
    } catch (err) {
      console.error('Failed to load contents', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContents();
    
    const handleRefresh = () => loadContents();
    window.addEventListener('refresh-folder', handleRefresh);
    return () => window.removeEventListener('refresh-folder', handleRefresh);
  }, [folderId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchAll(searchQuery, folderId, kind);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, folderId]);


  const executeRename = async (newName: string) => {
    if (!canEdit) return;
    if (renameItem && newName.trim() !== '' && newName.trim() !== renameItem.currentName) {
      await renameEntry(renameItem.id, renameItem.type, newName.trim());
      loadContents();
    }
    setRenameItem(null);
  };

  const handleCreateFolder = () => {
    if (!canEdit) return;
    setCreateFolderModal(true);
  };

  const handleCreateChart = async () => {
    if (!canEdit) return;
    const currentUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') : null) || 'guest-user';
    if (kind === 'lyrics') {
      const lyrics = {
        id: crypto.randomUUID(),
        title: 'Untitled lyrics',
        body: '',
        folder_id: folderId,
        created_by: currentUserId,
        updated_at: new Date().toISOString(),
      };
      const { saveLyrics } = await import('@/lib/lyrics');
      await saveLyrics(lyrics);
      const lyricsUrl = `/lyrics/edit/?id=${lyrics.id}`;
      try {
        router.push(lyricsUrl);
      } catch {
        if (typeof window !== 'undefined') {
          window.location.href = lyricsUrl;
        }
      }
    } else {
      const chart = {
        id: crypto.randomUUID(),
        title: 'Untitled Chart',
        tempo: 120,
        time_sig: '4/4',
        lines: [createDefaultLine(), createDefaultLine()],
        semitone_offset: 0,
        prefer_flats: false,
        folder_id: folderId,
        created_by: currentUserId,
        updated_at: new Date().toISOString(),
      };
      await saveChart(chart);
      const chartUrl = `/chart/edit/?id=${chart.id}`;
      try {
        router.push(chartUrl);
      } catch {
        if (typeof window !== 'undefined') {
          window.location.href = chartUrl;
        }
      }
    }
  };



  const executeDelete = async (permanent: boolean = false) => {
    if (!deleteItem) return;
    const itemToDelete = deleteItem;
    setDeleteItem(null);
    setDeleteConfirmText('');

    const isAdmin = profile?.profession === 'admin';
    const currentUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') : null) || 'guest-user';
    const isCreator = !itemToDelete.createdBy || itemToDelete.createdBy === currentUserId || (user?.id && itemToDelete.createdBy === user.id);

    if (!isAdmin && !isCreator) {
      alert("Permission denied: You can only delete items that you created. Admins can delete any item.");
      return;
    }

    // Only Admin can perform permanent delete; normal users can only move to trash
    const isPermanent = permanent && isAdmin;

    // Optimistic UI update so the item disappears immediately
    if (itemToDelete.type === 'folder') {
      setFolders(prev => prev.filter(f => f.id !== itemToDelete.id));
    } else {
      setCharts(prev => prev.filter(c => c.id !== itemToDelete.id));
    }
    if (searchResults && searchResults.length > 0) {
      setSearchResults(prev => prev.filter(c => c.id !== itemToDelete.id));
    }

    try {
      if (isPermanent) {
        await deleteEntry(itemToDelete.id, itemToDelete.type);
      } else {
        await moveToTrash(itemToDelete.id, itemToDelete.type);
      }
    } catch (err) {
      console.error('[FolderBrowser] Delete error:', err);
    } finally {
      loadContents();
    }
  };

  const executeMove = async (targetFolderId: string | null) => {
    if (!canEdit) return;
    if (isBulkMove) {
      await Promise.all(selectedItems.map(item => moveEntry(item.id, item.type, targetFolderId)));
      setSelectedItems([]);
      setIsBulkMove(false);
      loadContents();
    } else if (moveItem) {
      await moveEntry(moveItem.id, moveItem.type, targetFolderId);
      loadContents();
    }
    setMoveItem(null);
  };

  const handleToggleBookmark = async (chart: any) => {
    const newValue = !chart.is_bookmarked;
    await toggleBookmark(chart.id, chart.type as 'chart' | 'lyrics', newValue);
    // Optimistic update
    setCharts(prev => prev.map(c => c.id === chart.id ? { ...c, is_bookmarked: newValue } : c));
    if (searchResults) {
      setSearchResults(prev => prev.map(c => c.id === chart.id ? { ...c, is_bookmarked: newValue } : c));
    }
  };

  const handleBulkDelete = async (permanent: boolean = false) => {
    if (selectedItems.length === 0) return;

    const isAdmin = profile?.profession === 'admin';
    const isPermanent = permanent && isAdmin;

    if (permanent && !isAdmin) {
      alert("Permission denied: Only Admins can permanently delete items. Items will be moved to trash instead.");
    }

    const currentUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') : null) || 'guest-user';
    let itemsToDelete = [...selectedItems];

    if (!isAdmin) {
      const nonOwned = itemsToDelete.filter(item => {
        const itemObj = (item.type === 'folder' ? folders : charts).find(x => x.id === item.id);
        const cb = itemObj?.created_by;
        return cb && cb !== currentUserId && cb !== user?.id;
      });
      if (nonOwned.length > 0) {
        alert(`Permission denied: ${nonOwned.length} item(s) were created by others and cannot be deleted.`);
        itemsToDelete = itemsToDelete.filter(item => {
          const itemObj = (item.type === 'folder' ? folders : charts).find(x => x.id === item.id);
          const cb = itemObj?.created_by;
          return !cb || cb === currentUserId || cb === user?.id;
        });
        if (itemsToDelete.length === 0) {
          setSelectedItems([]);
          setBulkDeleteModal(false);
          return;
        }
      }
    }

    const itemIdsToDelete = new Set(itemsToDelete.map(i => i.id));

    setSelectedItems([]);
    setBulkDeleteModal(false);
    setDeleteConfirmText('');

    // Optimistic UI update
    setFolders(prev => prev.filter(f => !itemIdsToDelete.has(f.id)));
    setCharts(prev => prev.filter(c => !itemIdsToDelete.has(c.id)));
    if (searchResults && searchResults.length > 0) {
      setSearchResults(prev => prev.filter(c => !itemIdsToDelete.has(c.id)));
    }

    try {
      if (isPermanent) {
        await Promise.all(itemsToDelete.map(item => deleteEntry(item.id, item.type)));
      } else {
        await Promise.all(itemsToDelete.map(item => moveToTrash(item.id, item.type)));
      }
    } catch (err) {
      console.error('[FolderBrowser] Bulk delete error:', err);
    } finally {
      loadContents();
    }
  };

  const toggleSelection = (id: string, type: 'folder' | 'chart' | 'lyrics', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setSelectedItems(prev => {
      const exists = prev.find(item => item.id === id);
      if (exists) return prev.filter(item => item.id !== id);
      return [...prev, { id, type }];
    });
  };

  const handleSelectAll = () => {
    if (!canEdit) return;
    if (isSearching) {
      if (selectedItems.length === searchResults.length) {
        setSelectedItems([]);
      } else {
        setSelectedItems(searchResults.map(c => ({ id: c.id, type: c.type || kind })));
      }
    } else {
      const allFolders = folders.map(f => ({ id: f.id, type: 'folder' as const }));
      const allCharts = charts.map(c => ({ id: c.id, type: c.type || kind as any }));
      const totalCount = allFolders.length + allCharts.length;
      if (selectedItems.length === totalCount && totalCount > 0) {
        setSelectedItems([]);
      } else {
        setSelectedItems([...allFolders, ...allCharts]);
      }
    }
  };

  const RowMenu = ({ id, type, name, createdBy }: { id: string, type: 'folder' | 'chart' | 'lyrics', name: string, createdBy?: string }) => {
    const isAdmin = profile?.profession === 'admin';
    const currentUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') : null) || 'guest-user';
    const isCreator = !createdBy || createdBy === currentUserId || (user?.id && createdBy === user.id);
    const canDelete = isAdmin || isCreator;

    // Both admin and members can view the 3-dots options menu for editing/renaming/moving
    if (!canEdit && !isAdmin) {
      return null;
    }

    const isOpen = activeDropdown === id;
    return (
      <div className="relative" ref={isOpen ? dropdownRef : null}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isOpen) {
              const rect = e.currentTarget.getBoundingClientRect();
              if (window.innerHeight - rect.bottom < 220) {
                setDropdownDirection('up');
              } else {
                setDropdownDirection('down');
              }
              setActiveDropdown(id);
            } else {
              setActiveDropdown(null);
            }
          }}
          className="p-1.5 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none transition-colors"
          aria-label="More options"
        >
          <MoreVertical size={16} />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdown(null);
              }}
            />
            <div className={`absolute right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-48 bg-white/95 dark:bg-[#1c1c22]/95 backdrop-blur-2xl saturate-[180%] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)] z-50 border border-slate-200/80 dark:border-white/15 py-1.5 animate-in fade-in zoom-in-95 duration-150`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDropdown(null);
                  const targetUrl = type === 'lyrics' ? `/lyrics/edit/?id=${id}` : `/chart/edit/?id=${id}`;
                  router.push(targetUrl);
                }}
                className="flex items-center w-full px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
              >
                <Edit3 size={14} className="mr-2.5 text-orange-500" /> {type === 'lyrics' ? 'Edit Lyrics' : 'Edit Chart'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setRenameItem({ id, type, currentName: name }); }}
                className="flex items-center w-full px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
              >
                <Edit2 size={14} className="mr-2.5 text-slate-400" /> Rename
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setMoveItem({ id, type }); }}
                className="flex items-center w-full px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
              >
                <CornerRightDown size={14} className="mr-2.5 text-slate-400" /> Move
              </button>
              {(type === 'chart' || type === 'lyrics') && (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setActiveDropdown(null); 
                    let q: string[] = [];
                    try {
                      q = JSON.parse(localStorage.getItem('chord-grid-print-queue') || '[]');
                      if (!Array.isArray(q)) q = [];
                    } catch {
                      q = [];
                    }
                    if (!q.includes(id)) {
                      localStorage.setItem('chord-grid-print-queue', JSON.stringify([...q, id]));
                      alert('Added to print queue');
                    } else {
                      alert('Already in print queue');
                    }
                  }}
                  className="flex items-center w-full px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                >
                  <Printer size={14} className="mr-2.5 text-slate-400" /> Add to Printer
                </button>
              )}
              {canDelete ? (
                <>
                  <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] my-1 mx-2" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setDeleteItem({ id, type, name, createdBy }); setDeleteConfirmText(''); }}
                    className="flex items-center w-full px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} className="mr-2.5 text-rose-500" /> Move to Trash
                  </button>
                </>
              ) : (
                <>
                  <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] my-1 mx-2" />
                  <div className="px-4 py-1.5 text-[10px] text-text-muted italic select-none">
                    Created by another member
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // Selection Checkbox — only visible during selection mode (long-press) and when editing is allowed
  const SelectionCheckbox = ({ id, type }: { id: string, type: 'folder' | 'chart' | 'lyrics' }) => {
    if (!canEdit || selectedItems.length === 0) return null;
    const isSelected = selectedItems.some(i => i.id === id);
    return (
      <div
        onClick={(e) => toggleSelection(id, type, e)}
        className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm ${
          isSelected
            ? 'bg-orange-500 text-white border-2 border-orange-500 scale-105 shadow-md shadow-orange-500/30'
            : 'bg-white/20 dark:bg-black/50 border-2 border-white/70 dark:border-white/40 hover:border-orange-400'
        }`}
        title={isSelected ? 'Deselect item' : 'Select item'}
      >
        {isSelected && <Check size={12} className="stroke-[3.5] text-white" />}
      </div>
    );
  };

  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);

  return (
    <div
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-2 sm:pt-3"
      style={{
        paddingLeft: 'calc(1rem + max(env(safe-area-inset-left, 0px), var(--safe-area-inset-left, 0px)))',
        paddingRight: 'calc(1rem + max(env(safe-area-inset-right, 0px), var(--safe-area-inset-right, 0px)))',
        paddingBottom: 'calc(7.5rem + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))',
      }}
    >
      {/* Back button (only inside subfolders on desktop; phones/tablets use system back) */}
      {folderId && (
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => router.push(kind === 'lyrics' ? '/lyrics' : '/')}
            className="hidden lg:flex w-10 h-10 rounded-full glass-card items-center justify-center text-text-primary hover:bg-white/80 active:scale-95 transition-all shadow-sm"
            title="Back to root"
          >
            <CornerLeftUp size={18} />
          </button>
          {folderName && (
            <h2 className="text-xl font-bold text-text-primary tracking-tight truncate">
              {folderName}
            </h2>
          )}
        </div>
      )}

      {/* Search + action icon buttons on one row */}
      <div className="flex items-center gap-2.5 mb-6">
        {/* Search Field (Glass Pill) */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-9 py-2.5 glass-pill text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all shadow-sm"
            placeholder={folderId ? 'Search in folder…' : kind === 'lyrics' ? 'Search lyrics…' : 'Search charts…'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* View Mode Toggle Button */}
        <button
          onClick={() => {
            const nextMode = viewMode === 'grid' ? 'list' : 'grid';
            setViewMode(nextMode);
            localStorage.setItem('chord-grid-view-mode', nextMode);
          }}
          title={viewMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}
          className="w-10 h-10 rounded-full glass-pill flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/80 dark:hover:bg-white/10 active:scale-95 transition-all shadow-sm shrink-0"
        >
          {viewMode === 'grid' ? <List size={18} className="stroke-[2.2]" /> : <LayoutGrid size={18} className="stroke-[2.2]" />}
        </button>

        {/* Plus Action Button (Circular Dark Gradient) */}
        {canEdit && (
          <div className="relative shrink-0">
            <button
              onClick={() => setCreateDropdownOpen(prev => !prev)}
              title="Create New"
              className="w-10 h-10 rounded-full btn-dark-pill flex items-center justify-center shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              <Plus size={20} className="stroke-[2.5]" />
            </button>

            {createDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCreateDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white/55 dark:bg-[#1c1c22]/55 backdrop-blur-2xl saturate-[180%] rounded-2xl shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] z-50 border border-white/60 dark:border-white/15 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => { setCreateDropdownOpen(false); handleCreateFolder(); }}
                    className="flex items-center w-full px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                  >
                    <FolderPlus size={16} className="mr-2.5 text-orange-500 shrink-0" />
                    <span>New Folder</span>
                  </button>
                  <button
                    onClick={() => { setCreateDropdownOpen(false); handleCreateChart(); }}
                    className="flex items-center w-full px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                  >
                    <FilePlus size={16} className="mr-2.5 text-orange-500 shrink-0" />
                    <span>{kind === 'lyrics' ? 'New Lyrics' : 'New Chart'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="relative pt-2 pb-16">
        {/* 2-3 Decorative Blurred Blobs behind the tile grid */}
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-visible dark:opacity-20 transition-opacity" aria-hidden="true">
          <div
            className="absolute top-6 left-[6%] w-[220px] h-[220px] rounded-full pointer-events-none"
            style={{
              backgroundColor: '#fd944e',
              filter: 'blur(60px)',
              WebkitFilter: 'blur(60px)',
              opacity: 0.5,
            }}
          />
          <div
            className="absolute top-28 right-[10%] w-[220px] h-[220px] rounded-full pointer-events-none"
            style={{
              backgroundColor: '#ffd7b8',
              filter: 'blur(60px)',
              WebkitFilter: 'blur(60px)',
              opacity: 0.55,
            }}
          />
          <div
            className="absolute bottom-12 left-[36%] w-[220px] h-[220px] rounded-full pointer-events-none"
            style={{
              backgroundColor: '#93c5fd',
              filter: 'blur(60px)',
              WebkitFilter: 'blur(60px)',
              opacity: 0.45,
            }}
          />
        </div>

        {loading && !isSearching ? (
          <div className="py-14 sm:py-20 flex items-center justify-center animate-in fade-in duration-300">
            <LogoLoading
              variant="card"
              statusText={folderName ? `Loading ${folderName}...` : (kind === 'lyrics' ? 'Loading lyrics...' : 'Loading library...')}
            />
          </div>
        ) : isSearching ? (
          <div className="flex flex-col gap-6 relative z-0">
            {matchingFolders.length === 0 && matchingCharts.length === 0 ? (
              <div className="p-16 text-center text-text-primary font-medium ios-tile">
                No folders or {kind === 'lyrics' ? 'lyrics' : 'charts'} found matching "{searchQuery}"
              </div>
            ) : (
              <>
                {/* ── 1. MATCHING FOLDERS SECTION (1st Priority, A-Z) ── */}
                {matchingFolders.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-xs">
                          <FolderIcon size={13} />
                        </div>
                        <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Folders</span>
                        <span className="text-[10px] font-bold text-text-secondary px-2 py-0.5 rounded-full bg-surface-raised border border-border">
                          {matchingFolders.length}
                        </span>
                      </div>
                    </div>

                    <div className={viewMode === 'list' ? 'flex flex-col gap-2.5' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6'}>
                      {matchingFolders.map((folder) => (
                        viewMode === 'list' ? (
                          <div
                            key={folder.id}
                            className={`ios-tile px-4 py-3 flex items-center justify-between cursor-pointer group relative transition-all duration-200 select-none ${
                              selectedItems.some(i => i.id === folder.id) ? 'ring-2 ring-orange-500 shadow-glow' : ''
                            } ${activeDropdown === folder.id ? 'z-[999]' : ''}`}
                            style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                            onPointerDown={(e) => handlePointerDown(folder.id, 'folder', e)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onClick={(e) => handleCardClick(folder.id, 'folder', e, () => router.push(kind === 'lyrics' ? `/lyrics/folder?id=${folder.id}` : `/folder?id=${folder.id}`))}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (Date.now() - lastLongPressTime.current > 600) {
                                toggleSelection(folder.id, 'folder', e);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                              {selectedItems.length > 0 && (
                                <div onClick={e => e.stopPropagation()} className="shrink-0 animate-in fade-in zoom-in-75 duration-150">
                                  <SelectionCheckbox id={folder.id} type="folder" />
                                </div>
                              )}
                              <div className="w-10 h-10 icon-well flex items-center justify-center shrink-0">
                                <FolderIcon size={18} className="text-orange-500/80" fill="currentColor" fillOpacity={0.2} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-text-primary truncate">{folder.name}</p>
                                <p className="text-[11px] text-orange-600/90 dark:text-orange-400/90 font-medium truncate mt-0.5">
                                  {folder.path}
                                </p>
                              </div>
                            </div>
                            <div onClick={e => e.stopPropagation()} className="shrink-0">
                              <RowMenu id={folder.id} type="folder" name={folder.name} createdBy={folder.created_by} />
                            </div>
                          </div>
                        ) : (
                          <div
                            key={folder.id}
                            className={`ios-tile p-4 sm:p-5 flex flex-col items-center justify-center cursor-pointer group relative transition-all duration-200 select-none ${
                              selectedItems.some(i => i.id === folder.id) ? 'ring-2 ring-orange-500 shadow-glow' : ''
                            } ${activeDropdown === folder.id ? 'z-[999]' : ''}`}
                            style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                            onPointerDown={(e) => handlePointerDown(folder.id, 'folder', e)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onClick={(e) => handleCardClick(folder.id, 'folder', e, () => router.push(kind === 'lyrics' ? `/lyrics/folder?id=${folder.id}` : `/folder?id=${folder.id}`))}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (Date.now() - lastLongPressTime.current > 600) {
                                toggleSelection(folder.id, 'folder', e);
                              }
                            }}
                          >
                            {selectedItems.length > 0 && (
                              <div className="absolute top-3 left-3 z-10 animate-in fade-in zoom-in-75 duration-150" onClick={e => e.stopPropagation()}>
                                <SelectionCheckbox id={folder.id} type="folder" />
                              </div>
                            )}
                            <div className="absolute top-2.5 right-2.5 z-10" onClick={e => e.stopPropagation()}>
                              <RowMenu id={folder.id} type="folder" name={folder.name} createdBy={folder.created_by} />
                            </div>
                            <div className="w-14 h-14 sm:w-16 sm:h-16 icon-well flex items-center justify-center mb-3 mt-3 transition-transform group-hover:scale-105">
                              <FolderIcon size={26} className="text-orange-500/80 stroke-[2.2]" fill="currentColor" fillOpacity={0.2} />
                            </div>
                            <p className="text-sm font-bold text-text-primary text-center w-full line-clamp-2 leading-tight px-1">{folder.name}</p>
                            <p className="text-[10px] text-orange-600/90 dark:text-orange-400/90 font-medium truncate max-w-full px-1 mt-1">
                              {folder.path}
                            </p>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* ── 2. MATCHING CHARTS / FILES SECTION (A-Z) ── */}
                {matchingCharts.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-xs">
                          {kind === 'lyrics' ? <Music size={13} /> : <FileText size={13} />}
                        </div>
                        <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                          {kind === 'lyrics' ? 'Lyrics & Songs' : 'Chord Charts'}
                        </span>
                        <span className="text-[10px] font-bold text-text-secondary px-2 py-0.5 rounded-full bg-surface-raised border border-border">
                          {matchingCharts.length}
                        </span>
                      </div>
                    </div>

                    <div className={viewMode === 'list' ? 'flex flex-col gap-2.5' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6'}>
                      {matchingCharts.map((chart) => (
                        viewMode === 'list' ? (
                          <div
                            key={chart.id}
                            className={`ios-tile px-4 py-3 flex items-center justify-between cursor-pointer group relative transition-all duration-200 select-none ${
                              selectedItems.some(i => i.id === chart.id) ? 'ring-2 ring-orange-500 shadow-glow' : ''
                            } ${activeDropdown === chart.id ? 'z-[999]' : ''}`}
                            style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                            onPointerDown={(e) => handlePointerDown(chart.id, kind, e)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onClick={(e) => handleCardClick(chart.id, kind, e, () => router.push(kind === 'lyrics' ? `/lyrics/view?id=${chart.id}` : `/chart?id=${chart.id}`))}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (Date.now() - lastLongPressTime.current > 600) {
                                toggleSelection(chart.id, kind, e);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                              {selectedItems.length > 0 && (
                                <div onClick={e => e.stopPropagation()} className="shrink-0 animate-in fade-in zoom-in-75 duration-150">
                                  <SelectionCheckbox id={chart.id} type={kind} />
                                </div>
                              )}
                              <div className="w-10 h-10 icon-well flex items-center justify-center shrink-0">
                                {kind === 'lyrics' ? (
                                  <Music size={18} className="text-orange-500" />
                                ) : (
                                  <FileText size={18} className="text-orange-500" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-text-primary truncate">{chart.title}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                                  <span className="text-orange-600/90 dark:text-orange-400/90 font-medium truncate max-w-[200px]">
                                    {chart.path}
                                  </span>
                                  <span className="text-text-muted">•</span>
                                  <span className="text-text-secondary font-medium shrink-0">
                                    {new Date(chart.updated_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                              <button
                                className={`p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all ${
                                  chart.is_bookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleBookmark(chart);
                                }}
                                title={chart.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Chart'}
                              >
                                <Star size={16} className={chart.is_bookmarked ? "text-amber-500 fill-amber-500 drop-shadow-sm" : "text-text-muted hover:text-amber-500"} />
                              </button>
                              <RowMenu id={chart.id} type={kind} name={chart.title} createdBy={chart.created_by} />
                            </div>
                          </div>
                        ) : (
                          <div
                            key={chart.id}
                            className={`ios-tile p-4 sm:p-5 flex flex-col items-center justify-center cursor-pointer group relative transition-all duration-200 select-none ${
                              selectedItems.some(i => i.id === chart.id) ? 'ring-2 ring-orange-500 shadow-glow' : ''
                            } ${activeDropdown === chart.id ? 'z-[999]' : ''}`}
                            style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                            onPointerDown={(e) => handlePointerDown(chart.id, kind, e)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onClick={(e) => handleCardClick(chart.id, kind, e, () => router.push(kind === 'lyrics' ? `/lyrics/view?id=${chart.id}` : `/chart?id=${chart.id}`))}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (Date.now() - lastLongPressTime.current > 600) {
                                toggleSelection(chart.id, kind, e);
                              }
                            }}
                          >
                            {selectedItems.length > 0 && (
                              <div className="absolute top-3 left-3 z-10 animate-in fade-in zoom-in-75 duration-150" onClick={e => e.stopPropagation()}>
                                <SelectionCheckbox id={chart.id} type={kind} />
                              </div>
                            )}

                            <div className="absolute top-2.5 right-2.5 z-10" onClick={e => e.stopPropagation()}>
                              <RowMenu id={chart.id} type={kind} name={chart.title} createdBy={chart.created_by} />
                            </div>

                            <div className="w-14 h-14 sm:w-16 sm:h-16 icon-well flex items-center justify-center mb-3 mt-3 transition-transform group-hover:scale-105">
                              {kind === 'lyrics' ? (
                                <Music size={24} className="text-orange-500 stroke-[2.2]" />
                              ) : (
                                <FileText size={24} className="text-orange-500 stroke-[2.2]" />
                              )}
                            </div>

                            <p className="text-sm font-bold text-text-primary text-center w-full line-clamp-2 leading-tight px-1">{chart.title}</p>
                            <p className="text-[10px] text-orange-600/90 dark:text-orange-400/90 font-medium truncate max-w-full px-1 mt-1">
                              {chart.path}
                            </p>
                            <p className="text-[11px] text-text-secondary mt-0.5 font-medium">{new Date(chart.updated_at).toLocaleDateString()}</p>

                            <button
                              className={`absolute bottom-2.5 right-2.5 z-10 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all ${
                                chart.is_bookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleBookmark(chart);
                              }}
                              title={chart.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Chart'}
                            >
                              <Star size={15} className={chart.is_bookmarked ? "text-amber-500 fill-amber-500 drop-shadow-sm" : "text-text-muted hover:text-amber-500"} />
                            </button>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className={viewMode === 'list' ? 'flex flex-col gap-2.5 relative z-0' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 relative z-0'}>
            {folders.length === 0 && charts.length === 0 ? (
              <div className="col-span-full p-12 sm:p-16 text-center flex flex-col items-center justify-center ios-tile">
                <div className="w-20 h-20 icon-well flex items-center justify-center mb-5">
                  <FolderIcon size={32} className="text-orange-500/70" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-1.5">No songs or folders yet</h3>
                <p className="text-xs text-text-secondary max-w-sm mb-6 font-medium">
                  {canEdit 
                    ? "Create a new folder to organize your library, or load ready-to-use sample worship songs, jazz standards, and pop classics."
                    : `No ${kind === 'lyrics' ? 'lyrics sheets' : 'chord charts'} are available in this folder yet.`}
                </p>
                {canEdit && (
                  <button
                    onClick={async () => {
                      setLoading(true);
                      await seedSampleData(user?.id);
                      const res = await listFolder(folderId, kind);
                      setFolders(res?.folders || []);
                      setCharts(res?.charts || []);
                      setLoading(false);
                    }}
                    className="px-6 py-3 rounded-full btn-gradient-orange text-xs font-bold shadow-glow flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Sparkles size={16} /> Load Demo Charts & Folders
                  </button>
                )}
              </div>
            ) : (
              <>
                {sortedFolders.map(folder => (
                  viewMode === 'list' ? (
                    <div
                      key={folder.id}
                      className={`ios-tile px-4 py-3 flex items-center justify-between cursor-pointer group relative transition-all duration-200 select-none ${
                        selectedItems.some(i => i.id === folder.id) ? 'ring-2 ring-orange-500 shadow-glow' : ''
                      } ${activeDropdown === folder.id ? 'z-[999]' : ''}`}
                      style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                      onPointerDown={(e) => handlePointerDown(folder.id, 'folder', e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onClick={(e) => handleCardClick(folder.id, 'folder', e, () => router.push(kind === 'lyrics' ? `/lyrics/folder?id=${folder.id}` : `/folder?id=${folder.id}`))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (Date.now() - lastLongPressTime.current > 600) {
                          toggleSelection(folder.id, 'folder', e);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        {selectedItems.length > 0 && (
                          <div onClick={e => e.stopPropagation()} className="shrink-0 animate-in fade-in zoom-in-75 duration-150">
                            <SelectionCheckbox id={folder.id} type="folder" />
                          </div>
                        )}
                        <div className="w-10 h-10 icon-well flex items-center justify-center shrink-0">
                          <FolderIcon size={18} className="text-orange-500/80" fill="currentColor" fillOpacity={0.2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-text-primary truncate">{folder.name}</p>
                          <p className="text-[11px] text-text-secondary mt-0.5 font-medium">{new Date(folder.updated_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div onClick={e => e.stopPropagation()} className="shrink-0">
                        <RowMenu id={folder.id} type="folder" name={folder.name} createdBy={folder.created_by} />
                      </div>
                    </div>
                  ) : (
                    <div
                      key={folder.id}
                      className={`ios-tile p-4 sm:p-5 flex flex-col items-center justify-center cursor-pointer group relative transition-all duration-200 select-none ${
                        selectedItems.some(i => i.id === folder.id) ? 'ring-2 ring-orange-500 shadow-glow' : ''
                      } ${activeDropdown === folder.id ? 'z-[999]' : ''}`}
                      style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                      onPointerDown={(e) => handlePointerDown(folder.id, 'folder', e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onClick={(e) => handleCardClick(folder.id, 'folder', e, () => router.push(kind === 'lyrics' ? `/lyrics/folder?id=${folder.id}` : `/folder?id=${folder.id}`))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (Date.now() - lastLongPressTime.current > 600) {
                          toggleSelection(folder.id, 'folder', e);
                        }
                      }}
                    >
                      {/* Top Left: Checkbox (only shown in selection mode) */}
                      {selectedItems.length > 0 && (
                        <div className="absolute top-3 left-3 z-10 animate-in fade-in zoom-in-75 duration-150" onClick={e => e.stopPropagation()}>
                          <SelectionCheckbox id={folder.id} type="folder" />
                        </div>
                      )}

                      {/* Top Right: Kebab Menu */}
                      <div className="absolute top-2.5 right-2.5 z-10" onClick={e => e.stopPropagation()}>
                        <RowMenu id={folder.id} type="folder" name={folder.name} createdBy={folder.created_by} />
                      </div>

                      {/* Centered Circular Glass Icon Well */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 icon-well flex items-center justify-center mb-3 mt-3 transition-transform group-hover:scale-105">
                        <FolderIcon size={26} className="text-orange-500/80" fill="currentColor" fillOpacity={0.18} />
                      </div>

                      {/* Title & Date */}
                      <p className="text-sm font-bold text-text-primary text-center w-full line-clamp-2 leading-tight px-1">{folder.name}</p>
                      <p className="text-[11px] text-text-secondary mt-1 font-medium">{new Date(folder.updated_at).toLocaleDateString()}</p>
                    </div>
                  )
                ))}
                
                {charts.map(chart => (
                  viewMode === 'list' ? (
                    <div
                      key={chart.id}
                      className={`ios-tile px-4 py-3 flex items-center justify-between cursor-pointer group relative transition-all duration-200 select-none ${
                        selectedItems.some(i => i.id === chart.id) ? 'ring-2 ring-orange-500 shadow-glow' : ''
                      } ${activeDropdown === chart.id ? 'z-[999]' : ''}`}
                      style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                      onPointerDown={(e) => handlePointerDown(chart.id, kind, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onClick={(e) => handleCardClick(chart.id, kind, e, () => router.push(kind === 'lyrics' ? `/lyrics/view?id=${chart.id}` : `/chart?id=${chart.id}`))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (Date.now() - lastLongPressTime.current > 600) {
                          toggleSelection(chart.id, kind, e);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        {selectedItems.length > 0 && (
                          <div onClick={e => e.stopPropagation()} className="shrink-0 animate-in fade-in zoom-in-75 duration-150">
                            <SelectionCheckbox id={chart.id} type={kind} />
                          </div>
                        )}
                        <div className="w-10 h-10 icon-well flex items-center justify-center shrink-0">
                          <FileText size={18} className="text-orange-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-text-primary truncate">{chart.title}</p>
                          <p className="text-[11px] text-text-secondary mt-0.5 font-medium">{new Date(chart.updated_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          className={`p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all ${
                            chart.is_bookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBookmark(chart);
                          }}
                          title={chart.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Chart'}
                        >
                          <Star size={16} className={chart.is_bookmarked ? "text-amber-500 fill-amber-500 drop-shadow-sm" : "text-text-muted hover:text-amber-500"} />
                        </button>
                        <RowMenu id={chart.id} type={kind} name={chart.title} createdBy={chart.created_by} />
                      </div>
                    </div>
                  ) : (
                    <div
                      key={chart.id}
                      className={`ios-tile p-4 sm:p-5 flex flex-col items-center justify-center cursor-pointer group relative transition-all duration-200 select-none ${
                        selectedItems.some(i => i.id === chart.id) ? 'ring-2 ring-orange-500 shadow-glow' : ''
                      } ${activeDropdown === chart.id ? 'z-[999]' : ''}`}
                      style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                      onPointerDown={(e) => handlePointerDown(chart.id, kind, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onClick={(e) => handleCardClick(chart.id, kind, e, () => router.push(kind === 'lyrics' ? `/lyrics/view?id=${chart.id}` : `/chart?id=${chart.id}`))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (Date.now() - lastLongPressTime.current > 600) {
                          toggleSelection(chart.id, kind, e);
                        }
                      }}
                    >
                      {/* Top Left: Checkbox (only shown in selection mode) */}
                      {selectedItems.length > 0 && (
                        <div className="absolute top-3 left-3 z-10 animate-in fade-in zoom-in-75 duration-150" onClick={e => e.stopPropagation()}>
                          <SelectionCheckbox id={chart.id} type={kind} />
                        </div>
                      )}

                      {/* Top Right: Kebab Menu */}
                      <div className="absolute top-2.5 right-2.5 z-10" onClick={e => e.stopPropagation()}>
                        <RowMenu id={chart.id} type={kind} name={chart.title} createdBy={chart.created_by} />
                      </div>

                      {/* Centered Circular Glass Icon Well */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 icon-well flex items-center justify-center mb-3 mt-3 transition-transform group-hover:scale-105">
                        <FileText size={24} className="text-orange-500 stroke-[2.2]" />
                      </div>

                      {/* Title & Date */}
                      <p className="text-sm font-bold text-text-primary text-center w-full line-clamp-2 leading-tight px-1">{chart.title}</p>
                      <p className="text-[11px] text-text-secondary mt-1 font-medium">{new Date(chart.updated_at).toLocaleDateString()}</p>

                      {/* Bookmark Star */}
                      <button
                        className={`absolute bottom-2.5 right-2.5 z-10 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all ${
                          chart.is_bookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBookmark(chart);
                        }}
                        title={chart.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Chart'}
                      >
                        <Star size={15} className={chart.is_bookmarked ? "text-amber-500 fill-amber-500 drop-shadow-sm" : "text-text-muted hover:text-amber-500"} />
                      </button>
                    </div>
                  )
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bulk Action Bar (Floating Glass Pill Dock) */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-5 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-white/50 dark:bg-[#18181c]/50 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 text-text-primary px-5 py-2.5 rounded-full shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] flex items-center space-x-3 animate-in slide-in-from-bottom-4 duration-200">
          <span className="text-xs font-bold text-text-primary whitespace-nowrap">
            {selectedItems.length} selected
          </span>
          <div className="flex items-center space-x-2 border-l border-border pl-3">
            <button
              onClick={handleSelectAll}
              className="px-3.5 py-1.5 text-xs font-bold text-text-primary glass-pill hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer"
            >
              {(isSearching ? selectedItems.length === searchResults.length && searchResults.length > 0 : selectedItems.length === (folders.length + charts.length) && (folders.length + charts.length) > 0) ? 'Deselect All' : 'Select All'}
            </button>
            {canEdit && (
              <>
                <button
                  onClick={() => setIsBulkMove(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-text-primary glass-pill hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer"
                >
                  Move
                </button>
                <button
                  onClick={() => { setBulkDeleteModal(true); setDeleteConfirmText(''); }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-500 rounded-full hover:bg-rose-600 shadow-sm transition-all cursor-pointer"
                >
                  Move to Trash
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedItems([])}
              className="ml-1 p-1 text-text-muted hover:text-text-primary transition-all rounded-full"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <FolderPickerModal
        isOpen={!!moveItem || isBulkMove}
        onClose={() => { setMoveItem(null); setIsBulkMove(false); }}
        onMoveHere={executeMove}
        excludeIds={isBulkMove ? selectedItems.filter(i => i.type === 'folder').map(i => i.id) : (moveItem?.type === 'folder' ? [moveItem.id] : [])}
      />

      {/* Inline Rename Modal */}
      {renameItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white/60 dark:bg-[#18181c]/60 backdrop-blur-2xl saturate-[180%] rounded-[28px] p-6 w-full max-w-sm shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15">
            <h3 className="text-base font-bold text-text-primary mb-4 text-center">Rename {renameItem.type}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('newName') as HTMLInputElement;
              executeRename(input.value);
            }}>
              <input
                name="newName"
                autoFocus
                defaultValue={renameItem.currentName}
                className="w-full px-4 py-3 glass-pill text-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all mb-6 font-semibold text-sm"
              />
              <div className="flex justify-center gap-3">
                <button type="button" onClick={() => setRenameItem(null)} className="flex-1 py-2.5 text-xs font-bold text-text-secondary glass-pill hover:bg-white dark:hover:bg-white/10 transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 text-xs font-bold btn-dark-pill transition-all">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Delete Confirmation */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white/60 dark:bg-[#18181c]/60 backdrop-blur-2xl saturate-[180%] rounded-[28px] p-6 w-full max-w-sm shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 text-center">
            <div className="w-14 h-14 mx-auto icon-well flex items-center justify-center mb-4">
              <Trash2 size={22} className="text-rose-500" />
            </div>
            <h3 className="text-base font-bold text-text-primary mb-2">Move {deleteItem.type} to Trash?</h3>
            <p className="text-xs text-text-secondary mb-5 font-medium px-2 leading-relaxed">
              Are you sure you want to move "{deleteItem.name}" to trash?
              {deleteItem.type === 'folder' && " All nested contents will also be moved to trash."}
              <br />
              <span className="text-[11px] text-orange-600 dark:text-orange-400 mt-1 block">
                It can be restored anytime from the Trash section.
              </span>
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => executeDelete(false)} 
                className="w-full py-2.5 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-rose-400 rounded-full shadow-glow hover:brightness-105 transition-all cursor-pointer"
              >
                Move to Trash
              </button>
              {profile?.profession === 'admin' && (
                <button 
                  onClick={() => executeDelete(true)} 
                  className="w-full py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-full transition-all cursor-pointer"
                >
                  Delete Permanently (Admin)
                </button>
              )}
              <button onClick={() => { setDeleteItem(null); setDeleteConfirmText(''); }} className="w-full py-2 text-xs font-semibold text-text-muted hover:text-text-primary transition-all cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {bulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white/60 dark:bg-[#18181c]/60 backdrop-blur-2xl saturate-[180%] rounded-[28px] p-6 w-full max-w-sm shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 text-center">
            <div className="w-14 h-14 mx-auto icon-well flex items-center justify-center mb-4">
              <Trash2 size={22} className="text-rose-500" />
            </div>
            <h3 className="text-base font-bold text-text-primary mb-2">Move {selectedItems.length} items to Trash?</h3>
            <p className="text-xs text-text-secondary mb-5 font-medium px-2 leading-relaxed">
              Are you sure you want to move {selectedItems.length} items to trash? All items will be preserved and can be restored anytime.
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => handleBulkDelete(false)} 
                className="w-full py-2.5 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-rose-400 rounded-full shadow-glow hover:brightness-105 transition-all cursor-pointer"
              >
                Move to Trash
              </button>
              {profile?.profession === 'admin' && (
                <button 
                  onClick={() => handleBulkDelete(true)} 
                  className="w-full py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-full transition-all cursor-pointer"
                >
                  Delete Permanently (Admin)
                </button>
              )}
              <button onClick={() => { setBulkDeleteModal(false); setDeleteConfirmText(''); }} className="w-full py-2 text-xs font-semibold text-text-muted hover:text-text-primary transition-all cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {createFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white/60 dark:bg-[#18181c]/60 backdrop-blur-2xl saturate-[180%] rounded-[28px] p-6 w-full max-w-sm shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15">
            <h3 className="text-base font-bold text-text-primary mb-4 text-center">New Folder</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('folderName') as HTMLInputElement;
              const name = input.value;
              if (name.trim()) {
                await createFolder(folderId, name.trim(), kind);
                loadContents();
              }
              setCreateFolderModal(false);
            }}>
              <input
                name="folderName"
                autoFocus
                placeholder="Folder name"
                className="w-full px-4 py-3 glass-pill text-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all mb-6 font-semibold text-sm"
              />
              <div className="flex justify-center gap-3">
                <button type="button" onClick={() => setCreateFolderModal(false)} className="flex-1 py-2.5 text-xs font-bold text-text-secondary glass-pill hover:bg-white dark:hover:bg-white/10 transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 text-xs font-bold btn-dark-pill transition-all">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* "Press back again to exit" Toast */}
      {showExitToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-white/70 dark:bg-black/60 text-text-primary dark:text-white border border-white/60 dark:border-white/15 text-xs font-bold px-4 py-2 rounded-full shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl saturate-[180%] animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none">
          Press back again to exit
        </div>
      )}

      {/* Band Connect & Create Workspace Modal */}
      <BandConnectModal
        isOpen={bandModalOpen}
        onClose={() => setBandModalOpen(false)}
        onSuccess={() => loadContents()}
      />

    </div>
  );
}
