-- ==============================================================================
-- Chordly Migration 009 Rollback: Revert Profiles & Bands Lockdown
-- ==============================================================================

DROP POLICY IF EXISTS "Allow read own or band profiles" ON public.profiles;
CREATE POLICY "Allow read profiles"
ON public.profiles FOR SELECT TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Allow read own band" ON public.bands;
CREATE POLICY "Allow read bands"
ON public.bands FOR SELECT TO authenticated, anon
USING (true);

DROP FUNCTION IF EXISTS public.is_band_code_taken(TEXT);
DROP FUNCTION IF EXISTS public.get_band_by_code(TEXT);
DROP FUNCTION IF EXISTS public.get_email_for_username(TEXT);
