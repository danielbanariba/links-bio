import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import preact from '@astrojs/preact';

// Static output deployed via `vercel deploy --prebuilt` from the local sync host
// (the only machine that has reflex.db at build time — see design decision §6).
export default defineConfig({
  output: 'static',
  // webAnalytics auto-injects the Vercel Insights script into every page at
  // build time (via the adapter's injectScript). No shared layout exists here,
  // so this is the only way to cover all 11 pages without editing each one.
  // Still must be enabled in the Vercel dashboard (project → Analytics) to see data.
  adapter: vercel({ webAnalytics: { enabled: true } }),
  integrations: [preact()],
  // No `base`: the site root (/) is the bio/portfolio. The Metal Archive lives
  // under /metal-archive/ via the src/pages/metal-archive/ folder (the folder
  // provides the path prefix instead of the base config), so public URLs stay
  // identical. public/ assets now serve from / (e.g. /browse-index.json, /fonts).
  vite: {
    ssr: {
      // better-sqlite3 is a native Node module; must stay external to avoid
      // bundling issues — proven by the astro-spike POC.
      external: ['better-sqlite3'],
    },
  },
});
