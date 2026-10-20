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
  username TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'instrument',
  instrument TEXT,
  band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  band_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure band_id and band_name columns exist if profiles was already created previously
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS band_name TEXT;

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
