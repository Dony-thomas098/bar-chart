-- ==============================================================================
-- Chordly Migration 010: Fix Mobile, Guest & Cross-Band Chart & Lyrics Access
-- ==============================================================================
-- Purpose:
-- 1. Restores SELECT access on public.charts and public.lyrics for:
--    - Church & Choir default band songs (Infant Jesus Church & Choir Band)
--    - Legacy songs where band_id IS NULL
--    - Stage room followers and mobile viewers (authenticated & anon)
--    - Authenticated users for their own joined band
-- 2. Backfills all NULL band_id rows across charts, lyrics, folders, and setlists
--    to the default Infant Jesus Church band (9ca7fef8-a0e0-4587-a329-0444c4b27f70).
-- 3. Retains strict write security: ONLY authenticated band members can INSERT/UPDATE,
--    and ONLY creator/admin can DELETE.
--
-- How to apply:
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. BACKFILL NULL BAND_ID IN CATALOG TABLES TO DEFAULT CHURCH BAND
UPDATE public.folders 
SET band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70' 
WHERE band_id IS NULL;

UPDATE public.charts 
SET band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70' 
WHERE band_id IS NULL;

UPDATE public.lyrics 
SET band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70' 
WHERE band_id IS NULL;

UPDATE public.setlists 
SET band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70' 
WHERE band_id IS NULL;

UPDATE public.setlist_items 
SET band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70' 
WHERE band_id IS NULL;

-- 2. CHARTS SELECT POLICY
DROP POLICY IF EXISTS "Band isolation select charts" ON public.charts;
DROP POLICY IF EXISTS "Allow read charts" ON public.charts;

CREATE POLICY "Band isolation select charts"
ON public.charts FOR SELECT TO authenticated, anon
USING (
  band_id IS NULL
  OR band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70'
  OR band_id = 'a8e019d1-5269-4cd2-8b98-c2cec52360df'
  OR (auth.role() = 'authenticated' AND band_id = public.current_user_band_id())
);

-- 3. LYRICS SELECT POLICY
DROP POLICY IF EXISTS "Band isolation select lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Allow read lyrics" ON public.lyrics;

CREATE POLICY "Band isolation select lyrics"
ON public.lyrics FOR SELECT TO authenticated, anon
USING (
  band_id IS NULL
  OR band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70'
  OR band_id = 'a8e019d1-5269-4cd2-8b98-c2cec52360df'
  OR (auth.role() = 'authenticated' AND band_id = public.current_user_band_id())
);

-- 4. FOLDERS SELECT POLICY
DROP POLICY IF EXISTS "Band isolation select folders" ON public.folders;
DROP POLICY IF EXISTS "Allow read folders" ON public.folders;

CREATE POLICY "Band isolation select folders"
ON public.folders FOR SELECT TO authenticated, anon
USING (
  band_id IS NULL
  OR band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70'
  OR band_id = 'a8e019d1-5269-4cd2-8b98-c2cec52360df'
  OR (auth.role() = 'authenticated' AND band_id = public.current_user_band_id())
);

-- 5. SETLISTS & SETLIST_ITEMS SELECT POLICY
DROP POLICY IF EXISTS "Band isolation select setlists" ON public.setlists;
DROP POLICY IF EXISTS "Allow read setlists" ON public.setlists;

CREATE POLICY "Band isolation select setlists"
ON public.setlists FOR SELECT TO authenticated, anon
USING (
  band_id IS NULL
  OR band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70'
  OR band_id = 'a8e019d1-5269-4cd2-8b98-c2cec52360df'
  OR (auth.role() = 'authenticated' AND band_id = public.current_user_band_id())
);

DROP POLICY IF EXISTS "Band isolation select setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Allow read setlist_items" ON public.setlist_items;

CREATE POLICY "Band isolation select setlist_items"
ON public.setlist_items FOR SELECT TO authenticated, anon
USING (
  band_id IS NULL
  OR band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70'
  OR band_id = 'a8e019d1-5269-4cd2-8b98-c2cec52360df'
  OR (auth.role() = 'authenticated' AND band_id = public.current_user_band_id())
);
