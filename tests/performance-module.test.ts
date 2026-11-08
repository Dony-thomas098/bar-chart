import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Performance Module & Live Stage Invariants', () => {
  const perfPagePath = path.resolve(__dirname, '../app/perform/[code]/page.tsx');
  const perfHookPath = path.resolve(__dirname, '../hooks/usePerformanceSession.ts');
  const setlistPerfPath = path.resolve(__dirname, '../app/setlists/[id]/perform/page.tsx');
  const lyricsReaderPath = path.resolve(__dirname, '../components/PiascoreLyricsReader.tsx');
  const perfBuilderPath = path.resolve(__dirname, '../app/perform/page.tsx');
  const setlistsLibPath = path.resolve(__dirname, '../lib/setlists.ts');

  it('guarantees usePerformanceSession initializes mode to leader when initialPayload is present', () => {
    const hookCode = fs.readFileSync(perfHookPath, 'utf-8');
    // Must determine isLeader from initialPayload chartIds
    expect(hookCode).toContain('const isLeader = !!(initialPayload && Array.isArray(initialPayload.chartIds) && initialPayload.chartIds.length > 0);');
    // Must initialize mode to 'leader' immediately so leader is never stuck on loading
    expect(hookCode).toContain("const [mode, setMode] = useState<PerformRole>(isLeader ? 'leader' : 'loading');");
    // Must guard channel creation against empty code
    expect(hookCode).toContain('if (!code) return;');
    // Must sync state when initialPayload updates
    expect(hookCode).toContain('setMode(\'leader\');');
    expect(hookCode).toContain('setChartIds(initialPayload.chartIds);');
  });

  it('guarantees app/perform/[code]/page.tsx derives initialPayload with useMemo and supports lyrics', () => {
    const pageCode = fs.readFileSync(perfPagePath, 'utf-8');
    // initialPayload must be derived dynamically with useMemo, not locked in useState
    expect(pageCode).toContain('const initialPayload = React.useMemo(');
    expect(pageCode).toContain('sessionStorage.getItem(`perform-leader-${code}`)');
    expect(pageCode).toContain('localStorage.getItem(`perform-leader-${code}`)');
    expect(pageCode).toContain('localStorage.getItem(`perform-active-session-${code}`)');

    // Must import readLyrics
    expect(pageCode).toContain("import { readChart, readLyrics } from '@/lib/storage';");
    // Must support currentLyrics state
    expect(pageCode).toContain('const [currentLyrics, setCurrentLyrics] = useState');
    // Must render lyrics or unavailable fallback instead of infinite spinner
    expect(pageCode).toContain('currentLyrics ? (');
    expect(pageCode).toContain('Item Unavailable');
  });

  it('guarantees setlist perform page provides instant leader mode and solo perform fallback', () => {
    const setlistPerfCode = fs.readFileSync(setlistPerfPath, 'utf-8');
    // Mode must initialize to leader if leader device
    expect(setlistPerfCode).toContain("const [mode, setMode] = useState<PerfMode>(isLeaderDevice ? 'leader' : 'loading');");
    // Must sync isLeaderRef with isLeaderDevice
    expect(setlistPerfCode).toContain('isLeaderRef.current = isLeaderDevice;');
    // Must provide takeLead action
    expect(setlistPerfCode).toContain('const takeLead = useCallback(');
    // Must render "Perform Solo / Take Lead" button if waiting
    expect(setlistPerfCode).toContain('Perform Solo / Take Lead');
  });

  it('guarantees PiascoreLyricsReader properly persists perform-leader session payload', () => {
    const lyricsReaderCode = fs.readFileSync(lyricsReaderPath, 'utf-8');
    expect(lyricsReaderCode).toContain('sessionStorage.setItem(');
    expect(lyricsReaderCode).toContain('`perform-leader-${code}`');
    expect(lyricsReaderCode).toContain('`perform-active-session-${code}`');
    expect(lyricsReaderCode).toContain('router.push(`/perform/stage/?code=${code}`);');
  });

  it('guarantees perform builder searches both charts and lyrics', () => {
    const builderCode = fs.readFileSync(perfBuilderPath, 'utf-8');
    expect(builderCode).toContain("r.type === 'chart' || r.type === 'lyrics'");
    expect(builderCode).toContain("chart.type === 'lyrics' ? 'Lyrics'");
  });

  it('guarantees lib/setlists.ts caches setlists and items for offline performance', () => {
    const libCode = fs.readFileSync(setlistsLibPath, 'utf-8');
    expect(libCode).toContain('setlists_cache_');
    expect(libCode).toContain('setlist_items_cache_');
  });
});
