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
