// The now-playing progress bar: one album is one video, cut into tracks by their
// start times. Each test names the defect a realistic wrong implementation would
// bring back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tsToSeconds, trackSpans, trackAt, timeAtX, xAtTime, trackLengths } from '../src/lib/segments.ts';

test('a timestamp with hours counts them', () => {
  // Defect: reading "1:02:03" as minutes and seconds, so every track after the
  // first hour of a long album seeks back to minute one. Text that is not a
  // timestamp counts as 0, which the span check below then rejects.
  assert.equal(tsToSeconds('1:02:03'), 3723);
  assert.equal(tsToSeconds('04:09'), 249);
  assert.equal(tsToSeconds('ab:cd'), 0);
  assert.equal(tsToSeconds(null), 0);
});

test('each track runs until the next one starts, the last one until the video ends', () => {
  // Defect: the last track ending at its own start (a zero-width segment) or
  // the spans being shifted by one track.
  assert.deepEqual(trackSpans([0, 8, 249], 300), [
    { start: 0, end: 8 },
    { start: 8, end: 249 },
    { start: 249, end: 300 },
  ]);
});

test('starts that do not move forward give no segments instead of invented ones', () => {
  // Defect: drawing segments for a tracklist without timestamps (every start
  // 0) or with a typo (a start earlier than the one before), which would show
  // tracks that are not where the bar says they are.
  assert.deepEqual(trackSpans([0, 0, 0], 300), []);
  assert.deepEqual(trackSpans([0, 120, 90], 300), []);
  assert.deepEqual(trackSpans([0, 120, 300], 300), []);
  assert.deepEqual(trackSpans([0, 120], 0), []);
});

test('the album page lists a length only where the next start gives it', () => {
  // Defect: a tracklist without timestamps (every start 0) listing "0:00" for
  // every track, a typo listing a negative length, or the last track getting a
  // length the database cannot give (it keeps the album's length in whole
  // minutes, so that one could be off by most of a minute).
  assert.deepEqual(trackLengths([0, 8, 234]), [8, 226, null]);
  assert.deepEqual(trackLengths([0, 0, 0]), [null, null, null]);
  assert.deepEqual(trackLengths([0, 120, 90]), [null, null, null]);
});

test('the moment a track starts belongs to that track', () => {
  // Defect: an off-by-one at the boundary, so the list keeps the previous track
  // highlighted for a second after the next one began.
  const spans = trackSpans([0, 8, 249], 300);
  assert.equal(trackAt(spans, 7.9), 0);
  assert.equal(trackAt(spans, 8), 1);
  assert.equal(trackAt(spans, 299), 2);
  assert.equal(trackAt(spans, 400), 2);
  assert.equal(trackAt([], 10), -1);
});

test('a point on a segment seeks into that track, not along the whole bar', () => {
  // Defect: mapping the pointer linearly over the bar's width. The gaps
  // between segments and the minimum width of a short intro make that land in
  // the wrong place: here 181s instead of 188s.
  const spans = trackSpans([0, 8, 248], 300);
  const boxes = [
    { left: 0, width: 4 },
    { left: 7, width: 200 },
    { left: 210, width: 50 },
  ];
  assert.equal(timeAtX(spans, boxes, 7 + 150), 188);
  assert.equal(xAtTime(spans, boxes, 188), 157);
  // Outside the bar it stops at the ends; in a gap it takes the nearest edge.
  assert.equal(timeAtX(spans, boxes, -20), 0);
  assert.equal(timeAtX(spans, boxes, 999), 300);
  assert.equal(timeAtX(spans, boxes, 5), 8);
});
