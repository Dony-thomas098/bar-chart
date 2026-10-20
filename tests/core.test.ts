import { describe, it, expect } from 'vitest';
import { transposeChordString, transposeSingleChord } from '../lib/transpose';
import { canModifySection } from '../components/AuthProvider';

describe('Transpose Logic', () => {
  it('correctly transposes simple major chords with sharps', () => {
    expect(transposeSingleChord('C', 2, false)).toBe('D');
    expect(transposeSingleChord('G', 2, false)).toBe('A');
    expect(transposeSingleChord('B', 1, false)).toBe('C');
  });

  it('correctly handles preferFlats transposition', () => {
    expect(transposeSingleChord('C', 1, true)).toBe('Db');
    expect(transposeSingleChord('C', 1, false)).toBe('C#');
  });

  it('correctly transposes complex chords with extensions and slash bass', () => {
    expect(transposeChordString('Cmaj7/E', 2, false)).toBe('Dmaj7/F#');
    expect(transposeChordString('Am7b5/G', 3, true)).toBe('Cm7b5/Bb');
  });

  it('preserves non-chord tokens and empty bars intact', () => {
    expect(transposeChordString('%', 2, false)).toBe('%');
    expect(transposeChordString('N.C.', 2, false)).toBe('N.C.');
    expect(transposeChordString('', 2, false)).toBe('');
  });
});

describe('Role-Based Section Authorization', () => {
  it('allows admins to modify all sections', () => {
    expect(canModifySection('admin', 'chart')).toBe(true);
    expect(canModifySection('admin', 'lyrics')).toBe(true);
  });

  it('allows singers and instrumentalists to collaboratively create and modify charts and lyrics', () => {
    expect(canModifySection('singing', 'lyrics')).toBe(true);
    expect(canModifySection('singing', 'chart')).toBe(true);
    expect(canModifySection('instrument', 'chart')).toBe(true);
    expect(canModifySection('instrument', 'lyrics')).toBe(true);
  });
});

describe('Trash Naming and Recovery Logic', () => {
  const parseTrashName = (trashedName: string) => {
    const parts = trashedName.split(':');
    let originalParentId: string | null = null;
    let originalName = trashedName;
    if (parts.length >= 3 && parts[0] === '__TRASH__') {
      originalParentId = parts[1] === 'root' ? null : parts[1];
      originalName = parts.slice(2).join(':');
    } else if (parts.length === 2 && parts[0] === '__TRASH__') {
      originalParentId = null;
      originalName = parts[1];
    }
    return { originalParentId, originalName };
  };

  it('correctly parses root-level trashed items', () => {
    const { originalParentId, originalName } = parseTrashName('__TRASH__:root:My Awesome Chart');
    expect(originalParentId).toBeNull();
    expect(originalName).toBe('My Awesome Chart');
  });

  it('correctly parses folder-nested trashed items', () => {
    const { originalParentId, originalName } = parseTrashName('__TRASH__:folder-abc-123:My Lyrics');
    expect(originalParentId).toBe('folder-abc-123');
    expect(originalName).toBe('My Lyrics');
  });

  it('handles item names that contain colons', () => {
    const { originalParentId, originalName } = parseTrashName('__TRASH__:root:Part 1: The Intro: Final');
    expect(originalParentId).toBeNull();
    expect(originalName).toBe('Part 1: The Intro: Final');
  });

  it('handles legacy or two-part trashed names gracefully', () => {
    const { originalParentId, originalName } = parseTrashName('__TRASH__:Legacy Song');
    expect(originalParentId).toBeNull();
    expect(originalName).toBe('Legacy Song');
  });
});
