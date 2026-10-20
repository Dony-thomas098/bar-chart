-- ==============================================================================
-- Chordly Security Migration: Locked-Down Row Level Security (RLS)
-- ==============================================================================
-- Purpose:
-- 1. Eliminates anonymous write/delete access across all catalog tables.
-- 2. Restricts INSERT, UPDATE, and DELETE strictly to authenticated users.
-- 3. Restricts DELETE operations to item creators or band admins.
-- 4. Allows safe public SELECT so stage followers (room codes) and viewers can read charts.
-- 5. Secures bands and profiles tables so users can only modify their own records.
-- 6. Fully idempotent: safe to run repeatedly without conflicts.
--
-- How to apply:
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. ENSURE ROW LEVEL SECURITY IS ACTIVE ON ALL TABLES
ALTER TABLE IF EXISTS public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lyrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.setlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. DROP OBSOLETE & WIDE-OPEN POLICIES
-- Folders
DROP POLICY IF EXISTS "Shared workspace view folders" ON public.folders;
DROP POLICY IF EXISTS "Shared workspace insert folders" ON public.folders;
DROP POLICY IF EXISTS "Shared workspace update folders" ON public.folders;
DROP POLICY IF EXISTS "Shared workspace delete folders" ON public.folders;
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can select any folder" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can view non-deleted folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can insert folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can update folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can delete folders" ON public.folders;

-- Charts
DROP POLICY IF EXISTS "Shared workspace view charts" ON public.charts;
DROP POLICY IF EXISTS "Shared workspace insert charts" ON public.charts;
DROP POLICY IF EXISTS "Shared workspace update charts" ON public.charts;
DROP POLICY IF EXISTS "Shared workspace delete charts" ON public.charts;
DROP POLICY IF EXISTS "Users can view own charts" ON public.charts;
DROP POLICY IF EXISTS "Users can insert own charts" ON public.charts;
DROP POLICY IF EXISTS "Users can update own charts" ON public.charts;
DROP POLICY IF EXISTS "Users can delete own charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can select any chart" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can view non-deleted charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can insert charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can update any chart" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can delete any chart" ON public.charts;

-- Lyrics
DROP POLICY IF EXISTS "Shared workspace view lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Shared workspace insert lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Shared workspace update lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Shared workspace delete lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can view own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can insert own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can update own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Users can delete own lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can view lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can insert lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can update lyrics" ON public.lyrics;
DROP POLICY IF EXISTS "Authenticated users can delete lyrics" ON public.lyrics;

-- Setlists
DROP POLICY IF EXISTS "Shared workspace view setlists" ON public.setlists;
DROP POLICY IF EXISTS "Shared workspace insert setlists" ON public.setlists;
DROP POLICY IF EXISTS "Shared workspace update setlists" ON public.setlists;
DROP POLICY IF EXISTS "Shared workspace delete setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can view own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can insert own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can update own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can delete own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can select setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can insert setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can update setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can delete setlists" ON public.setlists;

-- Setlist Items
DROP POLICY IF EXISTS "Shared workspace view setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Shared workspace insert setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Shared workspace update setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Shared workspace delete setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can view own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can insert own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can update own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Users can delete own setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can select setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can insert setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can update setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can delete setlist_items" ON public.setlist_items;

-- Bands
DROP POLICY IF EXISTS "Shared workspace view bands" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace insert bands" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace update bands" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace delete bands" ON public.bands;
DROP POLICY IF EXISTS "Public bands lookup by code" ON public.bands;
DROP POLICY IF EXISTS "Authenticated users can create bands" ON public.bands;
DROP POLICY IF EXISTS "Admin can update their band" ON public.bands;
DROP POLICY IF EXISTS "Admin can delete their band" ON public.bands;

-- Profiles
DROP POLICY IF EXISTS "Shared workspace view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Shared workspace insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Shared workspace update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by anon for login" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;


-- ==============================================================================
-- 3. SECURE POLICIES: CATALOG TABLES
-- ==============================================================================

-- ─── FOLDERS ─────────────────────────────────────────────────────────────────
-- Public/anon read allowed for stage sync and shared charts
DROP POLICY IF EXISTS "Allow read folders" ON public.folders;
CREATE POLICY "Allow read folders"
ON public.folders FOR SELECT TO authenticated, anon
USING (true);

-- Only authenticated users can create folders
DROP POLICY IF EXISTS "Allow authenticated insert folders" ON public.folders;
CREATE POLICY "Allow authenticated insert folders"
ON public.folders FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can rename or move folders
DROP POLICY IF EXISTS "Allow authenticated update folders" ON public.folders;
CREATE POLICY "Allow authenticated update folders"
ON public.folders FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Only creator or admin can delete folders
DROP POLICY IF EXISTS "Allow creator or admin delete folders" ON public.folders;
CREATE POLICY "Allow creator or admin delete folders"
ON public.folders FOR DELETE TO authenticated
USING (
  created_by::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
  )
);

-- ─── CHARTS ──────────────────────────────────────────────────────────────────
-- Public/anon read allowed for stage sync and shared charts
DROP POLICY IF EXISTS "Allow read charts" ON public.charts;
CREATE POLICY "Allow read charts"
ON public.charts FOR SELECT TO authenticated, anon
USING (true);

-- Only authenticated users can create charts
DROP POLICY IF EXISTS "Allow authenticated insert charts" ON public.charts;
CREATE POLICY "Allow authenticated insert charts"
ON public.charts FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Authenticated band members can update charts
DROP POLICY IF EXISTS "Allow authenticated update charts" ON public.charts;
CREATE POLICY "Allow authenticated update charts"
ON public.charts FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Only creator or admin can delete charts
DROP POLICY IF EXISTS "Allow creator or admin delete charts" ON public.charts;
CREATE POLICY "Allow creator or admin delete charts"
ON public.charts FOR DELETE TO authenticated
USING (
  created_by::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
  )
);

-- ─── LYRICS ──────────────────────────────────────────────────────────────────
-- Public/anon read allowed
DROP POLICY IF EXISTS "Allow read lyrics" ON public.lyrics;
CREATE POLICY "Allow read lyrics"
ON public.lyrics FOR SELECT TO authenticated, anon
USING (true);

-- Only authenticated users can create lyrics
DROP POLICY IF EXISTS "Allow authenticated insert lyrics" ON public.lyrics;
CREATE POLICY "Allow authenticated insert lyrics"
ON public.lyrics FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Authenticated band members can update lyrics
DROP POLICY IF EXISTS "Allow authenticated update lyrics" ON public.lyrics;
CREATE POLICY "Allow authenticated update lyrics"
ON public.lyrics FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Only creator or admin can delete lyrics
DROP POLICY IF EXISTS "Allow creator or admin delete lyrics" ON public.lyrics;
CREATE POLICY "Allow creator or admin delete lyrics"
ON public.lyrics FOR DELETE TO authenticated
USING (
  created_by::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
  )
);

-- ─── SETLISTS ────────────────────────────────────────────────────────────────
-- Public/anon read allowed
DROP POLICY IF EXISTS "Allow read setlists" ON public.setlists;
CREATE POLICY "Allow read setlists"
ON public.setlists FOR SELECT TO authenticated, anon
USING (true);

-- Only authenticated users can create setlists
DROP POLICY IF EXISTS "Allow authenticated insert setlists" ON public.setlists;
CREATE POLICY "Allow authenticated insert setlists"
ON public.setlists FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Authenticated band members can update setlists
DROP POLICY IF EXISTS "Allow authenticated update setlists" ON public.setlists;
CREATE POLICY "Allow authenticated update setlists"
ON public.setlists FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Only creator or admin can delete setlists
DROP POLICY IF EXISTS "Allow creator or admin delete setlists" ON public.setlists;
CREATE POLICY "Allow creator or admin delete setlists"
ON public.setlists FOR DELETE TO authenticated
USING (
  created_by::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'profession_admin')
  )
);

-- ─── SETLIST ITEMS ───────────────────────────────────────────────────────────
-- Public/anon read allowed
DROP POLICY IF EXISTS "Allow read setlist_items" ON public.setlist_items;
CREATE POLICY "Allow read setlist_items"
ON public.setlist_items FOR SELECT TO authenticated, anon
USING (true);

-- Only authenticated users can add items to setlists
DROP POLICY IF EXISTS "Allow authenticated insert setlist_items" ON public.setlist_items;
CREATE POLICY "Allow authenticated insert setlist_items"
ON public.setlist_items FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Authenticated band members can update setlist items (transposition, reorder)
DROP POLICY IF EXISTS "Allow authenticated update setlist_items" ON public.setlist_items;
CREATE POLICY "Allow authenticated update setlist_items"
ON public.setlist_items FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Only setlist creator or admin can delete setlist items
DROP POLICY IF EXISTS "Allow creator or admin delete setlist_items" ON public.setlist_items;
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


-- ==============================================================================
-- 4. SECURE POLICIES: BANDS & PROFILES
-- ==============================================================================

-- ─── BANDS ───────────────────────────────────────────────────────────────────
-- Anyone can look up bands (e.g. by code "1234") to join
DROP POLICY IF EXISTS "Allow read bands" ON public.bands;
CREATE POLICY "Allow read bands"
ON public.bands FOR SELECT TO authenticated, anon
USING (true);

-- Only authenticated users can create a new band
DROP POLICY IF EXISTS "Allow authenticated insert bands" ON public.bands;
CREATE POLICY "Allow authenticated insert bands"
ON public.bands FOR INSERT TO authenticated
WITH CHECK (auth.uid() = admin_id);

-- Only band admin can update band settings
DROP POLICY IF EXISTS "Allow admin update bands" ON public.bands;
CREATE POLICY "Allow admin update bands"
ON public.bands FOR UPDATE TO authenticated
USING (auth.uid() = admin_id)
WITH CHECK (auth.uid() = admin_id);

-- Only band admin can delete the band
DROP POLICY IF EXISTS "Allow admin delete bands" ON public.bands;
CREATE POLICY "Allow admin delete bands"
ON public.bands FOR DELETE TO authenticated
USING (auth.uid() = admin_id);

-- ─── PROFILES ────────────────────────────────────────────────────────────────
-- Public lookup allowed so username login can resolve username -> email
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
CREATE POLICY "Allow read profiles"
ON public.profiles FOR SELECT TO authenticated, anon
USING (true);

-- Users can only insert their own profile matching auth.uid()
DROP POLICY IF EXISTS "Allow insert own profile" ON public.profiles;
CREATE POLICY "Allow insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can only update their own profile matching auth.uid()
DROP POLICY IF EXISTS "Allow update own profile" ON public.profiles;
CREATE POLICY "Allow update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can only delete their own profile matching auth.uid()
DROP POLICY IF EXISTS "Allow delete own profile" ON public.profiles;
CREATE POLICY "Allow delete own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = id);
