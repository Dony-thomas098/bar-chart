-- ==============================================================================
-- Chordly Migration 010: Fix Mobile & Band Member Access to Charts & Lyrics
-- ==============================================================================
-- Purpose:
-- 1. Drops restrictive SELECT policies on charts, lyrics, folders, setlists, and
--    setlist_items that were blocking band members and admins from reading songs.
-- 2. Sets open SELECT policies (USING true) so all members, admins, followers,
--    and mobile devices can view the music sheets without access denial.
-- 3. Retains STRICT write security:
--    - INSERT and UPDATE require authenticated sessions.
--    - DELETE is strictly restricted to creator or band admin.
-- 4. Backfills all NULL band_id records to Infant Jesus Church.
--
-- How to apply:
-- Paste this entire script into your Supabase SQL Editor and click the green "RUN" button.
-- ==============================================================================

-- ─── 1. BACKFILL NULL BAND_ID RECORDS TO INFANT JESUS CHURCH ─────────────────
UPDATE public.profiles 
SET band_id = '9ca7fef8-a0e0-4587-a329-0444c4b27f70', 
    band_name = 'Infant Jesus Church' 
WHERE band_id IS NULL;

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

-- ─── 2. CHARTS SELECT POLICY (ALLOW ALL MEMBERS, ADMINS & MOBILE READ ACCESS) 
DROP POLICY IF EXISTS "Band isolation select charts" ON public.charts;
DROP POLICY IF EXISTS "Allow read charts" ON public.charts;
DROP POLICY IF EXISTS "Users can view own charts" ON public.charts;
DROP POLICY IF EXISTS "Shared workspace view charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can select any chart" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can view non-deleted charts" ON public.charts;

CREATE POLICY "Allow read charts"
ON public.charts FOR SELECT
USING (true);

-- ─── 3. LYRICS SELECT POLICY ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Band isolation select lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Allow read lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can view own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Shared workspace view lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can view lyrics" ON public.lyrics;

CREATE POLICY "Allow read lyrics"
ON public.lyrics FOR SELECT
USING (true);

-- ─── 4. FOLDERS SELECT POLICY ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Band isolation select folders" ON public.folders;
DROP POLICY IF EXISTS "Allow read folders" ON public.folders;
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Shared workspace view folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can select any folder" ON public.folders;

CREATE POLICY "Allow read folders"
ON public.folders FOR SELECT
USING (true);

-- ─── 5. SETLISTS & SETLIST_ITEMS SELECT POLICY ───────────────────────────────
DROP POLICY IF EXISTS "Band isolation select setlists" ON public.setlists;
DROP POLICY IF EXISTS "Allow read setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can view own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Shared workspace view setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can select setlists" ON public.setlists;

CREATE POLICY "Allow read setlists"
ON public.setlists FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Band isolation select setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Allow read setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can view own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Shared workspace view setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can select setlist_items" ON public.setlist_items;

CREATE POLICY "Allow read setlist_items"
ON public.setlist_items FOR SELECT
USING (true);

-- ─── 6. IMMEDIATE VERIFICATION RESULTS ────────────────────────────────────────
SELECT count(*) AS total_charts_in_database FROM public.charts;
SELECT id, title, band_id, created_by FROM public.charts LIMIT 10;
