import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  listFolderFromCache, 
  clearBandCache, 
  saveChart, 
  saveLyrics, 
  createFolder, 
  getDBPromise, 
  Chart, 
  Folder 
} from '../lib/storage';
import { 
  saveBandLocally, 
  getStoredBand, 
  clearActiveBandSession, 
  leaveBand, 
  joinBand,
  Band 
} from '../lib/band';

const BAND_1: Band = {
  id: 'b1111111-1111-1111-1111-111111111111',
  name: 'Band Alpha',
  code: 'ALPHA',
  admin_id: 'user-a',
};

const BAND_2: Band = {
  id: 'b2222222-2222-2222-2222-222222222222',
  name: 'Band Beta',
  code: 'BETA',
  admin_id: 'user-b',
};

describe('Band Data Isolation & Scoped Storage', () => {
  beforeEach(async () => {
    localStorage.clear();
    const db = await getDBPromise();
    if (db) {
      await db.clear('charts');
      await db.clear('lyrics');
      await db.clear('folders');
      await db.clear('pending_saves');
    }
  });

  it('Band A member can only see Band A items and never Band B items from cache', async () => {
    const db = await getDBPromise();
    expect(db).toBeDefined();
    if (!db) return;

    // Seed Band 1 items
    await db.put('charts', {
      id: 'chart-band-1',
      title: 'Amazing Grace (Band 1)',
      tempo: 72,
      time_sig: '4/4',
      lines: [],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: 'user-a',
      updated_at: new Date().toISOString(),
      band_id: BAND_1.id,
    } as Chart);

    await db.put('folders', {
      id: 'folder-band-1',
      name: 'Sunday Morning Set (Band 1)',
      parent_id: null,
      created_by: 'user-a',
      updated_at: new Date().toISOString(),
      kind: 'chart',
      band_id: BAND_1.id,
    } as Folder);

    // Seed Band 2 items
    await db.put('charts', {
      id: 'chart-band-2',
      title: 'Way Maker (Band 2 Secret)',
      tempo: 68,
      time_sig: '4/4',
      lines: [],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: 'user-c',
      updated_at: new Date().toISOString(),
      band_id: BAND_2.id,
    } as Chart);

    await db.put('folders', {
      id: 'folder-band-2',
      name: 'Easter Special (Band 2 Secret)',
      parent_id: null,
      created_by: 'user-c',
      updated_at: new Date().toISOString(),
      kind: 'chart',
      band_id: BAND_2.id,
    } as Folder);

    // Set active band to Band 1
    saveBandLocally(BAND_1);
    expect(getStoredBand().id).toBe(BAND_1.id);

    // List folder for Band 1
    const band1Results = await listFolderFromCache(null, 'chart', BAND_1.id);
    expect(band1Results.charts.map((c) => c.id)).toContain('chart-band-1');
    expect(band1Results.charts.map((c) => c.id)).not.toContain('chart-band-2');
    expect(band1Results.folders.map((f) => f.id)).toContain('folder-band-1');
    expect(band1Results.folders.map((f) => f.id)).not.toContain('folder-band-2');

    // Switch active band to Band 2
    saveBandLocally(BAND_2);
    expect(getStoredBand().id).toBe(BAND_2.id);

    // List folder for Band 2
    const band2Results = await listFolderFromCache(null, 'chart', BAND_2.id);
    expect(band2Results.charts.map((c) => c.id)).toContain('chart-band-2');
    expect(band2Results.charts.map((c) => c.id)).not.toContain('chart-band-1');
    expect(band2Results.folders.map((f) => f.id)).toContain('folder-band-2');
    expect(band2Results.folders.map((f) => f.id)).not.toContain('folder-band-1');
  });

  it('User with no band sees no band items', async () => {
    const db = await getDBPromise();
    if (!db) return;

    await db.put('charts', {
      id: 'chart-band-1',
      title: 'Confidential Song',
      tempo: 70,
      time_sig: '4/4',
      lines: [],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: 'user-a',
      updated_at: new Date().toISOString(),
      band_id: BAND_1.id,
    } as Chart);

    clearActiveBandSession();
    expect(getStoredBand().id).toBeNull();

    // With no band and not guest mode, band items are not returned
    const noBandResults = await listFolderFromCache(null, 'chart', null);
    expect(noBandResults.charts.map((c) => c.id)).not.toContain('chart-band-1');
    expect(noBandResults.charts.length).toBe(0);
  });

  it('Guest mode stays local-only and does not require band_id', async () => {
    const db = await getDBPromise();
    if (!db) return;

    localStorage.setItem('chord-grid-guest-mode', 'true');

    await db.put('charts', {
      id: 'guest-local-chart',
      title: 'My Local Chart',
      tempo: 100,
      time_sig: '4/4',
      lines: [],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: 'guest-offline',
      updated_at: new Date().toISOString(),
    } as Chart);

    const guestResults = await listFolderFromCache(null, 'chart', null);
    expect(guestResults.charts.map((c) => c.id)).toContain('guest-local-chart');
  });

  it('clearBandCache purges only that band items and preserves other bands', async () => {
    const db = await getDBPromise();
    if (!db) return;

    // Seed both bands
    await db.put('charts', {
      id: 'c1',
      title: 'Band 1 Song',
      tempo: null,
      time_sig: null,
      lines: [],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: 'u1',
      updated_at: '',
      band_id: BAND_1.id,
    } as Chart);

    await db.put('charts', {
      id: 'c2',
      title: 'Band 2 Song',
      tempo: null,
      time_sig: null,
      lines: [],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: 'u2',
      updated_at: '',
      band_id: BAND_2.id,
    } as Chart);

    // Purge Band 1
    await clearBandCache(BAND_1.id);

    const remaining = await db.getAll('charts');
    expect(remaining.map((c) => c.id)).not.toContain('c1');
    expect(remaining.map((c) => c.id)).toContain('c2');
  });

  it('automatically sets creator band_id on insert in storage functions', async () => {
    const db = await getDBPromise();
    if (!db) return;

    saveBandLocally(BAND_1);

    // saveChart
    const newChart: Chart = {
      id: 'new-chart-auto-band',
      title: 'Auto Band Song',
      tempo: 120,
      time_sig: '4/4',
      lines: [],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: 'user-current',
      updated_at: '',
    };
    await saveChart(newChart);

    const cachedChart = await db.get('charts', 'new-chart-auto-band');
    expect(cachedChart?.band_id).toBe(BAND_1.id);

    // saveLyrics
    const newLyric = {
      id: 'new-lyric-auto-band',
      title: 'Auto Band Lyric',
      body: 'Lyrics line 1',
      folder_id: null,
      created_by: 'user-current',
      updated_at: '',
    };
    await saveLyrics(newLyric);

    const cachedLyric = await db.get('lyrics', 'new-lyric-auto-band');
    expect(cachedLyric?.band_id).toBe(BAND_1.id);

    // createFolder
    const folder = await createFolder(null, 'Worship Folder', 'chart');
    expect(folder.band_id).toBe(BAND_1.id);
  });

  it('leaveBand purges cached data and removes active session band keys', async () => {
    const db = await getDBPromise();
    if (!db) return;

    saveBandLocally(BAND_1, 'leader@band.org');
    await db.put('charts', {
      id: 'band-1-song',
      title: 'Band 1 Song',
      tempo: null,
      time_sig: null,
      lines: [],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: 'u1',
      updated_at: '',
      band_id: BAND_1.id,
    } as Chart);

    await leaveBand('leader@band.org');

    // Band keys should be cleared from active storage
    expect(getStoredBand().id).toBeNull();
    expect(getStoredBand().code).toBeNull();

    // Cached items should be removed from IndexedDB
    const remainingCharts = await db.getAll('charts');
    expect(remainingCharts.map((c) => c.id)).not.toContain('band-1-song');
  });
});
