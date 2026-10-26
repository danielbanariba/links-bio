// The cover detector finds the square album art inside a 1280x720 YouTube frame.
//
// Frames are synthetic (tests/fixtures/covers/synth.ts): a stretched, textured
// background, an optional bordered square at a KNOWN position, and a fake
// left-aligned tracklist on the right half as a lure. Each test names the
// production defect it would catch.
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import { detectCover, FRAME_H, FRAME_W } from '../src/lib/coverDetect.ts';
import { toRawFrame, normalizeFrame } from '../src/lib/coverImage.ts';
import { BORDER_PX, synthFrame, type SynthCover } from './fixtures/covers/synth.ts';

const TOL = 5; // px; the search runs at half resolution, then snaps at full resolution

async function detect(cover: SynthCover | undefined, uploadYear: number | null, tracklist = true) {
  const jpeg = await synthFrame({ cover, tracklist });
  const frame = await toRawFrame(jpeg);
  return detectCover(frame, { uploadYear });
}

/** The box a perfect detector returns for a cover: the cover inset by 1.5% per side. */
function insetOf(c: SynthCover): [number, number, number] {
  const ins = Math.round(c.size * 0.015);
  return [c.x + ins, c.y + ins, c.size - 2 * ins];
}

function assertNear(actual: number[] | null, expected: number[], tol = TOL) {
  assert.ok(actual, 'expected a box, got null');
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) <= tol,
      `box ${JSON.stringify(actual)} is not within ${tol}px of ${JSON.stringify(expected)}`,
    );
  }
}

// Defect caught: a coordinate bug (the half-resolution search not scaled back up,
// an off-by-one in a side lookup) or a layout the prior wrongly excludes. Also the
// "no border sliver" property: a crop that includes the cover's own border ring
// shows a bright line on the card.
for (const layout of [
  { name: '2024-25 centred layout', cover: { x: 300, y: 20, size: 660 } },
  { name: '2026 inset layout', cover: { x: 84, y: 60, size: 600 } },
  { name: 'frame-hugging layout (cover flush with the left edge)', cover: { x: 0, y: 30, size: 650 } },
]) {
  test(`detects a bordered cover in the ${layout.name}, strictly inside its border`, async () => {
    const r = await detect(layout.cover, 2026);
    assert.equal(r.source, 'detected');
    assertNear(r.box, insetOf(layout.cover));
    const [x, y, s] = r.box!;
    assert.ok(x >= layout.cover.x + BORDER_PX, 'left edge reaches the border ring');
    assert.ok(y >= layout.cover.y + BORDER_PX, 'top edge reaches the border ring');
    assert.ok(x + s <= layout.cover.x + layout.cover.size - BORDER_PX, 'right edge reaches the border ring');
    assert.ok(y + s <= layout.cover.y + layout.cover.size - BORDER_PX, 'bottom edge reaches the border ring');
  });
}

// Defect caught: the layout prior being dropped, so a bordered square on the
// tracklist side (a decoration, a second thumbnail) is taken for the cover. The
// cover sits left of centre in every real layout.
test('a bordered square on the right half is not taken for the cover', async () => {
  const r = await detect({ x: 660, y: 40, size: 600 }, 2019, false);
  assert.equal(r.source, 'full');
  assert.equal(r.box, null);
});

// Defect caught: the template re-score pass never rescuing a cover whose border is
// too weak for the generic search (the 2026 uploads that reuse one layout). The
// cover sits 3px off the nominal template on purpose, so a result copied from the
// year geometry (which ignores the pixels) would be 3px off.
for (const tpl of [
  { name: '2024-25 template', cover: { x: 291, y: 11, size: 682, edge: 14, texture: 20 } },
  { name: '2026 template', cover: { x: 87, y: 63, size: 598, edge: 14, texture: 20 } },
]) {
  test(`rescues a weak-border cover at the ${tpl.name} through the template pass`, async () => {
    // No tracklist here: this test is about the re-score, not the lure. 2019 has no
    // year geometry, so only the pixels can place the box.
    const r = await detect(tpl.cover, 2019, false);
    assert.equal(r.source, 'template');
    assertNear(r.box, insetOf(tpl.cover), 6);
  });
}

// Defect caught: a frame with a tracklist but no cover getting a "detected" box
// over the text, or the year geometry being applied to the wrong upload year.
// 2026 uploads use the left layout, 2024-25 the centred one.
for (const y of [
  { year: 2026, expect: [84, 60, 598] },
  { year: 2025, expect: [288, 8, 682] },
  { year: 2024, expect: [288, 8, 682] },
]) {
  test(`with no cover, an upload from ${y.year} falls back to that year's layout`, async () => {
    const r = await detect(undefined, y.year);
    assert.equal(r.source, 'year-fallback');
    const ins = Math.round(y.expect[2] * 0.015);
    assertNear(r.box, [y.expect[0] + ins, y.expect[1] + ins, y.expect[2] - 2 * ins], 8);
  });
}

// Defect caught: inventing a box (a centre crop over the tracklist) when there is
// no evidence and no year geometry. null means "keep the full frame" downstream.
test('with no cover and no known year layout, the result is "full" with no box', async () => {
  for (const year of [2019, null]) {
    const r = await detect(undefined, year);
    assert.equal(r.source, 'full');
    assert.equal(r.box, null);
  }
});

// Defect caught: running the 1280x720 geometry on a frame of another shape (the
// sddefault 4:3 thumbnail the catalogue has once), which would put the crop
// somewhere meaningless. Other 16:9 sizes are scaled into the same geometry.
test('only 16:9 frames are analysed, other 16:9 sizes are scaled to 1280x720', async () => {
  const four3 = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#222' } }).jpeg().toBuffer();
  assert.equal(await normalizeFrame(four3), null);

  const hd = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#222' } }).jpeg().toBuffer();
  const norm = await normalizeFrame(hd);
  assert.ok(norm);
  const meta = await sharp(norm).metadata();
  assert.deepEqual([meta.width, meta.height], [FRAME_W, FRAME_H]);
});
