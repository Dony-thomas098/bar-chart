-- ==============================================================================
-- Chordly Migration: Complete Self-Contained Band Workspace & Profiles Setup
-- ==============================================================================
-- Run this in your Supabase Dashboard -> SQL Editor
-- This script creates both `public.profiles` and `public.bands` tables if they don't exist,
-- enables Realtime replication, and sets up shared workspace permissions.
-- ==============================================================================

-- 1. Enable UUID Extension (built-in pgcrypto/uuid-ossp)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Bands Table
CREATE TABLE IF NOT EXISTS public.bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Profiles Table (if missing)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'instrument',
  instrument TEXT,
  band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  band_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure email, band_id, band_name columns exist if profiles was already created previously
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS band_name TEXT;

-- Indexes for instant username / email lookup
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (LOWER(email));

-- 4. Enable Row Level Security (RLS) & Realtime Replica Identity
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands REPLICA IDENTITY FULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- 5. Add to Supabase Realtime Publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bands;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 6. Shared Workspace Policies for Bands
DROP POLICY IF EXISTS "Public bands lookup by code" ON public.bands;
DROP POLICY IF EXISTS "Authenticated users can create bands" ON public.bands;
DROP POLICY IF EXISTS "Admin can update their band" ON public.bands;
DROP POLICY IF EXISTS "Admin can delete their band" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace view bands" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace insert bands" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace update bands" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace delete bands" ON public.bands;

CREATE POLICY "Shared workspace view bands"
ON public.bands FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Shared workspace insert bands"
ON public.bands FOR INSERT TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Shared workspace update bands"
ON public.bands FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Shared workspace delete bands"
ON public.bands FOR DELETE TO authenticated, anon
USING (true);

-- 7. Shared Workspace Policies for Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by anon for login" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Shared workspace view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Shared workspace insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Shared workspace update profiles" ON public.profiles;

CREATE POLICY "Shared workspace view profiles"
ON public.profiles FOR SELECT TO authenticated, anon
USING (true);

CREATE POLICY "Shared workspace insert profiles"
ON public.profiles FOR INSERT TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Shared workspace update profiles"
ON public.profiles FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 8. Insert Default Band 'Choir Band' with default PIN '1234'
INSERT INTO public.bands (name, code)
VALUES ('Choir Band', '1234')
ON CONFLICT (code) DO NOTHING;

-- 9. Backfill emails from auth.users into profiles
UPDATE public.profiles p
SET 
  email = u.email,
  username = COALESCE(p.username, split_part(u.email, '@', 1)),
  display_name = COALESCE(p.display_name, split_part(u.email, '@', 1)),
  updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 10. Auto-sync trigger for new user creation (works for Email/Password and Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'instrument')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. Secure RPC function: Resolve username to email for login
CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier TEXT)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
  clean_ident TEXT;
BEGIN
  clean_ident := LOWER(TRIM(identifier));
  
  -- If already an email, return as-is
  IF POSITION('@' IN clean_ident) > 0 THEN
    RETURN clean_ident;
  END IF;

  -- 1. Match exact username (case-insensitive)
  SELECT email INTO v_email
  FROM public.profiles
  WHERE LOWER(username) = clean_ident AND email IS NOT NULL AND email != ''
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- 2. Match email prefix (e.g. user 'dony' -> 'dony@gmail.com')
  SELECT email INTO v_email
  FROM public.profiles
  WHERE LOWER(split_part(email, '@', 1)) = clean_ident AND email IS NOT NULL AND email != ''
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- 3. Match auth.users directly if profile was missing
  SELECT email INTO v_email
  FROM auth.users
  WHERE (LOWER(raw_user_meta_data->>'username') = clean_ident 
         OR LOWER(split_part(email, '@', 1)) = clean_ident)
    AND email IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- Fallback: return cleaned input
  RETURN clean_ident;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;

