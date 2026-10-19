-- ==============================================================================
-- Chordly Security Migration: Strict Row Level Security (RLS) User Data Isolation
-- Run this in your Supabase SQL Editor to protect user data from unauthorized access
-- ==============================================================================

-- 1. DROP EXISTING INSECURE / PERMISSIVE POLICIES
DROP POLICY IF EXISTS "Authenticated users can view non-deleted folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can insert folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can update folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can delete folders" ON public.folders;
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;

DROP POLICY IF EXISTS "Authenticated users can view non-deleted charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can insert charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can update charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can delete charts" ON public.charts;
DROP POLICY IF EXISTS "Users can view own charts" ON public.charts;
DROP POLICY IF EXISTS "Users can insert own charts" ON public.charts;
DROP POLICY IF EXISTS "Users can update own charts" ON public.charts;
DROP POLICY IF EXISTS "Users can delete own charts" ON public.charts;

DROP POLICY IF EXISTS "Authenticated users can view lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can insert lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can update lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can delete lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can view own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can insert own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can update own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can delete own lyrics" ON public.lyrics;

DROP POLICY IF EXISTS "Authenticated users can view setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can insert setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can update setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can delete setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can view own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can insert own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can update own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can delete own setlists" ON public.setlists;

DROP POLICY IF EXISTS "Authenticated users can view setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can insert setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can update setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can delete setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can view own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can insert own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can update own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can delete own setlist_items" ON public.setlist_items;

-- 2. ENABLE RLS (Ensure RLS is enabled on all tables)
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lyrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_items ENABLE ROW LEVEL SECURITY;

-- 3. CREATE SECURE USER-OWNERSHIP POLICIES

-- FOLDERS
CREATE POLICY "Users can view own folders"
ON public.folders FOR SELECT TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own folders"
ON public.folders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own folders"
ON public.folders FOR UPDATE TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own folders"
ON public.folders FOR DELETE TO authenticated
USING (auth.uid() = created_by);

-- CHARTS
CREATE POLICY "Users can view own charts"
ON public.charts FOR SELECT TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own charts"
ON public.charts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own charts"
ON public.charts FOR UPDATE TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own charts"
ON public.charts FOR DELETE TO authenticated
USING (auth.uid() = created_by);

-- LYRICS
CREATE POLICY "Users can view own lyrics"
ON public.lyrics FOR SELECT TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own lyrics"
ON public.lyrics FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own lyrics"
ON public.lyrics FOR UPDATE TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own lyrics"
ON public.lyrics FOR DELETE TO authenticated
USING (auth.uid() = created_by);

-- SETLISTS
CREATE POLICY "Users can view own setlists"
ON public.setlists FOR SELECT TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own setlists"
ON public.setlists FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own setlists"
ON public.setlists FOR UPDATE TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own setlists"
ON public.setlists FOR DELETE TO authenticated
USING (auth.uid() = created_by);

-- SETLIST ITEMS
CREATE POLICY "Users can view own setlist_items"
ON public.setlist_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_items.setlist_id AND s.created_by = auth.uid()
  )
);

CREATE POLICY "Users can insert own setlist_items"
ON public.setlist_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_items.setlist_id AND s.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update own setlist_items"
ON public.setlist_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_items.setlist_id AND s.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_items.setlist_id AND s.created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete own setlist_items"
ON public.setlist_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_items.setlist_id AND s.created_by = auth.uid()
  )
);
