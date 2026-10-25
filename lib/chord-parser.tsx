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
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'm', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ',
  'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ',
  'M': 'M', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ',
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

  if (raw.includes(' ')) {
    return raw
      .split(' ')
      .map(part => normalizeChordInput(part))
      .join(' ');
  }

  return raw
    .replace(/^([a-g])([#b♯♭]?)/i, (_, r, acc) => {
      const rootUpper = r.toUpperCase();
      const accChar = acc === '#' || acc === '♯' ? '♯' : acc === 'b' || acc === '♭' ? '♭' : '';
      return rootUpper + accChar;
    })
    .replace(/\/([a-g])([#b♯♭]?)/i, (_, r, acc) => {
      const rootUpper = r.toUpperCase();
      const accChar = acc === '#' || acc === '♯' ? '♯' : acc === 'b' || acc === '♭' ? '♭' : '';
      return '/' + rootUpper + accChar;
    })
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

const UN_SUPER_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '⁼': '=',
  '⁽': '(', '⁾': ')',
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

function unSuperscript(str: string): string {
  return str.split('').map(c => UN_SUPER_MAP[c] || c).join('');
}

function parseSingleChord(raw: string): React.ReactNode {
  if (!raw || raw === '_' || raw === '%' || raw === '.') {
    return <span>{raw}</span>;
  }

  // Convert any existing tiny Unicode superscripts back to standard readable characters
  const clean = unSuperscript(raw);
  const match = clean.match(/^([A-G])([#b♯♭])?(.*)$/);
  if (!match) {
    return <span>{raw}</span>;
  }

  const [, root, accidental, rawRest] = match;
  const accChar = accidental === '#' || accidental === '♯' ? '♯' : accidental === 'b' || accidental === '♭' ? '♭' : '';
  const rootStr = root + accChar;

  let baseQuality = '';
  let superCluster = '';

  const rest = formatExt(rawRest);

  if (rest) {
    if (rest.startsWith('min')) {
      baseQuality = 'm';
      superCluster = rest.slice(3);
    } else if (rest.startsWith('m') && !rest.startsWith('maj')) {
      baseQuality = 'm';
      superCluster = rest.slice(1);
    } else if (rest.startsWith('maj')) {
      superCluster = 'Δ' + rest.slice(3);
    } else if (rest.startsWith('dim')) {
      superCluster = '°' + rest.slice(3);
    } else if (rest.startsWith('aug')) {
      superCluster = '+' + rest.slice(3);
    } else if (rest.startsWith('sus')) {
      superCluster = 'sus' + rest.slice(3);
    } else if (rest.startsWith('add')) {
      superCluster = 'add' + rest.slice(3);
    } else {
      superCluster = rest;
    }
  }

  return (
    <span className="inline-flex items-baseline select-none" style={{ verticalAlign: 'baseline' }}>
      <span className="font-bold">{rootStr}{baseQuality}</span>
      {superCluster ? (
        <sup style={{ fontSize: '0.80em', verticalAlign: '0.35em', fontWeight: 700, marginLeft: '1.5px', lineHeight: 1 }}>
          {superCluster}
        </sup>
      ) : null}
    </span>
  );
}

export function parseChord(raw: string): React.ReactNode {
  if (!raw || raw.trim() === '') return null;

  if (raw === '_' || raw === '%' || raw === '.') {
    return <span>{raw}</span>;
  }

  const trimmed = raw.trim();
  if (trimmed.includes(' ')) {
    const tokens = trimmed.split(/\s+/);
    return (
      <span className="inline-flex items-baseline gap-1.5">
        {tokens.map((tok, i) => (
          <React.Fragment key={i}>{parseChord(tok)}</React.Fragment>
        ))}
      </span>
    );
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
  const rootStr = root + accChar;

  let baseQuality = '';
  let superCluster = '';
  if (rest) {
    if (rest.startsWith('min')) {
      baseQuality = 'm';
      const ext = rest.slice(3);
      superCluster = ext ? toSuperscript(ext) : '';
    } else if (rest.startsWith('m') && !rest.startsWith('maj')) {
      baseQuality = 'm';
      const ext = rest.slice(1);
      superCluster = ext ? toSuperscript(ext) : '';
    } else if (rest.startsWith('maj')) {
      superCluster = 'Δ' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('dim')) {
      superCluster = '°' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('aug')) {
      superCluster = '+' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('sus')) {
      superCluster = 'sus' + toSuperscript(rest.slice(3));
    } else if (rest.startsWith('add')) {
      superCluster = 'add' + toSuperscript(rest.slice(3));
    } else {
      superCluster = toSuperscript(rest);
    }
  }

  return rootStr + baseQuality + superCluster;
}

export function parseChordToText(raw: string): string {
  if (!raw || raw.trim() === '') return '';

  if (raw === '_' || raw === '%' || raw === '.') {
    return raw;
  }

  const trimmed = raw.trim();
  if (trimmed.includes(' ')) {
    return trimmed
      .split(/\s+/)
      .map(tok => parseChordToText(tok))
      .join(' ');
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


