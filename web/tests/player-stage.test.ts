// Where the ONE YouTube iframe goes. The Player never moves the iframe in the
// DOM (that reloads the video): it lays it over a slot (the desktop panel, the
// now-playing art, the floating tile). YouTube's embed rules: while it plays the
// player is at least 200x200, inside the viewport, not covered and not cropped.
// Each test names the defect a realistic wrong implementation would bring back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSurface, videoBox, fitsInside, nearestCorner, tileAt } from '../src/lib/playerStage.ts';

test('the video goes to the slot of what is on screen, else the floating tile', () => {
  // Defects: a phone getting the desktop panel (off-screen there), or the video
  // laid over a now-playing art that is cut off instead of moving to the tile.
  const yes = () => true;
  const no = () => false;
  assert.equal(pickSurface({ open: false, view: false, layout: 'desktop', usable: yes }), 'hidden');
  assert.equal(pickSurface({ open: true, view: false, layout: 'desktop', usable: yes }), 'panel');
  assert.equal(pickSurface({ open: true, view: false, layout: 'tablet', usable: yes }), 'tile');
  assert.equal(pickSurface({ open: true, view: false, layout: 'phone', usable: yes }), 'tile');
  assert.equal(pickSurface({ open: true, view: true, layout: 'phone', usable: yes }), 'art');
  assert.equal(pickSurface({ open: true, view: true, layout: 'tablet', usable: no }), 'tile');
  assert.equal(pickSurface({ open: true, view: false, layout: 'desktop', usable: no }), 'tile');
});

test('in a square slot the 16:9 video is shown whole, centred, at full width', () => {
  // Defect: stretching the iframe over the square (YouTube then letterboxes it
  // in black, hiding the blurred cover behind) or sizing it past the slot,
  // which would crop the video.
  assert.deepEqual(videoBox({ left: 10, top: 20, width: 480, height: 480 }, 'video'), {
    left: 10,
    top: 20 + (480 - 270) / 2,
    width: 480,
    height: 270,
  });
});

test('a slot too small for a 200px-tall 16:9 video gets the iframe over all of it', () => {
  // Defect: the 280px desktop panel getting a 280x157 iframe, under YouTube's
  // 200px minimum. Filled, the square iframe letterboxes the video itself.
  const panel = { left: 0, top: 0, width: 280, height: 280 };
  assert.deepEqual(videoBox(panel, 'video'), panel);
  assert.deepEqual(videoBox(panel, 'fill'), panel);
});

test('a video box under 200px or partly outside the visible area is not usable', () => {
  // Defect: laying the video over a slot that is clipped by the top bar or the
  // screen edge, where YouTube's player would be covered or cut.
  const visible = { left: 0, top: 68, width: 390, height: 700 };
  assert.equal(fitsInside({ left: 0, top: 68, width: 200, height: 200 }, visible), true);
  assert.equal(fitsInside({ left: 0, top: 67, width: 200, height: 200 }, visible), false);
  assert.equal(fitsInside({ left: 200, top: 100, width: 200, height: 200 }, visible), false);
  assert.equal(fitsInside({ left: 0, top: 100, width: 199, height: 200 }, visible), false);
});

test('a dropped tile snaps to the corner nearest its centre within the free area', () => {
  // Defect: comparing against the middle of the whole viewport. The free area
  // starts below the top bar and ends above the player bars, so its middle is
  // higher: a tile dropped at y=400 on a phone belongs at the bottom.
  const area = { left: 12, top: 68, width: 366, height: 628 };
  assert.equal(nearestCorner({ x: 100, y: 400 }, area), 'bl');
  assert.equal(nearestCorner({ x: 300, y: 100 }, area), 'tr');
  assert.equal(nearestCorner({ x: 250, y: 650 }, area), 'br');
  assert.equal(nearestCorner({ x: 40, y: 90 }, area), 'tl');
});

test('in a bottom corner the tile ends where the free area ends, above the player bars', () => {
  // Defect: placing it from the viewport's bottom, over the mini player and the
  // tab bar on a phone.
  const area = { left: 12, top: 68, width: 366, height: 628 };
  const tile = { width: 212, height: 232 };
  assert.deepEqual(tileAt('bl', area, tile, 26), { left: 12, top: 68 + 628 - 232 });
  assert.deepEqual(tileAt('tr', area, tile, 26), { left: 12 + 366 - 212, top: 68 });
});

test('when the free area is shorter than the tile, the tile gives up the top bar, never the bars below', () => {
  // Defect: keeping a top corner under the top bar on a landscape tablet, which
  // pushes the tile down over the mini player.
  const area = { left: 108, top: 76, width: 716, height: 202 };
  const tile = { width: 212, height: 232 };
  assert.equal(tileAt('tl', area, tile, 26).top, 76 + 202 - 232);
  assert.equal(tileAt('bl', area, tile, 26).top, 76 + 202 - 232);
});
