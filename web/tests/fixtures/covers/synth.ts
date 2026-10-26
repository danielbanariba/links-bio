// Synthetic 1280x720 "YouTube frame" generator for the cover-detector tests.
// No network, no binary fixtures: every frame is built from a seeded PRNG so a
// failure reproduces byte for byte.
//
// A frame mimics the real uploads the detector was designed on:
//   * a stretched, textured copy of the art as the background;
//   * optionally a sharp square "cover" with a crisp border at a known position;
//   * optionally a fake tracklist (left-aligned rows of short bright "words") on
//     the right half, the main lure: it has many long-ish vertical and horizontal
//     edges but no closed square.
import sharp from 'sharp';

export const FRAME_W = 1280;
export const FRAME_H = 720;

export interface SynthCover {
  x: number;
  y: number;
  size: number;
  /** Luminance step of the border ring against the background (default 140). */
  edge?: number;
  /** Amplitude of the cover's own texture (default 60). */
  texture?: number;
}

export interface SynthOptions {
  cover?: SynthCover;
  /** Draw the fake tracklist on the right half (default true). */
  tracklist?: boolean;
  seed?: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** The border ring thickness, in px, drawn on every synthetic cover. */
export const BORDER_PX = 4;

export async function synthFrameRaw(opts: SynthOptions = {}): Promise<Buffer> {
  const rand = mulberry32(opts.seed ?? 7);
  const buf = Buffer.alloc(FRAME_W * FRAME_H * 3);

  // Background: a small random art texture stretched ~27x, plus mild fine noise.
  const small = Buffer.alloc(48 * 27 * 3);
  for (let i = 0; i < small.length; i++) small[i] = 55 + Math.floor(rand() * 80);
  const stretched = await sharp(small, { raw: { width: 48, height: 27, channels: 3 } })
    .resize(FRAME_W, FRAME_H, { kernel: 'cubic' })
    .raw()
    .toBuffer();
  for (let i = 0; i < buf.length; i++) buf[i] = clamp(stretched[i] + (rand() - 0.5) * 14);

  const put = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return;
    const o = (y * FRAME_W + x) * 3;
    buf[o] = clamp(r);
    buf[o + 1] = clamp(g);
    buf[o + 2] = clamp(b);
  };

  const c = opts.cover;
  if (c) {
    const edge = c.edge ?? 140;
    const amp = c.texture ?? 60;
    // Cover art: 12px blocks of random colour (like a busy illustration) + noise.
    const cells = Math.ceil(c.size / 12);
    const grid: number[][] = [];
    for (let i = 0; i < cells * cells; i++) {
      grid.push([100 + (rand() - 0.5) * amp * 2, 100 + (rand() - 0.5) * amp * 2, 100 + (rand() - 0.5) * amp * 2]);
    }
    for (let y = 0; y < c.size; y++) {
      for (let x = 0; x < c.size; x++) {
        const g = grid[Math.floor(y / 12) * cells + Math.floor(x / 12)];
        const n = (rand() - 0.5) * 16;
        put(c.x + x, c.y + y, g[0] + n, g[1] + n, g[2] + n);
      }
    }
    // Crisp border ring in a colour far from the background mean (~95).
    const ring = 95 + edge;
    for (let k = 0; k < BORDER_PX; k++) {
      for (let i = 0; i < c.size; i++) {
        put(c.x + i, c.y + k, ring, ring, ring);
        put(c.x + i, c.y + c.size - 1 - k, ring, ring, ring);
        put(c.x + k, c.y + i, ring, ring, ring);
        put(c.x + c.size - 1 - k, c.y + i, ring, ring, ring);
      }
    }
  }

  if (opts.tracklist ?? true) {
    // Rows of left-aligned "words" at x=800: bright, 14px tall, every 30px.
    for (let row = 0, y = 110; y < 610; row++, y += 30) {
      let x = 800;
      const limit = 800 + 160 + Math.floor(rand() * 220);
      while (x < limit) {
        const w = 18 + Math.floor(rand() * 52);
        for (let yy = 0; yy < 14; yy++) for (let xx = 0; xx < w && x + xx < limit; xx++) put(x + xx, y + yy, 235, 235, 235);
        x += w + 7;
      }
    }
  }
  return buf;
}

/** The frame as a q90 JPEG, the format the real thumbnails arrive in. */
export async function synthFrame(opts: SynthOptions = {}): Promise<Buffer> {
  const raw = await synthFrameRaw(opts);
  return sharp(raw, { raw: { width: FRAME_W, height: FRAME_H, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}
