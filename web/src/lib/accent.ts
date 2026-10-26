// The archive's one dynamic accent. Pure and browser-safe: the build computes
// the tokens (vibrant.ts, getAlbumAccent), the pages bake them, and the Player
// island only decodes and applies them, so no colour is ever extracted at runtime.
//
// A cover's dominant colour is rarely readable on near-black as it is, so it is
// turned into readable variants of the SAME hue (HSL lightness raised just far
// enough, never mixed toward white):
//   text - band names, links, progress: at least 4.5:1 on the surface;
//   fill - play buttons: at least 3:1 on the surface, its glyph ink from inkOnAccent;
//   glow - the fill, translucent, for the radial glow behind the bar's play button.
//
// On the page they are four custom properties on <html> (ACCENT_VARS): the
// stylesheet's existing chain reads --album-color as --accent (the fill).

import { contrastRatio, inkOnAccent } from './onAccent.js';

/**
 * The lightest archive surface the accent is drawn on: --ma-surface-2 in
 * global.css (controls, chips). The page (#121212) and the bar (#181818) are
 * darker, so a colour that reads here reads there too. A test keeps it in step
 * with global.css.
 */
export const ACCENT_SURFACE = '#1f1f1f';
const TEXT_CONTRAST = 4.5;
const FILL_CONTRAST = 3;
const GLOW_ALPHA = 0.45;

export interface AccentTokens {
  text: string; // #rrggbb
  fill: string; // #rrggbb
  ink: string; // #rrggbb, the glyph colour on the fill
  glow: string; // rgba() of the fill
}

// ─── colour maths ────────────────────────────────────────────────────────────
const HEX = /^#[0-9a-f]{6}$/i;

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: ((h * 60) + 360) % 360, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor(h / 60) % 6;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector];
  return toHex(r + m, g + m, b + m);
}

/**
 * `color` when it already reaches `min`:1 on `surface`; otherwise the same hue and
 * saturation with the LOWEST lightness that reaches it. Luminance only grows with
 * HSL lightness, so a binary search finds that edge; every candidate is checked
 * after rounding to hex, so the returned value itself passes.
 */
function lift(color: string, surface: string, min: number): string {
  if (contrastRatio(color, surface) >= min) return color;
  const { h, s, l } = hexToHsl(color);
  let lo = l;
  let hi = 1; // white: 16:1 on any archive surface
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(hslToHex(h, s, mid), surface) >= min) hi = mid;
    else lo = mid;
  }
  return hslToHex(h, s, hi);
}

function glowOf(fill: string): string {
  const [r, g, b] = rgb(fill);
  return `rgba(${r}, ${g}, ${b}, ${GLOW_ALPHA})`;
}

// ─── the tokens ──────────────────────────────────────────────────────────────

/** The readable accent for a cover's dominant colour; null when it is not a #rrggbb colour. */
export function readableAccent(color: string, surface: string = ACCENT_SURFACE): AccentTokens | null {
  if (!HEX.test(color)) return null;
  const c = color.toLowerCase();
  const fill = lift(c, surface, FILL_CONTRAST);
  return { text: lift(c, surface, TEXT_CONTRAST), fill, ink: inkOnAccent(fill), glow: glowOf(fill) };
}

/**
 * Which accent the archive shows:
 *   1. the album in the player (playing or paused), on every page;
 *   2. else the page's own album colour (album, band and genre pages);
 *   3. else null: no inline accent, so the stylesheet's amber fallback applies,
 *      the same one shown before anything has played.
 */
export function resolveAccent(playing: AccentTokens | null, page: AccentTokens | null): AccentTokens | null {
  return playing ?? page ?? null;
}

// ─── carrying the tokens: data-accent attributes and <html> custom properties ─

/** "text fill ink" for a data-accent attribute (the glow is rebuilt from the fill). */
export function encodeAccent(t: AccentTokens): string {
  return `${t.text} ${t.fill} ${t.ink}`;
}

export function decodeAccent(value: string | null | undefined): AccentTokens | null {
  const parts = (value || '').trim().split(/\s+/);
  if (parts.length !== 3 || !parts.every((p) => HEX.test(p))) return null;
  const [text, fill, ink] = parts;
  return { text, fill, ink, glow: glowOf(fill) };
}

/** The custom properties the accent sets on <html>; global.css and AccentTheme.astro read them. */
export const ACCENT_VARS = ['--album-color', '--accent-bright', '--on-accent', '--accent-glow'] as const;

export function accentDeclarations(t: AccentTokens): Record<(typeof ACCENT_VARS)[number], string> {
  return { '--album-color': t.fill, '--accent-bright': t.text, '--on-accent': t.ink, '--accent-glow': t.glow };
}

/**
 * The attributes an album, band or genre page puts on <html>: the style paints
 * the first frame, data-accent tells the Player what to restore when it closes.
 * No colour, no attributes: the stylesheet's amber applies.
 */
export function accentHtmlAttrs(t: AccentTokens | null): Record<string, string> {
  if (!t) return {};
  const style = Object.entries(accentDeclarations(t))
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  return { 'data-accent': encodeAccent(t), style };
}
