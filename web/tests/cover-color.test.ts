// The colour an album's cover gives its accent (lib/coverColor.ts). A metal cover
// is mostly black or grey with one strong colour in it, and that colour is what
// the accent must carry, the way node-vibrant picked it: the most VIVID colour,
// not the most frequent one. Each test names the defect it guards against.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { dominantColor } from '../src/lib/coverColor.ts';

type Rgb = [number, number, number];

/** A 200px square cover: a near-black field with one coloured emblem covering a quarter of it. */
async function emblemCover([r, g, b]: Rgb): Promise<Buffer> {
  const emblem = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
  return sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 28, g: 28, b: 30 } } })
    .composite([{ input: emblem, left: 50, top: 50 }])
    .webp({ lossless: true })
    .toBuffer();
}

/** HSL hue (degrees) and saturation (0..1) of a #rrggbb colour. */
function hueSat(hex: string): { h: number; s: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s };
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const EMBLEMS: Array<{ name: string; rgb: Rgb }> = [
  { name: 'red', rgb: [200, 30, 30] },
  { name: 'green', rgb: [40, 170, 60] },
  { name: 'blue', rgb: [40, 80, 210] },
];

test('a dark cover with one strong colour gives that colour, not the dark field', async () => {
  // Defect: picking the most frequent colour (sharp's stats().dominant), so nearly
  // every album, black or grey around its art, gets a grey accent.
  for (const { name, rgb } of EMBLEMS) {
    const hex = await dominantColor(await emblemCover(rgb));
    assert.ok(hex, `${name}: no colour extracted`);
    assert.match(hex, /^#[0-9a-f]{6}$/);
    const got = hueSat(hex);
    const want = hueSat(`#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`);
    assert.ok(hueDistance(got.h, want.h) <= 12, `${name}: hue ${got.h.toFixed(0)} instead of ${want.h.toFixed(0)} (${hex})`);
    assert.ok(got.s >= 0.35, `${name}: saturation ${got.s.toFixed(2)} is not vivid (${hex})`);
  }
});

test('a square crop read from disk gives the same colour as its bytes', async () => {
  // Defect: only handling a Buffer, while the build passes the crop's file path
  // (public/covers/<videoId>.webp), so every crop falls back to the video frame.
  const bytes = await emblemCover([200, 30, 30]);
  const dir = mkdtempSync(join(tmpdir(), 'cover-color-'));
  try {
    const file = join(dir, 'crop.webp');
    writeFileSync(file, bytes);
    assert.equal(await dominantColor(file), await dominantColor(bytes));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bytes that are not an image give no colour, so the failure is never cached', async () => {
  // Defect: throwing (which fails the page build) or inventing a colour (which
  // .vibrant-cache.json would then keep forever) for an undecodable cover.
  assert.equal(await dominantColor(Buffer.from('<html>not an image</html>')), null);
});
