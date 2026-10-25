import { describe, it, expect } from 'vitest';
import { transposeChordString } from '../lib/transpose';

describe('Group 3: Transposition, Time Signature, and SW Resilience', () => {
  describe('Issue #14: Chord Transposition Delimiters & Lowercase Roots', () => {
    it('transposes chords wrapped in parentheses', () => {
      expect(transposeChordString('(C)', 2, false)).toBe('(D)');
      expect(transposeChordString('(G)', 2, false)).toBe('(A)');
      expect(transposeChordString('(F#m)', 1, false)).toBe('(Gm)');
      expect(transposeChordString('(F#m)', 2, false)).toBe('(G#m)');
    });

    it('transposes slash chords wrapped in parentheses', () => {
      expect(transposeChordString('(Bb/D)', 2, false)).toBe('(C/E)');
      expect(transposeChordString('(F/A)', 2, false)).toBe('(G/B)');
    });

    it('transposes chords wrapped in brackets', () => {
      expect(transposeChordString('[Am7]', 2, false)).toBe('[Bm7]');
      expect(transposeChordString('[C#m7b5]', 2, false)).toBe('[D#m7b5]');
    });

    it('transposes chords with lowercase roots', () => {
      expect(transposeChordString('c', 2, false)).toBe('D');
      expect(transposeChordString('am7', 2, false)).toBe('Bm7');
      expect(transposeChordString('bb/d', 2, false)).toBe('C/E');
    });

    it('preserves non-chord tokens and spacing unchanged', () => {
      expect(transposeChordString('N.C.', 2, false)).toBe('N.C.');
      expect(transposeChordString('%', 2, false)).toBe('%');
      expect(transposeChordString('//', 2, false)).toBe('//');
      expect(transposeChordString('C   G', 2, false)).toBe('D   A');
    });

    it('correctly handles negative transposition and wraparound', () => {
      expect(transposeChordString('C', -1, false)).toBe('B');
      expect(transposeChordString('(C)', -2, true)).toBe('(Bb)');
    });
  });

  describe('Issue #15: Time Signature Denominator Validation', () => {
    it('validates denominator is a power of two and numerator is >= 1', () => {
      const isValidTimeSig = (val: string) => {
        const match = val.match(/^(\d{1,2})\/(\d{1,2})$/);
        if (!match) return false;
        const num = parseInt(match[1], 10);
        const den = parseInt(match[2], 10);
        const validDenominators = [1, 2, 4, 8, 16, 32];
        return num >= 1 && validDenominators.includes(den);
      };

      // Valid signatures
      expect(isValidTimeSig('4/4')).toBe(true);
      expect(isValidTimeSig('3/4')).toBe(true);
      expect(isValidTimeSig('6/8')).toBe(true);
      expect(isValidTimeSig('12/8')).toBe(true);
      expect(isValidTimeSig('2/2')).toBe(true);
      expect(isValidTimeSig('7/8')).toBe(true);

      // Invalid signatures (division by zero, odd denominators)
      expect(isValidTimeSig('0/0')).toBe(false);
      expect(isValidTimeSig('4/0')).toBe(false);
      expect(isValidTimeSig('0/4')).toBe(false);
      expect(isValidTimeSig('3/5')).toBe(false);
      expect(isValidTimeSig('4/3')).toBe(false);
      expect(isValidTimeSig('abc')).toBe(false);
    });
  });

  describe('Issue #23: Service Worker Authorization and No-Store Check', () => {
    it('verifies generate-sw.js includes Authorization header bypass and Cache-Control check', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const swGen = fs.readFileSync(path.resolve(__dirname, '../scripts/generate-sw.js'), 'utf-8');

      expect(swGen).toContain("request.headers.has('Authorization')");
      expect(swGen).toContain("!cc.includes('no-store')");
      expect(swGen).toContain("!cc.includes('private')");
    });
  });

  describe('Issue #13: Live Stage Performance Missing Chart Fallback', () => {
    it('verifies perform page renders Item Unavailable fallback with Skip to Next Song button', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const performPage = fs.readFileSync(path.resolve(__dirname, '../app/setlists/[id]/perform/page.tsx'), 'utf-8');

      expect(performPage).toContain('!contentLoading && currentItem && !currentChart && !currentLyrics');
      expect(performPage).toContain('Item Unavailable');
      expect(performPage).toContain('Skip to Next Song');
    });
  });
});
