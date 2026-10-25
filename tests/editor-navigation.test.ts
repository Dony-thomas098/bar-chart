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
});
