'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { ChartData, Line, Block } from '@/lib/chart-types';
import { parseChord } from '@/lib/chord-parser';

// SSR-safe layout effect
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const DEFAULT_SECTION_COLORS: Record<string, string> = {
  intro: '#E8650A',
  verse: '#D1366B',
  song: '#D1366B',
  chorus: '#7A4FD6',
  'bg 2nd': '#7A4FD6',
  bg: '#7A4FD6',
  bridge: '#0F9D8A',
  ap: '#0F9D8A',
  outro: '#C98A0C',
  ending: '#C98A0C',
  tag: '#C98A0C',
  interlude: '#E8650A',
  solo: '#D1366B',
  flute: '#D1366B',
  violin: '#0F9D8A',
  link: '#0F9D8A',
};

export const WARM_SECTION_PALETTE = ['#E8650A', '#D1366B', '#7A4FD6', '#0F9D8A', '#C98A0C'];

export function getDefaultSectionColor(label: string | undefined, index: number): string {
  if (!label) return WARM_SECTION_PALETTE[index % WARM_SECTION_PALETTE.length];
  const cleaned = label.trim().toLowerCase();
  if (DEFAULT_SECTION_COLORS[cleaned]) return DEFAULT_SECTION_COLORS[cleaned];
  for (const [key, color] of Object.entries(DEFAULT_SECTION_COLORS)) {
    if (cleaned.startsWith(key)) return color;
  }
  return WARM_SECTION_PALETTE[index % WARM_SECTION_PALETTE.length];
}

export type LineSpacingOption = 'tight' | 'normal' | 'relaxed';

/**
 * Returns top margin in `em` for a row to control gaps between lines.
 * Continuation lines within the same section have tighter gaps than new sections.
 */
export function getRowGapEm(
  isSectionStart: boolean,
  spacing: LineSpacingOption = 'normal'
): number {
  if (spacing === 'tight') {
    return isSectionStart ? 0.38 : 0.15;
  }
  if (spacing === 'relaxed') {
    return isSectionStart ? 0.85 : 0.35;
  }
  // normal (default)
  return isSectionStart ? 0.55 : 0.22;
}

export interface FitChartOptions {
  minFontSize?: number;
  maxFontSize?: number;
  stopShrinkingBelow?: number;
  targetAvailableHeight?: number;
  targetAvailableWidth?: number;
  lineSpacing?: LineSpacingOption;
}

export interface FitChartResult {
  fontSize: number;
  fitsOnPage: boolean;
  availableHeight: number;
  availableWidth: number;
  chartHeight: number;
  chartWidth: number;
}

/**
 * Binary search for largest font size (10px to 40px) where scrollHeight and scrollWidth
 * fit inside the page area minus the header.
 * Sizing in `em` ensures all labels, chords, bar lines, and gaps scale proportionally.
 */
export async function fitChartToPage(
  pageEl: HTMLElement,
  chartEl: HTMLElement,
  options?: FitChartOptions
): Promise<FitChartResult> {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Non-blocking fallback
    }
  }

  const minSize = options?.minFontSize ?? 10;
  const maxSize = options?.maxFontSize ?? 40;
  const stopShrinkingBelow = options?.stopShrinkingBelow ?? 14;

  const headerEl = pageEl.querySelector('.print-header') as HTMLElement | null;

  let pageH = pageEl.clientHeight || pageEl.getBoundingClientRect().height;
  let pageW = pageEl.clientWidth || pageEl.getBoundingClientRect().width;

  // Fallback dimensions for A4 at 96 DPI if element is hidden/unmeasured
  if (pageH <= 0) {
    pageH = options?.targetAvailableHeight ? options.targetAvailableHeight + 60 : 1032; // ~273mm at 96 DPI
  }
  if (pageW <= 0) {
    pageW = options?.targetAvailableWidth ?? 703; // ~186mm at 96 DPI
  }

  const headerH = headerEl ? (headerEl.offsetHeight || headerEl.getBoundingClientRect().height) : 0;

  let padY = 0;
  let padX = 0;
  if (typeof window !== 'undefined') {
    try {
      const cs = window.getComputedStyle(pageEl);
      padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    } catch {
      padY = 0;
      padX = 0;
    }
  }

  const availableHeight = options?.targetAvailableHeight ?? Math.max(80, pageH - headerH - padY);
  const availableWidth = options?.targetAvailableWidth ?? Math.max(80, pageW - padX);

  // Measure with unconstrained layout
  chartEl.style.height = 'auto';
  chartEl.style.justifyContent = 'flex-start';
  chartEl.style.overflow = 'visible';

  let low = minSize;
  let high = maxSize;
  let best = 0;

  // Binary search with 0.5px precision
  while (low <= high) {
    const mid = Math.round(((low + high) / 2) * 2) / 2;
    chartEl.style.fontSize = `${mid}px`;

    const fitsHeight = chartEl.scrollHeight <= availableHeight;
    const fitsWidth = chartEl.scrollWidth <= availableWidth;

    if (fitsHeight && fitsWidth) {
      best = mid;
      low = mid + 0.5;
    } else {
      high = mid - 0.5;
    }
  }

  const fitsOnPage = best >= stopShrinkingBelow;
  const finalFontSize = fitsOnPage ? best : Math.max(best, stopShrinkingBelow);

  chartEl.style.fontSize = `${finalFontSize}px`;
  chartEl.style.height = '100%';
  // Center chart vertically within printable page while keeping tight, cohesive line gaps
  chartEl.style.justifyContent = 'center';
  chartEl.style.overflow = 'hidden';

  return {
    fontSize: finalFontSize,
    fitsOnPage,
    availableHeight,
    availableWidth,
    chartHeight: chartEl.scrollHeight,
    chartWidth: chartEl.scrollWidth,
  };
}

/**
 * Splits chart lines across pages so that no section row is split (break-inside: avoid).
 */
export function paginateChartLines(
  lines: Line[],
  rowHeights: number[],
  availableHeight: number,
  spacing: LineSpacingOption = 'normal',
  fontSize: number = 14
): Line[][] {
  if (lines.length === 0) return [[]];
  const pages: Line[][] = [];
  let currentPage: Line[] = [];
  let currentH = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rowH = rowHeights[i] ?? (fontSize * 1.3);
    const isSectionStart = !!line.label && currentPage.length > 0;
    const gapPx = currentPage.length > 0 ? getRowGapEm(isSectionStart, spacing) * fontSize : 0;
    const nextH = currentH + rowH + gapPx;

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
 * Bar marker (e.g. "||:", ":||:", "||", ":||")
 * Repeats stay with their bars via white-space: nowrap.
 * Double-bars are black/bold, colons (:) are warm orange.
 */
export function BarMarker({ marker, side }: { marker: string; side?: 'left' | 'right' }) {
  const padClass = side === 'left' ? 'pr-[0.2em]' : 'pl-[0.2em]';

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

  return (
    <span className={`inline-flex items-center tracking-tight font-mono select-none whitespace-nowrap ${padClass}`}>
      {parts.map((p, idx) => (
        <span
          key={idx}
          className={p.isColon ? 'font-black' : 'font-bold'}
          style={{
            color: p.isColon ? '#FF6A1F' : '#000000',
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

/**
 * Header repeated on each page of the chart.
 * Centered underlined title, key, time signature, and tempo on the right.
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
  const fontStyle = { fontFamily: fontFamily || 'var(--font-mono), monospace' };

  return (
    <div
      className="print-header relative flex items-center justify-center w-full pb-2 mb-2 border-b border-black/30 text-black shrink-0"
      style={fontStyle}
    >
      <div className="flex items-baseline gap-3 text-center">
        <h1 className="text-xl sm:text-2xl font-bold tracking-normal text-black font-mono">
          {chart.title || 'Untitled Chart'}
          {(chart as unknown as { key?: string }).key &&
            !chart.title.includes((chart as unknown as { key?: string }).key as string) && (
              <span className="ml-1.5 font-semibold text-black">
                ({(chart as unknown as { key?: string }).key})
              </span>
            )}
        </h1>
        <span className="font-semibold text-black text-sm sm:text-base font-mono">
          {chart.time_sig || '4/4'}
        </span>
        {totalPages && totalPages > 1 && (
          <span className="text-xs font-semibold text-slate-700 font-mono ml-1">
            (Page {(pageIndex ?? 0) + 1}/{totalPages})
          </span>
        )}
      </div>
      <div className="absolute right-0 font-semibold text-black text-xs sm:text-sm font-mono">
        t={chart.tempo || 120}
      </div>
    </div>
  );
}

export interface PrintChartProps {
  chart: ChartData;
  selectedFont?: string;
  watermark?: string;
  paperSize?: 'a4' | 'letter';
  lineSpacing?: LineSpacingOption;
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
  const [pages, setPages] = useState<Line[][]>(() => [chart?.lines || []]);
  const [fontSizes, setFontSizes] = useState<number[]>([18]);

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chartRefs = useRef<(HTMLDivElement | null)[]>([]);

  const activeFont =
    selectedFont && selectedFont !== 'system'
      ? selectedFont
      : 'var(--font-mono), monospace';
  const fontStyle = { fontFamily: activeFont };

  // Calculate label width in em so it scales with font-size without taking excess space
  const maxLabelLen = chart?.lines
    ? Math.max(0, ...chart.lines.map((l) => (l.label ? l.label.length : 0)))
    : 0;
  const labelWidthEm = maxLabelLen > 0 ? Math.max(3.8, (maxLabelLen + 1.2) * 0.56) : 0;

  // Re-fit all pages of this chart
  const fitPages = useCallback(async () => {
    if (!pageRefs.current[0] || !chartRefs.current[0] || !chart?.lines?.length) {
      return;
    }

    try {
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // First, attempt to fit the whole chart on 1 page
      const firstPageEl = pageRefs.current[0];
      const firstChartEl = chartRefs.current[0];

      if (pages.length === 1) {
        const result = await fitChartToPage(firstPageEl, firstChartEl, {
          minFontSize: 10,
          maxFontSize: 40,
          stopShrinkingBelow: 14,
          lineSpacing,
        });

        if (result.fitsOnPage) {
          setFontSizes([result.fontSize]);
          if (onFitComplete) onFitComplete();
          return;
        }

        // Long chart: does not fit at >= 14px on 1 page. Stop shrinking below 14px
        // and split into multiple pages.
        firstChartEl.style.fontSize = '14px';
        firstChartEl.style.height = 'auto';
        firstChartEl.style.justifyContent = 'flex-start';

        const rowEls = firstChartEl.querySelectorAll('.print-chart-row');
        const rowHeights: number[] = [];
        rowEls.forEach((el) => {
          rowHeights.push((el as HTMLElement).offsetHeight || (14 * 1.3));
        });

        const paginated = paginateChartLines(
          chart.lines,
          rowHeights,
          result.availableHeight,
          lineSpacing,
          14
        );

        if (paginated.length > 1) {
          setPages(paginated);
          setFontSizes(new Array(paginated.length).fill(14));
          return;
        }
      } else {
        // Multi-page fitting: fit each page at >= 14px
        const newFontSizes: number[] = [];
        for (let i = 0; i < pages.length; i++) {
          const pEl = pageRefs.current[i];
          const cEl = chartRefs.current[i];
          if (pEl && cEl) {
            const res = await fitChartToPage(pEl, cEl, {
              minFontSize: 14,
              maxFontSize: 40,
              stopShrinkingBelow: 14,
              lineSpacing,
            });
            newFontSizes.push(res.fontSize);
          } else {
            newFontSizes.push(14);
          }
        }

        // Use consistent font size across pages of the same song for visual harmony
        const minSize = Math.max(14, Math.min(...newFontSizes));
        for (let i = 0; i < pages.length; i++) {
          const cEl = chartRefs.current[i];
          if (cEl) {
            cEl.style.fontSize = `${minSize}px`;
            cEl.style.height = '100%';
            cEl.style.justifyContent = 'center';
          }
        }
        setFontSizes(new Array(pages.length).fill(minSize));
      }
    } catch (err) {
      console.warn('Error during fitChartToPage:', err);
    } finally {
      if (onFitComplete) onFitComplete();
    }
  }, [chart?.lines, pages.length, lineSpacing, onFitComplete]);

  // Run in layout effect, on beforeprint, on window resize
  useIsomorphicLayoutEffect(() => {
    fitPages();
  }, [fitPages, paperSize, lineSpacing]);

  useEffect(() => {
    const handleBeforePrint = () => {
      fitPages();
    };

    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fitPages();
      }, 150);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [fitPages]);

  if (!chart) return null;

  // Custom text fallback
  if (chart.custom_text !== undefined && chart.custom_text !== null) {
    return (
      <div className={`print-page ${paperSize === 'letter' ? 'paper-letter' : ''}`}>
        <PrintHeader chart={chart} fontFamily={activeFont} />
        <pre
          className="text-black font-mono font-medium leading-relaxed whitespace-pre flex-1 overflow-hidden"
          style={fontStyle}
        >
          {chart.custom_text}
        </pre>
      </div>
    );
  }

  return (
    <>
      {pages.map((pageLines, pageIdx) => {
        const pageFontSize = fontSizes[pageIdx] || 16;
        return (
          <div
            key={pageIdx}
            ref={(el) => {
              pageRefs.current[pageIdx] = el;
            }}
            className={`print-page ${paperSize === 'letter' ? 'paper-letter' : ''}`}
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

            {/* Repeated title header */}
            <PrintHeader
              chart={chart}
              pageIndex={pageIdx}
              totalPages={pages.length}
              fontFamily={activeFont}
            />

            {/* Scaled chart container sized in em */}
            <div
              ref={(el) => {
                chartRefs.current[pageIdx] = el;
              }}
              className="print-chart-content flex flex-col justify-center w-full flex-1 overflow-hidden"
              style={{
                fontSize: `${pageFontSize}px`,
                fontFamily: activeFont,
                lineHeight: 1.25,
              }}
            >
              {pageLines.map((line, lIdx) => {
                const defaultWarmColor = getDefaultSectionColor(line.label, lIdx);
                const sectionColor = line.labelColor || defaultWarmColor;

                // Tighter gap for continuation lines; clean musical gap for section starts
                const isSectionStart = !!line.label;
                const marginTopEm = lIdx === 0 ? 0 : getRowGapEm(isSectionStart, lineSpacing);

                return (
                  <div
                    key={line.id || lIdx}
                    className="print-chart-row flex flex-row items-center justify-start flex-nowrap whitespace-nowrap w-full"
                    style={{
                      breakInside: 'avoid',
                      pageBreakInside: 'avoid',
                      marginTop: `${marginTopEm}em`,
                      padding: '0.05em 0',
                    }}
                  >
                    {/* Left Section Label in em */}
                    {labelWidthEm > 0 && (
                      <div
                        className="print-section-label"
                        style={{
                          width: `${labelWidthEm}em`,
                          minWidth: `${labelWidthEm}em`,
                          paddingRight: '0.5em',
                          color: sectionColor,
                          fontWeight: 700,
                          textAlign: 'right',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          flexShrink: 0,
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact',
                        }}
                      >
                        {line.label
                          ? `${line.label.charAt(0).toUpperCase()}${line.label.slice(1).toLowerCase()}:`
                          : ''}
                      </div>
                    )}

                    {/* Chords Blocks in em */}
                    <div className="print-chords-container flex items-center justify-start flex-nowrap shrink-0 whitespace-nowrap">
                      {line.blocks.map((block, bIdx) => {
                        const isFirst = bIdx === 0;
                        let prefix = '';
                        if (isFirst) {
                          prefix = block.startRepeat ? '||:' : '||';
                        } else {
                          const prevBlock = line.blocks[bIdx - 1];
                          if (prevBlock.endRepeat && block.startRepeat) {
                            prefix = ':||:';
                          } else if (prevBlock.endRepeat) {
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
                                <span
                                  className="print-chord-bar inline-flex items-center justify-center font-mono font-bold text-black select-none whitespace-nowrap"
                                  style={{
                                    padding: '0 0.22em',
                                    minWidth: '1.9em',
                                    textAlign: 'center',
                                    WebkitPrintColorAdjust: 'exact',
                                    printColorAdjust: 'exact',
                                  }}
                                >
                                  {parseChord(bar || '_')}
                                </span>
                                {barIdx < block.bars.length - 1 && (
                                  <span
                                    className="print-bar-sep inline-flex items-center justify-center font-mono font-medium text-black select-none whitespace-nowrap"
                                    style={{
                                      padding: '0 0.12em',
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

                      {/* Final Suffix */}
                      {line.blocks.length > 0 && (() => {
                        const lastBlock = line.blocks[line.blocks.length - 1];
                        const suffix = lastBlock.endRepeat ? ':||' : '||';
                        return <BarMarker marker={suffix} side="right" />;
                      })()}
                    </div>

                    {/* Right Label (Annotation text after || bar) */}
                    {line.labelRight && (
                      <div
                        className="print-right-label font-semibold font-mono text-left whitespace-nowrap"
                        style={{
                          paddingLeft: '0.6em',
                          color: line.labelRightColor || '#475569',
                          flexShrink: 0,
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact',
                        }}
                      >
                        {line.labelRight}
                      </div>
                    )}
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
