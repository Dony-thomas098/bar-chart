-- ==============================================================================
-- Chordly Migration: Username & Email Authentication + Auto-Profile Sync
-- ==============================================================================
-- Run this in your Supabase Dashboard -> SQL Editor
-- This enables:
-- 1. Seamless login using EITHER username OR email with the same password.
-- 2. Automatic profile creation & email syncing for Email/Password and Google OAuth.
-- 3. High-performance case-insensitive username lookup RPC.
-- ==============================================================================

-- 1. Ensure UUID Extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Ensure public.profiles table has email column and proper schema
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

-- Ensure email column exists if profiles already existed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 3. Create case-insensitive indexes for instant lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (LOWER(email));

-- 4. Backfill existing profiles with their registered email from auth.users
UPDATE public.profiles p
SET 
  email = u.email,
  username = COALESCE(p.username, split_part(u.email, '@', 1)),
  display_name = COALESCE(p.display_name, split_part(u.email, '@', 1)),
  updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Also insert any auth.users that don't have a profile yet
INSERT INTO public.profiles (id, email, username, display_name, role)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'role', 'instrument')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = COALESCE(public.profiles.username, EXCLUDED.username);

-- 5. Auto-sync trigger for new user creation (works for Email and Google OAuth)
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

-- 6. Secure RPC function: Resolve username to email for login
-- Callable by anon users on the login page without exposing user tables
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

  -- Not found: return cleaned input
  RETURN clean_ident;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to execute lookup RPC to anon & authenticated users
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;

-- 7. Ensure RLS on profiles allows public view for username resolution and band sync
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shared workspace view profiles" ON public.profiles;
CREATE POLICY "Shared workspace view profiles"
ON public.profiles FOR SELECT TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Shared workspace insert profiles" ON public.profiles;
CREATE POLICY "Shared workspace insert profiles"
ON public.profiles FOR INSERT TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Shared workspace update profiles" ON public.profiles;
CREATE POLICY "Shared workspace update profiles"
ON public.profiles FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);
