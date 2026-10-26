// The archive's dynamic accent: the readable variants of a cover's colour, which
// accent applies, and the attribute that carries it to the player. Each test
// names the defect a realistic wrong implementation would reintroduce.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ACCENT_SURFACE,
  decodeAccent,
  encodeAccent,
  readableAccent,
  resolveAccent,
  type AccentTokens,
} from '../src/lib/accent.ts';
import { contrastRatio } from '../src/lib/onAccent.ts';

// ─── An independent HSL oracle (not the implementation's) ────────────────────
const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${hex2((r + m) * 255)}${hex2((g + m) * 255)}${hex2((b + m) * 255)}`;
}
function rgbOf(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
function hslOf(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

// Covers' dominant colours across the whole range: every hue, from grey to fully
// saturated, from near-black to near-white, plus the edge cases by name.
const SWEEP: string[] = [
  '#000000', '#050505', '#0a0a0a', '#121212', '#1f1f1f', '#3a3a3a', '#808080', '#f5f5f5', '#ffffff',
  '#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#00ffff', '#ffff00', '#3b0000', '#00003b', '#1a0505',
];
for (let h = 0; h < 360; h += 15) {
  for (const s of [0.15, 0.35, 0.6, 0.85, 1]) {
    for (const l of [0.03, 0.08, 0.15, 0.25, 0.35, 0.5, 0.65, 0.8, 0.95]) SWEEP.push(hslToHex(h, s, l));
  }
}

const tokens = (c: string): AccentTokens => {
  const t = readableAccent(c);
  assert.ok(t, `${c} gave no accent`);
  return t;
};

test('every colour gives a text that reads 4.5:1 and a play fill that reads 3:1 on the archive surface', () => {
  // Defect: the colour as extracted (or today's 72%-white mix for text) is
  // unreadable on near-black: #0000ff mixed that way is 2.8:1, and a dark cover's
  // raw colour as a button fill nearly vanishes into the bar.
  for (const c of SWEEP) {
    const t = tokens(c);
    assert.ok(contrastRatio(t.text, ACCENT_SURFACE) >= 4.5, `${c}: text ${t.text} ${contrastRatio(t.text, ACCENT_SURFACE).toFixed(2)}:1`);
    assert.ok(contrastRatio(t.fill, ACCENT_SURFACE) >= 3, `${c}: fill ${t.fill} ${contrastRatio(t.fill, ACCENT_SURFACE).toFixed(2)}:1`);
    // The play glyph sits on the fill, so its ink must be read against the FILL,
    // not against the colour the fill was lifted from.
    assert.ok(contrastRatio(t.ink, t.fill) >= 4.4, `${c}: ink ${t.ink} on ${t.fill}`);
  }
});

test('the hue survives: a red cover stays red, a grey cover stays grey', () => {
  // Defect: lifting by mixing toward a tinted colour (the amber fallback, a warm
  // white) or an HSL slip (degrees vs turns, swapped channels) turns a blue cover's
  // band name purple or beige.
  for (const c of SWEEP) {
    const t = tokens(c);
    const src = hslOf(c);
    for (const out of [t.text, t.fill]) {
      if (src.s === 0) {
        const [r, g, b] = rgbOf(out);
        assert.ok(r === g && g === b, `${c} is grey, got ${out}`);
      } else if (src.s >= 0.3 && hslOf(out).s > 0) {
        assert.ok(hueGap(hslOf(out).h, src.h) <= 3, `${c} (hue ${src.h.toFixed(0)}) -> ${out} (hue ${hslOf(out).h.toFixed(0)})`);
      }
    }
  }
});

test('a colour is lifted only as far as it needs: readable colours are kept, dark ones are not pushed to white', () => {
  // Defect: a fixed lift for every colour (today's 72%-white mix, or "lightness
  // 0.85") changes covers that already read and washes reds and blues out to
  // near-white, so every album ends up with the same pale accent.
  for (const c of SWEEP) {
    const t = tokens(c);
    for (const [out, min] of [[t.text, 4.5], [t.fill, 3]] as const) {
      if (contrastRatio(c, ACCENT_SURFACE) >= min) {
        assert.equal(out, c, `${c} already reads ${min}:1 and must be kept`);
        continue;
      }
      const { h, s, l } = hslOf(out);
      const darker = hslToHex(h, s, Math.max(0, l - 0.03));
      assert.ok(contrastRatio(darker, ACCENT_SURFACE) < min, `${c} -> ${out} is lifted further than ${min}:1 needs`);
    }
  }
  // The named cases from the spec: pure red and pure blue keep a strong colour.
  for (const c of ['#ff0000', '#0000ff', '#3b0000']) {
    assert.ok(hslOf(tokens(c).text).l <= 0.75, `${c} -> ${tokens(c).text} is washed out`);
  }
});

test('the glow is the fill, translucent', () => {
  // Defect: a glow taken from the unlifted colour (invisible on dark covers) or an
  // opaque one (a solid disc behind the button instead of a glow).
  for (const c of ['#0000ff', '#3b0000', '#dda15e', '#808080']) {
    const t = tokens(c);
    const m = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(t.glow);
    assert.ok(m, `${c}: glow ${t.glow} is not rgba()`);
    assert.deepEqual([+m[1], +m[2], +m[3]], rgbOf(t.fill), `${c}: glow ${t.glow} is not the fill ${t.fill}`);
    assert.ok(+m[4] > 0 && +m[4] < 1, `${c}: glow alpha ${m[4]}`);
  }
});

test('a value that is not a colour gives no accent instead of broken CSS', () => {
  // Defect: NaN maths writing "#NaNNaNNaN" into a page's style when the colour
  // cache holds something unexpected.
  for (const bad of ['', 'red', '#12', 'rgb(1,2,3)', '#zzzzzz']) assert.equal(readableAccent(bad), null, bad);
});

test('the archive surface the accent is measured against is the one global.css paints', () => {
  // Defect: the archive's surfaces change (T11 restyles them) and the contrast
  // guarantee silently keeps measuring against the old colour.
  const css = readFileSync(resolve(import.meta.dirname, '../src/styles/global.css'), 'utf-8');
  const archive = css.slice(css.indexOf('body:not(.bio-page) {'));
  const token = /--ma-surface-2:\s*(#[0-9a-f]{6})/i.exec(archive);
  assert.ok(token, 'global.css no longer declares --ma-surface-2 in the archive theme');
  assert.equal(ACCENT_SURFACE.toLowerCase(), token[1].toLowerCase());
});

// ─── Which accent applies ─────────────────────────────────────────────────────
const RED = tokens('#c0392b');
const BLUE = tokens('#2c5aa0');

test('the album in the player colours every page, even another album\'s page', () => {
  // Defect: navigating to album B's page while album A plays turns the bar and the
  // controls B's colour, because the page's baked colour wins.
  assert.deepEqual(resolveAccent(RED, BLUE), RED);
  assert.deepEqual(resolveAccent(RED, null), RED);
});

test('with nothing in the player, an album page keeps its own colour', () => {
  // Defect: closing the player on album B's page resets it to the amber fallback.
  assert.deepEqual(resolveAccent(null, BLUE), BLUE);
});

test('with nothing in the player and no page colour, the stylesheet\'s amber applies', () => {
  // Defect: hand-made amber tokens written over the stylesheet's fallback, so the
  // home's links change shade once the player has been closed. null means "no
  // inline accent": the stylesheet's own amber chain, the one shown before any play.
  assert.equal(resolveAccent(null, null), null);
});

test('the accent attribute round-trips and rejects anything else', () => {
  // Defect: the encoder and the decoder disagree on the order, so the player paints
  // the text colour on the play button; or a malformed attribute reaches the style.
  for (const c of ['#0000ff', '#dda15e', '#000000']) {
    const t = tokens(c);
    assert.deepEqual(decodeAccent(encodeAccent(t)), t);
  }
  for (const bad of [undefined, null, '', '#fff', '#112233 #445566', 'red blue green', '#112233 #445566 #778899 #aabbcc']) {
    assert.equal(decodeAccent(bad), null, String(bad));
  }
});
