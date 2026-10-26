// Pre-build step: make public/covers/<videoId>.webp (a 400px square WebP) for every
// album, so cards show the clean album art instead of the whole 16:9 YouTube frame.
//
//   npm run covers              # also runs before `astro build` (see package.json)
//   npm run covers -- --limit 40   # first 40 albums only, for experiments
//
// How it decides, per album (src/lib/cover.ts, planCover):
//   1. src/data/cover-overrides.json (tracked): a reviewed box, or "full" = no crop;
//   2. .cover-cache.json (gitignored): the detector's result, valid while the
//      algorithm version matches;
//   3. otherwise download the full-res thumbnail and run the detector (coverDetect.ts).
// Nothing is downloaded when the cache is warm. The first run on a fresh checkout
// downloads ~2,750 frames (minutes): run it by hand before the sync timer's build.
//
// Never fails the build: one bad album is logged and keeps the mqdefault frame; an
// unexpected error is logged loudly and the build goes on with whatever exists.
// Without reflex.db the step skips itself (the page build reports the missing
// database on its own), and so it does when cover-overrides.json is not valid
// JSON: running without the reviewers' decisions would re-crop the albums they
// fixed by hand, so the crops and the cache stay exactly as they are.
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchWithRetry, formatSummary, runCovers } from '../../src/lib/coverRun.ts';
import { coverPaths, readCoverCache, readCoverOverrides, writeCoverCache } from '../../src/lib/coverStore.ts';

// Same DB lookup as src/lib/db.ts (cwd is web/ under npm).
const candidates = [process.env.REFLEX_DB, resolve(process.cwd(), '../reflex.db'), resolve(process.cwd(), 'reflex.db')].filter(Boolean);
const dbPath = candidates.find((p) => existsSync(p));
if (!dbPath) {
  console.error(`[covers] reflex.db not found, covers step skipped. Tried: ${candidates.join(', ')}`);
  process.exit(0);
}

const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

try {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const rows = db
    .prepare(
      `SELECT id, youtube_video_id, album_artwork_url, upload_date FROM albums
       WHERE youtube_video_id != '' AND album_artwork_url != '' ORDER BY id`,
    )
    .all();
  db.close();
  const albums = rows.slice(0, limit).map((r) => ({
    id: r.id,
    videoId: r.youtube_video_id,
    artworkUrl: r.album_artwork_url,
    uploadYear: Number.parseInt(String(r.upload_date).slice(0, 4), 10) || null,
  }));

  const paths = coverPaths();
  const { overrides, problems, unreadable } = readCoverOverrides(paths.overrides);
  if (unreadable) {
    console.error(`[covers] FAILED to read ${paths.overrides}, covers step skipped, the existing crops stay: ${problems.join('; ')}`);
    process.exit(0);
  }
  for (const p of problems) console.warn(`[covers] cover-overrides.json ignored an entry: ${p}`);

  const { cache, summary } = await runCovers({
    albums,
    overrides,
    cache: readCoverCache(paths.cache),
    fetchImage: (url) => fetchWithRetry(url),
    coversDir: paths.coversDir,
    previewDir: paths.previewDir,
    concurrency: 6,
    // A killed cold run keeps the albums it already finished.
    onCheckpoint: (c) => writeCoverCache(paths.cache, c),
  });
  writeCoverCache(paths.cache, cache);
  console.log(formatSummary(summary));
} catch (err) {
  console.error(`[covers] FAILED, the build continues with the mqdefault frames: ${err instanceof Error ? err.stack : err}`);
}
