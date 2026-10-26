// The accent colour of a cover, extracted with sharp alone.
//
// This replaced node-vibrant (T10b): its Node image backend pulled in Jimp and
// an advisory-laden file-type, only to re-decode a PNG that sharp had already
// decoded for it (Jimp cannot read WebP). The choice of colour is a port of
// node-vibrant's default generator, because the accents were tuned on it:
//
//   1. Decode and downscale to a 64px sample (node-vibrant sampled the 200px
//      decode at quality 5, i.e. 40px), drop transparent and near-white pixels
//      (its default filter).
//   2. Quantise into a 4-bit-per-channel histogram and take each bin's mean
//      colour as a swatch. Bins under MIN_BIN_SHARE of the pixels are noise and
//      are skipped, so a few stray pixels of pure red cannot win. (node-vibrant
//      used a 64-colour median cut; the bins play the same role.)
//   3. Score the swatches with node-vibrant's targets and weights: the
//      "Vibrant" swatch is the most saturated one at mid lightness. A cover
//      with no vibrant swatch borrows the hue of its dark or light vibrant
//      swatch, then of its muted ones, at mid lightness, exactly as
//      node-vibrant filled its empty swatches; only a cover with none of those
//      falls back to its muted swatch.
//
// So a black cover with one red emblem gives that red, not the black that
// covers most of it (which is what sharp's own stats().dominant returns).
import sharp from 'sharp';

type Rgb = [number, number, number];
type Hsl = [number, number, number];

interface Swatch {
  rgb: Rgb;
  hsl: Hsl;
  population: number;
}

const SAMPLE_SIZE = 64;
const BIN_BITS = 4;
const SHIFT = 8 - BIN_BITS;
const MIN_BIN_SHARE = 0.004;

// node-vibrant's DefaultOpts (@vibrant/generator-default).
const OPTS = {
  targetDarkLuma: 0.26,
  maxDarkLuma: 0.45,
  minLightLuma: 0.55,
  targetLightLuma: 0.74,
  minNormalLuma: 0.3,
  targetNormalLuma: 0.5,
  maxNormalLuma: 0.7,
  targetMutesSaturation: 0.3,
  maxMutesSaturation: 0.4,
  targetVibrantSaturation: 1,
  minVibrantSaturation: 0.35,
  weightSaturation: 3,
  weightLuma: 6.5,
  weightPopulation: 0.5,
};

/**
 * The accent colour (#rrggbb) of an image given as bytes or a file path; null
 * when sharp cannot decode it or no pixel survives the filter. Never throws.
 */
export async function dominantColor(input: Buffer | string): Promise<string | null> {
  let data: Buffer;
  try {
    // `failOn: 'none'` keeps sharp lenient on slightly corrupt files.
    ({ data } = await sharp(input, { failOn: 'none' })
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }));
  } catch {
    return null;
  }
  const swatch = pickSwatch(quantize(data));
  return swatch ? toHex(swatch.rgb) : null;
}

/** RGBA pixels → one swatch per populated histogram bin. */
function quantize(rgba: Uint8Array): Swatch[] {
  const bins = new Map<number, [number, number, number, number]>();
  let counted = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    if (rgba[i + 3] < 125 || (r > 250 && g > 250 && b > 250)) continue;
    const key = ((r >> SHIFT) << (2 * BIN_BITS)) | ((g >> SHIFT) << BIN_BITS) | (b >> SHIFT);
    let bin = bins.get(key);
    if (!bin) bins.set(key, (bin = [0, 0, 0, 0]));
    bin[0] += r;
    bin[1] += g;
    bin[2] += b;
    bin[3]++;
    counted++;
  }
  const all = [...bins.values()].map(([r, g, b, n]) => {
    const rgb: Rgb = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    return { rgb, hsl: rgbToHsl(rgb), population: n };
  });
  const kept = all.filter((s) => s.population >= counted * MIN_BIN_SHARE);
  // A noisy image can spread every pixel thin; better its bins than no colour.
  return kept.length ? kept : all;
}

/** node-vibrant's Vibrant swatch, with its fill-ins; else its Muted swatch. */
function pickSwatch(swatches: Swatch[]): Swatch | null {
  if (!swatches.length) return null;
  const maxPopulation = Math.max(...swatches.map((s) => s.population));
  const taken = new Set<Swatch>();
  const find = (
    targetLuma: number,
    minLuma: number,
    maxLuma: number,
    targetSat: number,
    minSat: number,
    maxSat: number,
  ): Swatch | null => {
    let best: Swatch | null = null;
    let bestValue = 0;
    for (const s of swatches) {
      const [, sat, luma] = s.hsl;
      if (sat < minSat || sat > maxSat || luma < minLuma || luma > maxLuma || taken.has(s)) continue;
      const value = score(sat, targetSat, luma, targetLuma, s.population / maxPopulation);
      if (best === null || value > bestValue) {
        best = s;
        bestValue = value;
      }
    }
    if (best) taken.add(best);
    return best;
  };

  // Same order as node-vibrant: a swatch taken by one variation is not
  // available to the next.
  const o = OPTS;
  const vibrant = find(o.targetNormalLuma, o.minNormalLuma, o.maxNormalLuma, o.targetVibrantSaturation, o.minVibrantSaturation, 1);
  const lightVibrant = find(o.targetLightLuma, o.minLightLuma, 1, o.targetVibrantSaturation, o.minVibrantSaturation, 1);
  let darkVibrant = find(o.targetDarkLuma, 0, o.maxDarkLuma, o.targetVibrantSaturation, o.minVibrantSaturation, 1);
  const muted = find(o.targetNormalLuma, o.minNormalLuma, o.maxNormalLuma, o.targetMutesSaturation, 0, o.maxMutesSaturation);
  const lightMuted = find(o.targetLightLuma, o.minLightLuma, 1, o.targetMutesSaturation, 0, o.maxMutesSaturation);
  const darkMuted = find(o.targetDarkLuma, 0, o.maxDarkLuma, o.targetMutesSaturation, 0, o.maxMutesSaturation);

  if (vibrant) return vibrant;
  // node-vibrant's _generateEmptySwatches, as far as it decides the Vibrant swatch
  // (the light muted one wins over the dark muted one there too).
  if (!darkVibrant && !lightVibrant) {
    if (darkMuted) darkVibrant = withLuma(darkMuted, o.targetDarkLuma);
    if (lightMuted) darkVibrant = withLuma(lightMuted, o.targetDarkLuma);
  }
  if (darkVibrant) return withLuma(darkVibrant, o.targetNormalLuma);
  if (lightVibrant) return withLuma(lightVibrant, o.targetNormalLuma);
  return muted;
}

// node-vibrant's _createComparisonValue: a weighted mean that skips a zero term.
function score(sat: number, targetSat: number, luma: number, targetLuma: number, populationShare: number): number {
  const terms: Array<[number, number]> = [
    [1 - Math.abs(sat - targetSat), OPTS.weightSaturation],
    [1 - Math.abs(luma - targetLuma), OPTS.weightLuma],
    [populationShare, OPTS.weightPopulation],
  ];
  let sum = 0;
  let weights = 0;
  for (const [value, weight] of terms) {
    if (!value) continue;
    sum += value * weight;
    weights += weight;
  }
  return weights ? sum / weights : 0;
}

function withLuma(s: Swatch, luma: number): Swatch {
  const hsl: Hsl = [s.hsl[0], s.hsl[1], luma];
  return { rgb: hslToRgb(hsl), hsl, population: 0 };
}

function rgbToHsl([r8, g8, b8]: Rgb): Hsl {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]: Hsl): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((v) => Math.round(v * 255)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}
