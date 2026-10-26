// The muted line under every album card: "country · year · genre".
//
// History: the previous helper (getCardMeta) existed because a caller doing
// `{a.year && <span>{a.year}</span>}` printed the literal number 0 for the
// DB's "unknown year" sentinel ("00Honduras", Oct 2026 audit F5). formatCardMeta
// returns one string, so a caller cannot leak a raw 0 or a separator any more;
// these tests pin the decisions that keep the string clean.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCardMeta, heroMeta, formatUploadDay } from '../src/lib/cardMeta.ts';

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

// heroMeta: the home hero's line, genre first as in the prototype, then the
// tracklist's size.
test('heroMeta puts the genre first and adds the tracks and minutes', () => {
  assert.equal(
    heroMeta({ genre: 'Deathcore', country: 'Estados Unidos', year: 2016, tracks: 9, minutes: 41 }),
    'Deathcore · United States · 2016 · 9 tracks · 41 min',
  );
});

test('heroMeta drops what is unknown instead of printing a placeholder, 0 tracks or 0 min', () => {
  assert.equal(
    heroMeta({ genre: 'Género desconocido', country: 'Honduras', year: 0, tracks: 0, minutes: null }),
    'Honduras',
  );
});

test('heroMeta says "1 track", not "1 tracks"', () => {
  assert.equal(heroMeta({ genre: 'Grindcore', tracks: 1, minutes: 3 }), 'Grindcore · 1 track · 3 min');
});

test('formatUploadDay turns the database timestamp into "30 Jul 2026"', () => {
  // Fails on a month table off by one, or on the raw timestamp reaching the page.
  assert.equal(formatUploadDay('2026-07-30 01:00:08.000000'), '30 Jul 2026');
  assert.equal(formatUploadDay('2025-01-05'), '5 Jan 2025');
});

test('formatUploadDay returns an empty string for a missing or malformed date', () => {
  assert.equal(formatUploadDay(null), '');
  assert.equal(formatUploadDay(''), '');
  assert.equal(formatUploadDay('yesterday'), '');
  assert.equal(formatUploadDay('2026-13-01'), '');
});
