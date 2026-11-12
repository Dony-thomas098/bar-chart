-- ==============================================================================
-- Chordly Migration 011 Rollback: Remove Custom Position Ordering from Folders
-- ==============================================================================

DROP INDEX IF EXISTS idx_folders_parent_position;
ALTER TABLE public.folders DROP COLUMN IF EXISTS position;
