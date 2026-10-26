// Which key a cover's colour is cached under (.vibrant-cache.json). A failed
// extraction is never cached, so the key is what decides whether a build reuses
// an old colour. Each test names the defect a wrong key would bring back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { colorCacheKey } from '../src/lib/vibrant.ts';

const THUMB = 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg';

test('re-cropping a cover gives it a new colour key', () => {
  // Defect: keying a crop by its video id or file name alone, so an override that
  // moves the box (T9b) keeps the colour of the old, wrong crop forever.
  const before = colorCacheKey({ crop: { videoId: 'abcdefghijk', box: [40, 60, 600] }, thumbUrl: THUMB });
  const moved = colorCacheKey({ crop: { videoId: 'abcdefghijk', box: [40, 60, 560] }, thumbUrl: THUMB });
  const shifted = colorCacheKey({ crop: { videoId: 'abcdefghijk', box: [80, 60, 600] }, thumbUrl: THUMB });
  assert.notEqual(before, moved);
  assert.notEqual(before, shifted);
  // ...and the same box keeps the same key, so a warm build extracts nothing.
  assert.equal(before, colorCacheKey({ crop: { videoId: 'abcdefghijk', box: [40, 60, 600] }, thumbUrl: THUMB }));
});

test('a cropped cover never reuses the colour cached for its full video frame', () => {
  // Defect: keying the crop by the mqdefault URL (the old key), so every album keeps
  // the colour of the whole frame, tracklist text and borders included.
  const crop = colorCacheKey({ crop: { videoId: 'abcdefghijk', box: [40, 60, 600] }, thumbUrl: THUMB });
  assert.notEqual(crop, colorCacheKey({ crop: null, thumbUrl: THUMB }));
});
