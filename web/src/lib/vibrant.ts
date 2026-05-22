// Build-time dominant color extraction via node-vibrant.
// Reads/writes .vibrant-cache.json keyed by artwork URL so unchanged covers
// skip re-extraction on incremental rebuilds.
//
// WHY cache: 1298+ albums × Vibrant decode = several seconds on first build,
// but only new/changed covers need re-processing on subsequent builds.
//
// WHY sharp decode (not Vibrant.from(url) directly): node-vibrant's native
// image backend (Jimp) CANNOT decode image/webp ("Unsupported MIME type").
// 509 of 1298 covers on cdn.deathgrind.club are .webp, so ~39% of albums were
// silently falling back to the cyan default. We fetch the bytes ourselves and
// hand them to sharp, which decodes webp/jpg/png/avif, downscale to a PNG
// buffer, and feed THAT buffer to Vibrant. Same dominant color, every format.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const CACHE_PATH = resolve(process.cwd(), '.vibrant-cache.json');
const FALLBACK_COLOR = '#0073a8'; // Xerox Underground primary cyan

// Browser-ish UA — some CDNs (Cloudflare in front of cdn.deathgrind.club) are
// picky about default Node/undici user-agents.
const FETCH_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
};

// node-vibrant decodes every pixel; 200px is plenty for a dominant color and
// keeps decode time negligible.
const DECODE_SIZE = 200;

// cdn.deathgrind.club sits behind Cloudflare with an aggressive rate limit:
// firing all ~1300 covers in parallel during the build trips HTTP 429 ("Too
// Many Requests", Retry-After ~13s) for hundreds of them. Two defenses:
//   1. a global concurrency gate so we never have more than N in-flight fetches
//   2. retry-with-backoff that HONORS the Retry-After header on 429
const MAX_CONCURRENT_FETCHES = 6;
const MAX_RETRIES = 4;
const FETCH_TIMEOUT_MS = 20000;

type Cache = Record<string, string>;

// ─── tiny global concurrency limiter (shared across all getAlbumColor calls) ─
// Astro builds pages concurrently and each page calls getAlbumColor
// independently, so the gate has to live at module scope to be effective.
let _inFlight = 0;
const _waiters: Array<() => void> = [];
function acquireSlot(): Promise<void> {
  if (_inFlight < MAX_CONCURRENT_FETCHES) {
    _inFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((res) => _waiters.push(res));
}
function releaseSlot(): void {
  const next = _waiters.shift();
  if (next) {
    next(); // hand the slot directly to the next waiter (count stays the same)
  } else {
    _inFlight--;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function loadCache(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) as Cache;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache): void {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

// Lazy-loaded vibrant module.
// IMPORTANT: node-vibrant v4 dropped the default export — importing the bare
// 'node-vibrant' THROWS ("use named imports node-vibrant/node|browser|worker").
// We need the /node entrypoint (native image decode) for the build, and the
// swatch API changed too: it's now a `.hex` getter, NOT getHex().
let _Vibrant: any = null;
async function getVibrant(): Promise<any> {
  if (!_Vibrant) {
    // node-vibrant/node exports a named `Vibrant` (v4). No default export.
    const mod = await import('node-vibrant/node');
    _Vibrant = mod.Vibrant;
  }
  return _Vibrant;
}

// In-memory cache so a single build does not re-read/re-write the JSON file
// once per album (1298 albums). The file is the cross-build cache; this is the
// per-build cache. Flushed to disk by getAlbumColor on each new extraction.
let _memCache: Cache | null = null;
function memCache(): Cache {
  if (_memCache === null) _memCache = loadCache();
  return _memCache;
}

// ─── build-stats: real-color vs fallback, logged once at build end ───────────
let _realCount = 0;
let _fallbackCount = 0;
let _cacheHits = 0;
let _summaryRegistered = false;
const _failedUrls: string[] = [];
function registerSummary(): void {
  if (_summaryRegistered) return;
  _summaryRegistered = true;
  process.on('exit', () => {
    const total = _realCount + _fallbackCount + _cacheHits;
    // eslint-disable-next-line no-console
    console.log(
      `\n[vibrant] colors: ${_realCount + _cacheHits} real (${_realCount} fresh + ${_cacheHits} cached), ` +
        `${_fallbackCount} fallback, ${total} total covers.`,
    );
    if (_failedUrls.length) {
      // eslint-disable-next-line no-console
      console.log(
        `[vibrant] ${_failedUrls.length} cover(s) could not be decoded (showing up to 10):`,
      );
      // eslint-disable-next-line no-console
      for (const u of _failedUrls.slice(0, 10)) console.log(`  - ${u}`);
    }
  });
}

// Fetch image bytes with retry-on-429 (honoring Retry-After) and a timeout.
// Returns the bytes or null on a hard failure. Runs inside the concurrency gate
// so the whole build never exceeds MAX_CONCURRENT_FETCHES requests to the CDN.
async function fetchImageBytes(url: string): Promise<Buffer | null> {
  await acquireSlot();
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: FETCH_HEADERS,
          redirect: 'follow',
          signal: ctrl.signal,
        });
      } catch {
        clearTimeout(timer);
        // network error / timeout / DNS — short backoff then retry.
        if (attempt < MAX_RETRIES) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        return null;
      }
      clearTimeout(timer);

      if (res.status === 429 || res.status === 503) {
        // Honor Retry-After (seconds); fall back to exponential backoff.
        const ra = parseInt(res.headers.get('retry-after') || '', 10);
        const waitMs = Number.isFinite(ra) && ra > 0 ? (ra + 1) * 1000 : 1000 * 2 ** attempt;
        if (attempt < MAX_RETRIES) {
          await sleep(waitMs);
          continue;
        }
        return null;
      }

      if (!res.ok) return null; // 404 / 403 / etc — no point retrying
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length ? buf : null;
    }
    return null;
  } finally {
    releaseSlot();
  }
}

// Fetch the image bytes (follow redirects, browser UA, retry on 429) and
// decode -> downscaled PNG buffer via sharp, then run Vibrant on the buffer.
// Returns the hex color or null if the URL can't be fetched/decoded.
async function extractFromUrl(url: string): Promise<string | null> {
  const buf = await fetchImageBytes(url);
  if (!buf) return null;

  let png: Buffer;
  try {
    // sharp handles webp/jpg/png/avif/gif/tiff. `failOn: 'none'` keeps it
    // lenient on slightly corrupt files instead of throwing.
    png = await sharp(buf, { failOn: 'none' })
      .resize(DECODE_SIZE, DECODE_SIZE, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    return null; // undecodable image bytes
  }

  try {
    const Vibrant = await getVibrant();
    const palette = await Vibrant.from(png).getPalette();
    const swatch =
      palette.Vibrant || palette.DarkVibrant || palette.Muted || palette.DarkMuted;
    // v4: `.hex` getter (was getHex() in v3).
    return swatch && swatch.hex ? swatch.hex : null;
  } catch {
    return null;
  }
}

// Extract dominant hex color from an album's artwork.
//
// `thumbUrl` is the small/cheap source (e.g. ytimg mqdefault); `fullUrl` is the
// large cover. We try the thumb first, and if it can't be fetched/decoded we
// fall back to the full cover BEFORE giving up — many covers have a working
// large image even when the thumb 404s. Only a REAL extracted color is cached;
// the cyan fallback is never cached so the next build can retry.
export async function getAlbumColor(
  thumbUrl: string | null | undefined,
  fullUrl?: string | null | undefined,
): Promise<string> {
  registerSummary();

  // The cache is keyed by the primary (thumb) URL; if there is no thumb, key by
  // the full URL so we still cache something useful.
  const cacheKey = thumbUrl || fullUrl || '';
  if (!cacheKey) {
    _fallbackCount++;
    return FALLBACK_COLOR;
  }

  const cache = memCache();
  if (cache[cacheKey]) {
    _cacheHits++;
    return cache[cacheKey];
  }

  // Try sources in order, de-duplicated (thumb===full for deathgrind URLs).
  const sources: string[] = [];
  if (thumbUrl) sources.push(thumbUrl);
  if (fullUrl && fullUrl !== thumbUrl) sources.push(fullUrl);

  for (const src of sources) {
    const hex = await extractFromUrl(src);
    if (hex) {
      cache[cacheKey] = hex;
      saveCache(cache);
      _realCount++;
      return hex;
    }
  }

  // Every source failed — return the fallback WITHOUT caching it so a future
  // build (or a fixed image) can succeed.
  _fallbackCount++;
  _failedUrls.push(cacheKey);
  return FALLBACK_COLOR;
}
