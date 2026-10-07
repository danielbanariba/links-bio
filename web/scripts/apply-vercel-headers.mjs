#!/usr/bin/env node
// Merges web/vercel.json's `headers` into the Astro Vercel adapter's
// generated .vercel/output/config.json `routes`.
//
// WHY: production deploys with `vercel deploy --prod --prebuilt` from
// web/, which uploads only .vercel/output -- it never reads vercel.json for
// a prebuilt deploy. The installed @astrojs/vercel adapter has no general
// custom-headers passthrough of its own: its `staticHeaders` option only
// emits a Content-Security-Policy header, and only when Astro's own
// experimental `security.csp` is enabled (see
// node_modules/@astrojs/vercel/dist/index.d.ts and index.js,
// createRoutesWithStaticHeaders()). So none of the 5 headers declared in
// vercel.json ever reached config.json, and `curl -sI
// https://danielbanariba.com/` showed none of them.
//
// vercel.json stays the single declared source of the headers. This script
// is the one place that makes config.json actually carry them, wired into
// the `build` npm script so it runs after every `astro build`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_VERCEL_JSON_PATH = path.join(WEB_DIR, 'vercel.json');
const DEFAULT_CONFIG_JSON_PATH = path.join(WEB_DIR, '.vercel', 'output', 'config.json');

// path-to-regexp named parameters (":slug", ":id", ...) can't be translated
// to a Build Output API `src` regex without a real path-to-regexp compiler,
// which this project has no other use for (vercel.json only ever declares
// plain-regex-style sources such as "/(.*)"). Fail loudly rather than
// silently emit a regex that would under- or over-match in production.
function sourceToSrcRegex(source) {
  if (/:[A-Za-z_]\w*/.test(source)) {
    throw new Error(
      `apply-vercel-headers: cannot faithfully translate the path-to-regexp named ` +
        `parameter in vercel.json header source "${source}" to a Build Output API ` +
        `"src" regex. Rewrite it as a plain regex (e.g. "/(.*)"), or extend this ` +
        `script with a real path-to-regexp compiler first.`,
    );
  }
  let pattern = source;
  if (!pattern.startsWith('^')) pattern = `^${pattern}`;
  if (!pattern.endsWith('$')) pattern = `${pattern}$`;
  return pattern;
}

function headerEntriesToRoutes(headerEntries) {
  return headerEntries.map(({ source, headers }) => ({
    src: sourceToSrcRegex(source),
    headers: Object.fromEntries(headers.map(({ key, value }) => [key.toLowerCase(), value])),
    continue: true,
  }));
}

function isHeaderOnlyRoute(route) {
  return (
    route !== null &&
    typeof route === 'object' &&
    typeof route.src === 'string' &&
    route.headers !== undefined &&
    route.dest === undefined &&
    route.status === undefined
  );
}

function mergeHeaderRoutes(routes, headerRoutes) {
  const incomingSrcs = new Set(headerRoutes.map((r) => r.src));
  // Idempotent: drop any existing route this script would be about to
  // (re-)insert -- identified by an exact `src` match against what we're
  // about to write -- before inserting the fresh set. A route with a
  // DIFFERENT src (e.g. the adapter's own asset cache-control route) is
  // never touched.
  const withoutStale = routes.filter((r) => !(isHeaderOnlyRoute(r) && incomingSrcs.has(r.src)));

  const filesystemIndex = withoutStale.findIndex((r) => r && r.handle === 'filesystem');
  if (filesystemIndex === -1) {
    throw new Error(
      'apply-vercel-headers: no {"handle":"filesystem"} entry found in config.json ' +
        'routes -- refusing to guess where to insert the header routes.',
    );
  }

  return [
    ...withoutStale.slice(0, filesystemIndex),
    ...headerRoutes,
    ...withoutStale.slice(filesystemIndex),
  ];
}

/**
 * Read `vercelJsonPath`'s `headers` and merge them into `configJsonPath`'s
 * `routes`, writing the result back to `configJsonPath`. Returns the parsed,
 * updated config object. Paths are overridable so tests can drive this
 * against fixture files instead of the real build output.
 */
export function applyHeaders({
  vercelJsonPath = DEFAULT_VERCEL_JSON_PATH,
  configJsonPath = DEFAULT_CONFIG_JSON_PATH,
} = {}) {
  if (!existsSync(configJsonPath)) {
    throw new Error(`apply-vercel-headers: ${configJsonPath} not found -- run \`astro build\` first.`);
  }

  const vercelJson = JSON.parse(readFileSync(vercelJsonPath, 'utf8'));
  const headerRoutes = headerEntriesToRoutes(vercelJson.headers ?? []);

  const config = JSON.parse(readFileSync(configJsonPath, 'utf8'));
  config.routes = mergeHeaderRoutes(config.routes ?? [], headerRoutes);

  writeFileSync(configJsonPath, JSON.stringify(config, null, 2) + '\n');
  return config;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  applyHeaders();
  console.log('apply-vercel-headers: merged vercel.json headers into .vercel/output/config.json');
}
