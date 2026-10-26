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
});
