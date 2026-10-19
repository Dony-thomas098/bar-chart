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

  it('restricts singers to lyrics only', () => {
    expect(canModifySection('singing', 'lyrics')).toBe(true);
    expect(canModifySection('singing', 'chart')).toBe(false);
  });

  it('restricts instrumentalists to charts only', () => {
    expect(canModifySection('instrument', 'chart')).toBe(true);
    expect(canModifySection('instrument', 'lyrics')).toBe(false);
  });
});
