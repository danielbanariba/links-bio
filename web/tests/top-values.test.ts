// topValues: the genres and countries of a band's facts line.
//
// The defect these tests guard (R3-002): the band page took the top three RAW genre values and
// only then dropped repeats, so two spellings of one genre ("Black Death Metal" and
// "Black/Death Metal" share the genre page /genre/black-death-metal) took two of the three
// slots, were listed twice with the same link, and pushed a real third genre off the line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, topValues } from '../src/lib/db.ts';

test('two spellings that share a genre page take one slot, so the third genre still shows', () => {
  const genres = ['Black Death Metal', 'Black/Death Metal', 'Black/Death Metal', 'Thrash Metal', 'Thrash Metal', 'Doom Metal'];
  assert.deepEqual(topValues(genres, 3, slugify), ['Black/Death Metal', 'Thrash Metal', 'Doom Metal']);
});

test('spellings of one value add their counts and the most common one stands for the group', () => {
  // "Venezuela" 3 + "Venezuela, Bolivarian Republic of" 1 = 4, against "Chile" 3
  // Chile comes first, so a tie would put it ahead: only the summed count puts Venezuela first
  const countries = ['Chile', 'Chile', 'Chile', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela, Bolivarian Republic of'];
  const label = (raw: string) => raw.split(',')[0];
  assert.deepEqual(topValues(countries, 2, label), ['Venezuela', 'Chile']);
  assert.deepEqual(topValues([...countries, 'Chile', 'Chile'], 2, label), ['Chile', 'Venezuela']);
});

test('blank values are skipped and an empty list gives an empty line', () => {
  assert.deepEqual(topValues([null, '', undefined, 'Doom Metal'], 3), ['Doom Metal']);
  assert.deepEqual(topValues([], 3), []);
});
