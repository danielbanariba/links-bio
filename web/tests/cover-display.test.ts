// coverMode: how a card draws its image. A square crop from the covers step
// (/covers/<videoId>.webp) fills the square; anything else is a 16:9 YouTube
// frame (the 761 "full" overrides, a failed crop, an album with no video), which
// must be shown whole, letterboxed over a blurred copy of itself, never
// centre-cropped (the T9b promise to the user).
import test from 'node:test';
import assert from 'node:assert/strict';
import { coverMode, pickCollage } from '../src/lib/coverDisplay.ts';

test('coverMode fills the square with a crop from the covers step', () => {
  assert.equal(coverMode('/covers/sGCKQoZFHA8.webp'), 'square');
  assert.equal(coverMode('/covers/i0Bmwo_Zlp4.webp'), 'square');
});

test('coverMode letterboxes a YouTube frame instead of cropping its centre', () => {
  // The exact bug T11 removes: a "full" album rendered `object-fit: cover` on its
  // mqdefault frame, which cut the cover art out of the middle of the frame.
  assert.equal(coverMode('https://i.ytimg.com/vi/abc123def45/mqdefault.jpg'), 'frame');
});

test('coverMode letterboxes any other image, so an unknown source is never cropped', () => {
  assert.equal(coverMode('https://cdn.deathgrind.club/a/b.jpg'), 'frame');
  // A path that only looks like the covers folder is not a crop.
  assert.equal(coverMode('/covers/../../etc/x.webp'), 'frame');
  assert.equal(coverMode('/img/covers/abc.webp'), 'frame');
});

test('coverMode reports no image for an empty or missing source', () => {
  // Fails if an empty string is treated as a frame: the card would render a
  // broken <img src="">.
  assert.equal(coverMode(''), 'none');
  assert.equal(coverMode('   '), 'none');
  assert.equal(coverMode(null), 'none');
  assert.equal(coverMode(undefined), 'none');
});

// pickCollage: the three covers fanned on a home genre/country tile, taken from
// that facet's albums in the order given (most viewed first).
test('pickCollage takes one cover per band and only square crops', () => {
  const picks = pickCollage(
    [
      { band_name: 'Alpha', cover: '/covers/aaaaaa1.webp' },
      { band_name: 'Alpha', cover: '/covers/aaaaaa2.webp' }, // same band again: a collage of one band
      { band_name: 'Bravo', cover: 'https://i.ytimg.com/vi/bbbbbb1/mqdefault.jpg' }, // a frame, squeezed into a tiny square
      { band_name: 'Charlie', cover: '/covers/cccccc1.webp' },
      { band_name: 'Delta', cover: '' },
      { band_name: 'Echo', cover: '/covers/eeeeee1.webp' },
    ],
    3,
  );
  assert.deepEqual(picks, ['/covers/aaaaaa1.webp', '/covers/cccccc1.webp', '/covers/eeeeee1.webp']);
});

test('pickCollage stops at the number asked for', () => {
  const rows = ['a', 'b', 'c', 'd'].map((b) => ({ band_name: b, cover: `/covers/${b}${b}${b}${b}${b}${b}.webp` }));
  assert.equal(pickCollage(rows, 3).length, 3);
  assert.deepEqual(pickCollage(rows, 1), ['/covers/aaaaaa.webp']);
});
