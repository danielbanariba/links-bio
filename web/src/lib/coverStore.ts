// Disk side of the covers: the gitignored cache, the tracked override file, and
// the lookup the page build uses to pick each card's image.
// Paths resolve from process.cwd() (web/), like db.ts, because import.meta.url is
// unreliable once Astro bundles this module.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { coverFileName, coverSrc, parseOverrides } from './cover.ts';
import type { CoverCache } from './cover.ts';

export function coverPaths(cwd: string = process.cwd()) {
  return {
    cache: resolve(cwd, '.cover-cache.json'),
    overrides: resolve(cwd, 'src/data/cover-overrides.json'),
    coversDir: resolve(cwd, 'public/covers'),
    previewDir: resolve(cwd, '.cover-previews'),
  };
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return undefined; // missing or unreadable: callers treat it as empty
  }
}

export function readCoverCache(file: string): CoverCache {
  const raw = readJson(file);
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as CoverCache) : {};
}

/** Atomic write (temp file + rename) so a killed build never leaves a half-written cache. */
export function writeCoverCache(file: string, cache: CoverCache): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(cache), 'utf-8');
  renameSync(tmp, file);
}

/**
 * The tracked override file. A missing file means no overrides; a file that is
 * there but not valid JSON is `unreadable`, never read as empty: that would
 * silently re-crop every album a reviewer decided by hand.
 */
export function readCoverOverrides(file: string): ReturnType<typeof parseOverrides> & { unreadable: boolean } {
  if (!existsSync(file)) return { ...parseOverrides(undefined), unreadable: false };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf-8'));
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    return { overrides: {}, problems: [`(file): not valid JSON: ${why}`], unreadable: true };
  }
  return { ...parseOverrides(raw), unreadable: false };
}

// ─── Page-build lookup (used by db.ts) ───────────────────────────────────────

let loaded: { cache: CoverCache; files: Set<string> } | null = null;

function load() {
  if (loaded) return loaded;
  const p = coverPaths();
  let files = new Set<string>();
  try {
    files = new Set(readdirSync(p.coversDir));
  } catch {
    // no covers yet: every card falls back to the mqdefault frame
  }
  loaded = { cache: readCoverCache(p.cache), files };
  return loaded;
}

/** The image URL for a card: the square crop when it exists, else the mqdefault frame. */
export function coverUrl(videoId: string | null | undefined, artworkUrl: string | null | undefined): string {
  const { cache, files } = load();
  const id = videoId ?? '';
  return coverSrc({ videoId, artworkUrl }, cache[id], files.has(coverFileName(id)));
}
