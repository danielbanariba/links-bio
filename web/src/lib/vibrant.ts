// Build-time cover colour extraction. The colour itself comes from
// lib/coverColor.ts (sharp, a port of node-vibrant's pick; node-vibrant was
// dropped in T10b). This file decides WHERE it comes from and caches it:
// .vibrant-cache.json (the name predates T10b) lets unchanged covers skip
// re-extraction on incremental rebuilds.
//
// WHERE the colour comes from (T10): the square crop the covers step cut out of
// the video frame (public/covers/<videoId>.webp, read from disk), because that is
// the image the cards show and it has no tracklist text or borders in it. Only
// an album with no crop (an override of "full", or a frame with no clean square)
// falls back to the network source: the mqdefault frame, then the full artwork.
// colorCacheKey() keys a crop by its video id AND its box, so a re-crop (a T9b
// override) gets a fresh colour; a frame is keyed by its URL, as before.
//
// WHY cache: ~2750 albums × a decode = seconds on a cold build, and the frame
// fallback is a network fetch; only new/changed covers need re-processing on
// subsequent builds. Colours cached before T10b were picked by node-vibrant and
// stay valid: coverColor.ts scores with node-vibrant's targets, so a fresh pick
// differs from them only by quantiser detail (median hue difference ~3° on a
// 300-cover sample). Deleting the file recolours every album on the next build.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readableAccent, type AccentTokens } from './accent.js';
import { coverFileName, isVideoId, type CoverCache } from './cover.js';
import { dominantColor } from './coverColor.js';
import type { CoverBox } from './coverDetect.js';
import { coverPaths, readCoverCache } from './coverStore.js';

const CACHE_PATH = resolve(process.cwd(), '.vibrant-cache.json');
// Browser-ish UA — some CDNs (Cloudflare in front of cdn.deathgrind.club) are
// picky about default Node/undici user-agents.
const FETCH_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
};

// cdn.deathgrind.club sits behind Cloudflare with an aggressive rate limit:
// firing all ~1300 covers in parallel during the build trips HTTP 429 ("Too
// Many Requests", Retry-After ~13s) for hundreds of them. Two defenses:
//   1. a global concurrency gate so we never have more than N in-flight fetches
//   2. retry-with-backoff that HONORS the Retry-After header on 429
const MAX_CONCURRENT_FETCHES = 6;
const MAX_RETRIES = 4;
const FETCH_TIMEOUT_MS = 20000;

type Cache = Record<string, string>;

// ─── tiny global concurrency limiter (shared across all getCoverColor calls) ─
// Astro builds pages concurrently and each page calls getCoverColor
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

// In-memory cache so a single build does not re-read/re-write the JSON file
// once per album (1298 albums). The file is the cross-build cache; this is the
// per-build cache. Flushed to disk on each new extraction (see cached()).
let _memCache: Cache | null = null;
function memCache(): Cache {
  if (_memCache === null) _memCache = loadCache();
  return _memCache;
}

// ─── build-stats: real-color vs fallback, logged once at build end ───────────
let _realCount = 0;
let _cropCount = 0;
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
      `\n[vibrant] colors: ${_realCount + _cacheHits} real (${_realCount} fresh, ${_cropCount} of them from square crops, + ${_cacheHits} cached), ` +
        `${_fallbackCount} fallback, ${total} lookups.`,
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

// Fetch the image bytes (follow redirects, browser UA, retry on 429), then decode.
async function extractFromUrl(url: string): Promise<string | null> {
  const buf = await fetchImageBytes(url);
  return buf ? dominantColor(buf) : null;
}

// ─── the square crop of an album, when the covers step made one ──────────────
/** A crop as the cache key sees it: which video, and where in its frame. */
export interface CoverCrop {
  videoId: string;
  box: CoverBox;
}

// Same rule as the cards' image (cover.ts, coverSrc): a cached box AND the file
// on disk. Memoised per video id: every card on every page asks.
let _coverCache: CoverCache | null = null;
const _crops = new Map<string, (CoverCrop & { file: string }) | null>();
function cropOf(videoId: string | null | undefined): (CoverCrop & { file: string }) | null {
  const id = (videoId || '').trim();
  if (!isVideoId(id)) return null;
  if (!_crops.has(id)) {
    const paths = coverPaths();
    _coverCache ??= readCoverCache(paths.cache);
    const box = _coverCache[id]?.box;
    const file = resolve(paths.coversDir, coverFileName(id));
    _crops.set(id, box && existsSync(file) ? { videoId: id, box, file } : null);
  }
  return _crops.get(id) ?? null;
}

/**
 * The .vibrant-cache.json key for a cover: a crop by its video id and box, so a
 * re-crop gets a new colour and never reuses the full frame's; a frame by its URL.
 */
export function colorCacheKey(src: {
  crop: CoverCrop | null;
  thumbUrl?: string | null;
  fullUrl?: string | null;
}): string {
  if (src.crop) return `crop:${src.crop.videoId}@${src.crop.box.join(',')}`;
  return src.thumbUrl || src.fullUrl || '';
}

export interface CoverColorInput {
  videoId?: string | null;
  /** The small frame (ytimg mqdefault): the fallback when there is no crop. */
  thumbUrl?: string | null;
  /** The large artwork: tried when the thumb can't be fetched or decoded. */
  fullUrl?: string | null;
}

// One extraction per key even when several cards of the same album render at once.
const _pending = new Map<string, Promise<string | null>>();
function cached(key: string, extract: () => Promise<string | null>): Promise<string | null> {
  const cache = memCache();
  if (cache[key]) {
    _cacheHits++;
    return Promise.resolve(cache[key]);
  }
  let job = _pending.get(key);
  if (!job) {
    job = extract().then((hex) => {
      _pending.delete(key);
      // Only a REAL extracted color is cached, so a future build can retry a failure.
      if (hex) {
        cache[key] = hex;
        saveCache(cache);
        _realCount++;
      }
      return hex;
    });
    _pending.set(key, job);
  }
  return job;
}

// Dominant hex color of an album's cover; null when nothing could be extracted
// (the page then shows the stylesheet's amber). The square crop when it exists,
// read from disk; else the thumb, then the full artwork (many covers have a
// working large image even when the thumb 404s).
export async function getCoverColor(album: CoverColorInput): Promise<string | null> {
  registerSummary();

  const crop = cropOf(album.videoId);
  if (crop) {
    const hex = await cached(colorCacheKey({ crop }), async () => {
      const found = await dominantColor(crop.file);
      if (found) _cropCount++;
      return found;
    });
    if (hex) return hex;
    // An unreadable crop file: fall through to the frame.
  }

  const key = colorCacheKey({ crop: null, thumbUrl: album.thumbUrl, fullUrl: album.fullUrl });
  if (!key) {
    _fallbackCount++;
    return null;
  }
  // Try sources in order, de-duplicated (thumb===full for deathgrind URLs).
  const sources: string[] = [];
  if (album.thumbUrl) sources.push(album.thumbUrl);
  if (album.fullUrl && album.fullUrl !== album.thumbUrl) sources.push(album.fullUrl);
  const hex = await cached(key, async () => {
    for (const src of sources) {
      const found = await extractFromUrl(src);
      if (found) return found;
    }
    return null;
  });
  if (!hex) {
    _fallbackCount++;
    _failedUrls.push(key);
  }
  return hex;
}

// The readable accent (lib/accent.ts) of an album's cover colour; null when it
// has none. Memoised per colour: the same album renders on many pages.
const _accents = new Map<string, AccentTokens | null>();
export async function getAlbumAccent(album: CoverColorInput): Promise<AccentTokens | null> {
  const color = await getCoverColor(album);
  if (!color) return null;
  if (!_accents.has(color)) _accents.set(color, readableAccent(color));
  return _accents.get(color) ?? null;
}
