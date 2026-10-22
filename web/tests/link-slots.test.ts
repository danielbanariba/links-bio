// nextLinkSlot: which `extra_link_N` a new row on the promo form takes.
//
// The defect these tests guard: the page counted rows ever added instead of rows present, so
// after five adds and one removal "Add another link" stayed hidden or did nothing, and a count
// based name could collide with a row still on the page (two inputs called extra_link_2, one
// of them lost from the request body). The API only reads extra_link_0 .. extra_link_4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextLinkSlot } from '../src/components/link-slots.ts';

test('rows fill the slots in order', () => {
  assert.equal(nextLinkSlot([]), 0);
  assert.equal(nextLinkSlot([0]), 1);
  assert.equal(nextLinkSlot([0, 1, 2]), 3);
});

test('a removed row gives its slot back, and a free slot never collides with a taken one', () => {
  // rows 0 and 2 are on the page (row 1 was removed): the new row is 1, not "the count" (2)
  assert.equal(nextLinkSlot([0, 2]), 1);
  // five were added, the first was removed: the sixth add lands in slot 0
  assert.equal(nextLinkSlot([1, 2, 3, 4]), 0);
});

test('five rows is the limit: no sixth slot exists', () => {
  assert.equal(nextLinkSlot([0, 1, 2, 3, 4]), null);
  assert.equal(nextLinkSlot(new Set([4, 3, 2, 1, 0])), null);
});
