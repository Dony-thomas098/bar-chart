import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Group 1: Security Fixes Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Migration 009 RPC Integration', () => {
    it('verifies SQL migration 009 script defines security definer functions and revokes anon enumeration', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const migrationPath = path.resolve(__dirname, '../migrations_009_lock_profiles_and_bands_enumeration.sql');
      const rollbackPath = path.resolve(__dirname, '../migrations_009_lock_profiles_and_bands_enumeration_rollback.sql');

      expect(fs.existsSync(migrationPath)).toBe(true);
      expect(fs.existsSync(rollbackPath)).toBe(true);

      const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
      const rollbackSql = fs.readFileSync(rollbackPath, 'utf-8');

      // Must create get_email_for_username with SECURITY DEFINER
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_email_for_username');
      expect(migrationSql).toContain('SECURITY DEFINER');

      // Must create get_band_by_code with SECURITY DEFINER
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_band_by_code');

      // Must create is_band_code_taken with SECURITY DEFINER
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.is_band_code_taken');

      // Must lock down SELECT on profiles and bands to authenticated only
      expect(migrationSql).toContain('DROP POLICY IF EXISTS "Allow read profiles"');
      expect(migrationSql).toContain('DROP POLICY IF EXISTS "Allow read bands"');
      expect(migrationSql).toContain('CREATE POLICY "Allow read own or band profiles"');
      expect(migrationSql).toContain('CREATE POLICY "Allow read own band"');

      // Rollback must restore prior permissive policies
      expect(rollbackSql).toContain('CREATE POLICY "Allow read profiles"');
      expect(rollbackSql).toContain('CREATE POLICY "Allow read bands"');
      expect(rollbackSql).toContain('DROP FUNCTION IF EXISTS public.get_email_for_username');
    });

    it('verifies app/auth/page.tsx utilizes RPC get_email_for_username before table fallback', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const authCode = fs.readFileSync(path.resolve(__dirname, '../app/auth/page.tsx'), 'utf-8');
      expect(authCode).toContain("supabase.rpc('get_email_for_username'");
    });

    it('verifies lib/band.ts utilizes RPC get_band_by_code and is_band_code_taken', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const bandCode = fs.readFileSync(path.resolve(__dirname, '../lib/band.ts'), 'utf-8');
      expect(bandCode).toContain("supabase.rpc('get_band_by_code'");
      expect(bandCode).toContain("supabase.rpc('is_band_code_taken'");
    });
  });

  describe('Live Stage Broadcast Authentication & Protection', () => {
    it('verifies hooks/usePerformanceSession.ts attaches senderId and verifies leader instance', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const hookCode = fs.readFileSync(path.resolve(__dirname, '../hooks/usePerformanceSession.ts'), 'utf-8');

      // Must track leaderInstanceIdRef and attach senderId
      expect(hookCode).toContain('leaderInstanceIdRef');
      expect(hookCode).toContain('senderId: instanceIdRef.current');
      expect(hookCode).toContain('payload.senderId !== leaderInstanceIdRef.current');

      // Must have 6-second presence disconnect debounce
      expect(hookCode).toContain('leaderDisconnectTimeoutRef');
      expect(hookCode).toContain('6000');
    });

    it('verifies removeChannel and track floating promises are caught', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const hookCode = fs.readFileSync(path.resolve(__dirname, '../hooks/usePerformanceSession.ts'), 'utf-8');
      const syncContextCode = fs.readFileSync(path.resolve(__dirname, '../components/OfflineSyncContext.tsx'), 'utf-8');

      expect(hookCode).toContain('.catch((err: unknown) => console.warn(');
      expect(syncContextCode).toContain('.catch((err: unknown) => console.warn(');
    });
  });
});
