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

  it('guarantees usePerformanceSession supports broadcastChordUpdate and listens to chord-update events', () => {
    const hookCode = fs.readFileSync(perfHookPath, 'utf-8');
    expect(hookCode).toContain("event: 'chord-update'");
    expect(hookCode).toContain('perform-chord-update');
    expect(hookCode).toContain('broadcastChordUpdate');
  });

  it('guarantees live stage page supports interactive transposition and real-time chord updates on followers', () => {
    const pageCode = fs.readFileSync(perfPagePath, 'utf-8');
    expect(pageCode).toContain('handleTranspose');
    expect(pageCode).toContain('perform-chord-update');
    expect(pageCode).toContain('handleOpenPerfEdit');
    expect(pageCode).toContain('handleSavePerfCopy');
    expect(pageCode).toContain('live-stage-chart-');
  });

  it('guarantees setlist perform page broadcasts chord edits and transpositions to follower devices', () => {
    const setlistCode = fs.readFileSync(setlistPerfPath, 'utf-8');
    expect(setlistCode).toContain("event: 'chord-update'");
    expect(setlistCode).toContain('setlist-chord-update');
    expect(setlistCode).toContain('handleTranspose');
    expect(setlistCode).toContain('broadcastChordUpdate({');
  });

  it('guarantees performance CodeBadge copies only code and header provides dedicated follower badge and leave button', () => {
    const pageCode = fs.readFileSync(perfPagePath, 'utf-8');
    // CodeBadge must copy only code
    expect(pageCode).toContain('navigator.clipboard.writeText(code);');
    expect(pageCode).not.toContain('navigator.clipboard.writeText(url);');

    // Header must have dedicated follower pill with Users icon and followerCount
    expect(pageCode).toContain('<Users size={12} className="text-accent-start" />');
    expect(pageCode).toContain('{followerCount}');

    // Follower must have dedicated Leave button and leader-only controls
    expect(pageCode).toContain('title="Leave live performance session"');
    expect(pageCode).toContain('handleFollowerLeave');
    expect(pageCode).toContain('router.replace(\'/perform\');');
    expect(pageCode).toContain('sessionStorage.setItem(`perform-ended-${code}`, \'true\');');

    // Missing code guard
    expect(pageCode).toContain('No Active Session Code');
  });

  it('guarantees setlist detail page does not have floating rounded View Set button', () => {
    const setlistDetailPath = path.resolve(__dirname, '../app/setlists/[id]/page.tsx');
    const setlistDetailCode = fs.readFileSync(setlistDetailPath, 'utf-8');
    expect(setlistDetailCode).not.toContain('View Set');
    expect(setlistDetailCode).not.toContain('fixed bottom-20');
  });

  it('guarantees performance and setlist perform stages avoid top bar collisions and animate clearance when bars hide/show', () => {
    const pageCode = fs.readFileSync(perfPagePath, 'utf-8');
    const setlistCode = fs.readFileSync(setlistPerfPath, 'utf-8');

    // Perform stage: header collision prevention & dynamic padding
    expect(pageCode).toContain('showHeader = true');
    expect(pageCode).toContain('showUI: showHeader');
    expect(pageCode).toContain("showHeader");
    expect(pageCode).toContain("pt-[calc(4.5rem+env(safe-area-inset-top,0px))]");
    expect(pageCode).toContain("pt-[max(1rem,env(safe-area-inset-top,0px))]");
    expect(pageCode).toContain('<PerformChartWrapper chart={currentChart} showHeader={showHeader}');

    // Setlist perform: barsVisible dynamic padding and collision prevention
    expect(setlistCode).toContain('barsVisible = true');
    expect(setlistCode).toContain('showUI: barsVisible');
    expect(setlistCode).toContain("barsVisible");
    expect(setlistCode).toContain("pt-[calc(6.25rem+env(safe-area-inset-top,0px))]");
    expect(setlistCode).toContain("pt-[max(1rem,env(safe-area-inset-top,0px))]");
    expect(setlistCode).toContain('barsVisible={barsVisible}');
  });
});
