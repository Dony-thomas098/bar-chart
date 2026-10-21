'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { ChartData, Line } from '@/lib/chart-types';
import { parseChord } from '@/lib/chord-parser';
import { transposeChart } from '@/lib/transpose';

// SSR-safe layout effect
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Section label colors matching Sneham Baliyay print demo palette:
 * Intro (#2b4fa3), Song/Verse (#b3203f), Chorus (#7a3fc4), BG (#4a43c9), APal/Bridge (#1f7a5a)
 */
export const SPEC_SECTION_COLORS: Record<string, string> = {
  intro: '#2b4fa3',
  song: '#b3203f',
  verse: '#b3203f',
  chorus: '#7a3fc4',
  bg: '#4a43c9',
  'bg 2nd': '#4a43c9',
  'a.pal': '#1f7a5a',
  apal: '#1f7a5a',
  ap: '#1f7a5a',
  link: '#1f7a5a',
  bridge: '#1f7a5a',
  flute: '#0d9488',
  violin: '#0d9488',
  outro: '#b45309',
  ending: '#b45309',
  tag: '#b45309',
  interlude: '#2b4fa3',
  solo: '#b3203f',
};

export const DEFAULT_SECTION_COLORS = SPEC_SECTION_COLORS;

export const SPEC_COLOR_PALETTE = ['#2b4fa3', '#b3203f', '#7a3fc4', '#4a43c9', '#1f7a5a', '#b45309', '#0d9488'];

export function getDefaultSectionColor(label: string | undefined, index: number): string {
  if (!label) return SPEC_COLOR_PALETTE[index % SPEC_COLOR_PALETTE.length];
  const cleaned = label.trim().toLowerCase();
  if (SPEC_SECTION_COLORS[cleaned]) return SPEC_SECTION_COLORS[cleaned];
  for (const [key, color] of Object.entries(SPEC_SECTION_COLORS)) {
    if (cleaned.startsWith(key)) return color;
  }
  return SPEC_COLOR_PALETTE[index % SPEC_COLOR_PALETTE.length];
}

export function getRowGapEm(
  isSectionStart: boolean,
  spacing: 'tight' | 'normal' | 'relaxed' = 'normal'
): number {
  if (isSectionStart) {
    if (spacing === 'tight') return 1.5;
    if (spacing === 'relaxed') return 2.6;
    return 2.2;
  }
  if (spacing === 'tight') return 1.2;
  if (spacing === 'relaxed') return 2.4;
  return 2.0;
}

export interface FitChartOptions {
  minFontSize?: number;
  maxFontSize?: number;
  stopShrinkingBelow?: number;
  justifyContent?: string;
  gap?: string;
}

export interface FitChartResult {
  fontSize: number;
  fitsOnPage: boolean;
}

/**
 * Binary search (6px to 60px) for largest font size where the chart fits
 * both height and width of the printable area.
 * Directly implements fit() from Sneham Baliyay print demo spec.
 */
export async function fitChartToPage(
  paperEl: HTMLElement,
  chartEl: HTMLElement,
  options?: FitChartOptions
): Promise<FitChartResult> {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Non-blocking font load fallback
    }
  }

  const loMin = options?.minFontSize ?? 6;
  const hiMax = options?.maxFontSize ?? 60;
  const stopBelow = options?.stopShrinkingBelow ?? 14;
  const defaultJustify = options?.justifyContent ?? 'space-evenly';

  const targetHeight =
    chartEl.clientHeight > 0
      ? chartEl.clientHeight
      : paperEl.clientHeight > 0
      ? paperEl.clientHeight - 80
      : 0;
  const targetWidth =
    chartEl.clientWidth > 0
      ? chartEl.clientWidth
      : paperEl.clientWidth > 0
      ? paperEl.clientWidth
      : 0;

  if (options?.gap) {
    chartEl.style.gap = options.gap;
  }

  // Check if it fits at maxFontSize first
  paperEl.style.fontSize = hiMax + 'px';
  chartEl.style.fontSize = hiMax + 'px';
  const fitsAtMax =
    (targetHeight > 0
      ? chartEl.scrollHeight <= targetHeight + 1
      : chartEl.scrollHeight <= chartEl.clientHeight + 1) &&
    (targetWidth > 0
      ? chartEl.scrollWidth <= targetWidth + 1
      : chartEl.scrollWidth <= chartEl.clientWidth + 1);

  if (fitsAtMax) {
    chartEl.style.justifyContent = defaultJustify;
    return { fontSize: hiMax, fitsOnPage: true };
  }

  let lo = loMin;
  let hi = hiMax;
  let best = lo;

  // Binary search precision 0.25px matching spec
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2;
    paperEl.style.fontSize = mid + 'px';
    chartEl.style.fontSize = mid + 'px';
    const ok =
      (targetHeight > 0
        ? chartEl.scrollHeight <= targetHeight + 1
        : chartEl.scrollHeight <= chartEl.clientHeight + 1) &&
      (targetWidth > 0
        ? chartEl.scrollWidth <= targetWidth + 1
        : chartEl.scrollWidth <= chartEl.clientWidth + 1);
    if (ok) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Round best to 0.25px precision (2 decimal places)
  const roundedBest = Math.round(best * 4) / 4;
  const fitsOnPage = roundedBest >= stopBelow;
  const finalFontSize = fitsOnPage ? roundedBest : Math.max(roundedBest, stopBelow);

  paperEl.style.fontSize = finalFontSize + 'px';
  chartEl.style.fontSize = finalFontSize + 'px';
  chartEl.style.justifyContent = defaultJustify;

  return { fontSize: finalFontSize, fitsOnPage };
}

/**
 * Splits chart lines across pages so that no section row is split (break-inside: avoid).
 */
export function paginateChartLines(
  lines: Line[],
  rowHeights: number[],
  availableHeight: number,
  _spacing?: 'tight' | 'normal' | 'relaxed',
  _baseFontSize?: number
): Line[][] {
  if (lines.length === 0) return [[]];
  const pages: Line[][] = [];
  let currentPage: Line[] = [];
  let currentH = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rowH = rowHeights[i] ?? 24;
    const nextH = currentH + rowH;

    if (currentPage.length > 0 && nextH > availableHeight) {
      pages.push(currentPage);
      currentPage = [line];
      currentH = rowH;
    } else {
      currentPage.push(line);
      currentH = nextH;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [lines];
}

/**
 * Checks if line is the first line of a section (only the first line renders the section label).
 */
export function isFirstLineOfSection(lines: Line[], index: number): boolean {
  if (index === 0) return !!lines[0]?.label;
  const current = (lines[index]?.label || '').trim().toLowerCase();
  const prev = (lines[index - 1]?.label || '').trim().toLowerCase();
  if (current && current !== prev) return true;
  return false;
}

/**
 * Header matching Image 1: centered title with key, time signature directly next to it on the same baseline,
 * tempo on the far right, and clean divider rule under header. Uses default sans-serif font.
 */
export function PrintHeader({
  chart,
  pageIndex,
  totalPages,
  fontFamily,
}: {
  chart: ChartData;
  pageIndex?: number;
  totalPages?: number;
  fontFamily?: string;
}) {
  const key = (chart as unknown as { key?: string }).key;
  const hasKeyInTitle = key ? chart.title?.toLowerCase().includes(`(${key.toLowerCase()})`) : false;
  const displayTitle = chart.title ? (key && !hasKeyInTitle ? `${chart.title} (${key})` : chart.title) : 'Untitled Chart';

  return (
    <div
      className="hd print-hd relative flex items-center justify-center border-b border-slate-200 pb-[0.5em] mb-[0.6em] text-slate-900 shrink-0 w-full"
      style={{ fontFamily: fontFamily || 'var(--font-sans), sans-serif' }}
    >
      <div className="flex items-baseline gap-[0.6em]">
        <h1 className="m-0 text-[1.6em] font-extrabold tracking-tight text-slate-900 text-center">
          {displayTitle}
        </h1>
        {chart.time_sig && (
          <span className="text-[0.75em] font-bold text-slate-500 whitespace-nowrap">
            {chart.time_sig}
          </span>
        )}
      </div>

      <div className="absolute right-0 flex items-baseline gap-[0.5em]">
        {chart.tempo && (
          <span className="text-[0.7em] font-bold text-slate-500 whitespace-nowrap">
            t={chart.tempo}
          </span>
        )}
        {totalPages && totalPages > 1 && (
          <span className="text-[0.65em] font-semibold text-slate-400 whitespace-nowrap">
            (Page {(pageIndex ?? 0) + 1}/{totalPages})
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Renders a bar-line marker (e.g. "||:", ":||:", "||", ":||") matching Image 1:
 * slate double vertical bars with orange repeat dots.
 */
function BarMarker({ marker, side }: { marker: string; side: 'left' | 'right' }) {
  const parts: { ch: string; isColon: boolean }[] = [];
  let i = 0;
  while (i < marker.length) {
    if (marker[i] === ':') {
      parts.push({ ch: ':', isColon: true });
      i++;
    } else if (marker[i] === '|') {
      let run = '';
      while (i < marker.length && marker[i] === '|') {
        run += marker[i];
        i++;
      }
      parts.push({ ch: run, isColon: false });
    } else {
      i++;
    }
  }

  const pad =
    side === 'left'
      ? 'inline-flex items-baseline pr-[0.3em] select-none shrink-0 tracking-tighter'
      : 'inline-flex items-baseline pl-[0.3em] select-none shrink-0 tracking-tighter';

  return (
    <span className={pad}>
      {parts.map((p, idx) => (
        <span
          key={idx}
          className={
            p.isColon
              ? 'text-[#FF6A1F] font-black'
              : 'text-slate-500 font-medium'
          }
          style={{
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          }}
        >
          {p.ch}
        </span>
      ))}
    </span>
  );
}

export interface PrintChartProps {
  chart: ChartData;
  selectedFont?: string;
  watermark?: string;
  paperSize?: 'a4' | 'letter';
  lineSpacing?: 'tight' | 'normal' | 'relaxed';
  onFitComplete?: () => void;
}

export function PrintChart({
  chart,
  selectedFont = 'system',
  watermark = '',
  paperSize = 'a4',
  lineSpacing = 'normal',
  onFitComplete,
}: PrintChartProps) {
  // Apply transposition if set on chart
  const effectiveChart = useMemo(() => {
    if (!chart) return chart;
    if (chart.semitone_offset) {
      return transposeChart(chart, chart.semitone_offset, chart.prefer_flats ?? false);
    }
    return chart;
  }, [chart]);

  const [pages, setPages] = useState<Line[][]>(() => [effectiveChart?.lines || []]);

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chartRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Font family matching Image 1: defaults to standard sans-serif font
  const activeFontFamily = useMemo(() => {
    if (selectedFont && selectedFont !== 'system') {
      return selectedFont;
    }
    return 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  }, [selectedFont]);

  // Calculate maximum label length across chart so longer labels (e.g. "Intro+ gtr:") never wrap
  const maxLabelLen = useMemo(() => {
    let max = 0;
    effectiveChart?.lines?.forEach((line) => {
      if (line.label) max = Math.max(max, line.label.trim().length);
    });
    return max;
  }, [effectiveChart?.lines]);

  // Sized in em with minimum of 4.5em in proportional sans-serif so labels stay on 1 line
  const labelWidthEm = Math.max(4.5, Math.ceil(maxLabelLen * 0.58 + 0.8));

  // Line spacing: default is 2.0em gap between each line; does not extend to end of page when lines are not enough
  const gapEm =
    lineSpacing === 'tight' ? '1.5em' : lineSpacing === 'relaxed' ? '2.5em' : '2.0em';
  const lineHeight =
    lineSpacing === 'tight' ? 1.2 : lineSpacing === 'relaxed' ? 1.5 : 1.35;

  // Auto-fit function matching Sneham Baliyay spec
  const fitPages = useCallback(async () => {
    if (!pageRefs.current[0] || !chartRefs.current[0] || !effectiveChart?.lines?.length) {
      return;
    }

    try {
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const firstPageEl = pageRefs.current[0];
      const firstChartEl = chartRefs.current[0];

      if (pages.length === 1) {
        const result = await fitChartToPage(firstPageEl, firstChartEl, {
          minFontSize: 6,
          maxFontSize: 36,
          stopShrinkingBelow: 14,
          justifyContent: 'flex-start',
          gap: gapEm,
        });

        if (result.fitsOnPage) {
          if (onFitComplete) onFitComplete();
          return;
        }

        // Long chart: does not fit at >= 14px on 1 page. Stop shrinking below 14px
        // and continue onto continued pages.
        firstPageEl.style.fontSize = '14px';
        firstChartEl.style.fontSize = '14px';
        firstChartEl.style.justifyContent = 'flex-start';
        firstChartEl.style.gap = gapEm;

        const rowEls = firstChartEl.querySelectorAll('.row');
        const rowHeights: number[] = [];
        rowEls.forEach((el) => {
          rowHeights.push((el as HTMLElement).offsetHeight || 24);
        });

        const paginated = paginateChartLines(
          effectiveChart.lines,
          rowHeights,
          firstChartEl.clientHeight || 750,
          lineSpacing,
          14
        );

        if (paginated.length > 1) {
          setPages(paginated);
          return;
        }
      } else {
        // Multi-page fitting: fit each page down to 14px
        for (let i = 0; i < pages.length; i++) {
          const pEl = pageRefs.current[i];
          const cEl = chartRefs.current[i];
          if (pEl && cEl) {
            await fitChartToPage(pEl, cEl, {
              minFontSize: 14,
              maxFontSize: 36,
              stopShrinkingBelow: 14,
              justifyContent: 'flex-start',
              gap: gapEm,
            });
          }
        }
      }
    } catch (err) {
      console.warn('Error during fitChartToPage:', err);
    } finally {
      if (onFitComplete) onFitComplete();
    }
  }, [effectiveChart?.lines, pages.length, onFitComplete, lineSpacing, gapEm]);

  // Run in layout effect (SSR safe)
  useIsomorphicLayoutEffect(() => {
    fitPages();
  }, [fitPages, paperSize]);

  // ResizeObserver, beforeprint, and fonts.ready triggers matching spec
  useEffect(() => {
    const handleBeforePrint = () => {
      fitPages();
    };

    window.addEventListener('beforeprint', handleBeforePrint);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        fitPages();
      });
      pageRefs.current.forEach((el) => {
        if (el) ro?.observe(el);
      });
    }

    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => fitPages());
    }

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      if (ro) ro.disconnect();
    };
  }, [fitPages]);

  if (!effectiveChart) return null;

  // Custom text fallback
  if (effectiveChart.custom_text !== undefined && effectiveChart.custom_text !== null) {
    return (
      <div className={`paper print-page ${paperSize === 'letter' ? 'paper-letter' : ''}`}>
        <PrintHeader chart={effectiveChart} fontFamily={activeFontFamily} />
        <pre
          className="text-slate-900 font-medium leading-relaxed whitespace-pre flex-1 overflow-hidden"
          style={{ fontFamily: activeFontFamily }}
        >
          {effectiveChart.custom_text}
        </pre>
      </div>
    );
  }

  return (
    <>
      {pages.map((pageLines, pageIdx) => {
        return (
          <div
            key={pageIdx}
            ref={(el) => {
              pageRefs.current[pageIdx] = el;
            }}
            className={`paper print-page ${paperSize === 'letter' ? 'paper-letter' : ''}`}
            data-page-index={pageIdx}
            data-paper-size={paperSize}
          >
            {/* Watermark */}
            {watermark && (
              <div className="hidden print:grid absolute inset-0 grid-cols-4 gap-y-6 gap-x-4 items-center justify-items-center pointer-events-none overflow-hidden z-[1] opacity-[0.04] rotate-[-30deg] scale-150 select-none">
                {Array.from({ length: 80 }).map((_, i) => (
                  <span
                    key={i}
                    className="text-base font-bold uppercase tracking-wider text-black whitespace-nowrap"
                  >
                    {watermark}
                  </span>
                ))}
              </div>
            )}

            {/* Header: centered title with key, time signature, tempo, rule */}
            <PrintHeader
              chart={effectiveChart}
              pageIndex={pageIdx}
              totalPages={pages.length}
              fontFamily={activeFontFamily}
            />

            {/* Chart Body: flex-start with 2.0em line spacing in default font like Image 1 */}
            <div
              ref={(el) => {
                chartRefs.current[pageIdx] = el;
              }}
              className="chart print-chart flex flex-col flex-1 min-h-0 overflow-hidden"
              style={{
                fontFamily: activeFontFamily,
                lineHeight,
                justifyContent: 'flex-start',
                gap: gapEm,
              }}
            >
              {pageLines.map((line, lIdx) => {
                const sectionName = line.label ? line.label.trim() : '';
                const isFirst = isFirstLineOfSection(pageLines, lIdx);
                const sectionColor = line.labelColor || getDefaultSectionColor(sectionName, lIdx);

                return (
                  <div
                    key={line.id || lIdx}
                    className="row print-row flex items-baseline gap-[0.75em] break-inside-avoid w-full"
                  >
                    {/* Fixed-width section label on the left: stays on 1 line with whitespace-nowrap */}
                    <span
                      className="lab print-lab flex-none text-right font-extrabold select-none whitespace-nowrap"
                      style={{
                        width: `${labelWidthEm}em`,
                        minWidth: `${labelWidthEm}em`,
                        color: isFirst && sectionName ? sectionColor : 'transparent',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      }}
                    >
                      {isFirst && sectionName ? `${sectionName}:` : ''}
                    </span>

                    {/* Bars: matching Image 1 with slate bar markers, orange dots, and bold chords in a clean non-overlapping flow */}
                    <div className="bars print-bars whitespace-nowrap select-none text-slate-900 flex items-baseline flex-nowrap shrink-0">
                      {line.blocks.map((block, bIdx) => {
                        const isFirstBlock = bIdx === 0;
                        let prefix = '||';
                        if (isFirstBlock) {
                          prefix = block.startRepeat ? '||:' : '||';
                        } else {
                          const prev = line.blocks[bIdx - 1];
                          if (prev.endRepeat && block.startRepeat) {
                            prefix = ':||:';
                          } else if (prev.endRepeat) {
                            prefix = ':||';
                          } else if (block.startRepeat) {
                            prefix = '||:';
                          } else {
                            prefix = '||';
                          }
                        }

                        return (
                          <React.Fragment key={block.id || bIdx}>
                            <BarMarker marker={prefix} side="left" />
                            {block.bars.map((bar, barIdx) => (
                              <React.Fragment key={barIdx}>
                                <span className="inline-flex items-baseline justify-center text-center px-[0.25em] min-w-[3.2em]">
                                  <span className="text-[1.15em] font-extrabold tracking-tight text-slate-900">
                                    {bar === '%' ? (
                                      <span className="font-extrabold">%</span>
                                    ) : (
                                      parseChord(bar || '_')
                                    )}
                                  </span>
                                </span>
                                {barIdx < block.bars.length - 1 && (
                                  <span
                                    className="shrink-0 text-slate-400 font-medium px-[0.25em] select-none text-[0.95em]"
                                    style={{
                                      WebkitPrintColorAdjust: 'exact',
                                      printColorAdjust: 'exact',
                                    }}
                                  >
                                    |
                                  </span>
                                )}
                              </React.Fragment>
                            ))}
                          </React.Fragment>
                        );
                      })}

                      {/* Line End Suffix */}
                      {line.blocks.length > 0 && (() => {
                        const lastBlock = line.blocks[line.blocks.length - 1];
                        const suffix = lastBlock.endRepeat ? ':||' : '||';
                        return <BarMarker marker={suffix} side="right" />;
                      })()}

                      {/* Right Label (e.g. "Song....!") */}
                      {line.labelRight && (
                        <span
                          className="print-label-right ml-[0.8em] font-bold shrink-0 whitespace-nowrap"
                          style={{
                            color: line.labelRightColor || '#4a43c9',
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact',
                          }}
                        >
                          {line.labelRight}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
