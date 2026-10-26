// Mine the detector's TEMPLATES list from human-reviewed crops.
//
//   node scripts/covers/mine-templates.mjs <verdicts.json>... [--cache <file>] [--tol 6] [--min 15]
//
// Input: the cover cache the review looked at (default .cover-cache.json; after a
// COVER_ALGO_VERSION bump, pass a saved copy of the reviewed one) and the review
// verdicts, JSON arrays of {videoId, reason, ...} that list the BAD crops only. Every
// other cached box with a crop is a "good" box: a human looked at it and kept it.
//
// The cache stores post-inset boxes (finish() insets each side by 1.5%); the
// detector's templates are pre-inset, so each good box is converted back first.
// Clustering is greedy: the box with the most neighbours within +-tol px on x, y
// and size seeds a cluster, its neighbours join it, the cluster centre is their
// per-axis median, and the members are removed before the next seed. Clusters with
// fewer than --min members are dropped.
//
// Output: one line per cluster, then a TypeScript literal to paste into
// src/lib/coverDetect.ts. Re-run it after a new review round.
import { readFileSync } from 'node:fs';
import { coverPaths, readCoverCache } from '../../src/lib/coverStore.ts';

const INSET = 0.015; // must match P.inset in coverDetect.ts

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const cacheFile = flag('--cache', coverPaths().cache);
const tol = Number(flag('--tol', 6));
const minSupport = Number(flag('--min', 15));
if (args.length === 0) {
  console.error('usage: node scripts/covers/mine-templates.mjs <verdicts.json>... [--cache <file>] [--tol 6] [--min 15]');
  process.exit(1);
}

const bad = new Set();
for (const file of args) for (const v of JSON.parse(readFileSync(file, 'utf-8'))) bad.add(v.videoId);

/** Undo finish()'s inset: the pre-inset square whose inset is the cached box. */
function preInset([x, y, s]) {
  let side = Math.round(s / (1 - 2 * INSET));
  // round() makes the inverse ambiguous by a pixel; take the side that maps back exactly.
  for (const cand of [side, side - 1, side + 1]) {
    if (cand - 2 * Math.round(cand * INSET) === s) {
      side = cand;
      break;
    }
  }
  const ins = Math.round(side * INSET);
  return [x - ins, y - ins, side];
}

const cache = readCoverCache(cacheFile);
const good = [];
for (const [videoId, e] of Object.entries(cache)) {
  if (!e.box || e.source === 'override' || bad.has(videoId)) continue;
  good.push(preInset(e.box));
}

const near = (a, b) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
const median = (v) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

let left = good.slice();
const clusters = [];
for (;;) {
  let seed = -1;
  let seedN = 0;
  for (let i = 0; i < left.length; i++) {
    let n = 0;
    for (const b of left) if (near(left[i], b)) n++;
    if (n > seedN) [seed, seedN] = [i, n];
  }
  if (seed < 0 || seedN < minSupport) break;
  const members = left.filter((b) => near(left[seed], b));
  const centre = [0, 1, 2].map((k) => median(members.map((b) => b[k])));
  clusters.push({ centre, n: members.length });
  left = left.filter((b) => !near(left[seed], b));
}

console.log(`${good.length} good boxes, ${bad.size} bad; tol +-${tol}px, min support ${minSupport}`);
for (const c of clusters) console.log(`  [${c.centre.join(', ')}]  n=${c.n}`);
console.log(`${good.length - left.length} boxes in ${clusters.length} clusters, ${left.length} unclustered\n`);
console.log('export const TEMPLATES: readonly CoverBox[] = [');
for (const c of clusters) console.log(`  [${c.centre.join(', ')}], // n=${c.n}`);
console.log('];');
