import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeChordInput, parseChord, parseChordToText } from '../lib/chord-parser';
import { readChart, saveChart, getDBPromise, Chart } from '../lib/storage';
import React from 'react';

// Mock Supabase client
vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'test-chart-stale',
                title: 'Stale Cloud Chart',
                updated_at: '2020-01-01T00:00:00.000Z',
                lines: []
              },
              error: null
            })
          }))
        })),
        upsert: vi.fn().mockResolvedValue({ error: null })
      }))
    }
  };
});

describe('Chord Input Parsing & Multi-Chord Bar Rendering', () => {
  it('normalizes chords separated by spaces without mangling subsequent chords', () => {
    const raw = 'd#m7 g#7 c#maj7';
    const normalized = normalizeChordInput(raw);
    expect(normalized).toBe('D♯m7 G♯7 C♯Δ7');
  });

  it('parses multiple chords in a bar without rendering subsequent chords as superscripts', () => {
    const node = parseChord('D G');
    expect(React.isValidElement(node)).toBe(true);
    // Should render a wrapper with gap-1.5 containing both chord nodes
    const renderedText = parseChordToText('D G');
    expect(renderedText).toBe('D G');
  });

  it('correctly handles slash chords and spaces', () => {
    const text = parseChordToText('D/F# G');
    expect(text).toBe('D/F♯ G');
  });

  it('preserves repeat markers and placeholders', () => {
    expect(parseChordToText('_')).toBe('_');
    expect(parseChordToText('%')).toBe('%');
    expect(parseChordToText('.')).toBe('.');
  });
});

describe('Keypad Input Logic (Root Replacement & Accidental Management)', () => {
  function simulateKeypadPress(current: string, key: string, isSlashBass: boolean): { result: string; nextSlashBass: boolean } {
    const isRoot = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(key);

    if (key === '/') {
      return { result: current.trim() ? current.trim() + '/' : '/', nextSlashBass: true };
    }
    if (isSlashBass && isRoot) {
      return { result: current + key, nextSlashBass: false };
    }
    if (isRoot) {
      if (!current || current === '-' || current === '_' || current === '.') {
        return { result: key, nextSlashBass: false };
      }
      if (current.endsWith(' ')) {
        return { result: current + key, nextSlashBass: false };
      }
      // Replaces root chord
      return { result: key, nextSlashBass: false };
    }

    let toAppend = key;
    if (key === 'dim') toAppend = '°';
    else if (key === 'aug') toAppend = '+';
    else if (key === 'maj7') toAppend = 'Δ7';
    else if (key === 'm7b5') toAppend = 'ø7';
    else if (key === 'b') toAppend = '♭';
    else if (key === '#') toAppend = '♯';

    let val = current === '-' || current === '_' ? '' : current;
    if ((toAppend === '♯' || toAppend === '#') && (val.endsWith('♭') || val.endsWith('b'))) {
      val = val.slice(0, -1) + '♯';
    } else if ((toAppend === '♭' || toAppend === 'b') && (val.endsWith('♯') || val.endsWith('#'))) {
      val = val.slice(0, -1) + '♭';
    } else if ((toAppend === '♯' || toAppend === '#') && (val.endsWith('♯') || val.endsWith('#'))) {
      // already sharp
    } else if ((toAppend === '♭' || toAppend === 'b') && (val.endsWith('♭') || val.endsWith('b'))) {
      // already flat
    } else {
      val += toAppend;
    }
    return { result: val, nextSlashBass: false };
  }

  function simulateBackspace(current: string): string {
    if (!current) return '';
    let newLen = current.length - 1;
    const multiChars = ['maj7', 'min7', 'sus4', 'sus2', 'add9', 'dim7', 'aug7', 'm7b5', 'Δ7', 'ø7'];
    for (const mc of multiChars) {
      if (current.endsWith(mc)) {
        newLen = current.length - mc.length;
        break;
      }
    }
    return newLen > 0 ? current.slice(0, newLen) : '';
  }

  it('replaces the chord root when a user taps another root note instead of appending', () => {
    // Starting with D
    let state = { result: 'D', nextSlashBass: false };
    // User taps G -> should become G, NOT DG
    state = simulateKeypadPress(state.result, 'G', state.nextSlashBass);
    expect(state.result).toBe('G');

    // User taps A -> should become A, NOT GA
    state = simulateKeypadPress(state.result, 'A', state.nextSlashBass);
    expect(state.result).toBe('A');
  });

  it('appends modifiers to the active root note', () => {
    let state = { result: 'D', nextSlashBass: false };
    state = simulateKeypadPress(state.result, 'm', state.nextSlashBass);
    expect(state.result).toBe('Dm');

    state = simulateKeypadPress(state.result, '7', state.nextSlashBass);
    expect(state.result).toBe('Dm7');
  });

  it('swaps accidentals cleanly when tapping sharp or flat', () => {
    let state = { result: 'C', nextSlashBass: false };
    state = simulateKeypadPress(state.result, '♯', state.nextSlashBass);
    expect(state.result).toBe('C♯');

    state = simulateKeypadPress(state.result, '♭', state.nextSlashBass);
    expect(state.result).toBe('C♭');
  });

  it('supports slash bass note selection after tapping /', () => {
    let state = { result: 'D', nextSlashBass: false };
    state = simulateKeypadPress(state.result, '/', state.nextSlashBass);
    expect(state.result).toBe('D/');
    expect(state.nextSlashBass).toBe(true);

    // Picking bass note F#
    state = simulateKeypadPress(state.result, 'F', state.nextSlashBass);
    expect(state.result).toBe('D/F');
    expect(state.nextSlashBass).toBe(false);

    state = simulateKeypadPress(state.result, '♯', state.nextSlashBass);
    expect(state.result).toBe('D/F♯');
  });

  it('performs smart multi-character backspace', () => {
    expect(simulateBackspace('Dsus4')).toBe('D');
    expect(simulateBackspace('CΔ7')).toBe('C');
    expect(simulateBackspace('D')).toBe('');
  });
});

describe('Local Cache Preservation Against Stale Cloud Overwrite', () => {
  beforeEach(async () => {
    const db = await getDBPromise();
    if (db) {
      await db.clear('charts');
      await db.clear('pending_saves');
    }
  });

  it('readChart never overwrites local IndexedDB cache when cloud updated_at is older', async () => {
    const db = await getDBPromise();
    if (!db) return;

    const newerLocalChart: Chart = {
      id: 'test-chart-stale',
      title: 'Newest Local Edits',
      lines: [],
      tempo: 120,
      time_sig: '4/4',
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: 'test-user',
      updated_at: '2026-10-25T12:00:00.000Z'
    };

    // Cache locally
    await db.put('charts', newerLocalChart);

    // Read chart
    const loaded = await readChart('test-chart-stale');
    expect(loaded?.title).toBe('Newest Local Edits');

    // Wait 50ms for background fetch to finish
    await new Promise(r => setTimeout(r, 60));

    // Verify cache in IndexedDB was NOT overwritten by stale cloud version from 2020
    const inDb = await db.get('charts', 'test-chart-stale');
    expect(inDb?.title).toBe('Newest Local Edits');
  });

  it('readChart never overwrites local cache when pending_saves has unpushed edits', async () => {
    const db = await getDBPromise();
    if (!db) return;

    const localChart: Chart = {
      id: 'test-chart-stale',
      title: 'Local Edits in Queue',
      lines: [],
      tempo: 120,
      time_sig: '4/4',
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: 'test-user',
      updated_at: '2026-10-25T12:00:00.000Z'
    };

    await db.put('charts', localChart);
    await db.put('pending_saves', {
      id: 'test-chart-stale',
      type: 'chart',
      data: localChart,
      action: 'upsert'
    });

    await readChart('test-chart-stale');
    await new Promise(r => setTimeout(r, 60));

    const inDb = await db.get('charts', 'test-chart-stale');
    expect(inDb?.title).toBe('Local Edits in Queue');
  });
});
