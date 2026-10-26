// The pre-build step end to end, with the network replaced by an in-memory
// fetchImage: files really land on disk, the cache really round-trips. Each test
// names the build-time failure it guards against.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

import { fetchWithRetry, runCovers, type RunAlbum } from '../src/lib/coverRun.ts';
import { synthFrame } from './fixtures/covers/synth.ts';

const art = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
const album = (id: number, videoId: string, uploadYear = 2026): RunAlbum => ({ id, videoId, artworkUrl: art(videoId), uploadYear });

function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), 'cover-run-'));
  const calls: string[] = [];
  return {
    dir,
    calls,
    coversDir: path.join(dir, 'covers'),
    previewDir: path.join(dir, 'previews'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

const quiet = () => {};

// Defect caught: one dead video (404) or one corrupt image aborting the whole
// build, or being cached as a final answer so it is never retried.
test('a failed album is logged and skipped; the others are processed and the failure is not cached', async () => {
  const s = setup();
  try {
    const good = await synthFrame({ cover: { x: 84, y: 60, size: 600 } });
    const fetchImage = async (url: string) => {
      s.calls.push(url);
      if (url.includes('vidDead')) throw new Error('HTTP 404');
      if (url.includes('vidCorrupt')) return Buffer.from('not an image');
      return good;
    };
    const { cache, summary } = await runCovers({
      albums: [album(1, 'vidOk1'), album(2, 'vidDead'), album(3, 'vidCorrupt'), album(4, 'vidOk2')],
      overrides: {},
      cache: {},
      fetchImage,
      coversDir: s.coversDir,
      previewDir: s.previewDir,
      concurrency: 2,
      log: quiet,
    });
    assert.equal(summary.failed, 2);
    assert.deepEqual(Object.keys(cache).sort(), ['vidOk1', 'vidOk2']);
    assert.ok(existsSync(path.join(s.coversDir, 'vidOk1.webp')));
    assert.ok(existsSync(path.join(s.coversDir, 'vidOk2.webp')));
    assert.ok(!existsSync(path.join(s.coversDir, 'vidDead.webp')));
    assert.ok(existsSync(path.join(s.previewDir, 'vidOk1.webp')), 'the 320x180 preview for the contact sheets is kept');
  } finally {
    s.cleanup();
  }
});

// Defect caught: a warm build (the twice-a-day timer) hitting the network for
// every album again, which is what would blow the sync unit's timeout.
test('a second run over a filled cache downloads nothing', async () => {
  const s = setup();
  try {
    const good = await synthFrame({ cover: { x: 84, y: 60, size: 600 } });
    const fetchImage = async (url: string) => {
      s.calls.push(url);
      return good;
    };
    const albums = [album(1, 'vidAlpha'), album(2, 'vidBravo')];
    const first = await runCovers({ albums, overrides: {}, cache: {}, fetchImage, coversDir: s.coversDir, previewDir: s.previewDir, log: quiet });
    assert.equal(s.calls.length, 2);
    const second = await runCovers({ albums, overrides: {}, cache: first.cache, fetchImage, coversDir: s.coversDir, previewDir: s.previewDir, log: quiet });
    assert.equal(s.calls.length, 2, 'no further downloads');
    assert.deepEqual(second.cache, first.cache);
  } finally {
    s.cleanup();
  }
});

// Defect caught: an override box ignored (the crop taken from the detector's box
// or the frame centre) or written at the wrong size/format; and a "full" override
// still costing a download or leaving a stale crop file behind.
test('an override box is cropped exactly and "full" removes the crop without a download', async () => {
  const s = setup();
  try {
    // flat dark frame with one pure-red 300px square at (500,100)
    const frame = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#202020' } })
      .composite([{ input: { create: { width: 300, height: 300, channels: 3, background: '#ff0000' } }, left: 500, top: 100 }])
      .jpeg({ quality: 95 })
      .toBuffer();
    const fetchImage = async (url: string) => {
      s.calls.push(url);
      return frame;
    };
    const base = { coversDir: s.coversDir, previewDir: s.previewDir, fetchImage, log: quiet };
    const r1 = await runCovers({ ...base, albums: [album(1, 'vidRed1')], overrides: { vidRed1: { x: 520, y: 120, size: 260 } }, cache: {} });
    assert.equal(r1.cache.vidRed1.source, 'override');
    const file = path.join(s.coversDir, 'vidRed1.webp');
    const meta = await sharp(file).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 400, 400]);
    const px = await sharp(file).extract({ left: 200, top: 200, width: 1, height: 1 }).raw().toBuffer();
    assert.ok(px[0] > 200 && px[1] < 60 && px[2] < 60, `expected red, got rgb(${px[0]},${px[1]},${px[2]})`);

    const before = s.calls.length;
    const r2 = await runCovers({ ...base, albums: [album(1, 'vidRed1')], overrides: { vidRed1: 'full' }, cache: r1.cache });
    assert.equal(s.calls.length, before, 'no download for a "full" override');
    assert.ok(!existsSync(file), 'the old crop file is removed');
    assert.deepEqual([r2.cache.vidRed1.source, r2.cache.vidRed1.box], ['full', null]);
  } finally {
    s.cleanup();
  }
});

const res = (status: number, headers: Record<string, string> = {}) =>
  new Response(status === 200 ? new Uint8Array([1, 2, 3]) : 'x', { status, headers });

// Defect caught: a transient 429/5xx from the thumbnail CDN silently dropping an
// album's cover for the whole build...
test('fetchWithRetry retries throttling and server errors with backoff, then succeeds', async () => {
  const seq = [res(429, { 'retry-after': '0' }), res(503), res(200)];
  const sleeps: number[] = [];
  const buf = await fetchWithRetry('https://x/y.jpg', {
    fetchFn: async () => seq.shift()!,
    sleep: async (ms) => void sleeps.push(ms),
  });
  assert.deepEqual([...buf], [1, 2, 3]);
  assert.equal(sleeps.length, 2);
  assert.ok(sleeps[1] > sleeps[0], 'backoff grows');
});

// ...and the opposite: a permanent 404 retried like a transient error would burn
// the full backoff on every build for a deleted video.
test('fetchWithRetry does not retry a 404', async () => {
  let n = 0;
  await assert.rejects(
    fetchWithRetry('https://x/y.jpg', { fetchFn: async () => (n++, res(404)), sleep: async () => {} }),
    /404/,
  );
  assert.equal(n, 1);
});
