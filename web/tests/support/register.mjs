// Bootstraps the sibling .js->.ts resolution loader (see ts-js-loader.mjs) via
// the stable node:module register() API, loaded with `node --import` before
// the test files run. Needed because db.ts and friends use Astro/Vite-style
// "./foo.js" relative imports for files that are actually "./foo.ts" on disk;
// Astro's bundler resolves that at build time, but plain `node --test` does not.
import { register } from 'node:module';
register('./ts-js-loader.mjs', import.meta.url);
