// Queue logic behind the "play from any card" player. One album is one long
// video, so the queue is a list of albums. Each test names the defect that a
// realistic wrong implementation would reintroduce.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQueue,
  nextIndex,
  prevIndex,
  markUnplayable,
  upNext,
  withIndex,
  extendQueue,
  shuffleUpcoming,
  restoreOrder,
  afterEnd,
} from '../src/lib/queue.ts';

const card = (videoId: string) => ({ videoId, title: `album ${videoId}` });
const row = (...ids: string[]) => ids.map(card);
const ids = (items: { videoId: string }[]) => items.map((i) => i.videoId);

test('pressing the second card of a row makes the third card the next one', () => {
  // Defect: the queue starting at index 0 (or at the page's first card)
  // instead of at the pressed card, so "next" would name the wrong album.
  const q = buildQueue(row('a', 'b', 'c', 'd'), 'b')!;
  assert.equal(q.index, 1);
  assert.equal(q.items[nextIndex(q)].videoId, 'c');
  assert.equal(q.items[prevIndex(q)].videoId, 'a');
});

test('the last album has no next: playback stops instead of wrapping', () => {
  // Defect: `(index + 1) % length` restarts the row forever when the last
  // album ends, or returns an index past the end and loads `undefined`.
  const q = buildQueue(row('a', 'b', 'c'), 'c')!;
  assert.equal(nextIndex(q), -1);
});

test('the first album has no previous', () => {
  // Defect: prev wrapping to the last album when pressed on the first one.
  const q = buildQueue(row('a', 'b', 'c'), 'a')!;
  assert.equal(prevIndex(q), -1);
});

test('next and previous skip albums marked unplayable', () => {
  // Defect: an album that cannot be embedded is chosen again, so auto-next
  // stalls on the same error instead of moving on.
  let q = buildQueue(row('a', 'b', 'c', 'd'), 'b')!;
  q = markUnplayable(q, 'c');
  assert.equal(q.items[nextIndex(q)].videoId, 'd');
  q = markUnplayable(withIndex(q, 3), 'b');
  assert.equal(q.items[prevIndex(q)].videoId, 'a');
});

test('when every later album is unplayable there is no next', () => {
  // Defect: an error cascade that never terminates, because the skip logic
  // falls back to the first unplayable entry instead of reporting "none".
  let q = buildQueue(row('a', 'b', 'c'), 'a')!;
  q = markUnplayable(markUnplayable(q, 'b'), 'c');
  assert.equal(nextIndex(q), -1);
});

test('markUnplayable returns a new queue and leaves the original untouched', () => {
  // Defect: mutating the shared set, so a stale queue held by the UI silently
  // changes what "next" means.
  const q = buildQueue(row('a', 'b', 'c'), 'a')!;
  const marked = markUnplayable(q, 'b');
  assert.equal(q.items[nextIndex(q)].videoId, 'b');
  assert.equal(marked.items[nextIndex(marked)].videoId, 'c');
});

test('an album repeated in the scope is queued once, at its first position', () => {
  // Defect: the same album sitting in two rows plays twice in a row, and the
  // album page (this album first, then the page's cards, which may include
  // it) would hear itself again right after it ends.
  const q = buildQueue([card('page'), ...row('x', 'page', 'y')], 'page')!;
  assert.deepEqual(ids(q.items), ['page', 'x', 'y']);
  assert.equal(q.index, 0);
});

test('cards without a video id never enter the queue', () => {
  // Defect: a card with a null or empty id reaches loadVideoById('') and the
  // player stalls with no error to skip on.
  const q = buildQueue(
    [card('a'), { videoId: '', title: 'no video' }, { videoId: null as unknown as string, title: 'null' }, card('b')],
    'a',
  )!;
  assert.deepEqual(ids(q.items), ['a', 'b']);
});

test('an empty scope builds no queue', () => {
  // Defect: returning a queue with index 0 over zero items, which the caller
  // would then dereference.
  assert.equal(buildQueue([], 'a'), null);
});

test('up next lists the next three playable albums and never wraps', () => {
  // Defect: the "Up next" column listing an album that will be skipped, or
  // wrapping around to the start and promising albums that will not play.
  let q = buildQueue(row('a', 'b', 'c', 'd', 'e', 'f'), 'a')!;
  q = markUnplayable(q, 'c');
  assert.deepEqual(ids(upNext(q)), ['b', 'd', 'e']);
  assert.deepEqual(ids(upNext(withIndex(q, 4))), ['f']);
  assert.deepEqual(ids(upNext(withIndex(q, 5))), []);
});

// ─── extendQueue: "Load more" adds cards to a scope after its queue was built ───

test('a queue at its last album continues with the cards the scope gained', () => {
  // Defect: the queue only covers the 24 results rendered when the ▶ was
  // pressed, so after "Load more" playback still ends at result 24.
  const q = buildQueue(row('a', 'b', 'c'), 'c')!;
  const longer = extendQueue(q, row('a', 'b', 'c', 'd', 'e'))!;
  assert.equal(longer.index, 2);
  assert.equal(longer.items[nextIndex(longer)].videoId, 'd');
  assert.deepEqual(ids(upNext(longer)), ['d', 'e']);
});

test('the rebuilt queue still skips albums that failed to embed', () => {
  // Defect: rebuilding from the cards with a fresh unplayable set, so an
  // album that already errored is tried (and errors) again.
  let q = buildQueue(row('a', 'b', 'c'), 'c')!;
  q = markUnplayable(q, 'b');
  const longer = extendQueue(q, row('a', 'b', 'c', 'd'))!;
  assert.equal(longer.items[prevIndex(longer)].videoId, 'a');
});

test('nothing new after the loaded album means no extended queue', () => {
  // Defect: returning a queue that still has no next, which the caller would
  // take as "extended" and keep waiting on, instead of ending playback. New
  // cards that already failed to embed do not count as new.
  let q = buildQueue(row('a', 'b', 'c'), 'c')!;
  assert.equal(extendQueue(q, row('a', 'b', 'c')), null);
  q = markUnplayable(q, 'd');
  assert.equal(extendQueue(q, row('a', 'b', 'c', 'd')), null);
});

test('a scope that no longer holds the loaded album does not move the queue', () => {
  // Defect: buildQueue falls back to index 0 when the start album is missing,
  // so a filter change would jump playback to the first result.
  const q = buildQueue(row('a', 'b', 'c'), 'c')!;
  assert.equal(extendQueue(q, row('x', 'y', 'z')), null);
});

// ─── shuffle and repeat (the now-playing view's side buttons) ───────────────────

// A random source that always picks the first candidate: Fisher-Yates then
// reverses-and-rotates, so the order surely changes.
const first = () => 0;

test('shuffle reorders only what is still to come', () => {
  // Defect: shuffling the whole list moves the album that plays now (the view
  // would then name another album as current) or brings back one already heard.
  const q = buildQueue(row('a', 'b', 'c', 'd', 'e', 'f'), 'c')!;
  const s = shuffleUpcoming(q, first);
  assert.deepEqual(ids(s.items.slice(0, 3)), ['a', 'b', 'c']);
  assert.equal(s.index, 2);
  assert.notDeepEqual(ids(s.items.slice(3)), ['d', 'e', 'f']);
  assert.deepEqual(ids(s.items.slice(3)).sort(), ['d', 'e', 'f']);
});

test('shuffle keeps skipping the albums that failed to embed', () => {
  // Defect: returning a queue with a fresh unplayable set, so an album that
  // already errored is loaded (and errors) again after shuffling.
  let q = buildQueue(row('a', 'b', 'c', 'd'), 'a')!;
  q = markUnplayable(q, 'c');
  const s = shuffleUpcoming(q, first);
  assert.ok(!upNext(s, 5).some((i) => i.videoId === 'c'));
});

test('shuffle off goes back to the built order, at the album that plays now', () => {
  // Defect: restoring the old index, which in the original order points at a
  // different album, so "next" would skip or repeat albums.
  const built = buildQueue(row('a', 'b', 'c', 'd', 'e'), 'a')!;
  const shuffled = shuffleUpcoming(built, first);
  const playing = withIndex(shuffled, 1);
  const current = playing.items[1].videoId;
  const back = restoreOrder(playing, built.items);
  assert.equal(back.items[back.index].videoId, current);
  assert.deepEqual(ids(back.items), ['a', 'b', 'c', 'd', 'e']);
});

test('with repeat on, the album that ended plays again even when another follows', () => {
  // Defect: the repeat button only changing its own look while auto-next still
  // moves on to the next album.
  const q = buildQueue(row('a', 'b', 'c'), 'b')!;
  assert.equal(afterEnd(q, true), 1);
  assert.equal(afterEnd(q, false), 2);
  assert.equal(afterEnd(withIndex(q, 2), false), -1);
});
