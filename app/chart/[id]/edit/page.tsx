'use client';

import { useAuth, canModifySection } from '@/components/AuthProvider';
import { useChartSync } from '@/hooks/useChartSync';
import { useParams, useRouter } from 'next/navigation';
import { ChordInput } from '@/components/ChordInput';
import { transposeChart, resetChartTranspose } from '@/lib/transpose';
import { createDefaultLine, createDefaultBlock, Line, Block } from '@/lib/chart-types';
import { parseChord, parseChordToText, normalizeChordInput } from '@/lib/chord-parser';
import { getChordNotes } from '@/lib/chord-notes';
import { moveEntry, saveChart } from '@/lib/storage';
import { FolderPickerModal } from '@/components/FolderPickerModal';
import { X, Plus, LogOut, Download, Copy, RefreshCw, Cloud, CloudOff, Edit2, Folder as FolderIcon, CornerLeftUp, ChevronLeft, ChevronRight, Check, Keyboard, Music } from 'lucide-react';
import { ChartData } from '@/lib/chart-types';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ChartEditor() {
  const { user, profile, loading: authLoading } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const getInitialChartId = () => {
    if (params?.id && params.id !== 'edit') return params.id as string;
    const spId = searchParams?.get('id');
    if (spId) return spId;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const wId = urlParams.get('id');
      if (wId) return wId;
    }
    return '';
  };
  const [resolvedChartId, setResolvedChartId] = useState<string>(getInitialChartId);

  useEffect(() => {
    const currentId =
      (params?.id && params.id !== 'edit' ? (params.id as string) : null) ||
      searchParams?.get('id') ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null) ||
      '';
    if (currentId && currentId !== resolvedChartId) {
      setResolvedChartId(currentId);
    }
  }, [params, searchParams, resolvedChartId]);

  const chartId = resolvedChartId;
  const canEdit = canModifySection(profile?.profession, 'chart');

  useEffect(() => {
    if (!chartId && !authLoading) {
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('id')) {
        return;
      }
      const newId = crypto.randomUUID();
      const currentUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') : null) || 'guest-user';
      const newChart: ChartData = {
        id: newId,
        title: 'Untitled Chart',
        tempo: 120,
        time_sig: '4/4',
        lines: [createDefaultLine(), createDefaultLine()],
        semitone_offset: 0,
        prefer_flats: false,
        folder_id: null,
        created_by: currentUserId,
        updated_at: new Date().toISOString(),
      };
      saveChart(newChart).then(() => {
        router.replace(`/chart/edit/?id=${newId}`);
      });
    }
  }, [chartId, authLoading, user, router]);
  
  const { chart, loading: chartLoading, saveStatus, collaborators, updateChart, forceSave } = useChartSync(chartId);
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
  const [isSlashBassMode, setIsSlashBassMode] = useState(false);
  const [isNativeKeyboard, setIsNativeKeyboard] = useState(false);
  const [mobileToast, setMobileToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setMobileToast(msg);
    toastTimeoutRef.current = setTimeout(() => setMobileToast(null), 1800);
  }, []);

  const generateText = useCallback((chartData: ChartData | null) => {
    if (!chartData) return '';
    const title = chartData.title || 'Untitled Chart';
    const timeSig = chartData.time_sig || '4/4';
    const tempo = `t=${chartData.tempo || 120}`;
    const headerStr = `${title}      ${timeSig}      ${tempo}`;

    const maxLabelLen = Math.max(...(chartData.lines || []).map(l => l.label ? l.label.length : 0), 0);
    const colWidth = Math.max(10, maxLabelLen);
    let bodyLines: string[] = [];

    (chartData.lines || []).forEach(line => {
      let lineTxt = '';
      const partStr = line.label ? line.label : '';
      lineTxt += `${partStr.padStart(colWidth)}  `;
      
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

  const normalizeChordText = useCallback((text: string) => {
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
  }, []);

  const parseTextToLines = useCallback((text: string) => {
    const lines: Line[] = [];
    const textLines = text.split('\n');
    let parsedHeader: { title?: string; time_sig?: string; tempo?: number } | null = null;
    
    for (const tLine of textLines) {
      if (!tLine.trim()) continue; 
      
      if (tLine.includes('t=') && !tLine.includes('|') && lines.length === 0) {
        const tempoMatch = tLine.match(/t=(\d+)/);
        const timeSigMatch = tLine.match(/\b(\d{1,2}\/\d{1,2})\b/);
        const titlePart = tLine
          .replace(/t=\d+/, '')
          .replace(/\b\d{1,2}\/\d{1,2}\b/, '')
          .trim();
        parsedHeader = {
          title: titlePart || undefined,
          time_sig: timeSigMatch ? timeSigMatch[1] : undefined,
          tempo: tempoMatch ? Math.min(300, Math.max(30, parseInt(tempoMatch[1], 10))) : undefined,
        };
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
    return { lines, header: parsedHeader };
  }, [normalizeChordText]);

  useEffect(() => {
    if (chart && !isTypingText.current) {
      setCustomText(generateText(chart));
    }
  }, [chart, generateText]);

  const handleBlockEdit = useCallback((updates: Partial<ChartData>) => {
    updateChart({ ...updates, custom_text: null });
  }, [updateChart]);

  useEffect(() => {
    if (chart && (!chart.lines || chart.lines.length === 0)) {
      handleBlockEdit({ lines: [createDefaultLine(), createDefaultLine()] });
    }
  }, [chart, handleBlockEdit]);

  const formatChordCase = useCallback((val: string) => {
    if (!val) return val;
    const normalized = normalizeChordInput(val);
    return normalized.split('/').map(part => {
      if (!part) return part;
      if (/^[a-g]/i.test(part)) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
      return part;
    }).join('/');
  }, []);

  const updateBar = useCallback((lineId: string, blockId: string, barIndex: number, val: string) => {
    if (!chart) return;
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
  }, [chart, formatChordCase, handleBlockEdit]);

  const updateTitle = useCallback((title: string) => handleBlockEdit({ title }), [handleBlockEdit]);
  const updateTempo = useCallback((tempo: number) => handleBlockEdit({ tempo }), [handleBlockEdit]);
  const updateTimeSig = useCallback((time_sig: string) => handleBlockEdit({ time_sig }), [handleBlockEdit]);

  const addLine = useCallback(() => {
    if (!chart) return;
    handleBlockEdit({ lines: [...chart.lines, createDefaultLine()] });
  }, [chart, handleBlockEdit]);
  
  const insertLineAfter = useCallback((lineId: string) => {
    if (!chart) return;
    const index = chart.lines.findIndex(l => l.id === lineId);
    if (index === -1) return;
    const newLines = [...chart.lines];
    newLines.splice(index + 1, 0, createDefaultLine());
    handleBlockEdit({ lines: newLines });
  }, [chart, handleBlockEdit]);
  
  const removeLine = useCallback((lineId: string) => {
    if (!chart || chart.lines.length <= 1) return;
    handleBlockEdit({ lines: chart.lines.filter(l => l.id !== lineId) });
    if (activeMobileSelection?.lineId === lineId) {
      setActiveMobileSelection(null);
    }
  }, [chart, handleBlockEdit, activeMobileSelection]);

  const updateLineLabel = useCallback((lineId: string, label: string) => {
    if (!chart) return;
    const newLines = chart.lines.map(l => l.id === lineId ? { ...l, label } : l);
    handleBlockEdit({ lines: newLines });
  }, [chart, handleBlockEdit]);

  const updateLineLabelRight = useCallback((lineId: string, labelRight: string) => {
    if (!chart) return;
    const newLines = chart.lines.map(l => l.id === lineId ? { ...l, labelRight } : l);
    handleBlockEdit({ lines: newLines });
  }, [chart, handleBlockEdit]);

  const addBlock = useCallback((lineId: string, atStart: boolean) => {
    if (!chart) return;
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const newBlock = createDefaultBlock();
      const blocks = atStart ? [newBlock, ...l.blocks] : [...l.blocks, newBlock];
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  }, [chart, handleBlockEdit]);

  const addBarsToLine = useCallback((lineId: string, count: number) => {
    if (!chart) return;
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
  }, [chart, handleBlockEdit, showToast]);

  const removeBlock = useCallback((lineId: string, blockId: string) => {
    if (!chart) return;
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      if (l.blocks.length <= 1) return l;
      return { ...l, blocks: l.blocks.filter(b => b.id !== blockId) };
    });
    handleBlockEdit({ lines: newLines });
    if (activeMobileSelection?.blockId === blockId) {
      setActiveMobileSelection(null);
    }
  }, [chart, handleBlockEdit, activeMobileSelection]);

  const addBarToBlock = useCallback((lineId: string, blockId: string) => {
    if (!chart) return;
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => {
        if (b.id !== blockId) return b;
        return { ...b, bars: [...b.bars, ''] };
      });
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  }, [chart, handleBlockEdit]);

  const toggleStartRepeat = useCallback((lineId: string, blockId: string) => {
    if (!chart) return;
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => b.id === blockId ? { ...b, startRepeat: !b.startRepeat } : b);
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  }, [chart, handleBlockEdit]);

  const toggleEndRepeat = useCallback((lineId: string, blockId: string) => {
    if (!chart) return;
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => b.id === blockId ? { ...b, endRepeat: !b.endRepeat } : b);
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  }, [chart, handleBlockEdit]);

  const handleTranspose = useCallback((delta: number) => {
    if (!chart) return;
    handleBlockEdit(transposeChart(chart, delta, chart.prefer_flats));
  }, [chart, handleBlockEdit]);

  const handleResetTranspose = useCallback(() => {
    if (!chart) return;
    handleBlockEdit(resetChartTranspose(chart));
  }, [chart, handleBlockEdit]);

  const toggleSpelling = useCallback(() => {
    if (!chart) return;
    handleBlockEdit(transposeChart(chart, 0, !chart.prefer_flats));
  }, [chart, handleBlockEdit]);

  const clearAll = useCallback(() => {
    if (!chart) return;
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
  }, [chart, handleBlockEdit, showToast]);

  const copyAsText = useCallback(() => {
    if (!chart) return;
    navigator.clipboard.writeText(customText || generateText(chart));
    setCopied(true);
    showToast('Copied to clipboard! 📋');
    setTimeout(() => setCopied(false), 2000);
  }, [chart, customText, generateText, showToast]);

  const handleMoveChart = useCallback(async (newFolderId: string | null) => {
    if (!chart) return;
    await moveEntry(chart.id, 'chart', newFolderId);
    updateChart({ folder_id: newFolderId });
    showToast('Chart moved');
  }, [chart, updateChart, showToast]);

  // ─── Flat bar list for mobile sequential navigation ────────────────────────
  const getFlatBars = useCallback(() => {
    const list: { lineId: string; blockId: string; barIndex: number; lineLabel: string; barTotalInBlock: number }[] = [];
    if (!chart?.lines) return list;
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
  }, [chart?.lines]);

  const getActiveBarValue = useCallback(() => {
    if (!activeMobileSelection || !chart?.lines) return '';
    const line = chart.lines.find(l => l.id === activeMobileSelection.lineId);
    const block = line?.blocks.find(b => b.id === activeMobileSelection.blockId);
    return block?.bars[activeMobileSelection.barIndex] || '';
  }, [chart?.lines, activeMobileSelection]);

  // ─── Smooth auto-scroll to active bar cell ──────────────────────────────────
  useEffect(() => {
    if (activeMobileSelection) {
      const cellId = `bar-cell-${activeMobileSelection.lineId}-${activeMobileSelection.blockId}-${activeMobileSelection.barIndex}`;
      const elem = document.getElementById(cellId);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeMobileSelection]);

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
    setIsSlashBassMode(false);
    setActiveMobileSelection({
      lineId: next.lineId,
      blockId: next.blockId,
      barIndex: next.barIndex,
    });
  }, [activeMobileSelection, getFlatBars, showToast]);

  const lastNextBarTapRef = useRef<number>(0);

  const handleNextBarClick = useCallback(() => {
    const now = Date.now();
    const timeDiff = now - lastNextBarTapRef.current;
    lastNextBarTapRef.current = now;

    if (timeDiff > 0 && timeDiff < 400) {
      // Double tap detected: create a new line!
      lastNextBarTapRef.current = 0;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([15, 60, 25]);
      }

      if (!chart) return;
      const newLine = createDefaultLine();
      const currentLineIndex = chart.lines.findIndex(l => l.id === activeMobileSelection?.lineId);

      let newLines: Line[];
      if (currentLineIndex !== -1) {
        newLines = [...chart.lines];
        newLines.splice(currentLineIndex + 1, 0, newLine);
      } else {
        newLines = [...chart.lines, newLine];
      }

      handleBlockEdit({ lines: newLines });

      const firstBlock = newLine.blocks[0];
      if (firstBlock && firstBlock.bars.length > 0) {
        setIsSlashBassMode(false);
        setActiveMobileSelection({
          lineId: newLine.id,
          blockId: firstBlock.id,
          barIndex: 0,
        });
      }

      showToast('New line created (Double Tap)');
      return;
    }

    // Single tap: step to next bar
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    stepMobileBar(1);
  }, [chart, activeMobileSelection, handleBlockEdit, stepMobileBar, showToast]);

  // Handle Mobile Keypad Key Press (Smart Builder + Slash Bass Picker)
  const handleKeypadPress = useCallback((key: string) => {
    if (!activeMobileSelection) return;
    let current = getActiveBarValue();

    let toAppend = key;
    if (key === 'dim') toAppend = '°';
    else if (key === 'aug') toAppend = '+';
    else if (key === 'maj7') toAppend = 'Δ7';
    else if (key === 'm7b5') toAppend = 'ø7';

    if (key === '/') {
      current = current.trim() + '/';
      setIsSlashBassMode(true);
      showToast('Pick bass note (C - B)');
    } else if (isSlashBassMode && ['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(key)) {
      current += key;
      setIsSlashBassMode(false);
    } else if (key === '␣') {
      current = current.trim() + ' ';
      setIsSlashBassMode(false);
    } else if (key === '.') {
      current = current.trim() ? `${current.trim()} .` : '.';
      setIsSlashBassMode(false);
    } else if (key === '%') {
      current = '%';
      setIsSlashBassMode(false);
    } else {
      current += toAppend;
    }

    updateBar(
      activeMobileSelection.lineId,
      activeMobileSelection.blockId,
      activeMobileSelection.barIndex,
      current
    );
  }, [activeMobileSelection, getActiveBarValue, updateBar, isSlashBassMode, showToast]);

  const handleKeypadBackspace = useCallback(() => {
    if (!activeMobileSelection) return;
    const current = getActiveBarValue();
    if (current.length > 0) {
      setIsSlashBassMode(false);
      updateBar(
        activeMobileSelection.lineId,
        activeMobileSelection.blockId,
        activeMobileSelection.barIndex,
        current.slice(0, -1)
      );
    }
  }, [activeMobileSelection, getActiveBarValue, updateBar]);

  const handleKeypadInsertBar = useCallback(() => {
    if (!activeMobileSelection || !chart) return;
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
    setIsSlashBassMode(false);
    setActiveMobileSelection({ lineId, blockId, barIndex: barIndex + 1 });
    showToast('+1 Bar Inserted');
  }, [activeMobileSelection, chart, handleBlockEdit, showToast]);

  const handleKeypadDeleteBar = useCallback(() => {
    if (!activeMobileSelection || !chart) return;
    const { lineId, blockId, barIndex } = activeMobileSelection;
    const line = chart.lines.find(l => l.id === lineId);
    const block = line?.blocks.find(b => b.id === blockId);
    if (!line || !block) return;

    if (block.bars.length <= 1 && line.blocks.length <= 1 && chart.lines.length <= 1) {
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
    setIsSlashBassMode(false);
    showToast('Bar deleted');

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
  }, [activeMobileSelection, chart, getFlatBars, handleBlockEdit, showToast, updateBar]);

  // ─── Conditional Returns (Guaranteed after ALL hooks are initialized) ─────────
  if (authLoading || chartLoading || !canEdit) {
    return (
      <div className="flex h-screen items-center justify-center text-white bg-bg">
        <div className="flex items-center gap-3">
          <RefreshCw size={20} className="animate-spin text-accent-solid" />
          <span className="font-semibold text-sm">Loading Chart...</span>
        </div>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-white bg-bg gap-4">
        <p className="text-text-secondary">Chart not found or access denied.</p>
        <button onClick={() => router.push('/')} className="px-5 py-2.5 bg-accent-solid text-white font-bold rounded-xl shadow-lg hover:brightness-110">
          Go Home
        </button>
      </div>
    );
  }

  const totalLines = chart.lines ? chart.lines.length : 0;
  const totalBars = (chart.lines || []).reduce((sum, line) => sum + (line.blocks || []).reduce((bSum, block) => bSum + (block.bars || []).length, 0), 0);

  // Active chord voicing calculation for bottom sheet
  const activeChordVal = getActiveBarValue();
  const activeChordVoicing = activeChordVal ? getChordNotes(activeChordVal) : null;
  const activeLine = (chart.lines || []).find(l => l.id === activeMobileSelection?.lineId);
  const activeBlock = activeLine?.blocks?.find(b => b.id === activeMobileSelection?.blockId);

  return (
    <div className={`min-h-screen bg-bg flex flex-col text-text-primary relative ${activeMobileSelection ? 'pb-80 sm:pb-32' : 'pb-32'}`}>
      
      {/* Editor Main Content */}
      <main className="flex-1 overflow-x-hidden p-3 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-12">
          
          {/* Header & Metadata */}
          <div className="flex flex-col items-center justify-center relative mb-2 sm:mb-4">
            
            {/* Top Bar for buttons */}
            <div className="w-full flex justify-end lg:justify-between items-center gap-2 sm:gap-4 mb-4 sm:mb-8">
              <button 
                onClick={async () => {
                  await forceSave();
                  router.push(returnTo ?? `/chart?id=${chart.id}`);
                }}
                className="hidden lg:flex px-4 py-2.5 text-xs font-bold tracking-wider uppercase text-text-primary bg-white/70 dark:bg-white/10 border border-glass shadow-sm rounded-full hover:bg-white items-center transition-all active:scale-95"
              >
                <CornerLeftUp size={15} className="mr-1.5" /> {returnTo ? 'Performance' : 'Viewer'}
              </button>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setIsFolderPickerOpen(true)}
                  className="px-4 py-2.5 text-xs font-bold tracking-wider uppercase text-text-primary bg-white/70 dark:bg-white/10 border border-glass shadow-sm rounded-full hover:bg-white flex items-center transition-all active:scale-95"
                >
                  <FolderIcon size={15} className="mr-1.5" /> Move
                </button>
                <div className="flex items-center text-[10px] sm:text-xs font-bold tracking-wider uppercase bg-white/70 dark:bg-white/10 border border-glass shadow-sm rounded-full px-3.5 py-2">
                  {saveStatus === 'saving' && <span className="text-text-secondary flex items-center"><RefreshCw size={13} className="mr-1.5 animate-spin" /> Saving</span>}
                  {saveStatus === 'saved' && <span className="text-orange-600 dark:text-orange-400 flex items-center"><Cloud size={13} className="mr-1.5" /> Saved</span>}
                  {saveStatus === 'offline' && <span className="text-red-500 flex items-center"><CloudOff size={13} className="mr-1.5" /> Offline</span>}
                </div>
              </div>
            </div>
            
            {/* Center aligned inputs (Responsive) */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center items-stretch sm:items-end gap-3 sm:gap-8 bg-surface-glass backdrop-blur-xl border border-glass shadow-glass rounded-[28px] p-5 sm:p-7 w-full">
              <div className="flex-1 min-w-0 sm:min-w-[200px]">
                <label className="block text-[10px] sm:text-xs font-bold tracking-wider text-text-secondary uppercase mb-1 sm:mb-2 text-left sm:text-center">Title</label>
                <input 
                  value={chart.title}
                  onChange={e => updateTitle(e.target.value)}
                  className="bg-white/70 dark:bg-white/[0.06] border border-glass shadow-inner-glass rounded-2xl px-4 py-2.5 sm:py-3 text-base sm:text-2xl font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-left sm:text-center w-full transition-all tracking-tight"
                  placeholder="Untitled progression"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1 sm:flex-initial">
                  <label className="block text-[10px] sm:text-xs font-bold tracking-wider text-text-secondary uppercase mb-1 sm:mb-2 text-center">Tempo</label>
                  <div className="flex items-center text-sm sm:text-lg font-bold text-text-primary justify-center bg-white/70 dark:bg-white/[0.06] border border-glass shadow-inner-glass rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 focus-within:ring-2 focus-within:ring-orange-500/30 transition-all font-mono">
                    <span className="mr-1.5 text-xs text-text-muted font-sans">BPM</span>
                    <input 
                      type="number" 
                      value={chart.tempo || ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          updateTempo(0);
                        } else {
                          const parsed = parseInt(val, 10);
                          if (!isNaN(parsed)) {
                            updateTempo(Math.min(300, Math.max(0, parsed)));
                          }
                        }
                      }}
                      onBlur={() => {
                        if (!chart.tempo || chart.tempo < 30) {
                          updateTempo(120);
                        }
                      }}
                      className="bg-transparent w-12 sm:w-16 focus:outline-none text-center font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex-1 sm:flex-initial">
                  <label className="block text-[10px] sm:text-xs font-bold tracking-wider text-text-secondary uppercase mb-1 sm:mb-2 text-center">Time</label>
                  <input 
                    value={chart.time_sig || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (/^[0-9/]*$/.test(val)) {
                        updateTimeSig(val);
                      }
                    }}
                    onBlur={() => {
                      const match = (chart.time_sig || '').match(/^(\d{1,2})\/(\d{1,2})$/);
                      if (!match) {
                        updateTimeSig('4/4');
                        return;
                      }
                      const num = parseInt(match[1], 10);
                      const den = parseInt(match[2], 10);
                      // Numerator must be positive and denominator must be a power of two
                      const validDenominators = [1, 2, 4, 8, 16, 32];
                      if (num < 1 || !validDenominators.includes(den)) {
                        updateTimeSig('4/4');
                      }
                    }}
                    className="bg-white/70 dark:bg-white/[0.06] border border-glass shadow-inner-glass rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-lg font-mono font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/30 w-full sm:w-24 text-center transition-all"
                    placeholder="4/4"
                  />
                </div>
              </div>
            </div>
            
            <div className="w-full flex justify-between items-center text-[10px] font-bold tracking-wider text-text-secondary uppercase mt-2 px-1">
              <span>{totalLines} lines • {totalBars} bars total</span>
              <span className="text-orange-600 dark:text-orange-400 md:hidden">💡 Tap bar to open keypad</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              MOBILE PHONE VIEW (< md): Stacked Cards & Touch Targets
              ═══════════════════════════════════════════════════════════════ */}
          <div className="block md:hidden space-y-3">
            {(chart.lines || []).map((line) => (
              <div key={line.id} className="bg-surface-glass backdrop-blur-xl border border-glass shadow-glass rounded-[24px] p-3.5 flex flex-col gap-3">
                
                {/* Line Header: Part name, Text annotation & Delete */}
                <div className="flex items-center gap-2">
                  <input 
                    value={line.label}
                    onChange={e => updateLineLabel(line.id, e.target.value)}
                    placeholder="Part (e.g. Intro)"
                    className="w-28 h-9 px-2.5 bg-orange-500/10 dark:bg-orange-500/20 border border-orange-300/40 dark:border-orange-500/30 rounded-xl text-xs font-bold text-orange-700 dark:text-orange-300 placeholder:text-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30 shrink-0 transition-all"
                  />
                  <input 
                    value={line.labelRight || ''}
                    onChange={e => updateLineLabelRight(line.id, e.target.value)}
                    placeholder="Section notes / lyrics..."
                    className="flex-1 h-9 px-2.5 bg-white/70 dark:bg-white/[0.06] border border-glass shadow-inner-glass rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/30 min-w-0 transition-all"
                  />
                  <button 
                    onClick={() => removeLine(line.id)}
                    disabled={(chart.lines || []).length <= 1}
                    className="w-9 h-9 flex items-center justify-center text-text-muted hover:text-rose-500 bg-white/70 dark:bg-white/[0.06] border border-glass shadow-sm rounded-xl shrink-0 disabled:opacity-30 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                    title="Remove line"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Blocks Grid Container */}
                <div className="flex flex-col gap-2">
                  {line.blocks.map((block) => {
                    const isTwoCol = block.bars.length === 2;
                    return (
                      <div key={block.id} className="flex items-center gap-1.5">
                        
                        {/* Start repeat button */}
                        <button
                          onClick={() => toggleStartRepeat(line.id, block.id)}
                          className={`px-1.5 h-12 flex items-center justify-center rounded-xl text-sm font-black transition-colors ${
                            block.startRepeat 
                              ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-300/40' 
                              : 'text-text-muted hover:text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                          }`}
                          title="Toggle Start Repeat (||:)"
                        >
                          ||{block.startRepeat && ':'}
                        </button>

                        {/* Measure Bars Grid (Responsive wrapping) */}
                        <div className={`flex-1 grid gap-1.5 ${isTwoCol ? 'grid-cols-2' : 'grid-cols-4'} bg-black/[0.02] dark:bg-white/[0.03] p-1.5 rounded-2xl border border-black/[0.04] dark:border-white/10`}>
                          {block.bars.map((bar, barIdx) => {
                            const isSelected = activeMobileSelection?.lineId === line.id &&
                                               activeMobileSelection?.blockId === block.id &&
                                               activeMobileSelection?.barIndex === barIdx;
                            return (
                              <button
                                key={`${block.id}-${barIdx}`}
                                id={`bar-cell-${line.id}-${block.id}-${barIdx}`}
                                type="button"
                                onClick={() => {
                                  setIsSlashBassMode(false);
                                  setActiveMobileSelection({ lineId: line.id, blockId: block.id, barIndex: barIdx });
                                }}
                                className={`h-12 rounded-[14px] font-mono text-sm font-bold flex items-center justify-center transition-all select-none overflow-hidden px-1 border ${
                                  isSelected 
                                    ? 'bg-orange-500/15 border-orange-500 text-orange-600 dark:text-orange-400 ring-2 ring-orange-500/40 scale-[1.03] shadow-md' 
                                    : bar 
                                      ? 'bg-white dark:bg-white/10 border-glass text-text-primary shadow-xs' 
                                      : 'bg-white/80 dark:bg-white/[0.04] border-dashed border-black/[0.12] dark:border-white/15 text-text-muted text-base hover:bg-white dark:hover:bg-white/10'
                                }`}
                              >
                                {bar ? parseChord(bar) : '·'}
                              </button>
                            );
                          })}
                        </div>

                        {/* End repeat button */}
                        <button
                          onClick={() => toggleEndRepeat(line.id, block.id)}
                          className={`px-1.5 h-12 flex items-center justify-center rounded-xl text-sm font-black transition-colors ${
                            block.endRepeat 
                              ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-300/40' 
                              : 'text-text-muted hover:text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                          }`}
                          title="Toggle End Repeat (:||)"
                        >
                          {block.endRepeat && ':'}||
                        </button>

                        {/* Delete block */}
                        <button
                          onClick={() => removeBlock(line.id, block.id)}
                          disabled={line.blocks.length <= 1}
                          className="w-7 h-12 flex items-center justify-center text-text-muted hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 rounded-xl disabled:opacity-30 shrink-0 transition-colors"
                          title="Delete measure block"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile Line Add Bar Buttons */}
                <div className="flex gap-2 pt-1 border-t border-black/[0.05] dark:border-white/[0.08]">
                  <button
                    onClick={() => addBarsToLine(line.id, 4)}
                    className="flex-1 py-2 text-xs font-bold text-text-secondary bg-white/70 dark:bg-white/[0.04] border border-dashed border-black/[0.1] dark:border-white/15 rounded-xl hover:border-orange-500/50 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-white/10 transition-all shadow-xs active:scale-98"
                  >
                    + 4 Bars
                  </button>
                  <button
                    onClick={() => addBarsToLine(line.id, 2)}
                    className="flex-1 py-2 text-xs font-bold text-text-secondary bg-white/70 dark:bg-white/[0.04] border border-dashed border-black/[0.1] dark:border-white/15 rounded-xl hover:border-orange-500/50 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-white/10 transition-all shadow-xs active:scale-98"
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
            {(chart.lines || []).map((line) => (
              <div key={line.id} className="flex items-stretch bg-surface-glass backdrop-blur-xl border border-glass shadow-glass rounded-[24px] relative group overflow-hidden">
                
                {/* Left controls: Part name & Delete */}
                <div className="w-44 flex flex-col justify-center p-5 shrink-0 bg-black/[0.02] dark:bg-white/[0.02] rounded-l-[24px] border-r border-glass">
                  <div className="flex items-center justify-between">
                    <input 
                      value={line.label}
                      onChange={e => updateLineLabel(line.id, e.target.value)}
                      placeholder="Part name"
                      className="bg-orange-500/10 dark:bg-orange-500/20 border border-orange-300/40 dark:border-orange-500/30 rounded-xl px-2.5 py-1.5 text-xs font-bold text-orange-700 dark:text-orange-300 placeholder:text-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30 w-full mr-2 transition-all"
                    />
                    <button 
                      onClick={() => removeLine(line.id)}
                      disabled={(chart.lines || []).length <= 1}
                      className="text-text-muted hover:text-rose-500 disabled:opacity-30 opacity-0 group-hover:opacity-100 transition-opacity bg-white/70 dark:bg-white/10 border border-glass shadow-sm rounded-lg p-1.5"
                      title="Remove line"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Pre-block Add */}
                <button 
                  onClick={() => addBlock(line.id, true)} 
                  className="px-4 text-text-muted hover:text-orange-600 transition-all flex items-center justify-center shrink-0 border-r border-glass hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  title="Add block"
                >
                  <Plus size={16} />
                </button>

                {/* Scrollable Blocks Grid */}
                <div className="flex-1 overflow-x-auto py-6 px-4 flex items-center">
                  <div className="flex flex-nowrap gap-x-2">
                    {line.blocks.map((block) => (
                      <React.Fragment key={block.id}>
                        <div className="flex items-center group/block shrink-0 bg-black/[0.02] dark:bg-white/[0.02] border border-glass shadow-inner-glass rounded-2xl p-3">
                          <div 
                            onClick={() => toggleStartRepeat(line.id, block.id)}
                            className="flex items-center cursor-pointer hover:text-orange-600 transition-colors mx-2 group/repeat"
                            title="Toggle start repeat"
                          >
                            <span className="text-2xl font-light text-text-secondary group-hover/repeat:text-orange-600">‖</span>
                            {block.startRepeat && (
                              <span className="text-3xl font-bold text-orange-600 dark:text-orange-400 ml-1 leading-none mt-[-4px]">:</span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-3 relative">
                            {block.bars.map((bar, barIdx) => (
                              <React.Fragment key={`${block.id}-${barIdx}`}>
                                <div className="w-28 h-14 bg-white dark:bg-white/10 border border-glass shadow-sm rounded-xl transition-all focus-within:ring-2 focus-within:ring-orange-500/40 focus-within:border-orange-500 shrink-0 overflow-hidden">
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
                                className="p-1.5 bg-white dark:bg-[#1c1c22] border border-glass shadow-sm hover:bg-rose-50 rounded-full text-text-muted hover:text-rose-500 disabled:opacity-30 transition-all"
                                title="Remove block"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                          
                          <div 
                            onClick={() => toggleEndRepeat(line.id, block.id)}
                            className="flex items-center cursor-pointer hover:text-orange-600 transition-colors mx-2 group/repeat"
                            title="Toggle end repeat"
                          >
                            {block.endRepeat && (
                              <span className="text-3xl font-bold text-orange-600 dark:text-orange-400 mr-1 leading-none mt-[-4px]">:</span>
                            )}
                            <span className="text-2xl font-light text-text-secondary group-hover/repeat:text-orange-600">‖</span>
                          </div>
                        </div>
                        
                        {/* Add Bar to block */}
                        <div className="flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity px-2 shrink-0">
                          <button 
                            onClick={() => addBarToBlock(line.id, block.id)}
                            className="p-2 bg-white/80 dark:bg-white/10 border border-glass shadow-sm rounded-xl text-text-muted hover:text-orange-600 hover:bg-white transition-all"
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
                  className="px-4 text-text-muted hover:text-orange-600 transition-all flex items-center justify-center shrink-0 border-l border-glass hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  title="Add block"
                >
                  <Plus size={16} />
                </button>
                
                {/* Right controls: Part name (end) */}
                <div className="w-44 flex flex-col justify-center p-5 shrink-0 bg-black/[0.02] dark:bg-white/[0.02] rounded-r-[24px] border-l border-glass">
                  <div className="flex items-center">
                    <input 
                      value={line.labelRight || ''}
                      onChange={e => updateLineLabelRight(line.id, e.target.value)}
                      placeholder="Section notes"
                      className="bg-white/70 dark:bg-white/[0.06] border border-glass shadow-inner-glass rounded-xl px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/30 w-full transition-all"
                    />
                  </div>
                </div>

                {/* Insert Line Below */}
                <div className="absolute -bottom-4 right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => insertLineAfter(line.id)}
                    className="flex items-center justify-center p-2 bg-white/90 dark:bg-[#1c1c22] border border-glass shadow-md rounded-full text-text-secondary hover:text-orange-600 hover:scale-105 transition-all backdrop-blur-sm"
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
              className="flex-1 sm:flex-initial flex items-center justify-center px-6 py-3 bg-white/80 dark:bg-white/10 border border-black/[0.08] dark:border-white/10 shadow-sm text-text-primary hover:bg-white dark:hover:bg-white/20 rounded-full transition-all text-xs font-bold tracking-wider uppercase active:scale-95"
            >
              <Plus size={15} className="mr-1.5 text-orange-500 stroke-[2.5]" /> Add Line
            </button>
            
            <button 
              onClick={copyAsText}
              className="flex-1 sm:flex-initial px-7 py-3 bg-gradient-to-b from-[#3a3a40] to-[#1c1c1e] text-white shadow-lg hover:brightness-110 rounded-full transition-all text-xs font-bold tracking-wider uppercase active:scale-95"
            >
              {copied ? 'Copied!' : 'Copy Text'}
            </button>
            
            <button 
              onClick={clearAll}
              className="px-6 py-3 bg-white/80 dark:bg-white/10 border border-rose-200/70 dark:border-rose-500/20 shadow-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full transition-all text-xs font-bold tracking-wider uppercase active:scale-95"
            >
              Clear All
            </button>
          </div>

          {/* Transpose Controls */}
          <div className="border-t border-black/[0.06] dark:border-white/[0.08] pt-6 sm:pt-8 flex flex-wrap items-center gap-3 sm:gap-6 justify-center">
            <span className="text-xs sm:text-sm font-bold tracking-wider text-text-secondary uppercase">Transpose</span>
            
            <div className="flex items-center space-x-2 bg-white/80 dark:bg-white/10 border border-glass shadow-inner-glass rounded-full px-2 py-1 sm:py-1.5">
              <button onClick={() => handleTranspose(-1)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white dark:bg-white/10 border border-glass shadow-sm rounded-full text-text-primary hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all text-base sm:text-lg font-bold active:scale-95">−</button>
              <span className="font-bold text-orange-600 dark:text-orange-400 min-w-[100px] sm:min-w-[110px] text-center text-xs sm:text-sm font-mono">
                {chart.semitone_offset === 0 ? 'Concert pitch' : `${chart.semitone_offset > 0 ? '+' : ''}${chart.semitone_offset} semitones`}
              </span>
              <button onClick={() => handleTranspose(1)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white dark:bg-white/10 border border-glass shadow-sm rounded-full text-text-primary hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all text-base sm:text-lg font-bold active:scale-95">+</button>
            </div>
            
            {chart.semitone_offset !== 0 && (
              <button onClick={handleResetTranspose} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-orange-600 bg-white/80 dark:bg-white/10 border border-glass shadow-sm rounded-full transition-all active:scale-95">
                Reset
              </button>
            )}

            <button 
              onClick={toggleSpelling} 
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all border shadow-sm ${chart.prefer_flats ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' : 'bg-white/80 dark:bg-white/10 border-glass text-text-secondary hover:text-text-primary'}`}
            >
              Spelling: {chart.prefer_flats ? '♭' : '♯'}
            </button>
            
            {/* Network Sync Status */}
            <div className="ml-0 sm:ml-auto flex items-center space-x-3 sm:space-x-4 mt-2 sm:mt-0">
              {collaborators.length > 0 && (
                <div className="flex -space-x-2">
                  {collaborators.map((email, idx) => (
                    <div key={idx} className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-orange-500/15 border border-orange-500/30 shadow-inner flex items-center justify-center text-[10px] sm:text-xs font-bold text-orange-600" title={`${email} is editing`}>
                      {email.charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center text-[10px] sm:text-xs font-bold tracking-wider uppercase bg-white/80 dark:bg-white/10 border border-glass shadow-sm rounded-full px-3.5 py-1.5">
                {saveStatus === 'saving' && <><RefreshCw size={13} className="mr-1.5 text-text-secondary animate-spin" /> <span className="text-text-secondary">Saving…</span></>}
                {saveStatus === 'saved' && <><Cloud size={13} className="mr-1.5 text-orange-600 dark:text-orange-400" /> <span className="text-orange-600 dark:text-orange-400">Saved</span></>}
                {saveStatus === 'offline' && <><CloudOff size={13} className="mr-1.5 text-red-500" /> <span className="text-red-500">Offline</span></>}
              </div>
            </div>
          </div>

          {/* Text Editor */}
          <div className="border-t border-black/[0.06] dark:border-white/[0.08] pt-8 sm:pt-12 mb-8 sm:mb-12">
            <label className="block text-[10px] sm:text-xs font-bold tracking-widest text-text-secondary uppercase mb-3 text-center">Text Editor &amp; Preview</label>
            <textarea 
              className="w-full h-48 sm:h-64 bg-white/70 dark:bg-black/30 border border-glass shadow-inner-glass rounded-[24px] sm:rounded-[28px] p-4 sm:p-8 font-mono text-xs sm:text-[14px] text-text-primary font-medium whitespace-pre-wrap resize-y focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all leading-relaxed"
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
                  const { lines: newLines, header } = parseTextToLines(newText);
                  updateChart({
                    lines: newLines,
                    custom_text: null,
                    ...(header?.title ? { title: header.title } : {}),
                    ...(header?.time_sig ? { time_sig: header.time_sig } : {}),
                    ...(header?.tempo ? { tempo: header.tempo } : {}),
                  });
                } catch (err) {}
              }}
              spellCheck={false}
            />
          </div>

        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE CHORD KEYPAD (BOTTOM SHEET - NO DARKENING OVERLAY)
          ═══════════════════════════════════════════════════════════════ */}
      {activeMobileSelection && (
        <div className="fixed left-0 right-0 bottom-0 bg-surface-glass backdrop-blur-2xl border-t border-glass rounded-t-[24px] p-3.5 pb-[max(16px,env(safe-area-inset-bottom))] z-50 shadow-glass-strong md:hidden max-w-lg mx-auto animate-slide-up">
          
          {/* Drawer Top Controls */}
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary">
              <span className="bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2.5 py-0.5 rounded-full text-[11px] border border-orange-500/20">
                {activeLine?.label || 'Section'}
              </span>
              <span>Bar {(activeMobileSelection.barIndex || 0) + 1} of {activeBlock?.bars.length || 1}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8); stepMobileBar(-1); }}
                className="px-3 py-1.5 bg-white/70 dark:bg-white/10 border border-glass text-text-primary rounded-full text-xs font-bold flex items-center gap-0.5 active:scale-95 transition-all shadow-sm"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                onClick={handleNextBarClick}
                className="px-3 py-1.5 bg-white/70 dark:bg-white/10 border border-glass text-text-primary rounded-full text-xs font-bold flex items-center gap-0.5 active:scale-95 transition-all shadow-sm"
                title="Next Bar (Double tap to add new line)"
              >
                Next <ChevronRight size={13} />
              </button>
              <button
                onClick={() => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(20); setActiveMobileSelection(null); }}
                className="px-3.5 py-1.5 bg-btn-dark text-white rounded-full text-xs font-bold flex items-center gap-1 active:scale-95 shadow-btn-dark transition-all"
              >
                <Check size={13} /> Done
              </button>
            </div>
          </div>

          {/* Realtime Chord Display & Mode Toggle (Peach Voicing Banner #ffedd5) */}
          <div className="bg-[#ffedd5] dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-500/20 rounded-2xl px-3.5 py-2 flex items-center justify-between mb-2.5 min-h-[46px] gap-2 shadow-sm">
            {isNativeKeyboard ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  ref={nativeInputRef}
                  autoFocus
                  value={activeChordVal}
                  onChange={(e) => updateBar(
                    activeMobileSelection.lineId,
                    activeMobileSelection.blockId,
                    activeMobileSelection.barIndex,
                    e.target.value
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleNextBarClick();
                    }
                  }}
                  placeholder="Type chord (e.g. Cm7, G/B)..."
                  className="w-full bg-transparent text-[#9a3412] dark:text-orange-200 font-mono font-bold text-lg focus:outline-none placeholder:text-orange-900/40"
                />
              </div>
            ) : (
              <div className="font-sans text-xl font-extrabold text-[#9a3412] dark:text-orange-300 flex items-baseline tracking-tight flex-1">
                <span>{activeChordVal ? parseChord(activeChordVal) : '-'}</span>
                <span className="w-1.5 h-5 bg-orange-500 rounded-full ml-1 inline-block animate-pulse self-center" />
                {isSlashBassMode && (
                  <span className="ml-2 text-xs font-sans font-bold text-orange-700 bg-orange-200/60 px-2 py-0.5 rounded-full">
                    Pick Bass Note ↓
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setIsNativeKeyboard(!isNativeKeyboard);
                  showToast(isNativeKeyboard ? 'Musical Keypad' : 'Phone Keyboard');
                }}
                className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors ${
                  isNativeKeyboard 
                    ? 'bg-orange-500/20 border-orange-500 text-orange-700 dark:text-orange-300' 
                    : 'bg-white/80 dark:bg-white/10 border-orange-300/40 text-orange-800 dark:text-orange-200'
                }`}
                title={isNativeKeyboard ? 'Switch to Musical Keypad' : 'Switch to Phone Keyboard'}
              >
                {isNativeKeyboard ? <Music size={14} /> : <Keyboard size={14} />}
              </button>
              <div className="text-[11px] font-mono font-bold text-orange-800 dark:text-orange-300 bg-white/70 dark:bg-white/10 border border-orange-300/40 px-2.5 py-1 rounded-full">
                {activeChordVoicing?.formattedNotes || (activeChordVal ? 'Notation' : 'Empty bar')}
              </div>
            </div>
          </div>

          {/* Keypad View (Shown when not in native text mode) */}
          {!isNativeKeyboard && (
            <>
              {/* Row 1: Root Note Keys (Highlights in slash mode) */}
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((root) => (
                  <button
                    key={root}
                    onClick={() => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10); handleKeypadPress(root); }}
                    className={`h-10 rounded-[14px] font-sans text-sm font-extrabold flex items-center justify-center active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all ${
                      isSlashBassMode 
                        ? 'bg-orange-500/20 border-orange-500 text-orange-600 ring-2 ring-orange-400 animate-pulse' 
                        : 'bg-white dark:bg-white/10 border border-glass text-text-primary hover:bg-orange-50'
                    }`}
                  >
                    {root}
                  </button>
                ))}
              </div>

              {/* Row 2: Qualities 1 */}
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {['♯', '♭', 'm', '7', 'maj7', 'sus4', 'dim'].map((q) => {
                  const isAcc = q === '♯' || q === '♭';
                  return (
                    <button
                      key={q}
                      onClick={() => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10); handleKeypadPress(q); }}
                      className={`h-9 bg-white/80 dark:bg-white/10 border border-glass rounded-[14px] font-mono text-xs font-bold flex items-center justify-center active:scale-95 transition-transform shadow-sm ${isAcc ? 'text-orange-600 dark:text-orange-400 text-sm font-extrabold' : 'text-text-primary'}`}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>

              {/* Row 3: Qualities 2 & Bass */}
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {['aug', '9', '6', 'sus2', 'add9', '/', '%'].map((q) => {
                  const isSlash = q === '/';
                  return (
                    <button
                      key={q}
                      onClick={() => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10); handleKeypadPress(q); }}
                      className={`h-9 border rounded-[14px] font-mono text-xs font-bold flex items-center justify-center active:scale-95 transition-transform shadow-sm ${
                        isSlash 
                          ? 'bg-orange-500/20 border-orange-400 text-orange-600 dark:text-orange-400 font-extrabold' 
                          : 'bg-white/80 dark:bg-white/10 border-glass text-text-secondary'
                      }`}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>

              {/* Row 4: Navigation, Editing & Auto-Advance */}
              <div className="grid grid-cols-5 gap-1.5">
                <button
                  onClick={() => setIsNativeKeyboard(true)}
                  className="h-9 bg-white/80 dark:bg-white/10 border border-glass text-text-secondary rounded-[14px] text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-sm"
                  title="Switch to Keyboard"
                >
                  <Keyboard size={13} /> Text
                </button>
                <button
                  onClick={() => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(15); handleKeypadBackspace(); }}
                  className="h-9 bg-white/80 dark:bg-white/10 border border-glass text-text-secondary rounded-[14px] text-xs font-black flex items-center justify-center active:scale-95 transition-transform shadow-sm"
                  title="Backspace"
                >
                  ⌫
                </button>
                <button
                  onClick={() => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10); handleKeypadInsertBar(); }}
                  className="h-9 bg-white/80 dark:bg-white/10 border border-glass text-text-secondary rounded-[14px] text-xs font-bold flex items-center justify-center active:scale-95 transition-transform shadow-sm"
                >
                  + Bar
                </button>
                <button
                  onClick={() => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(15); handleKeypadDeleteBar(); }}
                  className="h-9 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-[14px] text-xs font-bold flex items-center justify-center active:scale-95 transition-transform shadow-sm"
                >
                  Delete
                </button>
                <button
                  onClick={handleNextBarClick}
                  className="h-9 bg-btn-dark text-white rounded-full text-xs font-bold flex items-center justify-center active:scale-95 shadow-btn-dark transition-transform"
                  title="Next measure (Double-tap to create new line)"
                >
                  Next Bar ›
                </button>
              </div>
            </>
          )}

          {/* Native Keyboard Quick Actions */}
          {isNativeKeyboard && (
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              <button
                onClick={() => setIsNativeKeyboard(false)}
                className="h-9 bg-white/80 dark:bg-white/10 border border-glass text-orange-600 dark:text-orange-400 rounded-[14px] text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-sm"
              >
                <Music size={13} /> Keypad
              </button>
              <button
                onClick={handleKeypadInsertBar}
                className="h-9 bg-white/80 dark:bg-white/10 border border-glass text-text-secondary rounded-[14px] text-xs font-bold flex items-center justify-center active:scale-95 transition-transform shadow-sm"
              >
                + Bar
              </button>
              <button
                onClick={handleKeypadDeleteBar}
                className="h-9 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-[14px] text-xs font-bold flex items-center justify-center active:scale-95 transition-transform shadow-sm"
              >
                Delete
              </button>
              <button
                onClick={handleNextBarClick}
                className="h-9 bg-btn-dark text-white rounded-full text-xs font-bold flex items-center justify-center active:scale-95 shadow-btn-dark transition-transform"
                title="Next measure (Double-tap to create new line)"
              >
                Next Bar ›
              </button>
            </div>
          )}

        </div>
      )}

      {/* Mobile Toast Alert */}
      {mobileToast && (
        <div className="fixed left-1/2 bottom-24 -translate-x-1/2 z-50 bg-white/70 dark:bg-black/60 border border-white/60 dark:border-white/15 text-text-primary dark:text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl saturate-[180%] flex items-center gap-1.5 animate-fade-in pointer-events-none">
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
