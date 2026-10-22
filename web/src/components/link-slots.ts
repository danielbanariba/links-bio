// link-slots: which `extra_link_N` a new row on the promo form takes.
//
// The forms API reads extra_link_0 .. extra_link_4, so the page holds at most five extra rows
// and each takes the lowest slot nobody is using. A removed row gives its slot back; a counter
// of rows ever added never goes down, which left "Add another link" dead after a removal.

export const MAX_EXTRA_LINKS = 5;

/** The lowest free slot in 0..max-1, or null when every slot is taken. */
export function nextLinkSlot(taken: Iterable<number>, max: number = MAX_EXTRA_LINKS): number | null {
  const used = new Set(taken);
  for (let slot = 0; slot < max; slot++) if (!used.has(slot)) return slot;
  return null;
}
