// Which ink the play glyphs use on top of an album's accent colour. Each test
// names the defect a realistic wrong implementation would reintroduce.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, DARK_INK, inkOnAccent, WHITE_INK } from '../src/lib/onAccent.ts';

test('a dark red accent gets white ink', () => {
  // Defect: the fixed near-black ink over album 2887's #902c23 (2.4:1), which
  // made the card play glyph hard to see on 471 of 2753 covers.
  assert.equal(inkOnAccent('#902c23'), WHITE_INK);
  assert.ok(contrastRatio(WHITE_INK, '#902c23') >= 3);
});

test('the amber fallback and light accents keep the dark ink', () => {
  // Defect: flipping every accent to white, which is 2.1:1 on the amber
  // fallback that home and browse use.
  assert.equal(inkOnAccent('#dda15e'), DARK_INK);
  assert.equal(inkOnAccent('#84847a'), DARK_INK);
});

test('whichever ink is chosen reads at least 4.4:1 on any accent', () => {
  // Defect: a luminance threshold in the wrong place (for example "dark ink
  // above 0.5") leaves mid-tones with the weaker ink, under 4.4:1 even though
  // the other ink would be above it.
  const steps = [0, 32, 64, 96, 128, 160, 192, 224, 255];
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  for (const r of steps) {
    for (const g of steps) {
      for (const b of steps) {
        const accent = `#${hex(r)}${hex(g)}${hex(b)}`;
        const ratio = contrastRatio(inkOnAccent(accent), accent);
        assert.ok(ratio >= 4.4, `${accent} got ${ratio.toFixed(2)}:1`);
      }
    }
  }
});

test('a value that is not a hex colour falls back to the dark ink', () => {
  // Defect: NaN maths picking white (or throwing) when the colour cache holds
  // something unexpected, which would crash the build for every page using it.
  for (const bad of ['', 'red', '#12', 'rgb(1,2,3)', '#zzzzzz']) {
    assert.equal(inkOnAccent(bad), DARK_INK);
  }
});
