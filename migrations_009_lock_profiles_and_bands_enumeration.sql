-- ==============================================================================
-- Chordly Migration 009: Prevent Public Enumeration of Profiles & Band Codes
-- ==============================================================================
-- Purpose:
-- 1. Fixes Critical Security Finding #20 & #21 from AUDIT-REPORT.md.
-- 2. Revokes permissive `anon` SELECT access on `public.profiles` and `public.bands`.
-- 3. Provides `public.get_email_for_username(p_username TEXT)` via SECURITY DEFINER
--    to allow username-based sign-in without exposing user emails to bulk scraping.
-- 4. Provides `public.get_band_by_code(p_code TEXT)` via SECURITY DEFINER
--    to allow joining/validating a band by code without exposing all secret band PINs.
-- 5. Provides `public.is_band_code_taken(p_code TEXT)` via SECURITY DEFINER
--    to safely verify band code uniqueness during creation.
-- 6. Restricts SELECT on `public.profiles` to:
--    - The user themselves (`auth.uid() = id`), OR
--    - Members of the same band (`band_id = public.current_user_band_id()`).
-- 7. Restricts SELECT on `public.bands` to:
--    - The user's active joined band (`id = public.current_user_band_id()`), OR
--    - Bands created by the user (`admin_id = auth.uid()`).
--
-- How to apply:
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- ─── STEP 1: RPC FUNCTION FOR USERNAME -> EMAIL LOOKUP (FOR SIGN-IN) ──────────
CREATE OR REPLACE FUNCTION public.get_email_for_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE LOWER(TRIM(username)) = LOWER(TRIM(p_username))
    AND email IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_for_username(TEXT) TO anon, authenticated;

-- ─── STEP 2: RPC FUNCTION FOR BAND LOOKUP BY SECRET CODE (FOR JOINING) ───────
CREATE OR REPLACE FUNCTION public.get_band_by_code(p_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT,
  admin_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.code, b.admin_id, b.created_at
  FROM public.bands b
  WHERE LOWER(TRIM(b.code)) = LOWER(TRIM(p_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_band_by_code(TEXT) TO anon, authenticated;

-- ─── STEP 3: RPC FUNCTION TO CHECK IF A BAND CODE IS TAKEN (FOR CREATION) ────
CREATE OR REPLACE FUNCTION public.is_band_code_taken(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.bands
    WHERE LOWER(TRIM(code)) = LOWER(TRIM(p_code))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_band_code_taken(TEXT) TO anon, authenticated;

-- ─── STEP 4: SECURE PROFILES RLS POLICY ───────────────────────────────────────
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow read own or band profiles" ON public.profiles;

CREATE POLICY "Allow read own or band profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (
    band_id IS NOT NULL 
    AND public.current_user_band_id() IS NOT NULL
    AND band_id = public.current_user_band_id()
  )
);

-- ─── STEP 5: SECURE BANDS RLS POLICY ──────────────────────────────────────────
DROP POLICY IF EXISTS "Allow read bands" ON public.bands;
DROP POLICY IF EXISTS "Allow read own band" ON public.bands;

CREATE POLICY "Allow read own band"
ON public.bands FOR SELECT TO authenticated
USING (
  id = public.current_user_band_id()
  OR admin_id = auth.uid()
);
