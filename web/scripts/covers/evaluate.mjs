// Offline check of a detector change against the human review labels: runs the
// old and the new detector on the same full-res frames and reports what moved.
//
//   node scripts/covers/evaluate.mjs --frames <dir> --old <coverDetect.ts> --out <dir> <verdicts.json>...
//   node scripts/covers/evaluate.mjs --frames <dir> --fetch-only
//
// --frames  where the full-res thumbnails live; missing ones are downloaded (6 at a
//           time), so keep it outside the repo and reuse it between runs.
// --old     a copy of the previous detector, e.g.
//           `git show <rev>:web/src/lib/coverDetect.ts > /some/dir/coverDetect.old.ts`
//           (it has no imports, so it runs from anywhere). Its results are cached in
//           <out>/old-results.json, keyed by the file's hash.
// --out     report and tile lists. changed-bad.json and changed-good.json feed
//           `contact-sheets.mjs <dir> --list <file> --frames <dir>`.
// verdicts  JSON arrays of {videoId, reason}, the BAD crops of a review round.
//           Every other album counts as good.
//
// A box "changed" when any edge (left, top, right, bottom) moved by more than 2%
// of the old side, or when one side has a box and the other has none.
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { detectCover } from '../../src/lib/coverDetect.ts';
import { normalizeFrame, toRawFrame } from '../../src/lib/coverImage.ts';
import { fetchWithRetry } from '../../src/lib/coverRun.ts';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const has = (name) => {
  const i = argv.indexOf(name);
  if (i > -1) argv.splice(i, 1);
  return i > -1;
};
const framesDir = opt('--frames');
const oldPath = opt('--old');
const outDir = opt('--out');
const fetchOnly = has('--fetch-only');
const verdictFiles = argv;
if (!framesDir || (!fetchOnly && (!oldPath || !outDir || verdictFiles.length === 0))) {
  console.error('usage: evaluate.mjs --frames <dir> --old <coverDetect.ts> --out <dir> <verdicts.json>...  |  --frames <dir> --fetch-only');
  process.exit(1);
}

const candidates = [process.env.REFLEX_DB, resolve(process.cwd(), '../reflex.db'), resolve(process.cwd(), 'reflex.db')].filter(Boolean);
const dbPath = candidates.find((p) => existsSync(p));
if (!dbPath) throw new Error(`reflex.db not found. Tried: ${candidates.join(', ')}`);
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const albums = db
  .prepare(
    `SELECT id, youtube_video_id AS videoId, album_artwork_url AS url, upload_date FROM albums
     WHERE youtube_video_id != '' AND album_artwork_url != '' ORDER BY id`,
  )
  .all()
  .map((r) => ({ ...r, uploadYear: Number.parseInt(String(r.upload_date).slice(0, 4), 10) || null }));
db.close();

// ─── Frames ──────────────────────────────────────────────────────────────────

await mkdir(framesDir, { recursive: true });
const frameFile = (videoId) => join(framesDir, `${videoId}.jpg`);
{
  const missing = albums.filter((a) => !existsSync(frameFile(a.videoId)));
  let cursor = 0;
  let failed = 0;
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let a = missing[cursor++]; a; a = missing[cursor++]) {
        try {
          await writeFile(frameFile(a.videoId), await fetchWithRetry(a.url));
        } catch (err) {
          failed++;
          console.warn(`[evaluate] ${a.videoId}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }),
  );
  console.log(`[evaluate] frames: ${missing.length - failed} downloaded, ${failed} failed, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
if (fetchOnly) process.exit(0);

// ─── Detection ───────────────────────────────────────────────────────────────

const bad = new Map();
for (const f of verdictFiles) for (const v of JSON.parse(await readFile(f, 'utf-8'))) bad.set(v.videoId, v.reason);

const oldSrc = await readFile(oldPath);
const oldKey = createHash('sha1').update(oldSrc).digest('hex');
const oldCacheFile = join(outDir, 'old-results.json');
await mkdir(outDir, { recursive: true });
let oldCache = {};
try {
  const c = JSON.parse(await readFile(oldCacheFile, 'utf-8'));
  if (c.key === oldKey) oldCache = c.results;
} catch {
  // first run
}
const oldDetect = (await import(pathToFileURL(resolve(oldPath)).href)).detectCover;

const pick = (r) => ({ source: r.source, box: r.box, score: r.score });
const rows = [];
let n = 0;
for (const a of albums) {
  if (!existsSync(frameFile(a.videoId))) continue;
  const norm = await normalizeFrame(await readFile(frameFile(a.videoId)));
  let oldR;
  let newR;
  if (!norm) {
    oldR = newR = { source: 'full', box: null, score: 0 };
  } else {
    const raw = await toRawFrame(norm);
    oldR = oldCache[a.videoId] ?? pick(oldDetect(raw, { uploadYear: a.uploadYear }));
    newR = pick(detectCover(raw, { uploadYear: a.uploadYear }));
  }
  oldCache[a.videoId] = oldR;
  rows.push({ id: a.id, videoId: a.videoId, bad: bad.get(a.videoId) ?? null, old: oldR, new: newR });
  if (++n % 250 === 0) console.log(`[evaluate] ${n}/${albums.length}`);
}
await writeFile(oldCacheFile, JSON.stringify({ key: oldKey, results: oldCache }));

// ─── Report ──────────────────────────────────────────────────────────────────

function changed(a, b) {
  if (!a || !b) return !!a !== !!b;
  const lim = 0.02 * a[2];
  const edges = (q) => [q[0], q[1], q[0] + q[2], q[1] + q[2]];
  const ea = edges(a);
  const eb = edges(b);
  return ea.some((v, i) => Math.abs(v - eb[i]) > lim);
}
for (const r of rows) r.changed = changed(r.old.box, r.new.box);

const tally = (list, key) => list.reduce((m, r) => ((m[key(r)] = (m[key(r)] ?? 0) + 1), m), {});
const goods = rows.filter((r) => !r.bad);
const bads = rows.filter((r) => r.bad);
const changedGood = goods.filter((r) => r.changed);
const changedBad = bads.filter((r) => r.changed);

const lines = [
  `albums evaluated: ${rows.length} (good ${goods.length}, bad ${bads.length})`,
  `new sources: ${JSON.stringify(tally(rows, (r) => r.new.source))}`,
  `old -> new source: ${JSON.stringify(tally(rows, (r) => `${r.old.source}->${r.new.source}`))}`,
  `GOOD changed: ${changedGood.length} (${((100 * changedGood.length) / goods.length).toFixed(2)}% of goods)`,
  ...changedGood.map(
    (r) => `  album ${r.id} ${r.videoId}: ${r.old.source} ${JSON.stringify(r.old.box)} -> ${r.new.source} ${JSON.stringify(r.new.box)}`,
  ),
  `BAD changed: ${changedBad.length} of ${bads.length}; became template: ${changedBad.filter((r) => r.new.source === 'template').length}`,
  `BAD changed by reason: ${JSON.stringify(tally(changedBad, (r) => r.bad))}`,
  `BAD changed, new source: ${JSON.stringify(tally(changedBad, (r) => r.new.source))}`,
  `BAD no-cover now full: ${bads.filter((r) => r.bad === 'no-cover' && r.new.source === 'full').length} of ${bads.filter((r) => r.bad === 'no-cover').length}`,
];
console.log(lines.join('\n'));
await writeFile(join(outDir, 'report.txt'), `${lines.join('\n')}\n`);
await writeFile(join(outDir, 'results.json'), JSON.stringify(rows));
const tiles = (list) => list.map((r) => ({ id: r.id, videoId: r.videoId, old: r.old, new: r.new, note: r.bad ?? 'good' }));
await writeFile(join(outDir, 'changed-bad.json'), JSON.stringify(tiles(changedBad)));
await writeFile(join(outDir, 'changed-good.json'), JSON.stringify(tiles(changedGood)));
