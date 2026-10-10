# ChordCraft — Classical Redesign & Component Architecture Map

This document maps the components in the single-file, zero-dependency classical redesign demo ([index.html](file:///d:/chord-grid/index.html)) to the production Next.js and Tailwind application codebase in `chord-grid`.

---

## 🎨 Visual Direction & Design Tokens

| Token | Classical Paper (Default) | Dark Charcoal (Stage Mode) | Tailwind Equivalent |
|---|---|---|---|
| Background (`--bg`) | `#F3EFE6` (Paper Cream) | `#151411` (Warm Charcoal) | `bg-[#F3EFE6]` / `dark:bg-[#151411]` |
| Surface (`--surface`) | `#FFFDF8` (Vellum) | `#1E1C18` | `bg-[#FFFDF8]` / `dark:bg-[#1E1C18]` |
| Deep Text (`--text`) | `#1D1B17` (Engraver Ink) | `#ECE6D8` | `text-[#1D1B17]` / `dark:text-[#ECE6D8]` |
| Muted Text (`--muted`) | `#6B6455` (Sepia Muted) | `#9E9788` | `text-[#6B6455]` / `dark:text-[#9E9788]` |
| Hairline Border (`--hairline`) | `#CDC4AF` | `#38342D` | `border-[#CDC4AF]` / `dark:border-[#38342D]` |
| Single Accent (`--accent`) | `#7A1F2B` (Burgundy) | `#D98A92` | `bg-[#7A1F2B]` / `text-[#7A1F2B]` |
| Section Colors | `A section:` `#6347A6`, `B section:` `#B87820`, `Coda:` `#9A2834` | Adapted for dark mode | Section theme tokens |

---

## 🗺️ View Page vs Editing Page Structures

### 1. View Page (Chart Reader — Based on 2nd Reference Image)
- **Header**: Centered bold song title (`Autumn Leaves`), time signature (`4/4`), and tempo label on the right (`t=120`).
- **Lead Sheet Staves**:
  - Left label with colon: `A section:` (purple), `B section:` (amber), `Coda:` (burgundy).
  - Authentic double barlines `||` at section starts and ends.
  - Measures separated by single rules `|`, with `||` marking 4-bar blocks.
  - Chords formatted with baseline musical roots and superscript qualities/extensions:
    `A<sup>m7</sup>`, `D<sup>7</sup>`, `G<sup>Δ7</sup>`, `C<sup>Δ7</sup>`, `F#<sup>m7♭5</sup>`, `B<sup>7♭9</sup>`, `E<sup>m7</sup> E♭<sup>7</sup>`, etc.
  - Tapping any bar displays the chord voicing notes tooltip (`Am7 → A · C · E · G`) with a direct shortcut to the editor.

### 2. Editing Page (Chart Editor — Based on 3rd Reference Image)
- **Top Metadata**: Song title, two prominent meta boxes for `TEMPO` (`BPM 120`) and `TIME` (`4/4`).
- **Summary Banner**: Live line and bar counter (`3 LINES • 20 BARS TOTAL`) and tip (`💡 TAP BAR TO OPEN KEYPAD`).
- **Section Cards**:
  - Header: Section name pill, editable `Section notes / lyrics...` input, delete `✕` button.
  - Staves rows: Flanked by `||` on both sides with individual rounded card boxes for each measure, and row delete `✕`.
  - Section actions: `+ 4 Bars` and `+ 2 Bars` per section.
  - Selected bar is highlighted with a distinct active outline.
- **Docked 4-Row Keypad**:
  - Header: Active bar badge (`[B Section] Bar 1 of 4`), `‹ Prev`, `Next ›`, `✓ Done`.
  - Active monitor: Live chord display with cursor (`F#m7b5|`), text input button `⌨`, and notes pill (`F# · A · C · E`).
  - Row 1: `C` `D` `E` `F` `G` `A` `B`
  - Row 2: `♯` `♭` `m` `7` `maj7` `sus4` `dim`
  - Row 3: `aug` `9` `6` `sus2` `add9` `/` `%`
  - Row 4: `⌨ Text`, `⌫`, `+ Bar`, `Delete`, `Next Bar ›` (primary button).

---

## 🗺️ Component Mapping Guide to Production Files

| Demo Component | Production Next.js Codebase File | Porting Details |
|---|---|---|
| **View Page Lead Sheet** | [components/ChartRenderer.tsx](file:///d:/chord-grid/components/ChartRenderer.tsx) | Port `formatChordHtml` helper to render `c-root` and `c-ext` superscripts, section labels, and `||` lead-sheet dividers. |
| **Transpose Stepper** | [lib/transpose.ts](file:///d:/chord-grid/lib/transpose.ts)<br>[components/PiascoreReader.tsx](file:///d:/chord-grid/components/PiascoreReader.tsx) | Transpose multi-chord measures like `"Em7 Eb7"`. |
| **Voicing Tooltip** | [lib/chord-notes.ts](file:///d:/chord-grid/lib/chord-notes.ts) | Shows note breakdown for active chord. |
| **Editing Page Staves & Meta Cards** | [app/chart/[id]/edit/page.tsx](file:///d:/chord-grid/app/chart/%5Bid%5D/edit/page.tsx) | Replace table view with section cards, notes/lyrics inputs, `+ 4 Bars` / `+ 2 Bars`, and 4-bar rows. |
| **Docked 4-Row Mobile Keypad** | [components/ChordInput.tsx](file:///d:/chord-grid/components/ChordInput.tsx) | Implement 4-row touch keypad with chord monitor, cursor, and `Next Bar ›` stepper. |
| **Library & Setlists** | [components/FolderBrowser.tsx](file:///d:/chord-grid/components/FolderBrowser.tsx)<br>[app/setlists/[id]/page.tsx](file:///d:/chord-grid/app/setlists/%5Bid%5D/page.tsx) | Song list with key badges, time signature, and gig setlists. |
