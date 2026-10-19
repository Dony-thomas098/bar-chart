import React, { useState, useEffect, useRef } from 'react';
import { Cloud } from 'lucide-react';
import { parseChord } from '@/lib/chord-parser';
import { ChartData } from '@/lib/chart-types';
import { getChordNotes } from '@/lib/chord-notes';
import { saveChart } from '@/lib/storage';

function ChordNoteTooltip({ chord }: { chord: string }) {
  const info = getChordNotes(chord);
  if (!info) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute -top-11 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-3 py-1.5 bg-white/75 dark:bg-[#18181d]/75 backdrop-blur-2xl saturate-[180%] rounded-xl shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 animate-in fade-in zoom-in-95 duration-150 print:hidden min-w-max text-xs sm:text-sm tracking-normal select-none pointer-events-none text-text-primary dark:text-white"
    >
      <span className="font-bold text-indigo-300 font-sans">{info.chordName}</span>
      <span className="text-slate-500 text-xs">→</span>
      <span className="font-mono font-bold text-emerald-300 drop-shadow">{info.formattedNotes}</span>
    </div>
  );
}


/** Renders a bar-line marker (e.g. "||:", ":||:", "||") so that
 *  the || double-bars are black/bold and only the : repeat dots are indigo. */
function BarMarker({ marker, side }: { marker: string; side: 'left' | 'right' }) {
  const barClass = 'text-slate-500 font-medium text-[1.0em] sm:text-[1.1em] print:text-black print:!text-[1em] print:!font-normal print:!font-mono';
  const dotClass = 'text-[#FF6A1F] font-black text-[1.0em] sm:text-[1.1em] print:text-black print:!text-[1em] print:!font-normal print:!font-mono';

  // Split into segments: leading ':', '||', trailing ':'
  const parts: { ch: string; isColon: boolean }[] = [];
  let i = 0;
  while (i < marker.length) {
    if (marker[i] === ':') {
      parts.push({ ch: ':', isColon: true });
      i++;
    } else if (marker[i] === '|') {
      // grab the run of | characters
      let run = '';
      while (i < marker.length && marker[i] === '|') { run += marker[i]; i++; }
      parts.push({ ch: run, isColon: false });
    } else {
      i++;
    }
  }

  const pad = side === 'left'
    ? 'inline-flex items-center pr-1.5 sm:pr-2.5 print:pr-1 tracking-tighter print:!tracking-normal'
    : 'inline-flex items-center pl-1.5 sm:pl-2.5 print:pl-1 tracking-tighter print:!tracking-normal';

  return (
    <span className={pad}>
      {parts.map((p, idx) => (
        <span key={idx} className={p.isColon ? dotClass : barClass}>{p.ch}</span>
      ))}
    </span>
  );
}

// Section labels warm readable colors (Chordly style: #E8650A, #D1366B, #7A4FD6, #0F9D8A, #C98A0C)
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

// Color swatches for individual element popovers
const COLOR_SWATCHES = [
  { name: 'Reset', color: '#0f172a', isReset: true },
  { name: 'Red', color: '#e11d48' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Indigo', color: '#4f46e5' },
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Teal', color: '#0d9488' },
  { name: 'Amber', color: '#d97706' },
  { name: 'Emerald', color: '#059669' },
];

function ColorPickerPopover({
  itemKey,
  activePickerKey,
  onSetColor,
  position = 'above',
}: {
  itemKey: string;
  activePickerKey: string | null;
  onSetColor: (key: string, color: string | null) => void;
  position?: 'above' | 'below' | 'right';
}) {
  if (activePickerKey !== itemKey) return null;

  const posClasses = position === 'below' 
    ? 'top-full mt-2 left-0 z-50' 
    : position === 'right'
    ? 'top-1/2 -translate-y-1/2 left-full ml-3 z-50'
    : '-top-12 left-0 sm:left-1/2 sm:-translate-x-1/2 z-50';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute ${posClasses} flex items-center gap-1.5 p-2 bg-white/70 dark:bg-[#18181d]/70 backdrop-blur-2xl saturate-[180%] rounded-full shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 animate-in fade-in zoom-in-95 duration-150 print:hidden min-w-max`}
    >
      {COLOR_SWATCHES.map((swatch) => (
        <button
          key={swatch.name}
          title={swatch.name}
          onClick={(e) => {
            e.stopPropagation();
            onSetColor(itemKey, swatch.isReset ? null : swatch.color);
          }}
          className={`w-6 h-6 rounded-full border transition-transform hover:scale-125 ${
            swatch.isReset ? 'border-slate-500 bg-slate-800 text-[10px] text-white flex items-center justify-center font-bold' : 'border-white/40 shadow-sm'
          }`}
          style={!swatch.isReset ? { backgroundColor: swatch.color } : {}}
        >
          {swatch.isReset ? '✕' : ''}
        </button>
      ))}
    </div>
  );
}

interface ChartRendererProps {
  chart: ChartData;
  showUI?: boolean;
  collaborators?: any[];
  watermark?: string;
  selectedFont?: string;
  chordColor?: string;
  onClick?: (e: React.MouseEvent) => void;
  id?: string;
  /** Index of the currently active section (for follower highlight) */
  activeSectionIndex?: number;
}

export function ChartRenderer({ 
  chart, 
  showUI = false, 
  collaborators = [], 
  watermark = '',
  selectedFont = 'system',
  chordColor = '#0f172a',
  onClick,
  id = 'chart-card',
  activeSectionIndex,
}: ChartRendererProps) {
  // Individual element color overrides
  const [itemColors, setItemColors] = useState<Record<string, string>>({});
  const [activePickerKey, setActivePickerKey] = useState<string | null>(null);

  // Active font synced with settings and props
  const [activeFont, setActiveFont] = useState<string>(selectedFont || 'system');

  useEffect(() => {
    const applyFont = () => {
      const saved = localStorage.getItem('chord-grid-font');
      if (saved && saved !== 'system') {
        setActiveFont(saved);
      } else if (selectedFont && selectedFont !== 'system') {
        setActiveFont(selectedFont);
      } else {
        setActiveFont('system');
      }
    };
    applyFont();
    window.addEventListener('chord-grid-font-change', applyFont);
    return () => window.removeEventListener('chord-grid-font-change', applyFont);
  }, [selectedFont]);

  // Chord note voicing tooltip state and double-tap tracker
  const [activeNoteTooltipKey, setActiveNoteTooltipKey] = useState<string | null>(null);
  const lastTouchTimestampRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const handleGlobalClick = () => {
      if (activeNoteTooltipKey) setActiveNoteTooltipKey(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [activeNoteTooltipKey]);

  useEffect(() => {
    if (!chart?.id || !chart?.lines) return;
    const colors: Record<string, string> = {};
    let savedLocal: Record<string, string> = {};
    try {
      const saved = localStorage.getItem(`chord-grid-item-colors-${chart.id}`);
      if (saved) {
        savedLocal = JSON.parse(saved);
        Object.assign(colors, savedLocal);
      }
    } catch {}

    let needsMigrationSave = false;

    chart.lines.forEach((line, lIdx) => {
      const secName = line.label ? line.label.trim().toLowerCase() : '';
      const sectionKey = secName ? `section-${secName}` : `label-${lIdx}`;
      const labelRightKey = line.labelRight ? `labelRight-${lIdx}-${line.labelRight}` : '';

      // If cloud data already has colors, prioritize them over local cache
      if (line.labelColor) {
        if (secName) colors[sectionKey] = line.labelColor;
        colors[`label-${lIdx}`] = line.labelColor;
      } else if (savedLocal[sectionKey] || savedLocal[`label-${lIdx}`]) {
        // Migrate locally saved color to cloud structure
        line.labelColor = savedLocal[sectionKey] || savedLocal[`label-${lIdx}`];
        needsMigrationSave = true;
      }

      if (line.labelRight && line.labelRightColor) {
        colors[labelRightKey] = line.labelRightColor;
      } else if (line.labelRight && savedLocal[labelRightKey]) {
        line.labelRightColor = savedLocal[labelRightKey];
        needsMigrationSave = true;
      }
    });

    setItemColors(colors);

    if (needsMigrationSave && chart.id) {
      try {
        saveChart(chart as any).catch(() => {});
      } catch {}
    }
  }, [chart?.id, chart?.lines]);

  const handleSetColor = async (key: string, color: string | null) => {
    const updatedColors = { ...itemColors };
    if (color === null) {
      delete updatedColors[key];
    } else {
      updatedColors[key] = color;
    }
    setItemColors(updatedColors);
    setActivePickerKey(null);

    try {
      if (chart?.id) {
        localStorage.setItem(`chord-grid-item-colors-${chart.id}`, JSON.stringify(updatedColors));
      }
    } catch {}

    // Save colors directly into chart.lines in cloud database (Supabase)
    if (chart && chart.lines && chart.id) {
      let madeChange = false;
      chart.lines.forEach((line, lIdx) => {
        const secName = line.label ? line.label.trim().toLowerCase() : '';
        const sectionKey = secName ? `section-${secName}` : `label-${lIdx}`;
        const labelRightKey = line.labelRight ? `labelRight-${lIdx}-${line.labelRight}` : '';

        if (key === sectionKey || key === `label-${lIdx}`) {
          line.labelColor = color !== null ? color : undefined;
          madeChange = true;
        }
        if (key === labelRightKey) {
          line.labelRightColor = color !== null ? color : undefined;
          madeChange = true;
        }
      });

      if (madeChange) {
        try {
          await saveChart(chart as any);
        } catch (err) {
          console.warn('Failed to sync color change to cloud:', err);
        }
      }
    }
  };

  const renderTextFlow = (chartData: ChartData) => {
    const fontStyle = activeFont && activeFont !== 'system' 
      ? { fontFamily: activeFont } 
      : { fontFamily: 'var(--font-sans), sans-serif' };

    if (!chartData) return null;
    if (chartData.custom_text !== undefined && chartData.custom_text !== null) {
      return (
        <pre className="text-indigo-600 font-medium text-[10px] sm:text-xs md:text-[15px] leading-normal whitespace-pre min-w-max" style={fontStyle}>
          {chartData.custom_text}
        </pre>
      );
    }

    const maxLabelLen = Math.max(...chartData.lines.map(l => l.label ? l.label.length : 0));
    const labelCh = Math.max(7, maxLabelLen + 1); 
    
    const maxLabelRightLen = Math.max(...chartData.lines.map(l => l.labelRight ? l.labelRight.length : 0));
    const labelRightCh = Math.max(4, maxLabelRightLen) + 2;

    return (
      <div 
        className="flex flex-col gap-4 print:!font-mono w-full leading-relaxed text-slate-900 print-reset-scale print:text-black" 
        style={fontStyle}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center mb-4 sm:mb-6 md:mb-7 pb-3 md:pb-4 border-b border-slate-200 print:border-b print:border-black/20 w-full text-slate-900 print:text-black print:pt-2 print:pb-2 print:mb-4">
          <div className="flex items-baseline gap-3 sm:gap-6 print:gap-3">
            <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold print:text-2xl print:!font-bold tracking-tight print:!tracking-normal text-slate-900 print:text-black" style={fontStyle}>
              {chartData.title || 'Untitled Chart'}
            </h1>
            <span className="font-bold text-slate-500 print:text-black print:!font-semibold text-sm sm:text-xl print:!text-base" style={fontStyle}>
              {chartData.time_sig || '4/4'}
            </span>
          </div>
          <div className="absolute right-0 print:right-2 font-bold text-slate-500 print:text-black print:!font-semibold text-xs sm:text-lg print:!text-sm" style={fontStyle}>
            t={chartData.tempo || 120}
          </div>
        </div>

        {/* Lines */}
        <div className="flex flex-col w-full items-center justify-center">
          <div className="flex flex-col gap-4 sm:gap-6 md:gap-8 print:!gap-2.5 w-fit mx-auto print:mx-0 overflow-visible scrollbar-none px-1 sm:px-2 py-2 print:p-0">
            {chartData.lines.map((line, lIdx) => {
              const secName = line.label ? line.label.trim().toLowerCase() : '';
              const sectionKey = secName ? `section-${secName}` : `label-${lIdx}`;
              const defaultWarmColor = getDefaultSectionColor(line.label, lIdx);
              const customLabelColor = itemColors[sectionKey] || itemColors[`label-${lIdx}`] || (chordColor !== '#0f172a' ? chordColor : defaultWarmColor);
              const popoverPos = lIdx === 0 ? 'below' : 'above';

              if (line.blocks.length === 0) {
                return (
                  <div key={lIdx} className={`flex flex-row items-center justify-start w-full flex-nowrap whitespace-nowrap rounded-lg transition-all duration-300 ${
                    activeSectionIndex === lIdx ? 'ring-2 ring-[#FF6A1F]/40 bg-[#FF6A1F]/10 px-2 -mx-2' : ''
                  }`} id={`chart-line-${lIdx}`}>
                    {/* Left Label */}
                    {line.label ? (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePickerKey(activePickerKey === sectionKey ? null : sectionKey);
                        }}
                        className="relative shrink-0 font-extrabold text-sm sm:text-xl md:text-2xl print:text-[1em] print:!font-normal print:!font-mono text-right pr-1.5 sm:pr-4 print:!pr-3 flex items-center justify-end print:!min-w-0 select-none cursor-pointer hover:opacity-75 transition-opacity print:text-black"
                        style={{ width: `${Math.max(4, labelCh)}ch`, minWidth: `${Math.max(4, labelCh)}ch`, color: customLabelColor || '#0f172a', ...fontStyle }}
                        title="Click to color this section label"
                      >
                        <ColorPickerPopover itemKey={sectionKey} activePickerKey={activePickerKey} onSetColor={handleSetColor} position={popoverPos} />
                        {line.label.charAt(0).toUpperCase()}{line.label.slice(1).toLowerCase()}:
                      </div>
                    ) : (
                      <div className="shrink-0 print:!min-w-0" style={{ width: `${Math.max(4, labelCh)}ch`, minWidth: `${Math.max(4, labelCh)}ch` }}></div>
                    )}

                    {/* Right Label (Annotation text after || bar) */}
                    {line.labelRight && (() => {
                      const labelRightKey = `labelRight-${lIdx}-${line.labelRight}`;
                      const customLabelRightColor = itemColors[labelRightKey];
                      return (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePickerKey(activePickerKey === labelRightKey ? null : labelRightKey);
                          }}
                          className="relative shrink-0 font-semibold print:text-black text-sm sm:text-xl print:text-[1em] print:!font-normal print:!font-mono text-left pl-2 sm:pl-5 print:!pl-3 flex items-center ml-auto cursor-pointer hover:opacity-75 transition-opacity"
                          style={{ width: `${labelRightCh}ch`, color: customLabelRightColor || '#64748b', ...fontStyle }}
                          title="Click to color this text"
                        >
                          <ColorPickerPopover itemKey={labelRightKey} activePickerKey={activePickerKey} onSetColor={handleSetColor} />
                          {line.labelRight}
                        </div>
                      );
                    })()}
                  </div>
                );
              }

              return (
                <div key={lIdx} className={`flex flex-row items-center justify-start flex-nowrap whitespace-nowrap rounded-lg transition-all duration-300 ${
                  activeSectionIndex === lIdx ? 'ring-2 ring-[#FF6A1F]/40 bg-[#FF6A1F]/10 px-2 -mx-2' : ''
                }`} id={`chart-line-${lIdx}`}>
                  {/* Left Label */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePickerKey(activePickerKey === sectionKey ? null : sectionKey);
                    }}
                    className="relative shrink-0 font-extrabold text-sm sm:text-xl md:text-2xl print:text-[1em] print:!font-normal print:!font-mono text-right pr-1.5 sm:pr-4 print:!pr-3 flex items-center justify-end print:!min-w-0 select-none cursor-pointer hover:opacity-75 transition-opacity print:text-black"
                    style={{ width: `${Math.max(4, labelCh)}ch`, minWidth: `${Math.max(4, labelCh)}ch`, color: customLabelColor || '#0f172a', ...fontStyle }}
                    title="Click to color this section label"
                  >
                    <ColorPickerPopover itemKey={sectionKey} activePickerKey={activePickerKey} onSetColor={handleSetColor} position={popoverPos} />
                    {line.label ? `${line.label.charAt(0).toUpperCase()}${line.label.slice(1).toLowerCase()}:` : ''}
                  </div>

                  {/* Chords Container */}
                  <div className="flex items-center justify-start flex-nowrap shrink-0 text-sm sm:text-2xl md:text-[1.75rem] print:!text-[1.1em] print:!font-mono print:!font-normal print:!flex-nowrap print:!whitespace-nowrap">
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
                        <React.Fragment key={bIdx}>
                          <BarMarker marker={prefix} side="left" />
                          {block.bars.map((bar, barIdx) => {
                            const barKey = `chord-note-${lIdx}-${bIdx}-${barIdx}`;
                            const isTooltipActive = activeNoteTooltipKey === barKey;

                            return (
                              <React.Fragment key={barIdx}>
                                <span
                                  onMouseEnter={() => {
                                    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                                      setActiveNoteTooltipKey(barKey);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                                      setActiveNoteTooltipKey((prev) => (prev === barKey ? null : prev));
                                    }
                                  }}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setActiveNoteTooltipKey((prev) => (prev === barKey ? null : barKey));
                                  }}
                                  onTouchStart={(e) => {
                                    const now = Date.now();
                                    const last = lastTouchTimestampRef.current[barKey] || 0;
                                    if (now - last < 350) {
                                      e.stopPropagation();
                                      setActiveNoteTooltipKey((prev) => (prev === barKey ? null : barKey));
                                      lastTouchTimestampRef.current[barKey] = 0;
                                    } else {
                                      lastTouchTimestampRef.current[barKey] = now;
                                    }
                                  }}
                                  className={`relative inline-flex items-center justify-center min-w-[2.2rem] sm:min-w-[3.6rem] md:min-w-[4.8rem] print:!min-w-0 print:!w-auto px-1 sm:px-2 print:!px-1 text-center font-extrabold print:!font-normal print:!font-mono transition-all duration-150 text-sm sm:text-2xl md:text-[1.75rem] print:!text-[1em] print:!font-mono rounded print:!rounded-none select-none ${
                                    isTooltipActive ? 'bg-[#FF6A1F]/10 ring-2 ring-[#FF6A1F]/50' : 'hover:bg-slate-50/50'
                                  }`}
                                  style={{ color: '#0f172a', ...fontStyle }}
                                  title="Double-tap or double-click to view chord notes"
                                >
                                  {isTooltipActive && <ChordNoteTooltip chord={bar || ''} />}
                                  {parseChord(bar || '_')}
                                </span>
                                {barIdx < block.bars.length - 1 && (
                                  <span className="inline-flex items-center justify-center text-slate-500 font-medium px-1 sm:px-2 print:!px-1 text-base sm:text-2xl md:text-3xl print:text-black print:!text-[1em] print:!font-normal print:!font-mono print:!tracking-normal">|</span>
                                )}
                              </React.Fragment>
                            );
                          })}
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
                  {line.labelRight && (() => {
                    const labelRightKey = `labelRight-${lIdx}-${line.labelRight}`;
                    const customLabelRightColor = itemColors[labelRightKey];
                    return (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePickerKey(activePickerKey === labelRightKey ? null : labelRightKey);
                        }}
                        className="relative shrink-0 font-semibold print:text-black text-sm sm:text-2xl print:text-[1em] print:!font-normal print:!font-mono text-left pl-2 sm:pl-6 print:!pl-3 flex items-center cursor-pointer hover:opacity-75 transition-opacity"
                        style={{ width: `${labelRightCh}ch`, color: customLabelRightColor || '#64748b', ...fontStyle }}
                        title="Click to color this text"
                      >
                        <ColorPickerPopover itemKey={labelRightKey} activePickerKey={activePickerKey} onSetColor={handleSetColor} />
                        {line.labelRight}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      id={id}
      onClick={onClick}
      className="flex text-left flex-col w-fit p-4 sm:p-6 md:p-8 print:p-0 bg-white print:bg-transparent rounded-[24px] print:rounded-none relative mx-auto my-0 print:min-h-0 print:h-auto print:w-full border border-slate-200/80 shadow-2xl print:border-none print:shadow-none break-inside-avoid print:break-inside-avoid-page print-single-page"
    >
      {watermark && (
        <div className="hidden print:grid absolute inset-0 grid-cols-4 gap-y-6 gap-x-4 items-center justify-items-center pointer-events-none overflow-hidden z-[1] opacity-[0.04] rotate-[-30deg] scale-150 select-none">
          {Array.from({ length: 80 }).map((_, i) => (
            <span key={i} className="text-base font-bold uppercase tracking-wider text-black whitespace-nowrap">
              {watermark}
            </span>
          ))}
        </div>
      )}
      {renderTextFlow(chart)}

      {/* Footer Info */}
      <div className={`print:hidden mt-auto pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] text-slate-400 font-bold tracking-widest uppercase transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center space-x-4">
          <span className="flex items-center text-[#FF6A1F]"><Cloud size={14} className="mr-2" /> Live Sync</span>
          {collaborators.length > 0 && (
            <span className="text-[#FF6A1F]">
              {collaborators.length} viewing
            </span>
          )}
        </div>
        <span>
          {chart.lines.length} lines • {chart.lines.reduce((sum: number, line: any) => sum + line.blocks.reduce((bSum: number, block: any) => bSum + block.bars.length, 0), 0)} bars total
        </span>
      </div>
    </div>
  );
}
