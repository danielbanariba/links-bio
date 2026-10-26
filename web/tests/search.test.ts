// Search on the Browse page (islands/Search.tsx): what a typed query finds and in
// which order, which bands and facets it offers, and the top result. Pure
// functions over browse-index entries; each test names the defect it catches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAlbums, searchBands, searchFacets, topResult } from '../src/lib/search.ts';

const e = (id: number, band: string, title: string, over: Record<string, unknown> = {}) => ({
  id,
  band_name: band,
  album_title: title,
  genre: 'Doom Metal',
  country: 'Alemania',
  year: 2020,
  release_type: 'Full Album',
  views: 0,
  thumb: '',
  cover: '',
  youtube_video_id: `v${id}`,
  ...over,
});
const ids = (list: { id: number }[]) => list.map((a) => a.id);

test('a query matches without accents or case', () => {
  // Defect: a plain toLowerCase().includes(), which misses "Café Guancasco"
  // for "cafe" and "Motörhead" for "motorhead".
  const index = [e(1, 'Café Guancasco', 'Vivo'), e(2, 'Motörhead', 'Ace')];
  assert.deepEqual(ids(searchAlbums(index, 'cafe')), [1]);
  assert.deepEqual(ids(searchAlbums(index, 'MOTORHEAD')), [2]);
});

test('a title or band that starts with the query outranks a genre match with more views', () => {
  // Defect: ranking matches by views alone, so "death" lists every popular
  // Death Metal album before the band Deathtopia and the album "Path of Death".
  const index = [
    e(1, 'Holocausto', 'Tiempos Violentos', { genre: 'Death Metal', views: 9131 }),
    e(2, 'Deathtopia', 'Beyond', { genre: 'Grindcore', views: 29 }),
    e(3, 'Rudra', 'Path of Death', { genre: 'Black Metal', views: 100 }),
  ];
  assert.deepEqual(ids(searchAlbums(index, 'death')), [2, 3, 1]);
});

test('a country matches in English and as the database stores it', () => {
  // Defect: matching only the raw Spanish value, so "germany" (what the page
  // shows) finds nothing, or only the label, so "alemania" stops working.
  const index = [e(1, 'A', 'B', { country: 'Alemania' })];
  assert.deepEqual(ids(searchAlbums(index, 'germany')), [1]);
  assert.deepEqual(ids(searchAlbums(index, 'alemania')), [1]);
});

test('a year matches only in full', () => {
  // Defect: a substring match on the year, so "201" or "20" lists every album
  // of the decade.
  const index = [e(1, 'A', 'B', { year: 2016 })];
  assert.deepEqual(ids(searchAlbums(index, '2016')), [1]);
  assert.deepEqual(ids(searchAlbums(index, '201')), []);
});

test('bands are the ones with a page: two or more albums under the exact name', () => {
  // Defect: offering a band with one album, whose link would 404 (the build
  // makes band pages only for 2+ albums), or merging names that only differ in
  // case into one band whose page does not exist.
  const index = [
    e(1, 'Rudra', 'X', { views: 5 }),
    e(2, 'Rudra', 'Y', { views: 7 }),
    e(3, 'Rudrani', 'Z'),
    e(4, 'rudra', 'W'),
  ];
  const bands = searchBands(index, 'rud');
  assert.deepEqual(bands.map((b) => [b.name, b.albums, b.views]), [['Rudra', 2, 12]]);
  assert.equal(bands[0].href, '/metal-archive/band/rudra');
});

test('the top result is the band that starts with the query, else the best album', () => {
  // Defect: a band that only contains the query ("Necrodeath" for "death")
  // taking the top spot over the best album; or a top result for no query.
  const index = [e(1, 'Necrodeath', 'A'), e(2, 'Necrodeath', 'B'), e(3, 'Other', 'Death Rites')];
  const top = (list: ReturnType<typeof e>[], q: string) => topResult(q, searchBands(list, q), searchAlbums(list, q));
  const rites = top(index, 'death');
  assert.equal(rites?.kind === 'album' && rites.album.id, 3);
  const withBand = [...index, e(4, 'Deathtopia', 'C'), e(5, 'Deathtopia', 'D')];
  const band = top(withBand, 'death');
  assert.equal(band?.kind === 'band' && band.band.name, 'Deathtopia');
  assert.equal(top(withBand, '  '), null);
});

test('matching genres and countries link only to pages the build makes', () => {
  // Defect: offering a genre that only a live set has (facet pages leave live
  // recordings out, so its link 404s), or counting live sets in the total.
  const index = [
    e(1, 'A', 'Studio', { genre: 'Black Metal', country: 'Noruega' }),
    e(2, 'A', 'Studio 2', { genre: 'Black Metal', country: 'Noruega' }),
    e(3, 'B', 'Show (Live in Oslo)', { genre: 'Blackgaze', country: 'Noruega' }),
  ];
  const facets = searchFacets(index, 'black');
  assert.deepEqual(facets.map((f) => [f.kind, f.label, f.count, f.href]), [['genre', 'Black Metal', 2, '/metal-archive/genre/black-metal']]);
  const norway = searchFacets(index, 'norway');
  assert.deepEqual(norway.map((f) => [f.kind, f.label, f.count]), [['country', 'Norway', 2]]);
});
