-- ==============================================================================
-- Chordly Migration 008 Rollback: Restore Previous Shared Security Model
-- ==============================================================================
-- Run this in your Supabase Dashboard SQL Editor if you need to rollback Migration 008.
-- ==============================================================================

-- ─── 1. DROP BAND ISOLATION TRIGGERS & FUNCTIONS ─────────────────────────────
DROP TRIGGER IF EXISTS trg_set_band_id_charts ON public.charts;
DROP TRIGGER IF EXISTS trg_set_band_id_lyrics ON public.lyrics;
DROP TRIGGER IF EXISTS trg_set_band_id_folders ON public.folders;
DROP TRIGGER IF EXISTS trg_set_band_id_setlists ON public.setlists;
DROP TRIGGER IF EXISTS trg_set_band_id_setlist_items ON public.setlist_items;

DROP FUNCTION IF EXISTS public.set_band_id_from_profile();
DROP FUNCTION IF EXISTS public.set_setlist_item_band_id();
DROP FUNCTION IF EXISTS public.current_user_band_id();

-- ─── 2. DROP BAND ISOLATION RLS POLICIES ─────────────────────────────────────
DROP POLICY IF EXISTS "Band isolation select folders" ON public.folders;
DROP POLICY IF EXISTS "Band isolation insert folders" ON public.folders;
DROP POLICY IF EXISTS "Band isolation update folders" ON public.folders;
DROP POLICY IF EXISTS "Band isolation delete folders" ON public.folders;

DROP POLICY IF EXISTS "Band isolation select charts" ON public.charts;
DROP POLICY IF EXISTS "Band isolation insert charts" ON public.charts;
DROP POLICY IF EXISTS "Band isolation update charts" ON public.charts;
DROP POLICY IF EXISTS "Band isolation delete charts" ON public.charts;

DROP POLICY IF EXISTS "Band isolation select lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Band isolation insert lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Band isolation update lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Band isolation delete lyrics" ON public.lyrics;

DROP POLICY IF EXISTS "Band isolation select setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band isolation insert setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band isolation update setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band isolation delete setlists" ON public.setlists;

DROP POLICY IF EXISTS "Band isolation select setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Band isolation insert setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Band isolation update setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Band isolation delete setlist_items" ON public.setlist_items;

-- ─── 3. RESTORE PREVIOUS LOCKED-DOWN RLS POLICIES ─────────────────────────────

-- FOLDERS
CREATE POLICY "Allow read folders"
ON public.folders FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Allow authenticated insert folders"
ON public.folders FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update folders"
ON public.folders FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow creator or admin delete folders"
ON public.folders FOR DELETE TO authenticated
USING (
  created_by::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
  )
);

-- CHARTS
CREATE POLICY "Allow read charts"
ON public.charts FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Allow authenticated insert charts"
ON public.charts FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update charts"
ON public.charts FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow creator or admin delete charts"
ON public.charts FOR DELETE TO authenticated
USING (
  created_by::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
  )
);

-- LYRICS
CREATE POLICY "Allow read lyrics"
ON public.lyrics FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Allow authenticated insert lyrics"
ON public.lyrics FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update lyrics"
ON public.lyrics FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow creator or admin delete lyrics"
ON public.lyrics FOR DELETE TO authenticated
USING (
  created_by::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
  )
);

-- SETLISTS
CREATE POLICY "Allow read setlists"
ON public.setlists FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Allow authenticated insert setlists"
ON public.setlists FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update setlists"
ON public.setlists FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow creator or admin delete setlists"
ON public.setlists FOR DELETE TO authenticated
USING (
  created_by::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
  )
);

-- SETLIST ITEMS
CREATE POLICY "Allow read setlist_items"
ON public.setlist_items FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Allow authenticated insert setlist_items"
ON public.setlist_items FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update setlist_items"
ON public.setlist_items FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow creator or admin delete setlist_items"
ON public.setlist_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_items.setlist_id
      AND (
        s.created_by::text = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
        )
      )
  )
);

-- ─── 4. DROP INDEXES ON BAND_ID ──────────────────────────────────────────────
DROP INDEX IF EXISTS idx_folders_band_id;
DROP INDEX IF EXISTS idx_charts_band_id;
DROP INDEX IF EXISTS idx_lyrics_band_id;
DROP INDEX IF EXISTS idx_setlists_band_id;
DROP INDEX IF EXISTS idx_setlist_items_band_id;

-- ─── 5. OPTIONALLY REMOVE COLUMNS ─────────────────────────────────────────────
-- Uncomment if you want to completely remove the columns:
-- ALTER TABLE public.folders DROP COLUMN IF EXISTS band_id;
-- ALTER TABLE public.charts DROP COLUMN IF EXISTS band_id;
-- ALTER TABLE public.lyrics DROP COLUMN IF EXISTS band_id;
-- ALTER TABLE public.setlists DROP COLUMN IF EXISTS band_id;
-- ALTER TABLE public.setlist_items DROP COLUMN IF EXISTS band_id;
