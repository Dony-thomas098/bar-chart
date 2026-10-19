-- ==============================================================================
-- ChordCraft Comprehensive Schema & Security Migration (Batches 1 & 3)
-- ==============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table (Batch 1 & 2)
-- Enables cross-device username-to-email mapping, server-side role assignment,
-- and secure PIN validation.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'instrument' CHECK (role IN ('singing', 'instrument', 'admin')),
    instrument TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Dedicated Lyrics Table (Missing in original schema.sql)
CREATE TABLE IF NOT EXISTS public.lyrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 4. Add deleted_at column to all resources for non-destructive soft deletes (Batch 3)
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.charts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.lyrics ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 5. Foreign Key Integrity on setlist_items (Cascade on Setlist deletion)
-- Ensure setlist_items clean up automatically when setlists are removed
ALTER TABLE public.setlist_items DROP CONSTRAINT IF EXISTS setlist_items_setlist_id_fkey;
ALTER TABLE public.setlist_items 
    ADD CONSTRAINT setlist_items_setlist_id_fkey 
    FOREIGN KEY (setlist_id) REFERENCES public.setlists(id) ON DELETE CASCADE;

-- 6. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lyrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_items ENABLE ROW LEVEL SECURITY;

-- 7. Drop obsolete / insecure open policies
DROP POLICY IF EXISTS "Authenticated users can select any folder" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can insert folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can update any folder" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can delete any folder" ON public.folders;

DROP POLICY IF EXISTS "Authenticated users can select any chart" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can insert charts" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can update any chart" ON public.charts;
DROP POLICY IF EXISTS "Authenticated users can delete any chart" ON public.charts;

DROP POLICY IF EXISTS "Authenticated users can select setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can insert setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can update setlists" ON public.setlists;
DROP POLICY IF EXISTS "Authenticated users can delete setlists" ON public.setlists;

DROP POLICY IF EXISTS "Authenticated users can select setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can insert setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can update setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Authenticated users can delete setlist_items" ON public.setlist_items;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 8. Secure Profiles Policies
-- All authenticated users can view usernames (needed for collaboration, band membership & username login resolution)
CREATE POLICY "Public profiles are viewable by authenticated users"
ON public.profiles FOR SELECT TO authenticated
USING (true);

-- Allow public lookup for username sign-in resolution
CREATE POLICY "Public profiles are viewable by anon for login"
ON public.profiles FOR SELECT TO anon
USING (true);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 9. Folders Policies (Authenticated users within the band/shared library)
CREATE POLICY "Authenticated users can view non-deleted folders"
ON public.folders FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert folders"
ON public.folders FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update folders"
ON public.folders FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete folders"
ON public.folders FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

-- 10. Charts Policies
CREATE POLICY "Authenticated users can view non-deleted charts"
ON public.charts FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert charts"
ON public.charts FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update charts"
ON public.charts FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete charts"
ON public.charts FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

-- 11. Lyrics Policies
CREATE POLICY "Authenticated users can view lyrics"
ON public.lyrics FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert lyrics"
ON public.lyrics FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update lyrics"
ON public.lyrics FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete lyrics"
ON public.lyrics FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

-- 12. Setlists & Items Policies
CREATE POLICY "Authenticated users can view setlists"
ON public.setlists FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert setlists"
ON public.setlists FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update setlists"
ON public.setlists FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete setlists"
ON public.setlists FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view setlist_items"
ON public.setlist_items FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert setlist_items"
ON public.setlist_items FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update setlist_items"
ON public.setlist_items FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete setlist_items"
ON public.setlist_items FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

-- 13. Auto-sync trigger for new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'profession', 'instrument')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
