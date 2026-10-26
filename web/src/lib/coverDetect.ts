// Album-cover detector for 1280x720 YouTube frames: finds the square album art
// inside the frame (the right half usually holds a tracklist).
//
// A faithful TypeScript port of the Python spike (cover-spike/scripts/detect4.py,
// 65/80 good crops on a stratified sample, 20/20 on the 2024-25 uploads). It is
// pure: it takes raw pixels (decoded elsewhere, see coverImage.ts) and returns a
// box, with no I/O and no imports, so it runs unchanged under Node, Vite and the
// test runner.
//
// What the spike showed, and why the algorithm looks the way it does:
//   * "sharp inside, blurred outside" does NOT work: most frames keep a stretched
//     but still-sharp copy of the art behind the cover;
//   * what every layout shares is a crisp, long, straight border;
//   * the cover is large (>= 70% of the frame height) and sits left of centre.
//
// Pass 1 (generic): every square with a side of 70-100% of the frame height is
//   scored by the mean "ridge" of its four sides: the gradient normal to the side,
//   averaged along the WHOLE side (so texture averages out), relative to parallel
//   lines 10px away. A layout prior keeps the centre-x in [0.20, 0.58] of the width.
//   The best square is snapped per side at full resolution and inset by 1.5%.
// Pass 2 (template prior): the uploader reuses a handful of layouts. A frame whose
//   generic result is weak is re-scored at those known boxes (+-6px) and accepted
//   at a lower threshold.
// Pass 3 (year fallback): when nothing passes, the dominant layout of the upload
//   year is used. Years with no known layout get no box at all ("full"), because a
//   wrong square is worse than the whole frame.
//
// Coordinates are always in the 1280x720 frame.

export const FRAME_W = 1280;
export const FRAME_H = 720;

/** [x, y, size] of a square in the 1280x720 frame. */
export type CoverBox = [number, number, number];

export interface RawFrame {
  data: Uint8Array;
  width: number;
  height: number;
  /** 1 (grey), 3 (RGB) or 4 (RGBA). */
  channels: number;
}

export type DetectSource = 'detected' | 'template' | 'year-fallback' | 'full';

export interface DetectResult {
  source: DetectSource;
  box: CoverBox | null;
  /** Mean side ridge of the accepted square (0 for year-fallback). Higher is crisper. */
  score: number;
}

export interface DetectOptions {
  /** Year the video was uploaded; selects the year-fallback layout. */
  uploadYear?: number | null;
}

/**
 * The layouts the uploader reuses, as pre-inset [x, y, size]. Mined from the
 * spike's confident detections (cluster sizes 8, 7 and 4 of 80).
 */
export const TEMPLATES: readonly CoverBox[] = [
  [288, 8, 682],
  [84, 60, 598],
  [288, 8, 702],
];

/** Dominant layout per upload year (spike votes: 2024-25 -> 682px at x=288, 2026 -> 598px at x=84). */
export function yearTemplate(year: number | null | undefined): CoverBox | null {
  if (year == null) return null;
  if (year >= 2026) return [84, 60, 598];
  if (year >= 2024) return [288, 8, 682];
  return null;
}

const P = {
  minFrac: 0.7,
  maxFrac: 1.0,
  step: 2,
  cap: 3.0,
  c: 1.0,
  minScore: 1.0,
  minSide: 0.35,
  off: 5,
  edgeTol: 3,
  cxMin: 0.2,
  cxMax: 0.58,
  confScore: 1.5, // a "confident" generic detection stands as is
  confSide: 0.8,
  tplScore: 0.75, // acceptance at a template location
  tplSide: 0.25,
  prefer: 0.8,
  inset: 0.015,
} as const;

// ─── Edge maps ───────────────────────────────────────────────────────────────

// scipy's 'reflect' boundary: d c b a | a b c d | d c b a.
const refl = (i: number, n: number) => (i < 0 ? -i - 1 : i >= n ? 2 * n - i - 1 : i);

function toGray(frame: RawFrame): Float32Array {
  const { data, width, height, channels } = frame;
  const g = new Float32Array(width * height);
  if (channels === 1) {
    for (let i = 0; i < g.length; i++) g[i] = data[i];
  } else {
    for (let i = 0, o = 0; i < g.length; i++, o += channels) {
      g[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }
  }
  return g;
}

// gaussian_filter(sigma=0.7): scipy truncates at int(4*sigma + 0.5) = 3 taps per side.
const GAUSS = (() => {
  const sigma = 0.7;
  const r = Math.floor(4 * sigma + 0.5);
  const w = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp((-0.5 * (i - r) ** 2) / sigma ** 2));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / sum);
})();

function gaussian(src: Float32Array, w: number, h: number): Float32Array {
  const r = (GAUSS.length - 1) / 2;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let k = -r; k <= r; k++) a += GAUSS[k + r] * src[row + refl(x + k, w)];
      tmp[row + x] = a;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let k = -r; k <= r; k++) a += GAUSS[k + r] * tmp[refl(y + k, h) * w + x];
      out[y * w + x] = a;
    }
  }
  return out;
}

/** |sobel| / 8 along x (vertical edges, `ev`) and along y (horizontal edges, `eh`). */
function sobel(g: Float32Array, w: number, h: number): { ev: Float32Array; eh: Float32Array } {
  const vs = new Float32Array(w * h); // [1 2 1] smoothing along y
  const hs = new Float32Array(w * h); // [1 2 1] smoothing along x
  for (let y = 0; y < h; y++) {
    const ya = refl(y - 1, h) * w;
    const yb = y * w;
    const yc = refl(y + 1, h) * w;
    for (let x = 0; x < w; x++) {
      vs[yb + x] = g[ya + x] + 2 * g[yb + x] + g[yc + x];
      hs[yb + x] = g[yb + refl(x - 1, w)] + 2 * g[yb + x] + g[yb + refl(x + 1, w)];
    }
  }
  const ev = new Float32Array(w * h);
  const eh = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const ya = refl(y - 1, h) * w;
    const yc = refl(y + 1, h) * w;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      ev[row + x] = Math.abs(vs[row + refl(x + 1, w)] - vs[row + refl(x - 1, w)]) / 8;
      eh[row + x] = Math.abs(hs[yc + x] - hs[ya + x]) / 8;
    }
  }
  return { ev, eh };
}

class Maps {
  readonly w = FRAME_W;
  readonly h = FRAME_H;
  readonly ww = FRAME_W / 2;
  readonly hh = FRAME_H / 2;
  readonly ev: Float32Array;
  readonly eh: Float32Array;
  /** Column-smoothed vertical-edge strength, cumulated down the rows ((hh+1) x ww). */
  private readonly CV: Float64Array;
  /** Row-smoothed horizontal-edge strength, cumulated along the columns (hh x (ww+1)). */
  private readonly CH: Float64Array;

  constructor(frame: RawFrame) {
    const { ev, eh } = sobel(gaussian(toGray(frame), this.w, this.h), this.w, this.h);
    this.ev = ev;
    this.eh = eh;
    const { ww, hh, w } = this;
    // 2x2 mean downsample.
    const ev2 = new Float64Array(ww * hh);
    const eh2 = new Float64Array(ww * hh);
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < ww; x++) {
        const i = 2 * y * w + 2 * x;
        ev2[y * ww + x] = (ev[i] + ev[i + 1] + ev[i + w] + ev[i + w + 1]) / 4;
        eh2[y * ww + x] = (eh[i] + eh[i + 1] + eh[i + w] + eh[i + w + 1]) / 4;
      }
    }
    this.CV = new Float64Array((hh + 1) * ww);
    this.CH = new Float64Array(hh * (ww + 1));
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < ww; x++) {
        const vsm = (ev2[y * ww + refl(x - 1, ww)] + ev2[y * ww + x] + ev2[y * ww + refl(x + 1, ww)]) / 3;
        this.CV[(y + 1) * ww + x] = this.CV[y * ww + x] + vsm;
      }
    }
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < ww; x++) {
        const hsm = (eh2[refl(y - 1, hh) * ww + x] + eh2[y * ww + x] + eh2[refl(y + 1, hh) * ww + x]) / 3;
        this.CH[y * (ww + 1) + x + 1] = this.CH[y * (ww + 1) + x] + hsm;
      }
    }
  }

  /** Sum of the vertical-edge strength down column `x` between rows y0..y1 (half-res). */
  private cs(x: number, y0: number, y1: number): number {
    const xc = x < 0 ? 0 : x > this.ww - 1 ? this.ww - 1 : x;
    return this.CV[y1 * this.ww + xc] - this.CV[y0 * this.ww + xc];
  }

  /** Sum of the horizontal-edge strength along row `y` between columns x0..x1 (half-res). */
  private rs(y: number, x0: number, x1: number): number {
    const yc = y < 0 ? 0 : y > this.hh - 1 ? this.hh - 1 : y;
    return this.CH[yc * (this.ww + 1) + x1] - this.CH[yc * (this.ww + 1) + x0];
  }

  private ridge(on: number, near: number): number {
    const r = (on - near) / (near + P.c);
    return r < 0 ? 0 : r > P.cap ? P.cap : r;
  }

  /** Ridge of the four sides [left, right, top, bottom] of the half-res square (X, Y, s). */
  sides(X: number, Y: number, s: number, out: number[]): number[] {
    const { ww, hh } = this;
    const X1 = X + s;
    const Y1 = Y + s;
    const xr = Math.min(X1, ww - 1);
    const yb = Math.min(Y1, hh - 1);
    const rv = (xc: number) =>
      this.ridge(
        this.cs(xc, Y, Y1) / s,
        (0.5 * (this.cs(xc - P.off, Y, Y1) + this.cs(xc + P.off, Y, Y1))) / s,
      );
    const rh = (yc: number) =>
      this.ridge(
        this.rs(yc, X, X1) / s,
        (0.5 * (this.rs(yc - P.off, X, X1) + this.rs(yc + P.off, X, X1))) / s,
      );
    // A side lying on the frame edge has no outside to contrast with: half credit.
    const half = 0.5 * P.cap;
    out[0] = X <= P.edgeTol ? half : rv(X);
    out[1] = X1 >= ww - P.edgeTol ? half : rv(xr);
    out[2] = Y <= P.edgeTol ? half : rh(Y);
    out[3] = Y1 >= hh - P.edgeTol ? half : rh(yb);
    return out;
  }
}

// ─── Search ──────────────────────────────────────────────────────────────────

interface Found {
  score: number;
  /** Full-resolution [x, y, size] before snapping, or null when nothing qualified. */
  raw: CoverBox | null;
  sides: number[];
}

const mean4 = (v: number[]) => (v[0] + v[1] + v[2] + v[3]) / 4;
const min4 = (v: number[]) => Math.min(v[0], v[1], v[2], v[3]);

function generic(m: Maps): Found {
  const best: Found = { score: 0, raw: null, sides: [0, 0, 0, 0] };
  const sides = [0, 0, 0, 0];
  const sMin = Math.floor(P.minFrac * m.hh);
  const sMax = Math.floor(P.maxFrac * m.hh);
  for (let s = sMin; s <= sMax; s += P.step) {
    for (let Y = 0; Y <= m.hh - s; Y += P.step) {
      for (let X = 0; X <= m.ww - s; X += P.step) {
        const cx = (X + s / 2) / m.ww;
        if (cx < P.cxMin || cx > P.cxMax) continue; // layout prior
        m.sides(X, Y, s, sides);
        if (min4(sides) < P.minSide) continue;
        const sc = mean4(sides);
        if (sc > best.score) {
          best.score = sc;
          best.raw = [X * 2, Y * 2, s * 2];
          best.sides = sides.slice();
        }
      }
    }
  }
  return best;
}

/** Best square within +-R half-res px of a template (full-res x, y, size). */
function atTemplate(m: Maps, tpl: CoverBox, R = 3): Found {
  const tx = tpl[0] >> 1;
  const ty = tpl[1] >> 1;
  const ts = tpl[2] >> 1;
  const best: Found = { score: -1, raw: null, sides: [0, 0, 0, 0] };
  const sides = [0, 0, 0, 0];
  for (let ds = -R; ds <= R; ds++) {
    const s = ts + ds;
    for (let Y = Math.max(0, ty - R); Y <= Math.min(m.hh - s, ty + R); Y++) {
      for (let X = Math.max(0, tx - R); X <= Math.min(m.ww - s, tx + R); X++) {
        m.sides(X, Y, s, sides);
        const sc = mean4(sides);
        if (sc > best.score) {
          best.score = sc;
          best.raw = [X * 2, Y * 2, s * 2];
          best.sides = sides.slice();
        }
      }
    }
  }
  return best;
}

// ─── Snap + inset ────────────────────────────────────────────────────────────

/** Mean of a 3-tap box filter (reflect) over a vector. */
function smooth3(v: Float64Array): Float64Array {
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = (v[refl(i - 1, v.length)] + v[i] + v[refl(i + 1, v.length)]) / 3;
  return out;
}

/** Snap each side of the box to the strongest edge within +-R px at full resolution. */
function refine(m: Maps, x0: number, y0: number, x1: number, y1: number, R = 4): [number, number, number, number] {
  const ya = Math.max(y0, 0);
  const yb = Math.min(y1, m.h);
  const xa = Math.max(x0, 0);
  const xb = Math.min(x1, m.w);
  if (yb <= ya || xb <= xa) return [x0, y0, x1, y1];
  // pv: vertical-edge strength by column, averaged over the box rows; ph: by row.
  const pv = new Float64Array(m.w);
  for (let y = ya; y < yb; y++) for (let x = 0; x < m.w; x++) pv[x] += m.ev[y * m.w + x];
  for (let x = 0; x < m.w; x++) pv[x] /= yb - ya;
  const ph = new Float64Array(m.h);
  for (let y = 0; y < m.h; y++) {
    let a = 0;
    for (let x = xa; x < xb; x++) a += m.eh[y * m.w + x];
    ph[y] = a / (xb - xa);
  }
  const pvs = smooth3(pv);
  const phs = smooth3(ph);

  const snap = (prof: Float64Array, c: number, lim: number) => {
    const lo = Math.max(1, c - R);
    const hi = Math.min(lim - 2, c + R);
    if (hi < lo) return c;
    let bi = lo;
    for (let i = lo + 1; i <= hi; i++) if (prof[i] > prof[bi]) bi = i;
    return bi;
  };
  const nx0 = x0 <= 3 ? x0 : snap(pvs, x0, m.w);
  const nx1 = x1 >= m.w - 3 ? x1 : snap(pvs, x1, m.w);
  const ny0 = y0 <= 3 ? y0 : snap(phs, y0, m.h);
  const ny1 = y1 >= m.h - 3 ? y1 : snap(phs, y1, m.h);
  const w = nx1 - nx0;
  const h = ny1 - ny0;
  if (h > 0 && Math.abs(w - h) / ((w + h) / 2) <= 0.03) return [nx0, ny0, nx1, ny1];
  return [x0, y0, x1, y1];
}

function finish(m: Maps, raw: CoverBox): CoverBox {
  const [x, y, s] = raw;
  const [x0, y0, x1, y1] = refine(m, x, y, x + s, y + s);
  const side = Math.min(x1 - x0, y1 - y0);
  const ins = Math.round(side * P.inset);
  return [x0 + ins, y0 + ins, side - 2 * ins];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

// ─── Public API ──────────────────────────────────────────────────────────────

export function detectCover(frame: RawFrame, opts: DetectOptions = {}): DetectResult {
  if (frame.width !== FRAME_W || frame.height !== FRAME_H) {
    throw new Error(`detectCover expects a ${FRAME_W}x${FRAME_H} frame, got ${frame.width}x${frame.height}`);
  }
  const m = new Maps(frame);
  const gen = generic(m);
  const genOk = gen.raw !== null && gen.score >= P.minScore;

  // A confident generic result stands.
  if (genOk && gen.score >= P.confScore && min4(gen.sides) >= P.confSide) {
    return { source: 'detected', box: finish(m, gen.raw!), score: r3(gen.score) };
  }

  // Weak or missing: look for the known layouts.
  let tpl: Found = { score: -1, raw: null, sides: [0, 0, 0, 0] };
  for (const t of TEMPLATES) {
    const f = atTemplate(m, t);
    if (f.score > tpl.score) tpl = f;
  }
  const tplOk =
    tpl.raw !== null &&
    min4(tpl.sides) >= P.tplSide &&
    tpl.score >= P.tplScore &&
    (!genOk || tpl.score >= gen.score * P.prefer);
  if (tplOk) return { source: 'template', box: finish(m, tpl.raw!), score: r3(tpl.score) };

  if (genOk) return { source: 'detected', box: finish(m, gen.raw!), score: r3(gen.score) };

  const yt = yearTemplate(opts.uploadYear);
  if (yt) return { source: 'year-fallback', box: finish(m, yt), score: 0 };
  return { source: 'full', box: null, score: r3(Math.max(gen.score, 0)) };
}
