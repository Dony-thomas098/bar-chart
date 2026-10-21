-- ==============================================================================
-- Chordly Migration 008: Band-Level Data Isolation & Strict Multi-Tenant Security
-- ==============================================================================
-- Purpose:
-- 1. Adds nullable `band_id` column to catalog tables: charts, lyrics, folders,
--    setlists, and setlist_items with foreign key references to public.bands(id).
-- 2. Adds performance indexes on `band_id` across all catalog tables.
-- 3. Backfills all existing catalog rows to the confirmed default band
--    ('Infant Jesus Church', id: 9ca7fef8-a0e0-4587-a329-0444c4b27f70, code: INFANTJESUS).
-- 4. Creates a secure helper function `public.current_user_band_id()` to resolve
--    the authenticated user's current band without recursive RLS lookups.
-- 5. Implements BEFORE INSERT triggers to automatically assign `band_id` from the
--    creator's profile or parent setlist if not explicitly provided.
-- 6. Enforces strict Row Level Security (RLS) policies:
--    - Authenticated users can ONLY SELECT, INSERT, and UPDATE rows belonging to their band.
--    - DELETE operations require both matching `band_id` AND the existing created_by / admin rule.
--    - Users with no band see NOTHING from any band.
--    - Anonymous users see NOTHING from any band.
-- 7. Ensures Realtime replication with REPLICA IDENTITY FULL for all isolated tables.
--
-- How to apply:
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- Run Order: Run this script completely. If rolling back, run migrations_008_band_data_isolation_rollback.sql.
-- ==============================================================================

-- ─── STEP 1: ADD BAND_ID COLUMNS ──────────────────────────────────────────────
ALTER TABLE public.folders 
  ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE;

ALTER TABLE public.charts 
  ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE;

ALTER TABLE public.lyrics 
  ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE;

ALTER TABLE public.setlists 
  ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE;

ALTER TABLE public.setlist_items 
  ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE;

-- ─── STEP 2: CREATE INDEXES ON BAND_ID ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_folders_band_id ON public.folders (band_id);
CREATE INDEX IF NOT EXISTS idx_charts_band_id ON public.charts (band_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_band_id ON public.lyrics (band_id);
CREATE INDEX IF NOT EXISTS idx_setlists_band_id ON public.setlists (band_id);
CREATE INDEX IF NOT EXISTS idx_setlist_items_band_id ON public.setlist_items (band_id);

-- ─── STEP 3: BACKFILL EXISTING DATA TO DEFAULT BAND ───────────────────────────
-- Confirmed default band: Infant Jesus Church (ID: 9ca7fef8-a0e0-4587-a329-0444c4b27f70, Code: INFANTJESUS)
DO $$
DECLARE
  v_default_band_id UUID;
BEGIN
  -- 1. Try confirmed Infant Jesus Church band ID / code
  SELECT id INTO v_default_band_id 
  FROM public.bands 
  WHERE id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70' OR LOWER(code) = 'infantjesus' 
  LIMIT 1;

  -- 2. Fallback to Choir Band ('1234') if missing
  IF v_default_band_id IS NULL THEN
    SELECT id INTO v_default_band_id FROM public.bands WHERE code = '1234' LIMIT 1;
  END IF;

  -- 3. Fallback to any existing band
  IF v_default_band_id IS NULL THEN
    SELECT id INTO v_default_band_id FROM public.bands ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_default_band_id IS NOT NULL THEN
    -- Backfill folders
    UPDATE public.folders 
    SET band_id = v_default_band_id 
    WHERE band_id IS NULL;

    -- Backfill charts
    UPDATE public.charts 
    SET band_id = v_default_band_id 
    WHERE band_id IS NULL;

    -- Backfill lyrics
    UPDATE public.lyrics 
    SET band_id = v_default_band_id 
    WHERE band_id IS NULL;

    -- Backfill setlists
    UPDATE public.setlists 
    SET band_id = v_default_band_id 
    WHERE band_id IS NULL;

    -- Backfill setlist_items (first match parent setlist, then fallback)
    UPDATE public.setlist_items si
    SET band_id = s.band_id
    FROM public.setlists s
    WHERE si.setlist_id = s.id AND si.band_id IS NULL AND s.band_id IS NOT NULL;

    UPDATE public.setlist_items 
    SET band_id = v_default_band_id 
    WHERE band_id IS NULL;

    RAISE NOTICE 'Successfully backfilled all existing catalog rows to band_id: %', v_default_band_id;
  ELSE
    RAISE WARNING 'No band found in public.bands! Please insert a band before backfilling.';
  END IF;
END $$;

-- ─── STEP 4: HELPER FUNCTION FOR CURRENT USER BAND RESOLUTION ─────────────────
CREATE OR REPLACE FUNCTION public.current_user_band_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT band_id FROM public.profiles WHERE id = auth.uid() AND band_id IS NOT NULL LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_band_id() TO authenticated, anon;

-- ─── STEP 5: AUTOMATIC BAND_ID ASSIGNMENT TRIGGERS ON INSERT ──────────────────
CREATE OR REPLACE FUNCTION public.set_band_id_from_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.band_id IS NULL THEN
    NEW.band_id := public.current_user_band_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.set_setlist_item_band_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.band_id IS NULL THEN
    SELECT band_id INTO NEW.band_id
    FROM public.setlists
    WHERE id = NEW.setlist_id;
    
    IF NEW.band_id IS NULL THEN
      NEW.band_id := public.current_user_band_id();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_band_id_charts ON public.charts;
CREATE TRIGGER trg_set_band_id_charts
  BEFORE INSERT ON public.charts
  FOR EACH ROW EXECUTE FUNCTION public.set_band_id_from_profile();

DROP TRIGGER IF EXISTS trg_set_band_id_lyrics ON public.lyrics;
CREATE TRIGGER trg_set_band_id_lyrics
  BEFORE INSERT ON public.lyrics
  FOR EACH ROW EXECUTE FUNCTION public.set_band_id_from_profile();

DROP TRIGGER IF EXISTS trg_set_band_id_folders ON public.folders;
CREATE TRIGGER trg_set_band_id_folders
  BEFORE INSERT ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_band_id_from_profile();

DROP TRIGGER IF EXISTS trg_set_band_id_setlists ON public.setlists;
CREATE TRIGGER trg_set_band_id_setlists
  BEFORE INSERT ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.set_band_id_from_profile();

DROP TRIGGER IF EXISTS trg_set_band_id_setlist_items ON public.setlist_items;
CREATE TRIGGER trg_set_band_id_setlist_items
  BEFORE INSERT ON public.setlist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_setlist_item_band_id();

-- ─── STEP 6: DROP PREVIOUS CATALOG POLICIES ──────────────────────────────────
-- Folders
DROP POLICY IF EXISTS "Allow read folders" ON public.folders;
DROP POLICY IF EXISTS "Allow authenticated insert folders" ON public.folders;
DROP POLICY IF EXISTS "Allow authenticated update folders" ON public.folders;
DROP POLICY IF EXISTS "Allow creator or admin delete folders" ON public.folders;
DROP POLICY IF EXISTS "Band isolation select folders" ON public.folders;
DROP POLICY IF EXISTS "Band isolation insert folders" ON public.folders;
DROP POLICY IF EXISTS "Band isolation update folders" ON public.folders;
DROP POLICY IF EXISTS "Band isolation delete folders" ON public.folders;

-- Charts
DROP POLICY IF EXISTS "Allow read charts" ON public.charts;
DROP POLICY IF EXISTS "Allow authenticated insert charts" ON public.charts;
DROP POLICY IF EXISTS "Allow authenticated update charts" ON public.charts;
DROP POLICY IF EXISTS "Allow creator or admin delete charts" ON public.charts;
DROP POLICY IF EXISTS "Band isolation select charts" ON public.charts;
DROP POLICY IF EXISTS "Band isolation insert charts" ON public.charts;
DROP POLICY IF EXISTS "Band isolation update charts" ON public.charts;
DROP POLICY IF EXISTS "Band isolation delete charts" ON public.charts;

-- Lyrics
DROP POLICY IF EXISTS "Allow read lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Allow authenticated insert lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Allow authenticated update lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Allow creator or admin delete lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Band isolation select lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Band isolation insert lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Band isolation update lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Band isolation delete lyrics" ON public.lyrics;

-- Setlists
DROP POLICY IF EXISTS "Allow read setlists" ON public.setlists;
DROP POLICY IF EXISTS "Allow authenticated insert setlists" ON public.setlists;
DROP POLICY IF EXISTS "Allow authenticated update setlists" ON public.setlists;
DROP POLICY IF EXISTS "Allow creator or admin delete setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band isolation select setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band isolation insert setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band isolation update setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band isolation delete setlists" ON public.setlists;

-- Setlist Items
DROP POLICY IF EXISTS "Allow read setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Allow authenticated insert setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Allow authenticated update setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Allow creator or admin delete setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Band isolation select setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Band isolation insert setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Band isolation update setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Band isolation delete setlist_items" ON public.setlist_items;

-- ─── STEP 7: CREATE BAND-ISOLATION RLS POLICIES ───────────────────────────────

-- ─── FOLDERS ─────────────────────────────────────────────────────────────────
CREATE POLICY "Band isolation select folders"
ON public.folders FOR SELECT TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation insert folders"
ON public.folders FOR INSERT TO authenticated
WITH CHECK (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation update folders"
ON public.folders FOR UPDATE TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
)
WITH CHECK (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation delete folders"
ON public.folders FOR DELETE TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
  AND (
    created_by::text = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
    )
  )
);

-- ─── CHARTS ──────────────────────────────────────────────────────────────────
CREATE POLICY "Band isolation select charts"
ON public.charts FOR SELECT TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation insert charts"
ON public.charts FOR INSERT TO authenticated
WITH CHECK (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation update charts"
ON public.charts FOR UPDATE TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
)
WITH CHECK (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation delete charts"
ON public.charts FOR DELETE TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
  AND (
    created_by::text = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
    )
  )
);

-- ─── LYRICS ──────────────────────────────────────────────────────────────────
CREATE POLICY "Band isolation select lyrics"
ON public.lyrics FOR SELECT TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation insert lyrics"
ON public.lyrics FOR INSERT TO authenticated
WITH CHECK (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation update lyrics"
ON public.lyrics FOR UPDATE TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
)
WITH CHECK (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation delete lyrics"
ON public.lyrics FOR DELETE TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
  AND (
    created_by::text = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
    )
  )
);

-- ─── SETLISTS ────────────────────────────────────────────────────────────────
CREATE POLICY "Band isolation select setlists"
ON public.setlists FOR SELECT TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation insert setlists"
ON public.setlists FOR INSERT TO authenticated
WITH CHECK (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation update setlists"
ON public.setlists FOR UPDATE TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
)
WITH CHECK (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation delete setlists"
ON public.setlists FOR DELETE TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
  AND (
    created_by::text = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
    )
  )
);

-- ─── SETLIST ITEMS ───────────────────────────────────────────────────────────
CREATE POLICY "Band isolation select setlist_items"
ON public.setlist_items FOR SELECT TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation insert setlist_items"
ON public.setlist_items FOR INSERT TO authenticated
WITH CHECK (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation update setlist_items"
ON public.setlist_items FOR UPDATE TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
)
WITH CHECK (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
);

CREATE POLICY "Band isolation delete setlist_items"
ON public.setlist_items FOR DELETE TO authenticated
USING (
  band_id IS NOT NULL AND band_id = public.current_user_band_id()
  AND EXISTS (
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

-- ─── STEP 8: REPLICA IDENTITY FULL FOR REALTIME FILTERING ─────────────────────
ALTER TABLE public.folders REPLICA IDENTITY FULL;
ALTER TABLE public.charts REPLICA IDENTITY FULL;
ALTER TABLE public.lyrics REPLICA IDENTITY FULL;
ALTER TABLE public.setlists REPLICA IDENTITY FULL;
ALTER TABLE public.setlist_items REPLICA IDENTITY FULL;
