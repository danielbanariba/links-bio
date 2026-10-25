// Which ink to draw on top of an album's accent colour (the play glyphs and the
// bar's toggle). The page bakes --album-color on <html>; this picks the matching
// --on-accent. Dark ink on a dark accent was 2.4:1 for 471 of 2753 covers.

export const DARK_INK = '#100b06'; // same value as the --on-accent default in global.css
export const WHITE_INK = '#ffffff';

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

// WCAG relative luminance. Null when the value is not a #rrggbb colour.
function luminance(hex: string): number | null {
  const m = HEX.exec(hex);
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast ratio between two #rrggbb colours (1 when either is invalid).
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 1;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// The ink with the higher contrast on `accent`. A tie, which includes a value that
// is not a colour (both ratios are 1), keeps the dark ink.
export function inkOnAccent(accent: string): string {
  return contrastRatio(WHITE_INK, accent) > contrastRatio(DARK_INK, accent) ? WHITE_INK : DARK_INK;
}
