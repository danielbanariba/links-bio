// sitemap.xml — generated at build time from the database.
//
// The site had NO sitemap and NO robots.txt: ~1300 album pages plus every
// band/genre/country/year facet page were left for search engines to stumble
// onto by crawling. For a catalog whose entire value is discovery, that is the
// single cheapest fix available.
//
// This is a static endpoint: with `output: 'static'` Astro prerenders it during
// the build, so the deployed artifact is a plain sitemap.xml file — no runtime
// function, no database access in production.
//
// URLs are emitted WITHOUT a trailing slash to match vercel.json
// (`trailingSlash: false`); emitting them with one would make every entry a 308
// redirect hop.
import type { APIRoute } from 'astro';
import {
  getAllAlbumIds,
  getAllGenres,
  getAllCountries,
  getAllYears,
  getBandsWithMultipleAlbums,
  slugify,
} from '../lib/db.js';

const SITE = 'https://danielbanariba.com';

interface Entry {
  path: string;
  priority: string;
  changefreq: string;
}

/** Escape the five XML predefined entities. Slugs are ASCII, but never trust that. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = () => {
  const entries: Entry[] = [
    // ── Landing pages ────────────────────────────────────────────────────────
    { path: '/',                          priority: '1.0', changefreq: 'monthly' },
    { path: '/metal-archive',             priority: '0.9', changefreq: 'daily'   },
    { path: '/metal-archive/browse',      priority: '0.8', changefreq: 'daily'   },
    { path: '/metal-archive/submit',      priority: '0.5', changefreq: 'yearly'  },
    { path: '/metal-archive/promo',       priority: '0.5', changefreq: 'yearly'  },
    { path: '/metal-archive/newsletter',  priority: '0.5', changefreq: 'yearly'  },
  ];

  // ── Album detail pages (the bulk of the catalog) ───────────────────────────
  for (const id of getAllAlbumIds()) {
    entries.push({ path: `/metal-archive/album/${id}`, priority: '0.7', changefreq: 'monthly' });
  }

  // ── Facet pages. slugify() is the SAME function getStaticPaths() uses, so a
  //    sitemap entry can never point at a path the build did not emit. ────────
  for (const band of getBandsWithMultipleAlbums()) {
    entries.push({ path: `/metal-archive/band/${slugify(band.band_name)}`, priority: '0.6', changefreq: 'monthly' });
  }
  for (const facet of getAllGenres()) {
    entries.push({ path: `/metal-archive/genre/${slugify(facet.value)}`, priority: '0.6', changefreq: 'weekly' });
  }
  for (const facet of getAllCountries()) {
    entries.push({ path: `/metal-archive/country/${slugify(facet.value)}`, priority: '0.6', changefreq: 'weekly' });
  }
  for (const facet of getAllYears()) {
    entries.push({ path: `/metal-archive/year/${facet.value}`, priority: '0.5', changefreq: 'weekly' });
  }

  const urls = entries
    .map(
      (e) =>
        `  <url>\n` +
        `    <loc>${xmlEscape(SITE + e.path)}</loc>\n` +
        `    <changefreq>${e.changefreq}</changefreq>\n` +
        `    <priority>${e.priority}</priority>\n` +
        `  </url>`,
    )
    .join('\n');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
