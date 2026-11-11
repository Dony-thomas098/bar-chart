-- ==============================================================================
-- Chordly Migration 010 Rollback: Restore Migration 008 RLS Policies
-- ==============================================================================

DROP POLICY IF EXISTS "Band isolation select charts" ON public.charts;
CREATE POLICY "Band isolation select charts"
ON public.charts FOR SELECT TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

DROP POLICY IF EXISTS "Band isolation select lyrics" ON public.lyrics;
CREATE POLICY "Band isolation select lyrics"
ON public.lyrics FOR SELECT TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

DROP POLICY IF EXISTS "Band isolation select folders" ON public.folders;
CREATE POLICY "Band isolation select folders"
ON public.folders FOR SELECT TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

DROP POLICY IF EXISTS "Band isolation select setlists" ON public.setlists;
CREATE POLICY "Band isolation select setlists"
ON public.setlists FOR SELECT TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

DROP POLICY IF EXISTS "Band isolation select setlist_items" ON public.setlist_items;
CREATE POLICY "Band isolation select setlist_items"
ON public.setlist_items FOR SELECT TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);
