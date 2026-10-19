"use client";

import { useId } from "react";
import type { CSSProperties } from "react";
import styles from "./ChordlyLogo.module.css";

type CSSVars = CSSProperties & Record<string, string | number>;

export type ChordlyLogoProps = {
  /** "full" = icon + name side by side, "stacked" = icon above name, "icon" = app icon only */
  variant?: "full" | "stacked" | "icon";
  /** Plays the intro animation, then a gentle idle ripple. Off by default (static logo). */
  animate?: boolean;
  className?: string;
};

export function ChordlyLogo({ variant = "full", animate = false, className = "" }: ChordlyLogoProps) {
  // Unique gradient ids per instance, so several logos (or hidden ones) never clash.
  const uid = useId().replace(/:/g, "");

  const defs = (
    <defs>
      <linearGradient id={`k-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a4547" />
        <stop offset="1" stopColor="#1f1b1c" />
      </linearGradient>
      <radialGradient id={`h-${uid}`} cx=".85" cy=".05" r=".75">
        <stop offset="0" stopColor="#fd944e" stopOpacity=".35" />
        <stop offset="1" stopColor="#fd944e" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`t-${uid}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fd944e" />
        <stop offset="1" stopColor="#dc4928" />
      </linearGradient>
    </defs>
  );

  const icon = (
    <>
      <rect className={styles.tile} x="32" y="32" width="448" height="448" rx="104" fill={`url(#k-${uid})`} />
      <rect className={styles.tile} x="32" y="32" width="448" height="448" rx="104" fill={`url(#h-${uid})`} />
      <path className={styles.arc} pathLength={1} style={{ "--i": 0 } as CSSVars} d="M316.5 211.9 A56 56 0 1 0 316.5 300.1" fill="none" stroke="#ffd7b8" strokeWidth={15} strokeLinecap="round" />
      <path className={styles.arc} pathLength={1} style={{ "--i": 1 } as CSSVars} d="M333.7 189.8 A84 84 0 1 0 333.7 322.2" fill="none" stroke="#fd944e" strokeWidth={15} strokeLinecap="round" />
      <path className={styles.arc} pathLength={1} style={{ "--i": 2 } as CSSVars} d="M351.0 167.7 A112 112 0 1 0 351.0 344.3" fill="none" stroke="#e8643a" strokeWidth={15} strokeLinecap="round" />
      <path className={styles.arc} pathLength={1} style={{ "--i": 3 } as CSSVars} d="M368.2 145.7 A140 140 0 1 0 368.2 366.3" fill="none" stroke="#dc4928" strokeWidth={15} strokeLinecap="round" />
      <circle className={styles.dot} cx="282" cy="256" r="22" fill="#fff" />
    </>
  );

  const word = (
    <>
      <g className={styles.letter} style={{ "--i": 0 } as CSSVars}><path transform="translate(300.0 202.4) scale(0.24000 -0.24000)" d="M313 554Q414 554 479.5 504.0Q545 454 564 368H489Q475 427 428.5 460.5Q382 494 313 494Q258 494 214.0 469.0Q170 444 144.5 394.5Q119 345 119 273Q119 201 144.5 151.0Q170 101 214.0 76.0Q258 51 313 51Q382 51 428.5 84.5Q475 118 489 178H564Q545 94 479.0 43.0Q413 -8 313 -8Q236 -8 176.0 26.5Q116 61 82.0 124.5Q48 188 48 273Q48 358 82.0 421.5Q116 485 176.0 519.5Q236 554 313 554Z" className={styles.wm} /></g>
      <g className={styles.letter} style={{ "--i": 1 } as CSSVars}><path transform="translate(444.7 202.4) scale(0.24000 -0.24000)" d="M558 320V0H489V312Q489 401 444.5 448.0Q400 495 323 495Q244 495 197.0 445.0Q150 395 150 298V0H80V740H150V453Q176 502 226.5 529.0Q277 556 340 556Q402 556 451.5 530.0Q501 504 529.5 450.5Q558 397 558 320Z" className={styles.wm} /></g>
      <g className={styles.letter} style={{ "--i": 2 } as CSSVars}><path transform="translate(594.2 202.4) scale(0.24000 -0.24000)" d="M48 273Q48 358 84.0 421.5Q120 485 182.0 519.5Q244 554 321 554Q398 554 460.5 519.5Q523 485 558.5 421.5Q594 358 594 273Q594 189 558.0 125.0Q522 61 459.0 26.5Q396 -8 319 -8Q242 -8 180.5 26.5Q119 61 83.5 124.5Q48 188 48 273ZM522 273Q522 345 494.0 394.5Q466 444 420.0 468.5Q374 493 320 493Q266 493 220.0 468.5Q174 444 146.5 394.5Q119 345 119 273Q119 201 146.5 151.5Q174 102 219.5 77.5Q265 53 319 53Q373 53 419.0 77.5Q465 102 493.5 151.5Q522 201 522 273Z" className={styles.wm} /></g>
      <g className={styles.letter} style={{ "--i": 3 } as CSSVars}><path transform="translate(745.9 202.4) scale(0.24000 -0.24000)" d="M337 556V483H318Q242 483 196.0 442.0Q150 401 150 305V0H80V546H150V449Q173 500 220.5 528.0Q268 556 337 556Z" className={styles.wm} /></g>
      <g className={styles.letter} style={{ "--i": 4 } as CSSVars}><path transform="translate(830.4 202.4) scale(0.24000 -0.24000)" d="M310 554Q382 554 440.0 519.0Q498 484 525 428V740H595V0H525V122Q500 65 443.0 28.5Q386 -8 309 -8Q234 -8 174.5 27.0Q115 62 81.5 126.0Q48 190 48 274Q48 358 82.0 421.5Q116 485 175.5 519.5Q235 554 310 554ZM322 493Q264 493 218.0 467.0Q172 441 145.5 391.5Q119 342 119 274Q119 207 145.5 156.5Q172 106 218.0 79.5Q264 53 322 53Q378 53 424.5 80.0Q471 107 498.0 157.0Q525 207 525 273Q525 339 498.0 389.0Q471 439 424.5 466.0Q378 493 322 493Z" className={styles.wm} /></g>
      <g className={styles.letter} style={{ "--i": 5 } as CSSVars}><path transform="translate(994.8 202.4) scale(0.24000 -0.24000)" d="M233 740V0H62V740Z" fill={`url(#t-${uid})`} /></g>
      <g className={styles.letter} style={{ "--i": 6 } as CSSVars}><path transform="translate(1063.2 202.4) scale(0.24000 -0.24000)" d="M632 558 282 -265H98L226 19L-1 558H190L319 209L447 558Z" fill={`url(#t-${uid})`} /></g>
    </>
  );

  const rootClass = `${styles.root} ${animate ? styles.play : ""} ${className}`.trim();

  if (variant === "icon") {
    return (
      <svg className={rootClass} viewBox="32 32 448 448" role="img" aria-label="Chordly">
        {defs}
        {icon}
      </svg>
    );
  }

  if (variant === "stacked") {
    return (
      <svg className={rootClass} viewBox="280 -262 953 552" role="img" aria-label="Chordly">
        {defs}
        <svg x="626.5" y="-250" width="260" height="260" viewBox="32 32 448 448">
          {icon}
        </svg>
        {word}
      </svg>
    );
  }

  return (
    <svg className={rootClass} viewBox="0 0 1239 302" role="img" aria-label="Chordly">
      {defs}
      <svg x="24" y="24" width="232" height="232" viewBox="32 32 448 448">
        {icon}
      </svg>
      {word}
    </svg>
  );
}

export default ChordlyLogo;
