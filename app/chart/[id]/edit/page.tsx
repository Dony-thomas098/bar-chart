'use client';

import { useAuth } from '@/components/AuthProvider';
import { useChartSync } from '@/hooks/useChartSync';
import { useParams, useRouter } from 'next/navigation';
import { ChordInput } from '@/components/ChordInput';
import { transposeChart, resetChartTranspose } from '@/lib/transpose';
import { createDefaultLine, createDefaultBlock, Line, Block } from '@/lib/chart-types';
import { parseChordToText } from '@/lib/chord-parser';
import { getChordNotes } from '@/lib/chord-notes';
import { moveEntry } from '@/lib/storage';
import { FolderPickerModal } from '@/components/FolderPickerModal';
import { X, Plus, LogOut, Download, Copy, RefreshCw, Cloud, CloudOff, Edit2, Folder as FolderIcon, CornerLeftUp, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { ChartData } from '@/lib/chart-types';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ChartEditor() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const chartId = params.id as string;
  
  const { chart, loading: chartLoading, saveStatus, collaborators, updateChart, forceSave } = useChartSync(chartId);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [copied, setCopied] = useState(false);
  const [customText, setCustomText] = useState<string | null>(null);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const isTypingText = useRef(false);
  const lastEnterPress = useRef<number>(0);

  // Mobile Keypad & Active Selection State
  const [activeMobileSelection, setActiveMobileSelection] = useState<{
    lineId: string;
    blockId: string;
    barIndex: number;
  } | null>(null);
  const [mobileToast, setMobileToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setMobileToast(msg);
    toastTimeoutRef.current = setTimeout(() => setMobileToast(null), 1800);
  }, []);

  const generateText = useCallback((chartData: typeof chart) => {
    if (!chartData) return '';
    const title = chartData.title || 'Untitled Chart';
    const timeSig = chartData.time_sig || '4/4';
    const tempo = `t=${chartData.tempo || 120}`;
    const headerStr = `${title}      ${timeSig}      ${tempo}`;

    const maxLabelLen = Math.max(...chartData.lines.map(l => l.label ? l.label.length : 0));
    let bodyLines: string[] = [];

    chartData.lines.forEach(line => {
      let lineTxt = '';
      if (maxLabelLen > 0) {
        if (line.label) {
          lineTxt += `${line.label.padStart(maxLabelLen)}: `;
        } else {
          lineTxt += ' '.repeat(maxLabelLen + 2);
        }
      }
      
      if (line.blocks.length > 0) {
        line.blocks.forEach((block, bIdx) => {
          const isFirst = bIdx === 0;
          
          if (isFirst) {
            lineTxt += block.startRepeat ? '||: ' : '|| ';
          } else {
            const prevBlock = line.blocks[bIdx - 1];
            if (prevBlock.endRepeat && block.startRepeat) {
              lineTxt += ' :||: ';
            } else if (prevBlock.endRepeat) {
              lineTxt += ' :|| ';
            } else if (block.startRepeat) {
              lineTxt += ' ||: ';
            } else {
              lineTxt += ' || ';
            }
          }
          
          lineTxt += block.bars.map(b => (b ? parseChordToText(b) : '_')).join(' | ');
        });
        
        const lastBlock = line.blocks[line.blocks.length - 1];
        if (lastBlock && lastBlock.endRepeat) {
          lineTxt += ' :||';
        } else {
          lineTxt += ' ||';
        }
      }
      if (line.labelRight) {
        lineTxt += line.blocks.length > 0 ? ` ${line.labelRight}` : line.labelRight;
      }
      lineTxt += '\n\n';
      bodyLines.push(lineTxt);
    });

    const maxBodyLen = Math.max(...bodyLines.map(l => l.replace(/\n/g, '').length), headerStr.length);
    const padding = Math.max(0, Math.floor((maxBodyLen - headerStr.length) / 2));
    
    let txt = ' '.repeat(padding) + headerStr + '\n\n';
    txt += bodyLines.join('');

    return txt.trimEnd();
  }, []);

  const normalizeChordText = (text: string) => {
    let normalized = text
      .replace(/♭/g, 'b')
      .replace(/♯/g, '#')
      .replace(/△/g, 'maj7')
      .replace(/°/g, 'dim')
      .replace(/⁺/g, 'aug');
    
    const INVERSE_SUPER_MAP: Record<string, string> = {
      '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
      '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
      '⁺': '+', '⁻': '-',
      'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e',
      'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j',
      'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o',
      'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u',
      'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z',
      'ᴬ': 'A', 'ᴮ': 'B', 'ᴰ': 'D', 'ᴱ': 'E', 'ᴳ': 'G',
      'ᴴ': 'H', 'ᴵ': 'I', 'ᴶ': 'J', 'ᴷ': 'K', 'ᴸ': 'L',
      'ᴹ': 'M', 'ᴺ': 'N', 'ᴼ': 'O', 'ᴾ': 'P', 'ᴿ': 'R',
      'ᵀ': 'T', 'ᵁ': 'U', 'ⱽ': 'V', 'ᵂ': 'W',
    };
    
    let result = '';
    for (const char of normalized) {
      result += INVERSE_SUPER_MAP[char] || char;
    }
    return result;
  };

  const parseTextToLines = useCallback((text: string) => {
    const lines: Line[] = [];
    const textLines = text.split('\n');
    
    for (const tLine of textLines) {
      if (!tLine.trim()) continue; 
      
      // Skip the auto-generated header line so it doesn't become a text annotation
      if (tLine.includes('t=') && !tLine.includes('|') && lines.length === 0) {
        continue;
      }
      
      if (!tLine.includes('|')) {
        lines.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          label: '',
          labelRight: tLine.trim(),
          blocks: []
        });
        continue;
      }
      
      let label = '';
      let labelRight = '';
      let content = tLine.trim();
      
      const firstBarMatch = content.match(/^(.*?):\s*(\|\|:|\|\|)(.*)$/);
      if (firstBarMatch) {
        label = firstBarMatch[1].trim();
        content = firstBarMatch[2] + firstBarMatch[3];
      } else {
        const altMatch = content.match(/^(.*?)\s+(\|\|:|\|\|)(.*)$/);
        if (altMatch && !altMatch[1].includes('|')) {
           label = altMatch[1].trim();
           if (label.endsWith(':')) label = label.slice(0, -1);
           content = altMatch[2] + altMatch[3];
        }
      }
      
      // Extract labelRight from the end
      const lastBarMatch = content.match(/^(.*?)(\|\||:\|\|)\s+(.+)$/);
      if (lastBarMatch && !lastBarMatch[3].includes('|')) {
        content = lastBarMatch[1] + lastBarMatch[2];
        labelRight = lastBarMatch[3].trim();
      }
      
      const tokens = content.split(/(\|\|:|:\|\|:|:\|\||\|\|)/).map(s => s.trim()).filter(s => s !== '');
      let blocks: Block[] = [];
      let currentBlock: Block | null = null;
      
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        if (token === '||' || token === '||:') {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            startRepeat: token === '||:',
            endRepeat: false,
            bars: []
          };
        } else if (token === ':||' || token === ':||:') {
          if (currentBlock) {
            currentBlock.endRepeat = true;
            blocks.push(currentBlock);
            currentBlock = null;
          }
          if (token === ':||:') {
            currentBlock = {
              id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
              startRepeat: true,
              endRepeat: false,
              bars: []
            };
          }
        } else {
          if (!currentBlock) {
            currentBlock = {
              id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
              startRepeat: false,
              endRepeat: false,
              bars: []
            };
          }
          const bars = token.split('|').map(b => b.trim());
          currentBlock.bars.push(...bars.map(b => b === '_' || b === '' ? '' : normalizeChordText(b)));
        }
      }
      if (currentBlock) blocks.push(currentBlock);
      
      blocks = blocks.filter(b => b.bars.length > 0 || b.startRepeat || b.endRepeat);
      
      if (blocks.length > 0) {
        lines.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          label,
          labelRight,
          blocks
        });
      }
    }
    
    if (lines.length === 0) {
      lines.push(createDefaultLine());
    }
    return lines;
  }, []);

  useEffect(() => {
    if (chart && !isTypingText.current) {
      setCustomText(generateText(chart));
    }
  }, [chart, generateText]);

  if (authLoading || chartLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-white bg-bg">
        <div className="flex items-center gap-3">
          <RefreshCw size={20} className="animate-spin text-accent-solid" />
          <span className="font-semibold text-sm">Loading Chart...</span>
        </div>
      </div>
    );
  }

  if (!user || !chart) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-white bg-bg gap-4">
        <p className="text-text-secondary">Chart not found or access denied.</p>
        <button onClick={() => router.push('/')} className="px-5 py-2.5 bg-accent-solid text-white font-bold rounded-xl shadow-lg hover:brightness-110">
          Go Home
        </button>
      </div>
    );
  }

  const handleBlockEdit = (updates: Partial<typeof chart>) => {
    // If they edit the grid, we also clear custom_text so it doesn't override the viewer
    updateChart({ ...updates, custom_text: null });
  };

  const updateTitle = (title: string) => handleBlockEdit({ title });
  const updateTempo = (tempo: number) => handleBlockEdit({ tempo });
  const updateTimeSig = (time_sig: string) => handleBlockEdit({ time_sig });

  const addLine = () => handleBlockEdit({ lines: [...chart.lines, createDefaultLine()] });
  
  const insertLineAfter = (lineId: string) => {
    const index = chart.lines.findIndex(l => l.id === lineId);
    if (index === -1) return;
    const newLines = [...chart.lines];
    newLines.splice(index + 1, 0, createDefaultLine());
    handleBlockEdit({ lines: newLines });
  };
  
  const removeLine = (lineId: string) => {
    if (chart.lines.length <= 1) return;
    handleBlockEdit({ lines: chart.lines.filter(l => l.id !== lineId) });
    if (activeMobileSelection?.lineId === lineId) {
      setActiveMobileSelection(null);
    }
  };

  const updateLineLabel = (lineId: string, label: string) => {
    const newLines = chart.lines.map(l => l.id === lineId ? { ...l, label } : l);
    handleBlockEdit({ lines: newLines });
  };

  const updateLineLabelRight = (lineId: string, labelRight: string) => {
    const newLines = chart.lines.map(l => l.id === lineId ? { ...l, labelRight } : l);
    handleBlockEdit({ lines: newLines });
  };

  const addBlock = (lineId: string, atStart: boolean) => {
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const newBlock = createDefaultBlock();
      const blocks = atStart ? [newBlock, ...l.blocks] : [...l.blocks, newBlock];
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  };

  const addBarsToLine = (lineId: string, count: number) => {
    const newBlock: Block = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      bars: Array(count).fill(''),
    };
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      return { ...l, blocks: [...l.blocks, newBlock] };
    });
    handleBlockEdit({ lines: newLines });
    showToast(`+${count} Bars Added`);
  };

  const removeBlock = (lineId: string, blockId: string) => {
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      if (l.blocks.length <= 1) return l;
      return { ...l, blocks: l.blocks.filter(b => b.id !== blockId) };
    });
    handleBlockEdit({ lines: newLines });
    if (activeMobileSelection?.blockId === blockId) {
      setActiveMobileSelection(null);
    }
  };

  const addBarToBlock = (lineId: string, blockId: string) => {
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => {
        if (b.id !== blockId) return b;
        return { ...b, bars: [...b.bars, ''] };
      });
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  };

  const toggleStartRepeat = (lineId: string, blockId: string) => {
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => b.id === blockId ? { ...b, startRepeat: !b.startRepeat } : b);
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  };

  const toggleEndRepeat = (lineId: string, blockId: string) => {
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => b.id === blockId ? { ...b, endRepeat: !b.endRepeat } : b);
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  };

  const formatChordCase = (val: string) => {
    if (!val) return val;
    return val.split('/').map(part => {
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join('/');
  };

  const updateBar = (lineId: string, blockId: string, barIndex: number, val: string) => {
    const formattedVal = formatChordCase(val);
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => {
        if (b.id !== blockId) return b;
        const newBars = [...b.bars];
        newBars[barIndex] = formattedVal;
        return { ...b, bars: newBars };
      });
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  };

  const handleTranspose = (delta: number) => handleBlockEdit(transposeChart(chart, delta, chart.prefer_flats));
  const handleResetTranspose = () => handleBlockEdit(resetChartTranspose(chart));
  const toggleSpelling = () => handleBlockEdit(transposeChart(chart, 0, !chart.prefer_flats));

  const clearAll = () => {
    if (confirm('Are you sure you want to clear all chords?')) {
       const clearedLines = chart.lines.map(line => ({
         ...line,
         blocks: line.blocks.map(block => ({
           ...block,
           bars: block.bars.map(() => '')
         }))
       }));
       handleBlockEdit({ lines: clearedLines });
       showToast('Chart cleared');
    }
  };

  const copyAsText = () => {
    navigator.clipboard.writeText(customText || generateText(chart));
    setCopied(true);
    showToast('Copied to clipboard! 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMoveChart = async (newFolderId: string | null) => {
    await moveEntry(chart.id, 'chart', newFolderId);
    updateChart({ folder_id: newFolderId });
    showToast('Chart moved');
  };

  // ─── Flat bar list for mobile sequential navigation ────────────────────────
  const getFlatBars = useCallback(() => {
    const list: { lineId: string; blockId: string; barIndex: number; lineLabel: string; barTotalInBlock: number }[] = [];
    chart.lines.forEach((l) => {
      l.blocks.forEach((b) => {
        b.bars.forEach((_, barIdx) => {
          list.push({
            lineId: l.id,
            blockId: b.id,
            barIndex: barIdx,
            lineLabel: l.label || 'Section',
            barTotalInBlock: b.bars.length,
          });
        });
      });
    });
    return list;
  }, [chart.lines]);

  const getActiveBarValue = useCallback(() => {
    if (!activeMobileSelection) return '';
    const line = chart.lines.find(l => l.id === activeMobileSelection.lineId);
    const block = line?.blocks.find(b => b.id === activeMobileSelection.blockId);
    return block?.bars[activeMobileSelection.barIndex] || '';
  }, [chart.lines, activeMobileSelection]);

  const stepMobileBar = useCallback((delta: number) => {
    if (!activeMobileSelection) return;
    const flat = getFlatBars();
    const currentIndex = flat.findIndex(
      item => item.lineId === activeMobileSelection.lineId &&
              item.blockId === activeMobileSelection.blockId &&
              item.barIndex === activeMobileSelection.barIndex
    );
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + delta;
    if (nextIndex < 0) {
      showToast('First bar reached');
      return;
    }
    if (nextIndex >= flat.length) {
      showToast('Last bar reached');
      return;
    }

    const next = flat[nextIndex];
    setActiveMobileSelection({
      lineId: next.lineId,
      blockId: next.blockId,
      barIndex: next.barIndex,
    });
  }, [activeMobileSelection, getFlatBars, showToast]);

  // Handle Mobile Keypad Key Press
  const handleKeypadPress = useCallback((key: string) => {
    if (!activeMobileSelection) return;
    let current = getActiveBarValue();

    if (key === '␣') {
      current += ' ';
    } else if (key === '.') {
      current = current.trim() + ' .';
    } else if (key === '%') {
      current = '%';
    } else {
      current += key;
    }

    updateBar(
      activeMobileSelection.lineId,
      activeMobileSelection.blockId,
      activeMobileSelection.barIndex,
      current
    );
  }, [activeMobileSelection, getActiveBarValue, updateBar]);

  const handleKeypadBackspace = useCallback(() => {
    if (!activeMobileSelection) return;
    const current = getActiveBarValue();
    if (current.length > 0) {
      updateBar(
        activeMobileSelection.lineId,
        activeMobileSelection.blockId,
        activeMobileSelection.barIndex,
        current.slice(0, -1)
      );
    }
  }, [activeMobileSelection, getActiveBarValue, updateBar]);

  const handleKeypadInsertBar = useCallback(() => {
    if (!activeMobileSelection) return;
    const { lineId, blockId, barIndex } = activeMobileSelection;
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => {
        if (b.id !== blockId) return b;
        const newBars = [...b.bars];
        newBars.splice(barIndex + 1, 0, '');
        return { ...b, bars: newBars };
      });
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
    setActiveMobileSelection({ lineId, blockId, barIndex: barIndex + 1 });
    showToast('+1 Bar Inserted');
  }, [activeMobileSelection, chart.lines, handleBlockEdit, showToast]);

  const handleKeypadDeleteBar = useCallback(() => {
    if (!activeMobileSelection) return;
    const { lineId, blockId, barIndex } = activeMobileSelection;
    const line = chart.lines.find(l => l.id === lineId);
    const block = line?.blocks.find(b => b.id === blockId);
    if (!line || !block) return;

    if (block.bars.length <= 1 && line.blocks.length <= 1 && chart.lines.length <= 1) {
      // Clear instead of removing last standing bar
      updateBar(lineId, blockId, 0, '');
      showToast('Bar cleared');
      return;
    }

    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => {
        if (b.id !== blockId) return b;
        const newBars = [...b.bars];
        newBars.splice(barIndex, 1);
        return { ...b, bars: newBars };
      }).filter(b => b.bars.length > 0);
      return { ...l, blocks };
    }).filter(l => l.blocks.length > 0);

    handleBlockEdit({ lines: newLines });
    showToast('Bar deleted');

    // Select adjacent bar
    setTimeout(() => {
      const flat = getFlatBars();
      if (flat.length > 0) {
        const next = flat[Math.min(barIndex, flat.length - 1)];
        setActiveMobileSelection({
          lineId: next.lineId,
          blockId: next.blockId,
          barIndex: next.barIndex,
        });
      } else {
        setActiveMobileSelection(null);
      }
    }, 20);
  }, [activeMobileSelection, chart.lines, getFlatBars, handleBlockEdit, showToast, updateBar]);

  const totalLines = chart.lines.length;
  const totalBars = chart.lines.reduce((sum, line) => sum + line.blocks.reduce((bSum, block) => bSum + block.bars.length, 0), 0);

  // Active chord voicing calculation for bottom sheet
  const activeChordVal = getActiveBarValue();
  const activeChordVoicing = activeChordVal ? getChordNotes(activeChordVal) : null;
  const activeLine = chart.lines.find(l => l.id === activeMobileSelection?.lineId);
  const activeBlock = activeLine?.blocks.find(b => b.id === activeMobileSelection?.blockId);

  return (
    <div className="min-h-screen bg-bg flex flex-col text-text-primary relative pb-32">
      
      {/* Editor Main Content */}
      <main className="flex-1 overflow-x-hidden p-3 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-12">
          
          {/* Header & Metadata */}
          <div className="flex flex-col items-center justify-center relative mb-2 sm:mb-4">
            
            {/* Top Bar for buttons */}
            <div className="w-full flex justify-between items-center gap-2 sm:gap-4 mb-4 sm:mb-8">
              <button 
                onClick={async () => {
                  await forceSave();
                  router.push(returnTo ?? `/chart/${chart.id}`);
                }}
                className="px-3.5 py-2 text-xs sm:text-sm font-bold tracking-wider uppercase text-text-secondary hover:text-white bg-surface border border-border shadow-md rounded-xl hover:bg-surface-raised flex items-center transition-all"
              >
                <CornerLeftUp size={15} className="mr-1.5" /> {returnTo ? 'Performance' : 'Viewer'}
              </button>

              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => setIsFolderPickerOpen(true)}
                  className="px-3.5 py-2 text-xs sm:text-sm font-bold tracking-wider uppercase text-text-secondary hover:text-white bg-surface border border-border shadow-md rounded-xl hover:bg-surface-raised flex items-center transition-all"
                >
                  <FolderIcon size={15} className="mr-1.5" /> Move
                </button>
                <div className="flex items-center text-[10px] sm:text-xs font-bold tracking-wider uppercase bg-surface-raised border border-border shadow-inner rounded-xl px-3 py-2">
                  {saveStatus === 'saving' && <span className="text-text-secondary flex items-center"><RefreshCw size={13} className="mr-1.5 animate-spin" /> Saving</span>}
                  {saveStatus === 'saved' && <span className="text-accent-solid flex items-center"><Cloud size={13} className="mr-1.5" /> Saved</span>}
                  {saveStatus === 'offline' && <span className="text-red-500 flex items-center"><CloudOff size={13} className="mr-1.5" /> Offline</span>}
                </div>
              </div>
            </div>
            
            {/* Center aligned inputs (Responsive) */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center items-stretch sm:items-end gap-3 sm:gap-12 bg-surface border border-border shadow-card rounded-2xl sm:rounded-3xl p-4 sm:p-8 w-full">
              <div className="flex-1 min-w-0 sm:min-w-[200px]">
                <label className="block text-[10px] sm:text-xs font-bold tracking-widest text-text-secondary uppercase mb-1 sm:mb-2 text-left sm:text-center">Title</label>
                <input 
                  value={chart.title}
                  onChange={e => updateTitle(e.target.value)}
                  className="bg-surface-raised border border-border shadow-inner rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-2xl font-bold text-text-primary focus:outline-none focus:border-accent-solid text-left sm:text-center w-full transition-all"
                  placeholder="Untitled progression"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1 sm:flex-initial">
                  <label className="block text-[10px] sm:text-xs font-bold tracking-widest text-text-secondary uppercase mb-1 sm:mb-2 text-center">Tempo</label>
                  <div className="flex items-center text-sm sm:text-xl font-bold text-text-primary justify-center bg-surface-raised border border-border shadow-inner rounded-xl px-3 sm:px-4 py-2 sm:py-3 focus-within:border-accent-solid transition-all">
                    <span className="mr-1.5 text-xs sm:text-base text-text-secondary">BPM</span>
                    <input 
                      type="number" 
                      value={chart.tempo || ''}
                      onChange={e => updateTempo(parseInt(e.target.value) || 120)}
                      className="bg-transparent w-12 sm:w-16 focus:outline-none text-center"
                    />
                  </div>
                </div>

                <div className="flex-1 sm:flex-initial">
                  <label className="block text-[10px] sm:text-xs font-bold tracking-widest text-text-secondary uppercase mb-1 sm:mb-2 text-center">Time</label>
                  <input 
                    value={chart.time_sig || ''}
                    onChange={e => updateTimeSig(e.target.value)}
                    className="bg-surface-raised border border-border shadow-inner rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-xl font-bold text-text-primary focus:outline-none focus:border-accent-solid w-full sm:w-24 text-center transition-all"
                    placeholder="4/4"
                  />
                </div>
              </div>
            </div>
            
            <div className="w-full flex justify-between items-center text-[10px] font-bold tracking-wider text-text-secondary uppercase mt-2 px-1">
              <span>{totalLines} lines • {totalBars} bars total</span>
              <span className="text-accent-solid md:hidden">💡 Tap bar to open keypad</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              MOBILE PHONE VIEW (< md): Stacked Cards & Touch Targets
              ═══════════════════════════════════════════════════════════════ */}
          <div className="block md:hidden space-y-3">
            {chart.lines.map((line, li) => (
              <div key={line.id} className="bg-surface border border-border shadow-card rounded-2xl p-3 flex flex-col gap-2.5">
                
                {/* Line Header: Part name, Text annotation & Delete */}
                <div className="flex items-center gap-2">
                  <input 
                    value={line.label}
                    onChange={e => updateLineLabel(line.id, e.target.value)}
                    placeholder="Part (e.g. Intro)"
                    className="w-28 h-8 px-2.5 bg-surface-raised border border-border shadow-inner rounded-lg text-xs font-bold text-accent-solid focus:outline-none focus:border-accent-solid shrink-0"
                  />
                  <input 
                    value={line.labelRight || ''}
                    onChange={e => updateLineLabelRight(line.id, e.target.value)}
                    placeholder="Section notes / lyrics..."
                    className="flex-1 h-8 px-2.5 bg-surface-raised border border-border shadow-inner rounded-lg text-xs text-text-secondary focus:outline-none focus:border-accent-solid min-w-0"
                  />
                  <button 
                    onClick={() => removeLine(line.id)}
                    disabled={chart.lines.length <= 1}
                    className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-red-400 bg-surface-raised border border-border rounded-lg shrink-0 disabled:opacity-40"
                    title="Remove line"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Blocks Grid Container */}
                <div className="flex flex-col gap-2">
                  {line.blocks.map((block, bi) => {
                    const isTwoCol = block.bars.length === 2;
                    return (
                      <div key={block.id} className="flex items-center gap-1.5">
                        
                        {/* Start repeat button */}
                        <button
                          onClick={() => toggleStartRepeat(line.id, block.id)}
                          className={`px-1.5 h-10 flex items-center justify-center rounded-md border text-sm font-black transition-colors ${block.startRepeat ? 'border-accent-solid bg-accent-solid/20 text-accent-solid' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                          title="Toggle Start Repeat (||:)"
                        >
                          ||{block.startRepeat && ':'}
                        </button>

                        {/* Measure Bars Grid (Responsive wrapping) */}
                        <div className={`flex-1 grid gap-1.5 ${isTwoCol ? 'grid-cols-2' : 'grid-cols-4'} bg-black/30 p-1.5 rounded-xl border border-border`}>
                          {block.bars.map((bar, barIdx) => {
                            const isSelected = activeMobileSelection?.lineId === line.id &&
                                               activeMobileSelection?.blockId === block.id &&
                                               activeMobileSelection?.barIndex === barIdx;
                            return (
                              <button
                                key={`${block.id}-${barIdx}`}
                                type="button"
                                onClick={() => {
                                  setActiveMobileSelection({ lineId: line.id, blockId: block.id, barIndex: barIdx });
                                }}
                                className={`h-11 rounded-lg font-mono text-sm font-bold flex items-center justify-center transition-all select-none overflow-hidden px-1 border ${
                                  isSelected 
                                    ? 'bg-accent-solid/30 border-accent-solid text-white shadow-[0_0_12px_rgba(99,102,241,0.5)] ring-1 ring-accent-solid' 
                                    : bar 
                                      ? 'bg-surface-raised border-border text-text-primary' 
                                      : 'bg-surface border-dashed border-border/70 text-text-muted text-base'
                                }`}
                              >
                                {bar || '·'}
                              </button>
                            );
                          })}
                        </div>

                        {/* End repeat button */}
                        <button
                          onClick={() => toggleEndRepeat(line.id, block.id)}
                          className={`px-1.5 h-10 flex items-center justify-center rounded-md border text-sm font-black transition-colors ${block.endRepeat ? 'border-accent-solid bg-accent-solid/20 text-accent-solid' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                          title="Toggle End Repeat (:||)"
                        >
                          {block.endRepeat && ':'}||
                        </button>

                        {/* Delete block */}
                        <button
                          onClick={() => removeBlock(line.id, block.id)}
                          disabled={line.blocks.length <= 1}
                          className="w-7 h-10 flex items-center justify-center text-text-muted hover:text-red-400 disabled:opacity-30 shrink-0"
                          title="Delete measure block"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile Line Add Bar Buttons */}
                <div className="flex gap-2 pt-1 border-t border-border/50">
                  <button
                    onClick={() => addBarsToLine(line.id, 4)}
                    className="flex-1 py-1.5 text-[11px] font-semibold text-text-secondary bg-surface-raised border border-dashed border-border rounded-lg hover:border-accent-solid hover:text-accent-solid transition-colors"
                  >
                    + 4 Bars
                  </button>
                  <button
                    onClick={() => addBarsToLine(line.id, 2)}
                    className="flex-1 py-1.5 text-[11px] font-semibold text-text-secondary bg-surface-raised border border-dashed border-border rounded-lg hover:border-accent-solid hover:text-accent-solid transition-colors"
                  >
                    + 2 Bars
                  </button>
                </div>

              </div>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              DESKTOP VIEW (>= md): Full Width Grid with Inline Inputs
              ═══════════════════════════════════════════════════════════════ */}
          <div className="hidden md:block space-y-6">
            {chart.lines.map((line) => (
              <div key={line.id} className="flex items-stretch bg-surface border border-border shadow-card rounded-2xl relative group">
                
                {/* Left controls: Part name & Delete */}
                <div className="w-40 flex flex-col justify-center p-5 shrink-0 bg-white/5 rounded-l-2xl border-r border-border">
                  <div className="flex items-center justify-between">
                    <input 
                      value={line.label}
                      onChange={e => updateLineLabel(line.id, e.target.value)}
                      placeholder="Part name"
                      className="bg-surface-raised border border-border shadow-inner rounded-lg px-2 py-1 text-sm font-bold text-text-primary focus:outline-none focus:border-accent-solid w-full mr-2 transition-all"
                    />
                    <button 
                      onClick={() => removeLine(line.id)}
                      disabled={chart.lines.length <= 1}
                      className="text-text-secondary hover:text-red-500 disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity bg-surface border border-border shadow-sm hover:bg-surface-raised rounded-md p-1"
                      title="Remove line"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Pre-block Add */}
                <button 
                  onClick={() => addBlock(line.id, true)} 
                  className="px-4 text-text-secondary hover:text-accent-start transition-all flex items-center justify-center shrink-0 border-r border-border hover:bg-white/5"
                  title="Add block"
                >
                  <Plus size={16} />
                </button>

                {/* Scrollable Blocks Grid */}
                <div className="flex-1 overflow-x-auto py-6 px-4 flex items-center">
                  <div className="flex flex-nowrap gap-x-2">
                    {line.blocks.map((block) => (
                      <React.Fragment key={block.id}>
                        <div className="flex items-center group/block shrink-0 bg-surface-raised border border-border shadow-inner rounded-xl p-3">
                          <div 
                            onClick={() => toggleStartRepeat(line.id, block.id)}
                            className="flex items-center cursor-pointer hover:text-accent-start transition-colors mx-2 group/repeat"
                            title="Toggle start repeat"
                          >
                            <span className="text-2xl font-light text-text-secondary group-hover/repeat:text-accent-start">‖</span>
                            {block.startRepeat && (
                              <span className="text-3xl font-bold text-accent-solid ml-1 leading-none mt-[-4px]">:</span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-3 relative">
                            {block.bars.map((bar, barIdx) => (
                              <React.Fragment key={`${block.id}-${barIdx}`}>
                                <div className="w-28 h-14 bg-surface border border-border shadow-sm rounded-lg transition-all focus-within:border-accent-solid focus-within:shadow-[0_0_0_1px_var(--accent-solid)] shrink-0 overflow-hidden">
                                  <ChordInput 
                                    value={bar} 
                                    onChange={(val) => updateBar(line.id, block.id, barIdx, val)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const inputs = Array.from(document.querySelectorAll('.chord-input-field')) as HTMLInputElement[];
                                        const index = inputs.indexOf(e.currentTarget);
                                        if (index > -1 && index < inputs.length - 1) {
                                          inputs[index + 1].focus();
                                          inputs[index + 1].select();
                                        } else if (index === inputs.length - 1) {
                                          const now = Date.now();
                                          if (now - lastEnterPress.current < 500) {
                                            addLine();
                                            setTimeout(() => {
                                              const newInputs = Array.from(document.querySelectorAll('.chord-input-field')) as HTMLInputElement[];
                                              if (newInputs.length > inputs.length) {
                                                newInputs[inputs.length].focus();
                                                newInputs[inputs.length].select();
                                              }
                                            }, 50);
                                          }
                                          lastEnterPress.current = now;
                                        }
                                      }
                                    }}
                                    className="w-full h-full text-text-primary font-bold text-center bg-transparent focus:outline-none"
                                  />
                                </div>
                                {barIdx < block.bars.length - 1 && (
                                  <div className="text-3xl font-light text-border select-none">|</div>
                                )}
                              </React.Fragment>
                            ))}
                            
                            {/* Remove block cross */}
                            <div className="absolute -top-6 right-0 opacity-0 group-hover/block:opacity-100 transition-opacity">
                              <button 
                                onClick={() => removeBlock(line.id, block.id)}
                                disabled={line.blocks.length <= 1}
                                className="p-1.5 bg-surface border border-border shadow-sm hover:bg-surface-raised rounded-full text-text-secondary hover:text-red-500 disabled:opacity-50 disabled:shadow-none transition-all"
                                title="Remove block"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                          
                          <div 
                            onClick={() => toggleEndRepeat(line.id, block.id)}
                            className="flex items-center cursor-pointer hover:text-accent-start transition-colors mx-2 group/repeat"
                            title="Toggle end repeat"
                          >
                            {block.endRepeat && (
                              <span className="text-3xl font-bold text-accent-solid mr-1 leading-none mt-[-4px]">:</span>
                            )}
                            <span className="text-2xl font-light text-text-secondary group-hover/repeat:text-accent-start">‖</span>
                          </div>
                        </div>
                        
                        {/* Add Bar to block */}
                        <div className="flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity px-2 shrink-0">
                          <button 
                            onClick={() => addBarToBlock(line.id, block.id)}
                            className="p-2 bg-surface border border-border shadow-sm rounded-xl text-text-secondary hover:text-accent-start hover:bg-surface-raised transition-all"
                            title="Add bar"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Post-block Add */}
                <button 
                  onClick={() => addBlock(line.id, false)} 
                  className="px-4 text-text-secondary hover:text-accent-start transition-all flex items-center justify-center shrink-0 border-l border-border hover:bg-white/5"
                  title="Add block"
                >
                  <Plus size={16} />
                </button>
                
                {/* Right controls: Part name (end) */}
                <div className="w-40 flex flex-col justify-center p-5 shrink-0 bg-white/5 rounded-r-2xl border-l border-border">
                  <div className="flex items-center">
                    <input 
                      value={line.labelRight || ''}
                      onChange={e => updateLineLabelRight(line.id, e.target.value)}
                      placeholder="Text"
                      className="bg-surface-raised border border-border shadow-inner rounded-lg px-2 py-1 text-sm font-bold text-text-primary focus:outline-none focus:border-accent-solid w-full transition-all"
                    />
                  </div>
                </div>

                {/* Insert Line Below */}
                <div className="absolute -bottom-4 right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => insertLineAfter(line.id)}
                    className="flex items-center justify-center p-2 bg-surface border border-border shadow-md rounded-full text-text-secondary hover:text-accent-start hover:bg-surface-raised transition-all backdrop-blur-sm"
                    title="Insert line below"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-center pt-2">
            <button 
              onClick={addLine}
              className="flex-1 sm:flex-initial flex items-center justify-center px-4 sm:px-6 py-2.5 sm:py-3 bg-surface border border-border shadow-md text-text-secondary hover:text-accent-start hover:bg-surface-raised rounded-xl transition-all text-xs sm:text-sm font-bold tracking-widest uppercase"
            >
              <Plus size={15} className="mr-1.5" /> Add Line
            </button>
            
            <button 
              onClick={copyAsText}
              className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 bg-accent-gradient shadow-md text-white hover:brightness-110 rounded-xl transition-all text-xs sm:text-sm font-bold tracking-widest uppercase"
            >
              {copied ? 'Copied!' : 'Copy Text'}
            </button>
            
            <button 
              onClick={clearAll}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-surface border border-border shadow-md text-red-400 hover:text-red-300 hover:bg-surface-raised rounded-xl transition-all text-xs sm:text-sm font-bold tracking-widest uppercase"
            >
              Clear All
            </button>
          </div>

          {/* Transpose Controls */}
          <div className="border-t border-border pt-6 sm:pt-8 flex flex-wrap items-center gap-4 sm:gap-8 justify-center">
            <span className="text-xs sm:text-sm font-bold tracking-widest text-text-secondary uppercase">Transpose</span>
            
            <div className="flex items-center space-x-2 bg-surface-raised border border-border shadow-inner rounded-2xl px-2 py-1.5 sm:py-2">
              <button onClick={() => handleTranspose(-1)} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-surface border border-border shadow-sm rounded-xl text-text-secondary hover:text-white hover:bg-white/5 transition-all text-base sm:text-lg font-bold">−</button>
              <span className="font-bold text-accent-start min-w-[100px] sm:min-w-[120px] text-center text-xs sm:text-sm">
                {chart.semitone_offset === 0 ? 'Concert pitch' : `${chart.semitone_offset > 0 ? '+' : ''}${chart.semitone_offset} semitones`}
              </span>
              <button onClick={() => handleTranspose(1)} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-surface border border-border shadow-sm rounded-xl text-text-secondary hover:text-white hover:bg-white/5 transition-all text-base sm:text-lg font-bold">+</button>
            </div>
            
            {chart.semitone_offset !== 0 && (
              <button onClick={handleResetTranspose} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-accent-start bg-surface border border-border shadow-md rounded-xl hover:bg-surface-raised transition-all">
                Reset
              </button>
            )}

            <button 
              onClick={toggleSpelling} 
              className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-border shadow-md ${chart.prefer_flats ? 'bg-surface-raised text-accent-solid shadow-inner border-accent-solid' : 'bg-surface text-text-secondary hover:text-white hover:bg-surface-raised'}`}
            >
              Spelling: {chart.prefer_flats ? '♭' : '♯'}
            </button>
            
            {/* Network Sync Status */}
            <div className="ml-0 sm:ml-auto flex items-center space-x-4 sm:space-x-6 mt-2 sm:mt-0">
              {collaborators.length > 0 && (
                <div className="flex -space-x-2">
                  {collaborators.map((email, idx) => (
                    <div key={idx} className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-surface-raised border border-accent-solid shadow-inner flex items-center justify-center text-[10px] sm:text-xs font-bold text-accent-start" title={`${email} is editing`}>
                      {email.charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-surface-raised border border-border shadow-inner rounded-xl px-3 py-1.5 sm:px-4 sm:py-2">
                {saveStatus === 'saving' && <><RefreshCw size={13} className="mr-1.5 text-text-secondary animate-spin" /> <span className="text-text-secondary">Saving...</span></>}
                {saveStatus === 'saved' && <><Cloud size={13} className="mr-1.5 text-accent-solid" /> <span className="text-accent-solid">Saved</span></>}
                {saveStatus === 'offline' && <><CloudOff size={13} className="mr-1.5 text-red-500" /> <span className="text-red-500">Offline</span></>}
              </div>
            </div>
          </div>

          {/* Text Editor */}
          <div className="border-t border-border pt-8 sm:pt-12 mb-8 sm:mb-12">
            <label className="block text-[10px] sm:text-xs font-bold tracking-widest text-text-secondary uppercase mb-3 text-center">Text Editor &amp; Preview</label>
            <textarea 
              className="w-full h-48 sm:h-64 bg-surface-raised border border-border shadow-inner rounded-2xl sm:rounded-3xl p-4 sm:p-8 font-mono text-xs sm:text-[15px] text-text-primary font-medium whitespace-pre-wrap resize-y focus:outline-none focus:border-accent-solid transition-all leading-relaxed"
              value={customText || ''}
              onFocus={() => isTypingText.current = true}
              onBlur={() => {
                isTypingText.current = false;
                if (chart) setCustomText(generateText(chart));
              }}
              onChange={(e) => {
                const newText = e.target.value;
                setCustomText(newText);
                try {
                  const newLines = parseTextToLines(newText);
                  updateChart({ lines: newLines, custom_text: null });
                } catch (err) {}
              }}
              spellCheck={false}
            />
          </div>

        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE CHORD KEYPAD (BOTTOM SHEET)
          ═══════════════════════════════════════════════════════════════ */}
      {activeMobileSelection && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
            onClick={() => setActiveMobileSelection(null)}
          />

          {/* Keypad Drawer */}
          <div className="fixed left-0 right-0 bottom-0 bg-[#130d29] border-t border-border-light rounded-t-3xl p-3 pb-[calc(14px+env(safe-area-inset-bottom,12px))] z-50 shadow-2xl md:hidden max-w-lg mx-auto animate-slide-up">
            
            {/* Drawer Top Controls */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary">
                <span className="bg-surface-raised text-accent-solid px-2 py-0.5 rounded-full text-[11px]">
                  {activeLine?.label || 'Section'}
                </span>
                <span>Bar {(activeMobileSelection.barIndex || 0) + 1} of {activeBlock?.bars.length || 1}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => stepMobileBar(-1)}
                  className="px-2.5 py-1 bg-surface-raised border border-border text-text-primary rounded-lg text-xs font-bold flex items-center gap-0.5 active:scale-95"
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <button
                  onClick={() => stepMobileBar(1)}
                  className="px-2.5 py-1 bg-surface-raised border border-border text-text-primary rounded-lg text-xs font-bold flex items-center gap-0.5 active:scale-95"
                >
                  Next <ChevronRight size={13} />
                </button>
                <button
                  onClick={() => setActiveMobileSelection(null)}
                  className="px-3 py-1 bg-accent-solid text-white rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 shadow-md"
                >
                  <Check size={13} /> Done
                </button>
              </div>
            </div>

            {/* Realtime Chord Display & Voicing Note Breakdown */}
            <div className="bg-surface border border-border rounded-xl px-3 py-2 flex items-center justify-between mb-2 min-h-[44px]">
              <div className="font-mono text-xl font-black text-white flex items-center tracking-tight">
                <span>{activeChordVal ? parseChordToText(activeChordVal) : ''}</span>
                <span className="w-0.5 h-5 bg-accent-solid ml-1 inline-block animate-pulse" />
              </div>
              <div className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded-md">
                {activeChordVoicing?.formattedNotes || (activeChordVal ? 'Notation' : 'Empty bar')}
              </div>
            </div>

            {/* Row 1: Root Note Keys */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((root) => (
                <button
                  key={root}
                  onClick={() => handleKeypadPress(root)}
                  className="h-10 bg-surface-hover border border-border-light rounded-lg text-white font-sans text-base font-extrabold flex items-center justify-center active:bg-accent-solid active:scale-95 shadow-sm transition-transform"
                >
                  {root}
                </button>
              ))}
            </div>

            {/* Row 2: Accidentals & Qualities */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['♯', '♭', 'm', '7', 'maj7', 'sus4', 'dim'].map((q) => {
                const isAcc = q === '♯' || q === '♭';
                return (
                  <button
                    key={q}
                    onClick={() => handleKeypadPress(q)}
                    className={`h-9 bg-surface-raised border border-border rounded-lg font-mono text-xs font-bold flex items-center justify-center active:bg-surface-hover active:scale-95 transition-transform ${isAcc ? 'text-purple-300 text-sm' : 'text-slate-200'}`}
                  >
                    {q}
                  </button>
                );
              })}
            </div>

            {/* Row 3: Extensions, Slash & Rhythms */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['aug', '9', '6', '/', '%', '␣', '.'].map((q) => {
                const isSpecial = q === '/' || q === '%' || q === '␣';
                return (
                  <button
                    key={q}
                    onClick={() => handleKeypadPress(q)}
                    className={`h-9 bg-surface-raised border border-border rounded-lg font-mono text-xs font-bold flex items-center justify-center active:bg-surface-hover active:scale-95 transition-transform ${isSpecial ? 'text-sky-300 font-extrabold' : 'text-slate-200'}`}
                  >
                    {q}
                  </button>
                );
              })}
            </div>

            {/* Row 4: Navigation, Editing & Auto-Advance */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={handleKeypadBackspace}
                className="h-10 bg-white/10 border border-border text-white rounded-lg text-sm font-black flex items-center justify-center active:scale-95 transition-transform"
                title="Backspace"
              >
                ⌫
              </button>
              <button
                onClick={handleKeypadInsertBar}
                className="h-10 bg-surface-raised border border-border text-text-secondary rounded-lg text-xs font-bold flex items-center justify-center active:scale-95 transition-transform"
              >
                + Bar
              </button>
              <button
                onClick={handleKeypadDeleteBar}
                className="h-10 bg-red-950/30 border border-red-800/40 text-red-400 rounded-lg text-xs font-bold flex items-center justify-center active:scale-95 transition-transform"
              >
                Delete
              </button>
              <button
                onClick={() => stepMobileBar(1)}
                className="h-10 bg-accent-gradient text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 active:scale-95 shadow-md shadow-accent-glow transition-transform"
              >
                Next Bar ›
              </button>
            </div>

          </div>
        </>
      )}

      {/* Mobile Toast Alert */}
      {mobileToast && (
        <div className="fixed left-1/2 bottom-24 -translate-x-1/2 z-50 bg-[#1b1236]/95 border border-border-light text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl flex items-center gap-1.5 animate-fade-in pointer-events-none">
          <span>{mobileToast}</span>
        </div>
      )}
      
      {isFolderPickerOpen && (
        <FolderPickerModal
          isOpen={true}
          onClose={() => setIsFolderPickerOpen(false)}
          onMoveHere={(id) => {
            handleMoveChart(id);
            setIsFolderPickerOpen(false);
          }}
          title="Move Chart to..."
        />
      )}
    </div>
  );
}
