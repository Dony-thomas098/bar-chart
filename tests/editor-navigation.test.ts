import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Chart and Lyrics Editor Navigation & Routing Fixes', () => {
  it('guarantees PiascoreReader Writing button navigates with trailing slash /chart/edit/?id=', () => {
    const readerCode = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreReader.tsx'), 'utf-8');
    expect(readerCode).toContain('/chart/edit/?id=');
    expect(readerCode).not.toContain("router.push(`/chart/edit?id=");
  });

  it('guarantees PiascoreLyricsReader Writing button navigates with trailing slash /lyrics/edit/?id=', () => {
    const readerCode = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreLyricsReader.tsx'), 'utf-8');
    expect(readerCode).toContain('/lyrics/edit/?id=');
    expect(readerCode).not.toContain("router.push(`/lyrics/edit?id=");
  });

  it('guarantees app/perform/[code]/page.tsx uses /chart/edit/?id= with trailing slash', () => {
    const performCode = fs.readFileSync(path.resolve(__dirname, '../app/perform/[code]/page.tsx'), 'utf-8');
    expect(performCode).toContain('/chart/edit/?id=');
    expect(performCode).not.toContain("router.push(`/chart/edit?id=");
  });

  it('guarantees app/chart/[id]/page.tsx guards against collision with edit route', () => {
    const chartPageCode = fs.readFileSync(path.resolve(__dirname, '../app/chart/[id]/page.tsx'), 'utf-8');
    expect(chartPageCode).toContain("chartId === 'edit'");
    expect(chartPageCode).toContain("router.replace(`/chart/edit/${search}`);");
  });

  it('guarantees app/lyrics/[id]/page.tsx guards against collision with edit route', () => {
    const lyricsPageCode = fs.readFileSync(path.resolve(__dirname, '../app/lyrics/[id]/page.tsx'), 'utf-8');
    expect(lyricsPageCode).toContain("lyricId === 'edit'");
    expect(lyricsPageCode).toContain("router.replace(`/lyrics/edit/${search}`);");
  });

  it('guarantees FolderBrowser, Navigation, and Sidebar navigate directly to /chart/edit/?id= upon creating a new chart', () => {
    const folderCode = fs.readFileSync(path.resolve(__dirname, '../components/FolderBrowser.tsx'), 'utf-8');
    const navCode = fs.readFileSync(path.resolve(__dirname, '../components/Navigation.tsx'), 'utf-8');
    const sidebarCode = fs.readFileSync(path.resolve(__dirname, '../components/Sidebar.tsx'), 'utf-8');

    expect(folderCode).toContain('/chart/edit/?id=');
    expect(navCode).toContain('/chart/edit/?id=');
    expect(sidebarCode).toContain('/chart/edit/?id=');
  });

  it('guarantees FolderBrowser 3-dots dropdown menu includes direct Edit Chart / Edit Lyrics option', () => {
    const folderCode = fs.readFileSync(path.resolve(__dirname, '../components/FolderBrowser.tsx'), 'utf-8');
    expect(folderCode).toContain("Edit Chart");
    expect(folderCode).toContain("Edit Lyrics");
  });

  it('guarantees app/not-found.tsx redirects dynamic edit paths to edit query targets', () => {
    const notFoundCode = fs.readFileSync(path.resolve(__dirname, '../app/not-found.tsx'), 'utf-8');
    // Ensure edit route regex check exists before plain chart/lyrics check
    const chartEditPos = notFoundCode.indexOf('chartEditMatch');
    const chartPlainPos = notFoundCode.indexOf('chartMatch');
    expect(chartEditPos).toBeGreaterThan(-1);
    expect(chartPlainPos).toBeGreaterThan(-1);
    expect(chartEditPos).toBeLessThan(chartPlainPos);
    expect(notFoundCode).toContain('`/chart/edit/?id=${chartEditMatch[1]}`');

    const lyricsEditPos = notFoundCode.indexOf('lyricsEditMatch');
    const lyricsPlainPos = notFoundCode.indexOf('lyricsMatch');
    expect(lyricsEditPos).toBeGreaterThan(-1);
    expect(lyricsPlainPos).toBeGreaterThan(-1);
    expect(lyricsEditPos).toBeLessThan(lyricsPlainPos);
    expect(notFoundCode).toContain('`/lyrics/edit/?id=${lyricsEditMatch[1]}`');
  });

  it('guarantees chart and lyrics viewers allow offline and guest users without requiring user auth', () => {
    const chartPage = fs.readFileSync(path.resolve(__dirname, '../app/chart/page.tsx'), 'utf-8');
    const chartIdPage = fs.readFileSync(path.resolve(__dirname, '../app/chart/[id]/page.tsx'), 'utf-8');
    const lyricsPage = fs.readFileSync(path.resolve(__dirname, '../app/lyrics/view/page.tsx'), 'utf-8');
    const lyricsIdPage = fs.readFileSync(path.resolve(__dirname, '../app/lyrics/[id]/page.tsx'), 'utf-8');

    // Neither chart viewer should block unauthenticated users when local chart is present
    expect(chartPage).not.toContain('!user || !chart');
    expect(chartPage).toContain('if (!chart)');
    expect(chartIdPage).not.toContain('!user || !chart');
    expect(chartIdPage).toContain('if (!chart)');

    // Neither lyrics viewer should block unauthenticated users when local lyric is present
    expect(lyricsPage).not.toContain('!user || !lyric');
    expect(lyricsPage).toContain('if (!lyric)');
    expect(lyricsIdPage).not.toContain('!user || !lyric');
    expect(lyricsIdPage).toContain('if (!lyric)');
  });

  it('guarantees Setlist Live Performance uses a shared Supabase channel and proper presence key', () => {
    const setlistPerformCode = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/perform/page.tsx'), 'utf-8');
    // Channel name must be shared across all devices for the setlist
    expect(setlistPerformCode).toContain('supabase.channel(`setlist-${setlistId}`');
    expect(setlistPerformCode).not.toContain('supabase.channel(`setlist-${setlistId}-${instanceId}`)');
    expect(setlistPerformCode).toContain('presence: { key: instanceId }');

    // Prevents "cannot add presence callbacks after subscribe" by cleaning up existing channel and guarding race conditions
    expect(setlistPerformCode).toContain('supabase.getChannels().find');
    expect(setlistPerformCode).toContain('if (cancelled || !isMountedRef.current) return;');
  });

  it('guarantees Setlist and Live Stage routes use canonical trailing slashes', () => {
    const setlistListCode = fs.readFileSync(path.resolve(__dirname, '../app/setlists/page.tsx'), 'utf-8');
    expect(setlistListCode).toContain('/setlists/view/?id=');
    expect(setlistListCode).toContain('/setlists/perform/?id=');
    expect(setlistListCode).not.toContain("router.push(`/setlists/view?id=");
    expect(setlistListCode).not.toContain("router.push(`/setlists/perform?id=");

    const performCode = fs.readFileSync(path.resolve(__dirname, '../app/perform/page.tsx'), 'utf-8');
    expect(performCode).toContain('/perform/stage/?code=');
    expect(performCode).not.toContain("router.push(`/perform/stage?code=");

    const notFoundCode = fs.readFileSync(path.resolve(__dirname, '../app/not-found.tsx'), 'utf-8');
    expect(notFoundCode).toContain('/setlists/view/?id=');
    expect(notFoundCode).toContain('/setlists/perform/?id=');
    expect(notFoundCode).toContain('`/lyrics/folder/?id=${lyricsFolderMatch[1]}`');
  });

  it('guarantees dynamic route pages guard against static route names (view, perform, stage, edit)', () => {
    const setlistDetailPage = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/page.tsx'), 'utf-8');
    expect(setlistDetailPage).toContain("params.id !== 'view'");
    expect(setlistDetailPage).toContain("params.id !== 'perform'");

    const setlistPerformPage = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/perform/page.tsx'), 'utf-8');
    expect(setlistPerformPage).toContain("params.id !== 'view'");
    expect(setlistPerformPage).toContain("params.id !== 'perform'");

    const stagePerformPage = fs.readFileSync(path.resolve(__dirname, '../app/perform/[code]/page.tsx'), 'utf-8');
    expect(stagePerformPage).toContain("toLowerCase() !== 'stage'");

    const lyricsDetailPage = fs.readFileSync(path.resolve(__dirname, '../app/lyrics/[id]/page.tsx'), 'utf-8');
    expect(lyricsDetailPage).toContain("params.id !== 'view'");
    expect(lyricsDetailPage).toContain("params.id !== 'edit'");
    expect(lyricsDetailPage).toContain("params.id !== 'folder'");

    const lyricsViewPage = fs.readFileSync(path.resolve(__dirname, '../app/lyrics/view/page.tsx'), 'utf-8');
    expect(lyricsViewPage).toContain("params.id !== 'view'");
    expect(lyricsViewPage).toContain("params.id !== 'edit'");
    expect(lyricsViewPage).toContain("params.id !== 'folder'");
  });

  it('guarantees FolderBrowser refreshes on kind change and Navigation/Sidebar use trailing slashes', () => {
    const folderCode = fs.readFileSync(path.resolve(__dirname, '../components/FolderBrowser.tsx'), 'utf-8');
    expect(folderCode).toContain('[folderId, kind]');

    const navCode = fs.readFileSync(path.resolve(__dirname, '../components/Navigation.tsx'), 'utf-8');
    expect(navCode).toContain("href: isSinger ? '/' : '/lyrics/'");
    expect(navCode).toContain("href: '/setlists/'");
    expect(navCode).toContain("href: isSinger ? '/chords/' : '/'");

    const sidebarCode = fs.readFileSync(path.resolve(__dirname, '../components/Sidebar.tsx'), 'utf-8');
    expect(sidebarCode).toContain("handleNav(isSinger ? '/' : '/lyrics/')");
    expect(sidebarCode).toContain("handleNav('/setlists/')");
    expect(sidebarCode).toContain("handleNav('/perform/')");
  });

  it('guarantees Lyrics catalog route /lyrics/ and folder routes are matched before single lyrics viewer in Service Worker', () => {
    const swGenCode = fs.readFileSync(path.resolve(__dirname, '../scripts/generate-sw.js'), 'utf-8');
    
    // In generate-sw.js, check that /lyrics and /lyrics/ are intercepted and served /lyrics/index.html
    const catalogMatchPos = swGenCode.indexOf("url.pathname === '/lyrics' || url.pathname === '/lyrics/'");
    const lyricsViewPos = swGenCode.indexOf("caches.match('/lyrics/view/index.html'");
    expect(catalogMatchPos).toBeGreaterThan(-1);
    expect(lyricsViewPos).toBeGreaterThan(-1);
    expect(catalogMatchPos).toBeLessThan(lyricsViewPos);

    // Also verify RSC flight payload for catalog is matched before lyrics/view
    const rscCatalogPos = swGenCode.indexOf("url.pathname === '/lyrics' || url.pathname === '/lyrics/'", catalogMatchPos + 1);
    const rscViewPos = swGenCode.indexOf("caches.match('/lyrics/view/index.txt'");
    expect(rscCatalogPos).toBeGreaterThan(-1);
    expect(rscViewPos).toBeGreaterThan(-1);
    expect(rscCatalogPos).toBeLessThan(rscViewPos);
  });

  it('guarantees viewer pages bind key={id} to PiascoreReader and PiascoreLyricsReader to prevent stale chart lock', () => {
    const chartPage = fs.readFileSync(path.resolve(__dirname, '../app/chart/page.tsx'), 'utf-8');
    const chartDetailPage = fs.readFileSync(path.resolve(__dirname, '../app/chart/[id]/page.tsx'), 'utf-8');
    const lyricsViewPage = fs.readFileSync(path.resolve(__dirname, '../app/lyrics/view/page.tsx'), 'utf-8');
    const lyricsDetailPage = fs.readFileSync(path.resolve(__dirname, '../app/lyrics/[id]/page.tsx'), 'utf-8');

    expect(chartPage).toContain('<PiascoreReader\n      key={chart.id}');
    expect(chartDetailPage).toContain('<PiascoreReader\n      key={chart.id}');
    expect(lyricsViewPage).toContain('<PiascoreLyricsReader\n      key={lyric.id}');
    expect(lyricsDetailPage).toContain('<PiascoreLyricsReader\n      key={lyric.id}');
  });

  it('guarantees PiascoreReader and PiascoreLyricsReader synchronize tabs, activeTabId, and current item when initial props change', () => {
    const readerCode = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreReader.tsx'), 'utf-8');
    const lyricsReaderCode = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreLyricsReader.tsx'), 'utf-8');

    expect(readerCode).toContain('setActiveTabId(initialChart.id);');
    expect(readerCode).toContain('setCurrentChart(initialChart);');
    expect(lyricsReaderCode).toContain('setActiveTabId(initialLyric.id);');
    expect(lyricsReaderCode).toContain('setCurrentLyric(initialLyric);');
  });

  it('guarantees ChartEditor uses touch card interface for phones and tablets below xl', () => {
    const editorPage = fs.readFileSync(path.resolve(__dirname, '../app/chart/[id]/edit/page.tsx'), 'utf-8');
    expect(editorPage).toContain('block xl:hidden');
    expect(editorPage).toContain('hidden xl:block');
    expect(editorPage).not.toContain('block md:hidden');
    expect(editorPage).not.toContain('hidden md:block');
  });

  it('guarantees app/chart/[id]/page.tsx and app/chart/page.tsx render ChartEditor immediately on edit routes', () => {
    const chartIdPage = fs.readFileSync(path.resolve(__dirname, '../app/chart/[id]/page.tsx'), 'utf-8');
    const chartPage = fs.readFileSync(path.resolve(__dirname, '../app/chart/page.tsx'), 'utf-8');

    expect(chartIdPage).toContain("const isEditRoute = params?.id === 'edit' || pathname.includes('/edit');");
    expect(chartIdPage).toContain('if (isEditRoute) {\n    return <ChartEditor />;\n  }');
    expect(chartPage).toContain("const isEditRoute = params?.id === 'edit' || pathname.includes('/edit');");
    expect(chartPage).toContain('if (isEditRoute) {\n    return <ChartEditor />;\n  }');
  });

  it('guarantees ChartEditor and LyricsEditor integrate useHardwareBackButton and returnTo navigation', () => {
    const chartEditor = fs.readFileSync(path.resolve(__dirname, '../app/chart/[id]/edit/page.tsx'), 'utf-8');
    const lyricsEditor = fs.readFileSync(path.resolve(__dirname, '../app/lyrics/[id]/edit/page.tsx'), 'utf-8');

    expect(chartEditor).toContain('useHardwareBackButton({');
    expect(chartEditor).toContain('stateKey: \'chordly_chart_editor\'');
    expect(chartEditor).toContain('if (returnTo) {\n      router.push(returnTo);');
    expect(chartEditor).toContain('router.push(`/folder/?id=${chartRef.current.folder_id}`);');

    expect(lyricsEditor).toContain('useHardwareBackButton({');
    expect(lyricsEditor).toContain('stateKey: \'chordly_lyrics_editor\'');
    expect(lyricsEditor).toContain('if (returnTo) {\n      router.push(returnTo);');
    expect(lyricsEditor).toContain('router.push(`/lyrics/folder/?id=${lyricRef.current.folder_id}`);');
  });

  it('guarantees new chart creation in Navigation, FolderBrowser, and Sidebar includes returnTo parameter', () => {
    const nav = fs.readFileSync(path.resolve(__dirname, '../components/Navigation.tsx'), 'utf-8');
    const folder = fs.readFileSync(path.resolve(__dirname, '../components/FolderBrowser.tsx'), 'utf-8');
    const sidebar = fs.readFileSync(path.resolve(__dirname, '../components/Sidebar.tsx'), 'utf-8');

    expect(nav).toContain('returnTo=${encodeURIComponent(returnPath)}');
    expect(folder).toContain('returnTo=${encodeURIComponent(returnPath)}');
    expect(sidebar).toContain('returnTo=${encodeURIComponent(returnPath)}');
  });

  it('guarantees CapacitorInit allows history back navigation on subroutes instead of hardcoding home', () => {
    const capInit = fs.readFileSync(path.resolve(__dirname, '../components/CapacitorInit.tsx'), 'utf-8');
    expect(capInit).toContain('window.history.length > 1');
    expect(capInit).toContain('router.back();');
  });

  it('guarantees desktop-only Back buttons exist across Header, Piascore readers, perform views, and auth', () => {
    const header = fs.readFileSync(path.resolve(__dirname, '../components/Header.tsx'), 'utf-8');
    const piascoreReader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreReader.tsx'), 'utf-8');
    const lyricsReader = fs.readFileSync(path.resolve(__dirname, '../components/PiascoreLyricsReader.tsx'), 'utf-8');
    const setlistPerform = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/perform/page.tsx'), 'utf-8');
    const stagePerform = fs.readFileSync(path.resolve(__dirname, '../app/perform/[code]/page.tsx'), 'utf-8');
    const authPage = fs.readFileSync(path.resolve(__dirname, '../app/auth/page.tsx'), 'utf-8');

    expect(header).toContain('hidden md:inline-flex');
    expect(header).toContain('<span>Back</span>');

    expect(piascoreReader).toContain('hidden md:inline-flex');
    expect(piascoreReader).toContain('<span>Back</span>');

    expect(lyricsReader).toContain('hidden md:inline-flex');
    expect(lyricsReader).toContain('<span>Back</span>');

    expect(setlistPerform).toContain('hidden md:inline-flex');
    expect(setlistPerform).toContain('<span>Back</span>');

    expect(stagePerform).toContain('hidden md:inline-flex');
    expect(stagePerform).toContain('<span>Back</span>');

    expect(authPage).toContain('hidden md:inline-flex');
    expect(authPage).toContain('<span>Back</span>');
  });

  it('guarantees score fit centers medium and tall charts on tablets and phones without pinning to top', async () => {
    const { calculateScoreFit } = await import('../lib/score-fit');

    // Tablet: 12-line chart (850x900 on iPad portrait 820x1180)
    const tabletFit = calculateScoreFit({
      viewportWidth: 820,
      viewportHeight: 1180,
      cardWidth: 850,
      cardHeight: 900,
      showUI: false,
      isLocked: true,
    });
    expect(tabletFit.posY).toBeGreaterThan(8);
    const scaledHeight = 900 * tabletFit.scale;
    const expectedPosY = (1180 - scaledHeight) / 2;
    expect(tabletFit.posY).toBeCloseTo(expectedPosY, 1);

    // Phone: short/medium chart (600x450 on phone 390x844)
    const phoneFit = calculateScoreFit({
      viewportWidth: 390,
      viewportHeight: 844,
      cardWidth: 600,
      cardHeight: 450,
      showUI: false,
      isLocked: true,
    });
    expect(phoneFit.posY).toBeGreaterThan(8);
    const scaledHeightPhone = 450 * phoneFit.scale;
    const expectedPosYPhone = (844 - scaledHeightPhone) / 2;
    expect(phoneFit.posY).toBeCloseTo(expectedPosYPhone, 1);
  });

  it('guarantees FolderBrowser and Navigation implement safeNavigate with timeout fallback for card clicks and creation', () => {
    const folderCode = fs.readFileSync(path.resolve(__dirname, '../components/FolderBrowser.tsx'), 'utf-8');
    const navCode = fs.readFileSync(path.resolve(__dirname, '../components/Navigation.tsx'), 'utf-8');

    // safeNavigate definition and usage in FolderBrowser
    expect(folderCode).toContain('const safeNavigate = useCallback((targetUrl: string) =>');
    expect(folderCode).toContain('window.location.assign(targetUrl);');
    expect(folderCode).toContain("handleCardClick(chart.id, kind, e, () => safeNavigate");
    expect(folderCode).toContain("handleCardClick(folder.id, 'folder', e, () => safeNavigate");
    expect(folderCode).toContain("safeNavigate(chartUrl);");
    expect(folderCode).toContain("safeNavigate(lyricsUrl);");

    // Mouse pointer events never trigger long press
    expect(folderCode).toContain("if (e.pointerType === 'mouse') return;");

    // Navigation.tsx resilient navigation timeout fallback
    expect(navCode).toContain('window.location.assign(chartUrl);');
    expect(navCode).toContain('window.location.assign(lyricsUrl);');
  });

  it('guarantees Supabase setlist realtime cleans up subscribed channel instances from client', () => {
    const setlistPerformCode = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/perform/page.tsx'), 'utf-8');
    expect(setlistPerformCode).toContain('(supabase as any).realtime?.channels');
    expect(setlistPerformCode).toContain('channels.filter');
  });
});
