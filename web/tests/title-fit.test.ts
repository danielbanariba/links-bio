// title-fit: the fit and the line break of the name in a page head.
//
// The defect these tests guard: a band name that is ONE long word ("ZENTRUMFÜRPOLITISCHENOT…",
// 34 letters) is cut by the browser wherever the line runs out, so a phone showed
// "ZENTRUMFÜRPOLITISCHENOT / SCHLACHTUNG": two lines of different length and no hyphen to say a
// word was cut. breakLongWord() offers one soft hyphen at the weighted middle, so the break is
// balanced and shows a hyphen, and lineChars() sizes the type for exactly that two-line shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHY, breakLongWord, lineChars, wordWeight } from '../src/components/title-fit.ts';

const LONG = 'ZENTRUMFÜRPOLITISCHENOTSCHLACHTUNG';

test('a single long word gets one soft hyphen, near its middle', () => {
  const out = breakLongWord(LONG);
  assert.equal([...out].filter((c) => c === SHY).length, 1);
  const [a, b] = out.split(SHY);
  assert.equal(a + b, LONG, 'only the hyphen was added, no letter changed');
  // Balanced: the two halves differ by less than the weight of two capitals.
  assert.ok(Math.abs(wordWeight(a) - wordWeight(b)) < 2.5, `${wordWeight(a)} vs ${wordWeight(b)}`);
});

test('the two halves both fit the line the type size was fitted for', () => {
  // lineChars() is how many characters one line must hold; a half wider than that would
  // overflow, and the browser would cut again mid-word, with no hyphen.
  const [a, b] = breakLongWord(LONG).split(SHY);
  const fits = lineChars(LONG, 0);
  assert.ok(wordWeight(a) <= fits && wordWeight(b) <= fits);
});

test('names that break at spaces or fit one line are left alone', () => {
  for (const name of ['Peepeepoopooballsectomy Band', 'Goregrind/Grindcore', 'Slayer', 'Peepeepoo']) {
    assert.equal(breakLongWord(name), name);
  }
});

test('a combining mark is never separated from its letter', () => {
  // 19 capitals: the weighted middle falls right after the tenth letter, "J", which carries a
  // combining diaeresis. A cut there would leave the bare mark at the head of line two.
  const name = 'ABCDEFGHIJ\u0308KLMNOPQRS';
  const [a, b] = breakLongWord(name).split(SHY);
  assert.ok(a && b, 'the name was cut');
  assert.ok(!/^\p{M}/u.test(b), 'line two does not start with a bare mark');
  assert.ok(a.endsWith('J\u0308'), 'the letter keeps its mark');
});
