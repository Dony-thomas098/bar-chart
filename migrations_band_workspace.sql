-- ==============================================================================
-- Chordly Migration: Band Workspace System (Create Band & Join with PIN/Code)
-- ==============================================================================

-- 1. Create bands table
CREATE TABLE IF NOT EXISTS public.bands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add band_id and band_name columns to user profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS band_name TEXT;

-- 3. Enable RLS and Realtime Replication on bands
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands REPLICA IDENTITY FULL;

-- 4. Supabase Realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bands;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 5. Drop old policies if any
DROP POLICY IF EXISTS "Public bands lookup by code" ON public.bands;
DROP POLICY IF EXISTS "Authenticated users can create bands" ON public.bands;
DROP POLICY IF EXISTS "Admin can update their band" ON public.bands;
DROP POLICY IF EXISTS "Admin can delete their band" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace view bands" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace insert bands" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace update bands" ON public.bands;
DROP POLICY IF EXISTS "Shared workspace delete bands" ON public.bands;

-- 6. Shared Workspace Policies for bands
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

-- 7. Insert default band 'Choir Band' with default PIN '1234'
INSERT INTO public.bands (name, code)
VALUES ('Choir Band', '1234')
ON CONFLICT (code) DO NOTHING;
