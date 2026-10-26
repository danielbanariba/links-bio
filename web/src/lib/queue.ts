// Pure queue logic for the persistent Player island. One album is one long
// YouTube video, so a queue is a list of albums, identified by `videoId`.
//
// No DOM and no YT API in here: the island owns the side effects, this module
// only answers "which album is next / previous / coming up".
//
// The queue is immutable. Every function returns a new value, so a stale
// reference held by the UI can never change what "next" means.

export interface QueueItem {
  videoId: string;
}

export interface Queue<T extends QueueItem = QueueItem> {
  items: T[];
  /** Position of the album that is loaded now. */
  index: number;
  /** Videos that failed to embed (YT errors 2/5/100/101/150): skipped both ways. */
  unplayable: ReadonlySet<string>;
}

/**
 * Builds a queue from `items` (already in play order) starting at the album
 * whose video is `startVideoId`.
 *  - entries without a video id are dropped (nothing to load);
 *  - an album that appears twice is kept once, at its first position, so it
 *    never plays twice in a row;
 *  - returns null when nothing playable is left.
 */
export function buildQueue<T extends QueueItem>(items: T[], startVideoId: string): Queue<T> | null {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    if (!item || !item.videoId || seen.has(item.videoId)) continue;
    seen.add(item.videoId);
    unique.push(item);
  }
  if (unique.length === 0) return null;
  const index = unique.findIndex((i) => i.videoId === startVideoId);
  return { items: unique, index: index < 0 ? 0 : index, unplayable: new Set<string>() };
}

const playable = <T extends QueueItem>(q: Queue<T>, i: number): boolean =>
  !q.unplayable.has(q.items[i].videoId);

/** Index of the next playable album, or -1 at the end (the queue does not wrap). */
export function nextIndex<T extends QueueItem>(q: Queue<T>): number {
  for (let i = q.index + 1; i < q.items.length; i++) if (playable(q, i)) return i;
  return -1;
}

/** Index of the previous playable album, or -1 at the start. */
export function prevIndex<T extends QueueItem>(q: Queue<T>): number {
  for (let i = q.index - 1; i >= 0; i--) if (playable(q, i)) return i;
  return -1;
}

/** Same queue with `videoId` flagged as not embeddable. */
export function markUnplayable<T extends QueueItem>(q: Queue<T>, videoId: string): Queue<T> {
  return { ...q, unplayable: new Set([...q.unplayable, videoId]) };
}

/** Same queue, now positioned at `index`. */
export function withIndex<T extends QueueItem>(q: Queue<T>, index: number): Queue<T> {
  return { ...q, index };
}

/** The next `count` playable albums after the current one (no wrap). */
export function upNext<T extends QueueItem>(q: Queue<T>, count = 3): T[] {
  const out: T[] = [];
  for (let i = q.index + 1; i < q.items.length && out.length < count; i++) {
    if (playable(q, i)) out.push(q.items[i]);
  }
  return out;
}

/**
 * The queue rebuilt from `items` (the cards of the same scope as they are now),
 * still at the loaded album and still remembering the albums that failed to
 * embed. A scope can gain cards after its queue was built ("Load more"), and the
 * queue only holds what was rendered then.
 * Null when there is nothing new to continue with: the loaded album is no longer
 * in `items` (the scope was filtered or re-sorted), or no playable album follows it.
 */
export function extendQueue<T extends QueueItem>(q: Queue<T>, items: T[]): Queue<T> | null {
  const current = q.items[q.index];
  if (!current) return null;
  const rebuilt = buildQueue(items, current.videoId);
  // buildQueue starts at index 0 when the album is missing: that is not "extended".
  if (!rebuilt || rebuilt.items[rebuilt.index].videoId !== current.videoId) return null;
  const extended = { ...rebuilt, unplayable: q.unplayable };
  return nextIndex(extended) >= 0 ? extended : null;
}

/**
 * Shuffle on: the albums after the loaded one in a random order. The loaded album
 * stays where it is and so do the ones before it, so shuffling never replays an
 * album already heard nor skips the one playing. `random` returns [0, 1), like
 * Math.random (injected so the order can be checked).
 */
export function shuffleUpcoming<T extends QueueItem>(q: Queue<T>, random: () => number = Math.random): Queue<T> {
  const rest = q.items.slice(q.index + 1);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return { ...q, items: [...q.items.slice(0, q.index + 1), ...rest] };
}

/**
 * Shuffle off: the queue back in `order` (its items as they were built), at the
 * album that plays now; what came before it in that order counts as heard.
 * Unchanged when that album is not in `order`.
 */
export function restoreOrder<T extends QueueItem>(q: Queue<T>, order: T[]): Queue<T> {
  const current = q.items[q.index];
  const index = current ? order.findIndex((i) => i.videoId === current.videoId) : -1;
  return index < 0 ? q : { ...q, items: order.slice(), index };
}

/**
 * What plays once the loaded album has ended: the same album again with repeat
 * on, else the next playable one; -1 stops playback.
 */
export function afterEnd<T extends QueueItem>(q: Queue<T>, repeat: boolean): number {
  if (repeat && q.items[q.index]) return q.index;
  return nextIndex(q);
}
