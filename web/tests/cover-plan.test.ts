// The decisions around the detector: what the pre-build step does for an album
// (plan), what the cards render (coverSrc), and how a hand-edited override file
// is read. All pure, so no images are involved.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COVER_ALGO_VERSION,
  coverSrc,
  parseOverrides,
  planCover,
  type CoverEntry,
} from '../src/lib/cover.ts';

const V = COVER_ALGO_VERSION;
const detected = (box: [number, number, number] | null = [10, 20, 600]): CoverEntry => ({
  v: V,
  box,
  source: box ? 'detected' : 'full',
  score: 2.1,
});

// Defect caught: a human review result (T9b) being overwritten by the detector it
// was written to correct, or ignored because the cache already has a box.
test('an override box wins over a current cached detection', () => {
  const plan = planCover({ override: { x: 100, y: 50, size: 560 }, entry: detected(), fileExists: true });
  assert.deepEqual(plan, { kind: 'render', box: [100, 50, 560], source: 'override', score: 0 });
});

// Defect caught: after the same override has been rendered once, every later build
// re-downloading the frame and re-encoding the crop.
test('an override already rendered at the same box is left alone', () => {
  const entry: CoverEntry = { v: V, box: [100, 50, 560], source: 'override', score: 0 };
  assert.deepEqual(planCover({ override: { x: 100, y: 50, size: 560 }, entry, fileExists: true }), { kind: 'skip' });
  // ...but a lost crop file is rendered again
  assert.equal(planCover({ override: { x: 100, y: 50, size: 560 }, entry, fileExists: false }).kind, 'render');
});

// Defect caught: a "full" override still serving a crop (a wrong square the
// reviewer rejected), or paying a download for an album that needs no image.
test('a "full" override means no crop and no download, even if a detection is cached', () => {
  assert.deepEqual(planCover({ override: 'full', entry: detected(), fileExists: true }), { kind: 'full' });
});

// Defect caught: after an algorithm change the old boxes staying in force, so the
// improvement never reaches the site.
test('a cache entry from another algorithm version is detected again', () => {
  const stale: CoverEntry = { ...detected(), v: V - 1 };
  assert.deepEqual(planCover({ override: undefined, entry: stale, fileExists: true }), { kind: 'detect' });
});

// Defect caught: re-downloading ~2,750 frames on every build (the warm build must
// be network-free) -- and the opposite, a crop file lost from public/ never
// coming back.
test('a current cached detection is skipped, and re-rendered only when its file is gone', () => {
  assert.deepEqual(planCover({ override: undefined, entry: detected(), fileExists: true }), { kind: 'skip' });
  assert.deepEqual(planCover({ override: undefined, entry: detected(), fileExists: false }), {
    kind: 'render',
    box: [10, 20, 600],
    source: 'detected',
    score: 2.1,
  });
  // a definitive "no square" result has no file by design
  assert.deepEqual(planCover({ override: undefined, entry: detected(null), fileExists: false }), { kind: 'skip' });
});

// Defect caught: deleting an override from the file leaving its box in force
// forever (the cache still says source "override").
test('an override that was removed from the file is detected again', () => {
  const orphan: CoverEntry = { v: V, box: [100, 50, 560], source: 'override', score: 0 };
  assert.deepEqual(planCover({ override: undefined, entry: orphan, fileExists: true }), { kind: 'detect' });
});

// Defect caught: broken <img> links on cards. A crop URL is only used when the
// cache has a box AND the file is on disk; everything else falls back to the
// mqdefault frame the cards show today.
test('coverSrc serves the crop only when it exists, else the mqdefault thumbnail', () => {
  const art = 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg';
  const mq = 'https://i.ytimg.com/vi/abc123/mqdefault.jpg';
  const album = { videoId: 'abc123', artworkUrl: art };
  assert.equal(coverSrc(album, detected(), true), '/covers/abc123.webp');
  assert.equal(coverSrc(album, detected(), false), mq, 'file missing');
  assert.equal(coverSrc(album, undefined, true), mq, 'no cache entry');
  assert.equal(coverSrc(album, detected(null), true), mq, 'detector found no square');
  assert.equal(coverSrc({ videoId: '', artworkUrl: art }, detected(), true), mq, 'album without a video id');
});

// Defect caught: a mistyped override from a bulk edit (a size that runs off the
// frame, a string other than "full") reaching sharp and failing that album, or
// worse, cropping garbage. Bad entries are dropped and reported; good ones kept.
test('parseOverrides keeps valid entries and reports the invalid ones', () => {
  const { overrides, problems } = parseOverrides({
    goodVid: { x: 10, y: 20, size: 500 },
    wholeVid: 'full',
    offFrame: { x: 900, y: 20, size: 500 },
    tinyVid: { x: 10, y: 20, size: 20 },
    typoVid: 'ful',
    notNumbers: { x: '10', y: 20, size: 500 },
  });
  assert.deepEqual(overrides, { goodVid: { x: 10, y: 20, size: 500 }, wholeVid: 'full' });
  assert.deepEqual(problems.map((p) => p.split(':')[0]).sort(), ['notNumbers', 'offFrame', 'tinyVid', 'typoVid']);
});
