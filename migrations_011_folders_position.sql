-- ==============================================================================
-- Chordly Migration 011: Add Custom Position Ordering to Folders
-- ==============================================================================
-- Purpose:
-- 1. Adds nullable `position` column to `public.folders` table for custom drag-and-drop ordering.
-- 2. Creates index on (parent_id, position) for fast ordering lookups within folders and root catalog.
-- 3. Enables all band members to see Admin's custom folder ordering.
--
-- How to apply:
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- ─── STEP 1: ADD POSITION COLUMN ──────────────────────────────────────────────
ALTER TABLE public.folders 
  ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT NULL;

-- ─── STEP 2: CREATE INDEX FOR ORDERING LOOKUPS ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_folders_parent_position ON public.folders (parent_id, position);
