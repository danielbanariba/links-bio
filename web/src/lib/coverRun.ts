// The pre-build step: for every album, make sure public/covers/<videoId>.webp is
// the clean square cover (or record that there is none). Network and disk are
// injected / explicit so the whole flow is testable without YouTube.
//
// Rules this module guarantees:
//   * the cache decides what needs the network: a warm build downloads nothing;
//   * one failing album is logged and skipped, never aborts the run, and is not
//     cached (so the next build retries it);
//   * an override beats the detector; "full" means no crop at all.
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { COVER_ALGO_VERSION, coverFileName, isVideoId, planCover } from './cover.ts';
import type { CoverCache, CoverEntry, CoverOverrides, CoverSource } from './cover.ts';
import { detectCover } from './coverDetect.ts';
import type { CoverBox } from './coverDetect.ts';
import { normalizeFrame, renderCrop, renderPreview, toRawFrame } from './coverImage.ts';

export interface RunAlbum {
  id: number;
  videoId: string;
  /** The stored YouTube thumbnail URL (maxresdefault in practice). */
  artworkUrl: string;
  /** Year of upload_date; selects the year-fallback layout. */
  uploadYear: number | null;
}

export interface RunSummary {
  total: number;
  bySource: Record<CoverSource, number>;
  /** Frames downloaded this run. */
  fetched: number;
  /** Albums that needed no work (cache and file already agree). */
  cached: number;
  failed: number;
  invalid: number;
  ms: number;
}

export interface RunOptions {
  albums: RunAlbum[];
  overrides: CoverOverrides;
  cache: CoverCache;
  fetchImage: (url: string) => Promise<Buffer>;
  coversDir: string;
  previewDir: string;
  /** Parallel downloads (default 6). */
  concurrency?: number;
  log?: (message: string) => void;
  /** Called every `checkpointEvery` finished albums so a killed cold run keeps its progress. */
  onCheckpoint?: (cache: CoverCache) => void | Promise<void>;
  checkpointEvery?: number;
}

const sameBox = (a: CoverBox | null | undefined, b: CoverBox | null) =>
  !!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

export async function runCovers(opts: RunOptions): Promise<{ cache: CoverCache; summary: RunSummary }> {
  const started = Date.now();
  const { albums, overrides, coversDir, previewDir, fetchImage } = opts;
  const log = opts.log ?? ((m: string) => console.log(m));
  const next: CoverCache = { ...opts.cache };
  const summary: RunSummary = {
    total: albums.length,
    bySource: { detected: 0, template: 0, 'year-fallback': 0, override: 0, full: 0 },
    fetched: 0,
    cached: 0,
    failed: 0,
    invalid: 0,
    ms: 0,
  };
  await mkdir(coversDir, { recursive: true });
  await mkdir(previewDir, { recursive: true });

  const entryOf = (source: CoverSource, box: CoverBox | null, score: number): CoverEntry => ({
    v: COVER_ALGO_VERSION,
    box,
    source,
    score,
  });

  async function handle(a: RunAlbum): Promise<void> {
    const coverFile = path.join(coversDir, coverFileName(a.videoId));
    const previewFile = path.join(previewDir, coverFileName(a.videoId));
    const previous = next[a.videoId];
    const plan = planCover({
      override: overrides[a.videoId],
      entry: previous,
      fileExists: existsSync(coverFile),
    });

    if (plan.kind === 'skip') {
      summary.cached++;
      return;
    }
    if (plan.kind === 'full') {
      await rm(coverFile, { force: true });
      // Cached as the override it is (no box), not as the detector's own "full":
      // once the line leaves the override file, planCover detects it again.
      next[a.videoId] = entryOf('override', null, 0);
      return;
    }

    const image = await fetchImage(a.artworkUrl);
    summary.fetched++;
    const frame = await normalizeFrame(image);
    if (!frame) {
      if (plan.kind === 'render') throw new Error('frame is not 16:9, the box cannot apply');
      // Definitive: this thumbnail has a different shape, there is no 1280x720 geometry to search.
      await rm(coverFile, { force: true });
      next[a.videoId] = entryOf('full', null, 0);
      return;
    }
    if (!existsSync(previewFile)) await writeFile(previewFile, await renderPreview(frame));

    let source: CoverSource;
    let box: CoverBox | null;
    let score: number;
    if (plan.kind === 'render') {
      ({ source, box, score } = plan);
    } else {
      const found = detectCover(await toRawFrame(frame), { uploadYear: a.uploadYear });
      ({ source, box, score } = found);
    }

    if (!box) {
      await rm(coverFile, { force: true }); // the algorithm now says "no square": drop any older crop
    } else if (!(sameBox(previous?.box, box) && existsSync(coverFile))) {
      await writeFile(coverFile, await renderCrop(frame, box));
    }
    next[a.videoId] = entryOf(source, box, score);
  }

  const work = albums.filter((a) => {
    if (isVideoId(a.videoId) && a.artworkUrl) return true;
    summary.invalid++;
    return false;
  });
  const every = opts.checkpointEvery ?? 100;
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    for (;;) {
      const a = work[cursor++];
      if (!a) return;
      try {
        await handle(a);
      } catch (err) {
        summary.failed++;
        log(`[covers] ${a.videoId} (album ${a.id}) skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
      done++;
      if (opts.onCheckpoint && done % every === 0) {
        // Only a convenience for a killed run: a failed write is logged, never
        // allowed to stop the run (the final write still happens).
        try {
          await opts.onCheckpoint(next);
        } catch (err) {
          log(`[covers] checkpoint not saved: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 6, work.length)) }, worker));

  // An album with no box is shown whole ("full"), whether the detector or a
  // reviewer said so.
  for (const a of work) {
    const e = next[a.videoId];
    if (e) summary.bySource[e.box ? e.source : 'full']++;
  }
  summary.ms = Date.now() - started;
  return { cache: next, summary };
}

export function formatSummary(s: RunSummary): string {
  const src = (Object.entries(s.bySource) as [CoverSource, number][])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
  const extra = [s.failed ? `${s.failed} failed` : '', s.invalid ? `${s.invalid} without a usable video id/url` : '']
    .filter(Boolean)
    .join(', ');
  return (
    `[covers] ${s.total} albums in ${(s.ms / 1000).toFixed(1)}s | ${src || 'none'} | ` +
    `${s.fetched} downloaded, ${s.cached} up to date${extra ? `, ${extra}` : ''}`
  );
}

// ─── Download ────────────────────────────────────────────────────────────────

class PermanentFetchError extends Error {}

/**
 * The longest Retry-After that is waited out. A server asking for more (an hour,
 * a day) fails the album now; the next build retries it. Without a cap one header
 * would stall the twice-a-day sync build for as long as the server says.
 */
export const MAX_RETRY_AFTER_MS = 30_000;

export interface RetryOptions {
  fetchFn?: (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
  /** Extra attempts after the first (default 4). */
  retries?: number;
  baseMs?: number;
  timeoutMs?: number;
}

/**
 * GET with retry + exponential backoff on network errors, 429 and 5xx; other
 * statuses fail at once. A Retry-After is honoured up to MAX_RETRY_AFTER_MS.
 */
export async function fetchWithRetry(url: string, opts: RetryOptions = {}): Promise<Buffer> {
  const fetchFn = opts.fetchFn ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const retries = opts.retries ?? 4;
  const baseMs = opts.baseMs ?? 500;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let waitMs = baseMs * 2 ** attempt;
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      if (res.status !== 429 && res.status < 500) throw new PermanentFetchError(`HTTP ${res.status} for ${url}`);
      lastError = new Error(`HTTP ${res.status} for ${url}`);
      const retryAfter = Number(res.headers.get('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        if (retryAfter * 1000 > MAX_RETRY_AFTER_MS) break;
        waitMs = Math.max(waitMs, retryAfter * 1000);
      }
    } catch (err) {
      if (err instanceof PermanentFetchError) throw err;
      lastError = err;
    }
    if (attempt < retries) await sleep(waitMs);
  }
  throw lastError;
}
