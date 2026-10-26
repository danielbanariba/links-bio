// displayTitle: the album title as cards, rows and the player show it. YouTube
// uploads carry a "(Full Álbum)" / "(Full Album)" suffix that says nothing on a
// site where every entry is a full album, so it is dropped on display only; the
// DB, the URLs and the SEO title keep the raw value. The cases below are the
// variants the DB actually holds (2026-10 snapshot, 21 rows).
import test from 'node:test';
import assert from 'node:assert/strict';
import { displayTitle } from '../src/lib/title.ts';

test('displayTitle drops the Spanish "(Full Álbum)" suffix', () => {
  // 10 rows, e.g. album 969. Fails if the pattern only knows the ASCII spelling.
  assert.equal(displayTitle('Tiempos Violentos (Full Álbum)'), 'Tiempos Violentos');
});

test('displayTitle drops "(Full Album)" in any letter case', () => {
  assert.equal(displayTitle('Santino (Full Album)'), 'Santino');
  assert.equal(displayTitle('Santino (FULL ALBUM)'), 'Santino');
});

test('displayTitle drops the dash and spaces left in front of the suffix', () => {
  // Album 527 "Ventriloquist -    (Full Album)": stripping only the parentheses
  // would leave "Ventriloquist -" on the card.
  assert.equal(displayTitle('Ventriloquist -    (Full Album)'), 'Ventriloquist');
});

test('displayTitle drops doubled and unbalanced parentheses around the suffix', () => {
  assert.equal(displayTitle("Megela'a Rock ((Full Album))"), "Megela'a Rock");
  assert.equal(displayTitle('Old Blood...Full Album)'), 'Old Blood...');
});

test('displayTitle keeps a dash that belongs to the title', () => {
  // Album 896: the dash before "Early Recordings" is part of the name.
  assert.equal(
    displayTitle('Escuela Grind - Early Recordings 2016-2018 (Full Album)'),
    'Escuela Grind - Early Recordings 2016-2018',
  );
});

test('displayTitle leaves titles that only contain the word "Full" alone', () => {
  // Album 2771 "Raging Full On [...]" and live sets are real titles, not the suffix.
  assert.equal(displayTitle('Raging Full On [Thrash Metal/Hardcore]'), 'Raging Full On [Thrash Metal/Hardcore]');
  assert.equal(displayTitle('The Slaves Of D*** (Live Album)'), 'The Slaves Of D*** (Live Album)');
});

test('displayTitle keeps the raw title when the suffix is all there is', () => {
  // Album 883 is titled just "(Full Album)": an empty card title would be worse.
  assert.equal(displayTitle('(Full Album)'), '(Full Album)');
});

test('displayTitle returns an empty string for a missing title', () => {
  assert.equal(displayTitle(null), '');
  assert.equal(displayTitle(undefined), '');
});
