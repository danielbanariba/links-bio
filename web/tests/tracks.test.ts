// Track lengths for the album page tracklist.
//
// Every album is ONE long YouTube video and a timestamp is where a track STARTS, so a
// length is the gap to the next start. The last track runs to the end of the video, whose
// length is only known to the minute (`duration_minutes` is rounded). The defects these
// tests guard: a length that is wrong (a single track that starts late, starts that do not
// rise), or a length that claims more precision than the data has (an estimate printed as
// exact minutes:seconds).
import test from 'node:test';
import assert from 'node:assert/strict';
import { clock, lengthLabel, trackLengths, tsToSeconds } from '../src/lib/tracks.ts';

test('every track but the last is the exact gap to the next start; the last is an estimate', () => {
  assert.deepEqual(trackLengths([0, 200, 450], 600), [
    { seconds: 200, estimate: false },
    { seconds: 250, estimate: false },
    { seconds: 150, estimate: true },
  ]);
});

test('a single track is measured from where it starts, not from zero', () => {
  assert.deepEqual(trackLengths([90], 600), [{ seconds: 510, estimate: true }]);
  assert.deepEqual(trackLengths([0], 600), [{ seconds: 600, estimate: true }]);
});

test('starts that do not strictly rise give no lengths at all', () => {
  // equal starts (two tracks without a timestamp both read 0), and a start that goes backwards
  assert.deepEqual(trackLengths([0, 0, 0], 900), [null, null, null]);
  assert.deepEqual(trackLengths([0, 300, 120], 900), [null, null, null]);
});

test('without a duration the last track has no length and the others keep theirs', () => {
  assert.deepEqual(trackLengths([0, 200], 0), [{ seconds: 200, estimate: false }, null]);
  assert.deepEqual(trackLengths([0, 200], null), [{ seconds: 200, estimate: false }, null]);
});

test('a last track needs at least 15 seconds of video left, otherwise it has no length', () => {
  assert.deepEqual(trackLengths([0, 586], 600)[1], null);                       // 14 s left
  assert.deepEqual(trackLengths([0, 585], 600)[1], { seconds: 15, estimate: true });  // 15 s left
  assert.deepEqual(trackLengths([0, 584], 600)[1], { seconds: 16, estimate: true });  // 16 s left
  assert.deepEqual(trackLengths([0, 700], 600)[1], null);                       // starts after the total ends
});

test('an estimate is printed to the minute, never as exact minutes:seconds', () => {
  assert.equal(lengthLabel({ seconds: 200, estimate: false }), '3:20');
  assert.equal(lengthLabel({ seconds: 372, estimate: true }), '~6 min');
  assert.equal(lengthLabel({ seconds: 20, estimate: true }), '~1 min');
  assert.equal(lengthLabel(null), '');
});

test('timestamps read as H:MM:SS, M:SS or bare seconds, and junk reads as zero', () => {
  assert.equal(tsToSeconds('1:02:03'), 3723);
  assert.equal(tsToSeconds('12:34'), 754);
  assert.equal(tsToSeconds('45'), 45);
  assert.equal(tsToSeconds(null), 0);
  assert.equal(tsToSeconds('soon'), 0);
});

test('a clock pads the seconds, and the minutes only when there are hours', () => {
  assert.equal(clock(65), '1:05');
  assert.equal(clock(3600), '1:00:00');
  assert.equal(clock(3725), '1:02:05');
});
