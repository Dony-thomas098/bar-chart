'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBookmarks, toggleBookmark } from '@/lib/storage';
import { Header } from '@/components/Header';
import { GlassCard, IconButton } from '@/components/ui/primitives';
import { FileText, Music, Star, BookOpen } from 'lucide-react';

export default function BookmarksPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    setLoading(true);
    const data = await getBookmarks();
    setItems(data);
    setLoading(false);
  };

  const handleToggleBookmark = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleBookmark(item.id, item.type, false);
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-4 pt-[max(env(safe-area-inset-top,1.5rem),1.5rem)] pb-36">
        <div className="flex items-center gap-3 mb-8 mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight flex items-center gap-2.5">
              <Star size={26} className="text-amber-500 fill-amber-500" /> Bookmarks
            </h1>
            <p className="text-xs text-text-secondary font-medium mt-0.5">
              Your favorite chord charts and lyrics sheets.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
          </div>
        ) : items.length === 0 ? (
          <GlassCard className="p-16 text-center max-w-md mx-auto my-12">
            <div className="mx-auto h-20 w-20 bg-amber-500/10 rounded-full shadow-inner-glass border border-amber-500/20 flex items-center justify-center mb-5 text-amber-500">
              <Star size={32} strokeWidth={2} className="fill-amber-500/20" />
            </div>
            <h3 className="text-base font-bold text-text-primary mb-1 tracking-tight">No bookmarks yet</h3>
            <p className="text-xs text-text-secondary leading-relaxed">Tap the star icon on any chart or lyric to add it to your quick-access bookmarks.</p>
          </GlassCard>
        ) : (
          <div className="space-y-10">
            {items.filter(i => i.type === 'chart').length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                  <FileText size={18} className="text-orange-500" /> Chords
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                  {items.filter(i => i.type === 'chart').map(item => (
                    <GlassCard
                      key={item.id}
                      interactive
                      className="p-5 flex flex-col items-center justify-center cursor-pointer relative group"
                      onClick={() => router.push(`/chart?id=${item.id}`)}
                    >
                      <button
                        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-10"
                        onClick={(e) => handleToggleBookmark(item, e)}
                        title="Remove bookmark"
                      >
                        <Star size={16} className="text-amber-500 fill-amber-500 transition-transform active:scale-75" />
                      </button>

                      {/* Icon Well */}
                      <div className="w-16 h-16 bg-white/80 dark:bg-white/10 rounded-full flex items-center justify-center mb-3.5 shadow-inner-glass border border-glass group-hover:scale-105 transition-transform">
                        <FileText size={24} className="text-orange-600 dark:text-orange-400" />
                      </div>

                      <p className="text-sm font-bold text-text-primary text-center w-full truncate tracking-tight">{item.title}</p>
                      <p className="text-[11px] text-text-muted mt-1">{new Date(item.updated_at).toLocaleDateString()}</p>
                    </GlassCard>
                  ))}
                </div>
              </div>
            )}

            {items.filter(i => i.type === 'lyrics').length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                  <Music size={18} className="text-rose-500" /> Lyrics
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                  {items.filter(i => i.type === 'lyrics').map(item => (
                    <GlassCard
                      key={item.id}
                      interactive
                      className="p-5 flex flex-col items-center justify-center cursor-pointer relative group"
                      onClick={() => router.push(`/lyrics/view?id=${item.id}`)}
                    >
                      <button
                        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-10"
                        onClick={(e) => handleToggleBookmark(item, e)}
                        title="Remove bookmark"
                      >
                        <Star size={16} className="text-amber-500 fill-amber-500 transition-transform active:scale-75" />
                      </button>

                      {/* Icon Well */}
                      <div className="w-16 h-16 bg-white/80 dark:bg-white/10 rounded-full flex items-center justify-center mb-3.5 shadow-inner-glass border border-glass group-hover:scale-105 transition-transform">
                        <Music size={24} className="text-rose-600 dark:text-rose-400" />
                      </div>

                      <p className="text-sm font-bold text-text-primary text-center w-full truncate tracking-tight">{item.title}</p>
                      <p className="text-[11px] text-text-muted mt-1">{new Date(item.updated_at).toLocaleDateString()}</p>
                    </GlassCard>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
