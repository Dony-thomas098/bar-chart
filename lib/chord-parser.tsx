import React from 'react';

const SUPER_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼',
  '(': '⁽', ')': '⁾',
  '#': '♯', '♯': '♯',
  'b': '♭', '♭': '♭',
  '°': '°', 'ø': 'ø', 'Δ': 'Δ',
  'a': 'ᵃ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ',
  'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ',
  'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ',
  'T': 'ᵀ', 'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ',
};

function formatExt(str: string): string {
  return str
    .replace(/#/g, '♯')
    .replace(/b(?=[0-9])/g, '♭')
    .replace(/b(?=\))/g, '♭');
}

function toSuperscript(str: string): string {
  const formatted = formatExt(str);
  return formatted.split('').map(c => SUPER_MAP[c] || c).join('');
}

export function normalizeChordInput(raw: string): string {
  if (!raw || raw === '_' || raw === '%' || raw === '.') return raw;
  
  return raw
    .replace(/^([A-G])#/i, '$1♯')
    .replace(/^([A-G])b/i, '$1♭')
    .replace(/\/([A-G])#/i, '/$1♯')
    .replace(/\/([A-G])b/i, '/$1♭')
    .replace(/maj7/gi, 'Δ7')
    .replace(/major7/gi, 'Δ7')
    .replace(/maj9/gi, 'Δ9')
    .replace(/maj11/gi, 'Δ11')
    .replace(/maj13/gi, 'Δ13')
    .replace(/m7b5/gi, 'ø7')
    .replace(/m7♭5/gi, 'ø7')
    .replace(/min7b5/gi, 'ø7')
    .replace(/dim7/gi, '°7')
    .replace(/dim/gi, '°')
    .replace(/aug7/gi, '+7')
    .replace(/aug/gi, '+')
    .replace(/b(?=[0-9])/g, '♭')
    .replace(/#(?=[0-9])/g, '♯');
}

function parseSingleChord(raw: string): React.ReactNode {
  if (!raw || raw === '_' || raw === '%' || raw === '.') {
    return <span>{raw}</span>;
  }

  const match = raw.match(/^([A-G])([#b♯♭])?(.*)$/);
  if (!match) {
    return <span>{raw}</span>;
  }
  
  const [, root, accidental, rest] = match;
  const accChar = accidental === '#' || accidental === '♯' ? '♯' : accidental === 'b' || accidental === '♭' ? '♭' : '';

  let superCluster = accChar;

  if (rest) {
    let formattedRest = rest;
    if (rest.startsWith('sus')) {
      formattedRest = 'sus' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('add')) {
      formattedRest = 'add' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('m') && !rest.startsWith('maj') && !rest.startsWith('min')) {
      formattedRest = 'm' + toSuperscript(rest.slice(1));
    } else if (rest.startsWith('maj')) {
      formattedRest = 'Δ' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('min')) {
      formattedRest = 'm' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('dim')) {
      formattedRest = '°' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('aug')) {
      formattedRest = '+' + toSuperscript(rest.slice(3));
    } else {
      formattedRest = toSuperscript(rest);
    }
    superCluster += formattedRest;
  }

  return (
    <span className="inline-flex items-baseline select-none" style={{ verticalAlign: 'baseline' }}>
      <span className="font-bold">{root}</span>
      {superCluster && (
        <sup style={{ fontSize: '0.65em', verticalAlign: 'super', fontWeight: 800, marginLeft: '1px', lineHeight: 1 }}>
          {superCluster}
        </sup>
      )}
    </span>
  );
}

export function parseChord(raw: string): React.ReactNode {
  if (!raw || raw.trim() === '') return null;
  
  if (raw === '_' || raw === '%' || raw === '.') {
    return <span>{raw}</span>;
  }

  // If it doesn't start with A-G, just return it
  if (!/^[A-G]/.test(raw)) {
    return <span>{raw}</span>;
  }
  
  const parts = raw.split('/');
  const nodes: React.ReactNode[] = [];
  
  nodes.push(<React.Fragment key="main">{parseSingleChord(parts[0])}</React.Fragment>);
  
  for (let i = 1; i < parts.length; i++) {
    nodes.push(<span key={`slash-${i}`} className="opacity-70 mx-0.5">/</span>);
    nodes.push(<React.Fragment key={`bass-${i}`}>{parseSingleChord(parts[i])}</React.Fragment>);
  }
  
  return <>{nodes}</>;
}

export function parseSingleChordToText(raw: string): string {
  if (!raw || raw === '_' || raw === '%' || raw === '.') {
    return raw;
  }

  const normalized = normalizeChordInput(raw);
  const match = normalized.match(/^([A-G])([#b♯♭])?(.*)$/);
  if (!match) {
    return normalized;
  }
  
  const [, root, accidental, rest] = match;
  const accChar = accidental === '#' || accidental === '♯' ? '♯' : accidental === 'b' || accidental === '♭' ? '♭' : '';
  
  let superCluster = accChar;
  if (rest) {
    if (rest.startsWith('m') && !rest.startsWith('maj') && !rest.startsWith('min')) {
      superCluster += 'm' + toSuperscript(rest.slice(1));
    } else if (rest.startsWith('maj')) {
      superCluster += 'Δ' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('min')) {
      superCluster += 'm' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('sus')) {
      superCluster += 'sus' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('dim')) {
      superCluster += '°' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('aug')) {
      superCluster += '+' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('add')) {
      superCluster += 'add' + toSuperscript(rest.slice(3));
    } else {
      superCluster += toSuperscript(rest);
    }
  }
  
  return root + superCluster;
}

export function parseChordToText(raw: string): string {
  if (!raw || raw.trim() === '') return '';
  
  if (raw === '_' || raw === '%' || raw === '.') {
    return raw;
  }

  if (!/^[A-G]/.test(raw)) {
    return raw;
  }
  
  const parts = raw.split('/');
  let text = parseSingleChordToText(parts[0]);
  
  for (let i = 1; i < parts.length; i++) {
    text += '/' + parseSingleChordToText(parts[i]);
  }
  
  return text;
}


