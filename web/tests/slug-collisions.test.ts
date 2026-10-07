// Regression test for the slugify() collision defect found in the platform
// audit: distinct raw genre strings (e.g. "Black Death Metal" and
// "Black/Death Metal") can slugify to the SAME value. getStaticPaths() used to
// emit one path object per raw facet row, so Astro's static builder silently
// overwrote the earlier-built page with the later one — a 31-album genre page
// replaced by a 1-album one, no error, no warning. The sitemap had the same
// problem: one <loc> per raw row, so colliding slugs produced duplicate URLs.
//
// The fix groups raw facet rows by slug (getGenreFacetGroups /
// getCountryFacetGroups) so exactly one page is built per slug and it lists
// every album from every raw variant that collides into it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllGenres,
  getAllCountries,
  getGenreFacetGroups,
  getCountryFacetGroups,
  getAlbumsByGenres,
  getAlbumsByCountries,
  slugify,
} from '../src/lib/db.ts';

interface Facet {
  value: string;
  count: number;
}

function groupRawBySlug(rows: Facet[]): Map<string, Facet[]> {
  const bySlug = new Map<string, Facet[]>();
  for (const row of rows) {
    const slug = slugify(row.value);
    const list = bySlug.get(slug);
    if (list) list.push(row);
    else bySlug.set(slug, [row]);
  }
  return bySlug;
}

test('genre facet groups merge every colliding raw value into one page per slug', () => {
  const rawSlugs = groupRawBySlug(getAllGenres());
  const collisions = [...rawSlugs.entries()].filter(([, rows]) => rows.length > 1);

  // Sanity check on the fixture data itself: if this ever hits zero, the test
  // below would pass vacuously and stop proving anything. The audit found 7
  // such groups (NOT_LIVE-filtered) in the live dataset.
  assert.ok(collisions.length > 0, 'expected at least one known genre slug collision in the current data');

  const groups = getGenreFacetGroups();
  const groupSlugs = groups.map((g) => g.slug);

  // One group per distinct slug — duplicates are exactly what let one static
  // page silently overwrite another.
  assert.equal(groupSlugs.length, new Set(groupSlugs).size);
  assert.equal(groupSlugs.length, rawSlugs.size);

  for (const [slug, rawRows] of collisions) {
    const group = groups.find((g) => g.slug === slug);
    assert.ok(group, `missing merged group for colliding slug "${slug}"`);

    const expectedCount = rawRows.reduce((sum, r) => sum + r.count, 0);
    const biggestVariant = Math.max(...rawRows.map((r) => r.count));

    // The exact defect: the merged count must be the SUM across every raw
    // variant, not just whichever variant's page happened to build last.
    assert.equal(group!.count, expectedCount);
    assert.ok(
      group!.count > biggestVariant,
      `merged group "${slug}" must list more albums than any single colliding variant alone`,
    );

    // The page actually queries by every raw value in the group, so the
    // rendered grid matches the merged count too.
    const albums = getAlbumsByGenres(group!.values);
    assert.equal(albums.length, expectedCount);
  }
});

test('genre sitemap entries have no duplicate <loc> after the merge', () => {
  const paths = getGenreFacetGroups().map((g) => `/metal-archive/genre/${g.slug}`);
  assert.equal(paths.length, new Set(paths).size);
});

test('country facet groups stay collision-safe (0 collisions in current data, same mechanism as genre)', () => {
  const rawSlugs = groupRawBySlug(getAllCountries());
  const groups = getCountryFacetGroups();
  const groupSlugs = groups.map((g) => g.slug);

  assert.equal(groupSlugs.length, new Set(groupSlugs).size);
  assert.equal(groupSlugs.length, rawSlugs.size);

  for (const group of groups) {
    const albums = getAlbumsByCountries(group.values);
    assert.equal(albums.length, group.count);
  }
});
