// The muted line under every album card: "country · year · genre".
//
// History: the previous helper (getCardMeta) existed because a caller doing
// `{a.year && <span>{a.year}</span>}` printed the literal number 0 for the
// DB's "unknown year" sentinel ("00Honduras", Oct 2026 audit F5). formatCardMeta
// returns one string, so a caller cannot leak a raw 0 or a separator any more;
// these tests pin the decisions that keep the string clean.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCardMeta } from '../src/lib/cardMeta.ts';

test('formatCardMeta orders country, year, genre and translates the raw country', () => {
  // "Estados Unidos" is what the YouTube sync writes; the card must show the English label.
  assert.equal(
    formatCardMeta({ country: 'Estados Unidos', year: 2019, genre: 'Death Metal' }),
    'United States · 2019 · Death Metal',
  );
});

test('formatCardMeta leaves no stray separator when the country is missing', () => {
  assert.equal(formatCardMeta({ country: null, year: 2019, genre: 'Grindcore' }), '2019 · Grindcore');
});

test('formatCardMeta leaves no stray separator when the genre is missing', () => {
  assert.equal(formatCardMeta({ country: 'Alemania', year: 2001, genre: null }), 'Germany · 2001');
});

test('formatCardMeta treats year 0 (the DB sentinel for unknown) as missing, never prints 0', () => {
  assert.equal(formatCardMeta({ country: 'Honduras', year: 0, genre: 'Death Metal' }), 'Honduras · Death Metal');
});

test('formatCardMeta skips the sync placeholder genre instead of printing "Unknown genre"', () => {
  assert.equal(formatCardMeta({ country: 'Honduras', year: 2024, genre: 'Género desconocido' }), 'Honduras · 2024');
});

test('formatCardMeta treats blank strings as missing', () => {
  assert.equal(formatCardMeta({ country: '  ', year: 2024, genre: '' }), '2024');
});

test('formatCardMeta returns an empty string when nothing is known, so the caller renders no line', () => {
  assert.equal(formatCardMeta({ country: null, year: null, genre: null }), '');
  assert.equal(formatCardMeta({}), '');
});
