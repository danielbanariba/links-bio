// The band page's numbers: which albums are "Popular", and the hero's and the
// About card's facts. Each test names the defect it would catch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rankPopular, bandSummary } from '../src/lib/bandPage.ts';

const album = (id: number, over: Partial<{ year: number | null; genre: string | null; country: string | null; views: number | null; cover: string }> = {}) => ({
  id,
  year: 2020,
  genre: 'Death Metal',
  country: 'Alemania',
  views: 0,
  cover: '/covers/abcdefgh.webp',
  ...over,
});

test('Popular ranks by views, an uncounted album last, a tie to the newer upload', () => {
  // Defect: `b.views - a.views` with a null count (an album the sync has not
  // counted yet) is NaN, which leaves the order to chance; or ranking by year,
  // which is the discography's order, not popularity.
  const ranked = rankPopular([album(1, { views: 5 }), album(2, { views: null }), album(3, { views: 50 }), album(4, { views: 5 })]);
  assert.deepEqual(ranked.map((a) => a.id), [3, 4, 1, 2]);
  assert.deepEqual(rankPopular([album(1), album(2), album(3)], 2).map((a) => a.id), [3, 2]);
});

test('the views total adds every album, an uncounted one as 0', () => {
  // Defect: a null count turning the total into NaN ("NaN YouTube views"), or
  // the total adding only the five Popular albums.
  const albums = [1, 2, 3, 4, 5, 6].map((id) => album(id, { views: id === 6 ? null : 10 }));
  assert.equal(bandSummary(albums).views, 50);
});

test('the year range leaves out the unknown year 0', () => {
  // Defect: the database's 0 for "unknown year" read as a year: "0–2015".
  const s = bandSummary([album(1, { year: 2015 }), album(2, { year: 0 }), album(3, { year: 2009 }), album(4, { year: null })]);
  assert.deepEqual([s.firstYear, s.lastYear], [2009, 2015]);
  assert.deepEqual([bandSummary([album(1, { year: 0 })]).firstYear], [null]);
});

test('genres come most frequent first, without the unknown-genre placeholder', () => {
  // Defect: the sync's placeholder listed as a genre ("Unknown genre"), or one
  // odd album's genre listed before the one most of the band's albums have.
  const s = bandSummary([
    album(1, { genre: 'Grindcore' }),
    album(2, { genre: 'Género desconocido' }),
    album(3, { genre: 'Death Metal' }),
    album(4, { genre: 'Death Metal' }),
    album(5, { genre: '' }),
  ]);
  assert.deepEqual(s.genres, ['Death Metal', 'Grindcore']);
});

test('the hero takes the most viewed album that has a square cover', () => {
  // Defect: the hero filling its width with a 16:9 YouTube frame (cropped to a
  // strip of the cover) while another album has a clean square crop.
  const s = bandSummary([
    album(1, { views: 900, cover: 'https://i.ytimg.com/vi/abcdefgh/mqdefault.jpg' }),
    album(2, { views: 40 }),
    album(3, { views: 10 }),
  ]);
  assert.equal(s.best?.id, 2);
  // With no square crop at all, the most viewed album still gives the hero.
  const frames = bandSummary([album(1, { views: 1, cover: 'x.jpg' }), album(2, { views: 9, cover: 'y.jpg' })]);
  assert.equal(frames.best?.id, 2);
});
