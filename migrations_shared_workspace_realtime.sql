-- ==============================================================================
-- Chordly Migration: Shared Choir Workspace & Instant Real-Time Synchronization
-- ==============================================================================
-- This migration updates Supabase database to support a shared band/choir workspace:
-- 1. Adds folders, charts, lyrics, setlists, and setlist_items to Supabase Realtime publication.
-- 2. Sets REPLICA IDENTITY FULL so all realtime UPDATE/DELETE payloads contain full rows.
-- 3. Configures Row Level Security (RLS) so that all band/choir members and devices
--    (Vercel Web, Android APK, iOS App) immediately share and sync all catalog changes.
-- ==============================================================================

-- 1. ENABLE FULL REALTIME REPLICATION FOR INSTANT SYNC (< 1s)
ALTER TABLE public.folders REPLICA IDENTITY FULL;
ALTER TABLE public.charts REPLICA IDENTITY FULL;
ALTER TABLE public.lyrics REPLICA IDENTITY FULL;
ALTER TABLE public.setlists REPLICA IDENTITY FULL;
ALTER TABLE public.setlist_items REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.charts;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lyrics;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.setlists;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.setlist_items;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 2. DROP OLD RESTRICTIVE USER-ISOLATION POLICIES
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can select any folder" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can view non-deleted folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can insert folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can update folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can delete folders" ON public.folders;
DROP POLICY IF EXISTS "Shared workspace view folders" ON public.folders;
DROP POLICY IF EXISTS "Shared workspace insert folders" ON public.folders;
DROP POLICY IF EXISTS "Shared workspace update folders" ON public.folders;
DROP POLICY IF EXISTS "Shared workspace delete folders" ON public.folders;

DROP POLICY IF EXISTS "Users can view own charts" ON public.charts;
DROP POLICY IF EXISTS "Users can insert own charts" ON public.charts;
DROP POLICY IF EXISTS "Users can update own charts" ON public.charts;
DROP POLICY IF EXISTS "Users can delete own charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can select any chart" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can view non-deleted charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can insert charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can update charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can delete charts" ON public.charts;
DROP POLICY IF EXISTS "Shared workspace view charts" ON public.charts;
DROP POLICY IF EXISTS "Shared workspace insert charts" ON public.charts;
DROP POLICY IF EXISTS "Shared workspace update charts" ON public.charts;
DROP POLICY IF EXISTS "Shared workspace delete charts" ON public.charts;

DROP POLICY IF EXISTS "Users can view own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can insert own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can update own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can delete own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can view lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can insert lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can update lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can delete lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Shared workspace view lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Shared workspace insert lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Shared workspace update lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Shared workspace delete lyrics" ON public.lyrics;

DROP POLICY IF EXISTS "Users can view own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can insert own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can update own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can delete own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can select setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can view setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can insert setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can update setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can delete setlists" ON public.setlists;
DROP POLICY IF EXISTS "Shared workspace view setlists" ON public.setlists;
DROP POLICY IF EXISTS "Shared workspace insert setlists" ON public.setlists;
DROP POLICY IF EXISTS "Shared workspace update setlists" ON public.setlists;
DROP POLICY IF EXISTS "Shared workspace delete setlists" ON public.setlists;

DROP POLICY IF EXISTS "Users can view own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can insert own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can update own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can delete own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can select setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can view setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can insert setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can update setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can delete setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Shared workspace view setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Shared workspace insert setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Shared workspace update setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Shared workspace delete setlist_items" ON public.setlist_items;

-- 3. ENSURE RLS IS ENABLED
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lyrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_items ENABLE ROW LEVEL SECURITY;

-- 4. CREATE SHARED WORKSPACE POLICIES (All devices & band members share catalog)

-- FOLDERS
CREATE POLICY "Shared workspace view folders"
ON public.folders FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Shared workspace insert folders"
ON public.folders FOR INSERT TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Shared workspace update folders"
ON public.folders FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Shared workspace delete folders"
ON public.folders FOR DELETE TO authenticated, anon
USING (true);

-- CHARTS
CREATE POLICY "Shared workspace view charts"
ON public.charts FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Shared workspace insert charts"
ON public.charts FOR INSERT TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Shared workspace update charts"
ON public.charts FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Shared workspace delete charts"
ON public.charts FOR DELETE TO authenticated, anon
USING (true);

-- LYRICS
CREATE POLICY "Shared workspace view lyrics"
ON public.lyrics FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Shared workspace insert lyrics"
ON public.lyrics FOR INSERT TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Shared workspace update lyrics"
ON public.lyrics FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Shared workspace delete lyrics"
ON public.lyrics FOR DELETE TO authenticated, anon
USING (true);

-- SETLISTS
CREATE POLICY "Shared workspace view setlists"
ON public.setlists FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Shared workspace insert setlists"
ON public.setlists FOR INSERT TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Shared workspace update setlists"
ON public.setlists FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Shared workspace delete setlists"
ON public.setlists FOR DELETE TO authenticated, anon
USING (true);

-- SETLIST ITEMS
CREATE POLICY "Shared workspace view setlist_items"
ON public.setlist_items FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Shared workspace insert setlist_items"
ON public.setlist_items FOR INSERT TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Shared workspace update setlist_items"
ON public.setlist_items FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Shared workspace delete setlist_items"
ON public.setlist_items FOR DELETE TO authenticated, anon
USING (true);
