// Regression test for the album-card year===0 rendering defect found in the
// Oct 2026 Playwright audit (F5): /metal-archive/browse?q=Blasfemia, album
// 1329, rendered "00Honduras" instead of just "Honduras" because
// `{a.year && <span>{a.year}</span>}` rendered the literal number 0 (JS `&&`
// returns the falsy left operand itself, and JSX renders a numeric 0, unlike
// `false`/`null`/`undefined`, which render nothing). getCardMeta() returns a
// real boolean instead, so the caller's guard can never be the bare number.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getCardMeta } from '../src/lib/cardMeta.ts';

test('getCardMeta hides the year but keeps the country when year is 0', () => {
  const meta = getCardMeta(0, 'Honduras');
  // The exact defect: if showYear/showSeparator were ever the raw `year`
  // value (0) instead of a boolean, a caller doing `{meta.showYear && <span>}`
  // would print "0" again instead of nothing.
  assert.equal(meta.showYear, false);
  assert.equal(meta.showSeparator, false);
  assert.equal(meta.showCountry, true);
  assert.equal(meta.showRow, true);
});

test('getCardMeta shows the year and the separator for a real year with a country', () => {
  const meta = getCardMeta(2025, 'Alemania');
  assert.equal(meta.showYear, true);
  assert.equal(meta.showSeparator, true);
  assert.equal(meta.showCountry, true);
});

test('getCardMeta hides the whole row when both year and country are absent', () => {
  const meta = getCardMeta(null, null);
  assert.equal(meta.showRow, false);
  assert.equal(meta.showYear, false);
  assert.equal(meta.showSeparator, false);
  assert.equal(meta.showCountry, false);
});
