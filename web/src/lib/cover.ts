// Pure decisions around the square covers (no I/O, so they are unit-tested):
//   * planCover   - what the pre-build step must do for one album;
//   * coverSrc    - which image URL a card renders;
//   * parseOverrides - how the hand-edited override file is validated.
// The detector is coverDetect.ts; the pre-build runner is coverRun.ts.
import { FRAME_H, FRAME_W } from './coverDetect.ts';
import type { CoverBox } from './coverDetect.ts';
import { thumb } from './thumb.ts';

/**
 * Bump when the detector (or its templates/params) changes so every cached box is
 * recomputed on the next build. Overrides are human decisions and survive a bump.
 */
export const COVER_ALGO_VERSION = 2; // 2: the layout rescue mined from the T9b review

export type CoverSource = 'detected' | 'template' | 'year-fallback' | 'override' | 'full';

/** One cache record per video id (web/.cover-cache.json). */
export interface CoverEntry {
  v: number;
  /** [x, y, size] in the 1280x720 frame; null = no clean square, keep the full frame. */
  box: CoverBox | null;
  source: CoverSource;
  score: number;
}
export type CoverCache = Record<string, CoverEntry>;

/** web/src/data/cover-overrides.json: a reviewed box, or "full" when no clean square exists. */
export type CoverOverride = { x: number; y: number; size: number } | 'full';
export type CoverOverrides = Record<string, CoverOverride>;

export type CoverPlan =
  | { kind: 'skip' } // nothing to do: the cache entry and the file on disk agree
  | { kind: 'full' } // override "full": no crop, remove any file, no download
  | { kind: 'render'; box: CoverBox; source: CoverSource; score: number } // download + crop at a known box
  | { kind: 'detect' }; // download + detect + crop

/** YouTube ids are 11 chars of [A-Za-z0-9_-]; the guard keeps odd values out of file paths. */
export const isVideoId = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{6,20}$/.test(s);

export const coverFileName = (videoId: string) => `${videoId}.webp`;

const sameBox = (a: CoverBox | null, b: CoverBox) => !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

export function planCover(input: {
  override: CoverOverride | undefined;
  entry: CoverEntry | undefined;
  fileExists: boolean;
}): CoverPlan {
  const { override, entry, fileExists } = input;

  if (override === 'full') return { kind: 'full' };

  if (override) {
    const box: CoverBox = [override.x, override.y, override.size];
    if (entry?.source === 'override' && sameBox(entry.box, box) && fileExists) return { kind: 'skip' };
    return { kind: 'render', box, source: 'override', score: 0 };
  }

  // No override. A cached override (a box, or "full" cached with no box) whose
  // line was deleted from the file is stale.
  if (!entry || entry.source === 'override' || entry.v !== COVER_ALGO_VERSION) return { kind: 'detect' };
  if (!entry.box) return { kind: 'skip' }; // a definitive "no clean square"
  if (fileExists) return { kind: 'skip' };
  return { kind: 'render', box: entry.box, source: entry.source, score: entry.score };
}

/**
 * The image a card renders: the square crop when the cache has a box AND the file
 * is on disk, else the mqdefault frame (what cards show today).
 */
export function coverSrc(
  album: { videoId: string | null | undefined; artworkUrl: string | null | undefined },
  entry: CoverEntry | undefined,
  fileExists: boolean,
): string {
  if (isVideoId(album.videoId) && entry?.box && fileExists) return `/covers/${coverFileName(album.videoId)}`;
  return thumb(album.artworkUrl);
}

const MIN_OVERRIDE_SIZE = 64;

/** Validate the override file: keep good entries, report the rest (never throw). */
export function parseOverrides(raw: unknown): { overrides: CoverOverrides; problems: string[] } {
  const overrides: CoverOverrides = {};
  const problems: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    if (raw !== undefined && raw !== null) problems.push('(root): expected an object keyed by video id');
    return { overrides, problems };
  }
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isVideoId(id)) {
      problems.push(`${id}: not a YouTube video id`);
    } else if (v === 'full') {
      overrides[id] = 'full';
    } else if (v && typeof v === 'object') {
      const { x, y, size } = v as Record<string, unknown>;
      if (![x, y, size].every((n) => typeof n === 'number' && Number.isFinite(n))) {
        problems.push(`${id}: x, y and size must be numbers`);
        continue;
      }
      const [bx, by, bs] = [Math.round(x as number), Math.round(y as number), Math.round(size as number)];
      if (bs < MIN_OVERRIDE_SIZE || bx < 0 || by < 0 || bx + bs > FRAME_W || by + bs > FRAME_H) {
        problems.push(`${id}: box ${bx},${by},${bs} does not fit the ${FRAME_W}x${FRAME_H} frame`);
      } else {
        overrides[id] = { x: bx, y: by, size: bs };
      }
    } else {
      problems.push(`${id}: expected {x, y, size} or "full"`);
    }
  }
  return { overrides, problems };
}
