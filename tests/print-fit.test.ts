import { describe, it, expect, beforeEach } from 'vitest';
import {
  fitChartToPage,
  paginateChartLines,
  isFirstLineOfSection,
  getDefaultSectionColor,
  DEFAULT_SECTION_COLORS,
  SPEC_SECTION_COLORS,
  getRowGapEm,
} from '../components/PrintChart';
import { Line } from '../lib/chart-types';

describe('Print Chart Auto-Fit & Pagination Logic', () => {
  beforeEach(() => {
    // Mock document.fonts.ready
    if (typeof document !== 'undefined') {
      Object.defineProperty(document, 'fonts', {
        value: { ready: Promise.resolve() },
        configurable: true,
      });
    }
  });

  describe('fitChartToPage binary search', () => {
    it('scales up short charts to a large font size (up to 40px) without overflowing', async () => {
      // Mock DOM pageEl and chartEl
      const pageEl = document.createElement('div');
      const chartEl = document.createElement('div');
      pageEl.appendChild(chartEl);

      // Define page size: 186mm x 273mm printable area (~703px x 1032px at 96 DPI)
      Object.defineProperty(pageEl, 'clientHeight', { value: 1032, configurable: true });
      Object.defineProperty(pageEl, 'clientWidth', { value: 703, configurable: true });
      Object.defineProperty(chartEl, 'clientHeight', { value: 950, configurable: true });
      Object.defineProperty(chartEl, 'clientWidth', { value: 703, configurable: true });

      // Simulate a short chart with 5 lines: each line is 1.5em tall and 20ch wide
      // scrollHeight = 5 * fontSize * 1.5 = 7.5 * fontSize
      // scrollWidth = 20 * fontSize * 0.6 = 12 * fontSize
      Object.defineProperty(chartEl, 'scrollHeight', {
        get() {
          const fs = parseFloat(chartEl.style.fontSize) || 16;
          return fs * 7.5;
        },
        configurable: true,
      });
      Object.defineProperty(chartEl, 'scrollWidth', {
        get() {
          const fs = parseFloat(chartEl.style.fontSize) || 16;
          return fs * 12;
        },
        configurable: true,
      });

      const result = await fitChartToPage(pageEl, chartEl, {
        minFontSize: 10,
        maxFontSize: 40,
        stopShrinkingBelow: 14,
      });

      // Short chart easily fits at 40px (height: 40*7.5=300 <= 950, width: 40*12=480 <= 703)
      expect(result.fitsOnPage).toBe(true);
      expect(result.fontSize).toBe(40);
      expect(chartEl.style.justifyContent).toBe('space-evenly');
    });

    it('finds intermediate font size for medium-length charts based on width or height constraints', async () => {
      const pageEl = document.createElement('div');
      const chartEl = document.createElement('div');
      pageEl.appendChild(chartEl);

      Object.defineProperty(pageEl, 'clientHeight', { value: 1000, configurable: true });
      Object.defineProperty(pageEl, 'clientWidth', { value: 600, configurable: true });
      Object.defineProperty(chartEl, 'clientHeight', { value: 900, configurable: true });
      Object.defineProperty(chartEl, 'clientWidth', { value: 600, configurable: true });

      // Chart with width constraint: width = fontSize * 25
      // Max width = 600 => max fontSize = 600 / 25 = 24px
      Object.defineProperty(chartEl, 'scrollHeight', {
        get() {
          const fs = parseFloat(chartEl.style.fontSize) || 16;
          return fs * 15;
        },
        configurable: true,
      });
      Object.defineProperty(chartEl, 'scrollWidth', {
        get() {
          const fs = parseFloat(chartEl.style.fontSize) || 16;
          return fs * 25;
        },
        configurable: true,
      });

      const result = await fitChartToPage(pageEl, chartEl, {
        minFontSize: 10,
        maxFontSize: 40,
        stopShrinkingBelow: 14,
      });

      expect(result.fitsOnPage).toBe(true);
      expect(result.fontSize).toBeCloseTo(24, 0);
      expect(chartEl.style.justifyContent).toBe('space-evenly');
    });

    it('stops shrinking below 14px when chart is too long for 1 page', async () => {
      const pageEl = document.createElement('div');
      const chartEl = document.createElement('div');
      pageEl.appendChild(chartEl);

      Object.defineProperty(pageEl, 'clientHeight', { value: 800, configurable: true });
      Object.defineProperty(pageEl, 'clientWidth', { value: 600, configurable: true });
      Object.defineProperty(chartEl, 'clientHeight', { value: 720, configurable: true });
      Object.defineProperty(chartEl, 'clientWidth', { value: 600, configurable: true });

      // Chart with 50 lines: at 14px, height = 50 * 14 * 1.5 = 1050 > 720
      Object.defineProperty(chartEl, 'scrollHeight', {
        get() {
          const fs = parseFloat(chartEl.style.fontSize) || 16;
          return fs * 75; // 75em
        },
        configurable: true,
      });
      Object.defineProperty(chartEl, 'scrollWidth', {
        get() {
          const fs = parseFloat(chartEl.style.fontSize) || 16;
          return fs * 15;
        },
        configurable: true,
      });

      const result = await fitChartToPage(pageEl, chartEl, {
        minFontSize: 10,
        maxFontSize: 40,
        stopShrinkingBelow: 14,
      });

      // Does NOT fit on 1 page at >= 14px
      expect(result.fitsOnPage).toBe(false);
      // Clamped to minimum 14px (never shrinks below 14px)
      expect(result.fontSize).toBe(14);
    });
  });

  describe('isFirstLineOfSection (first-line-only section labels)', () => {
    it('shows section label on line 0 if it has a label', () => {
      const lines: Line[] = [
        { id: '1', label: 'Intro', blocks: [] },
        { id: '2', label: 'Intro', blocks: [] },
      ];
      expect(isFirstLineOfSection(lines, 0)).toBe(true);
      expect(isFirstLineOfSection(lines, 1)).toBe(false);
    });

    it('shows section label when section changes and suppresses on repeat lines', () => {
      const lines: Line[] = [
        { id: '1', label: 'Intro', blocks: [] },
        { id: '2', label: 'Intro', blocks: [] },
        { id: '3', label: 'Song', blocks: [] },
        { id: '4', label: 'Song', blocks: [] },
        { id: '5', label: 'Song', blocks: [] },
        { id: '6', label: 'Chorus', blocks: [] },
      ];
      expect(isFirstLineOfSection(lines, 0)).toBe(true); // Intro
      expect(isFirstLineOfSection(lines, 1)).toBe(false); // Intro cont
      expect(isFirstLineOfSection(lines, 2)).toBe(true); // Song
      expect(isFirstLineOfSection(lines, 3)).toBe(false); // Song cont
      expect(isFirstLineOfSection(lines, 4)).toBe(false); // Song cont
      expect(isFirstLineOfSection(lines, 5)).toBe(true); // Chorus
    });

    it('returns false for unlabeled lines', () => {
      const lines: Line[] = [
        { id: '1', label: '', blocks: [] },
        { id: '2', label: '', blocks: [] },
      ];
      expect(isFirstLineOfSection(lines, 0)).toBe(false);
      expect(isFirstLineOfSection(lines, 1)).toBe(false);
    });

    it('handles multi-word labels like "Intro+ gtr:" cleanly as a single line label', () => {
      const lines: Line[] = [
        { id: '1', label: 'Intro+ gtr', blocks: [] },
        { id: '2', label: 'Intro+ gtr', blocks: [] },
        { id: '3', label: '1st Bg', blocks: [] },
      ];
      expect(isFirstLineOfSection(lines, 0)).toBe(true);
      expect(isFirstLineOfSection(lines, 1)).toBe(false);
      expect(isFirstLineOfSection(lines, 2)).toBe(true);
    });
  });

  describe('Row Gap & Line Spacing', () => {
    it('provides tight, normal, and relaxed spacing with tighter gaps for continuation lines', () => {
      // Continuation lines (within same section)
      const tightCont = getRowGapEm(false, 'tight');
      const normalCont = getRowGapEm(false, 'normal');
      const relaxedCont = getRowGapEm(false, 'relaxed');

      expect(tightCont).toBeLessThan(normalCont);
      expect(normalCont).toBeLessThan(relaxedCont);

      // Section starts (distinct musical sections)
      const tightSec = getRowGapEm(true, 'tight');
      const normalSec = getRowGapEm(true, 'normal');
      const relaxedSec = getRowGapEm(true, 'relaxed');

      expect(tightSec).toBeLessThan(normalSec);
      expect(normalSec).toBeLessThan(relaxedSec);

      // Section starts should always have more breathing room than continuation lines
      expect(normalSec).toBeGreaterThan(normalCont);
      expect(tightSec).toBeGreaterThan(tightCont);
    });
  });

  describe('paginateChartLines multi-page continuation', () => {
    const makeSampleLines = (count: number): Line[] => {
      const lines: Line[] = [];
      for (let i = 0; i < count; i++) {
        lines.push({
          id: `line-${i}`,
          label: i === 0 ? 'Intro' : i === 4 ? 'Chorus' : '',
          blocks: [
            {
              id: `block-${i}`,
              bars: ['Am', 'C', 'G', 'F'],
            },
          ],
        });
      }
      return lines;
    };

    it('keeps short charts on a single page', () => {
      const lines = makeSampleLines(8);
      const rowHeights = new Array(8).fill(30); // 8 * 30 = 240px
      const availableHeight = 800;

      const pages = paginateChartLines(lines, rowHeights, availableHeight, 'normal', 14);
      expect(pages.length).toBe(1);
      expect(pages[0].length).toBe(8);
    });

    it('cleanly splits long charts across multiple pages without breaking section rows', () => {
      const lines = makeSampleLines(25);
      const rowHeights = new Array(25).fill(40); // 25 * 40 = 1000px
      const availableHeight = 500; // fits ~10 rows per page with gaps

      const pages = paginateChartLines(lines, rowHeights, availableHeight, 'normal', 14);

      // Should paginate into multiple pages
      expect(pages.length).toBeGreaterThan(1);
      // Total lines preserved exactly
      const totalPaginatedLines = pages.reduce((sum, p) => sum + p.length, 0);
      expect(totalPaginatedLines).toBe(25);

      // Every section row is intact (never split in half)
      pages.forEach((page) => {
        expect(page.length).toBeGreaterThan(0);
        page.forEach((line) => {
          expect(line.blocks.length).toBe(1);
          expect(line.blocks[0].bars).toEqual(['Am', 'C', 'G', 'F']);
        });
      });
    });
  });

  describe('Section Colors in Print', () => {
    it('maps known section labels to demo spec palette colors', () => {
      expect(getDefaultSectionColor('Intro', 0)).toBe(DEFAULT_SECTION_COLORS.intro);
      expect(getDefaultSectionColor('Verse', 1)).toBe(DEFAULT_SECTION_COLORS.verse);
      expect(getDefaultSectionColor('Song', 1)).toBe(DEFAULT_SECTION_COLORS.song);
      expect(getDefaultSectionColor('Chorus', 2)).toBe(DEFAULT_SECTION_COLORS.chorus);
      expect(getDefaultSectionColor('Bridge', 3)).toBe(DEFAULT_SECTION_COLORS.bridge);
      expect(getDefaultSectionColor('BG', 3)).toBe(DEFAULT_SECTION_COLORS.bg);
      expect(getDefaultSectionColor('A.Pal', 4)).toBe(SPEC_SECTION_COLORS['a.pal']);
      expect(getDefaultSectionColor('Outro', 4)).toBe(DEFAULT_SECTION_COLORS.outro);
      expect(getDefaultSectionColor('Flute', 5)).toBe(DEFAULT_SECTION_COLORS.flute);
    });

    it('falls back to palette for unknown labels or empty labels', () => {
      const color = getDefaultSectionColor('Guitar Lick', 0);
      expect(color).toBeTruthy();
      expect(color.startsWith('#')).toBe(true);

      const emptyColor = getDefaultSectionColor('', 2);
      expect(emptyColor).toBeTruthy();
    });
  });
});
