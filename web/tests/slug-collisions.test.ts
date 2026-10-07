// Regression test for the slugify() collision defect found in the platform
// audit: distinct raw genre strings (e.g. "Black Death Metal" and
// "Black/Death Metal") can slugify to the SAME value. getStaticPaths() used to
// emit one path object per raw facet row, so Astro's static builder silently
// overwrote the earlier-built page with the later one — a 31-album genre page
// replaced by a 1-album one, no error, no warning. The sitemap had the same
// problem: one <loc> per raw row, so colliding slugs produced duplicate URLs.
//
// groupFacetsBySlug() (db.ts) is the fix: it merges raw rows by slug before a
// page or sitemap entry is built. These tests exercise it with SYNTHETIC
// input rather than the live database (R3-003, lineage
// review-fad8cf8c80894277): the earlier version of this test required the
// live data to already contain a real collision, so it would start passing
// vacuously — proving nothing — the moment that data got normalized, or in
// any environment with a different or missing DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupFacetsBySlug, slugify } from '../src/lib/db.ts';

test('groupFacetsBySlug merges every raw value that collides on the same slug', () => {
  const groups = groupFacetsBySlug([
    { value: 'Black Death Metal', count: 1 },
    { value: 'Black/Death Metal', count: 31 },
  ]);

  // The exact defect: getStaticPaths() used to emit one page per raw row, so
  // Astro's builder silently overwrote the 31-album page with the 1-album
  // one. If groupFacetsBySlug stopped merging collisions, this goes red
  // either on the group count (2 instead of 1) or the summed count (31
  // instead of 32, whichever variant "won").
  assert.equal(groups.length, 1);
  assert.equal(groups[0].slug, 'black-death-metal');
  assert.equal(groups[0].count, 32);
  assert.deepEqual(new Set(groups[0].values), new Set(['Black Death Metal', 'Black/Death Metal']));
  // `label` picks the dominant (highest-count) raw variant, so the page
  // title / genreLabel() lookup reads as the variant most albums actually use.
  assert.equal(groups[0].label, 'Black/Death Metal');
});

test('groupFacetsBySlug keeps a non-colliding value in its own group', () => {
  const groups = groupFacetsBySlug([
    { value: 'Black Death Metal', count: 1 },
    { value: 'Black/Death Metal', count: 31 },
    { value: 'Doom Metal', count: 5 },
  ]);

  // Catches a grouping bug that merges everything regardless of slug (e.g.
  // grouping by array position instead of the computed slug).
  const doom = groups.find((g) => g.slug === 'doom-metal');
  assert.ok(doom, 'expected "Doom Metal" to keep its own group');
  assert.equal(doom!.count, 5);
  assert.deepEqual(doom!.values, ['Doom Metal']);
  assert.equal(groups.length, 2);
});

test('groupFacetsBySlug output slugs stay unique even when the input collides', () => {
  // This is the exact invariant getStaticPaths() and sitemap.xml.ts both rely
  // on to avoid duplicate paths / duplicate <loc> entries. Unlike the old
  // version of this check, it is driven by a collision we construct here, so
  // it keeps failing on a regression regardless of what the live DB contains.
  const groups = groupFacetsBySlug([
    { value: 'Black Death Metal', count: 1 },
    { value: 'Black/Death Metal', count: 31 },
    { value: 'Doom Metal', count: 5 },
  ]);
  const slugs = groups.map((g) => g.slug);
  assert.equal(slugs.length, new Set(slugs).size);
});

test('slugify() falls back to an ascii-safe slug for a value with no latin alphanumerics', () => {
  // A band/genre name like "Сын Собаки" collapses to "" under the normal
  // regex path, which used to crash the static build with
  // "Missing parameter: band/genre/country". The fallback must produce a
  // non-empty, URL-safe, deterministic slug instead.
  const slug = slugify('Сын Собаки');
  assert.ok(slug.length > 0);
  assert.match(slug, /^[a-z0-9-]+$/);
  assert.equal(slug, slugify('Сын Собаки'));
});
