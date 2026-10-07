// Regression tests for scripts/apply-vercel-headers.mjs.
//
// The defect: production deploys with `vercel deploy --prod --prebuilt`,
// which uploads only web/.vercel/output -- it never reads vercel.json for a
// prebuilt deploy. The Astro Vercel adapter's own `staticHeaders` option
// only emits a Content-Security-Policy header (and only when Astro's own
// experimental security.csp is enabled), so the other 4 headers declared in
// web/vercel.json never reached config.json at all, and
// `curl -sI https://danielbanariba.com/` showed none of the 5. This script
// is the fix: it merges vercel.json's `headers` into config.json's `routes`
// after every `astro build`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { applyHeaders } from '../scripts/apply-vercel-headers.mjs';

function makeFixture(routes: unknown[], headerEntries?: unknown[]) {
  const dir = mkdtempSync(path.join(tmpdir(), 'apply-vercel-headers-'));
  const vercelJsonPath = path.join(dir, 'vercel.json');
  const configJsonPath = path.join(dir, 'config.json');
  writeFileSync(
    vercelJsonPath,
    JSON.stringify({
      headers: headerEntries ?? [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
          ],
        },
      ],
    }),
  );
  writeFileSync(configJsonPath, JSON.stringify({ version: 3, routes }));
  return { vercelJsonPath, configJsonPath };
}

test('inserts the header route before {handle: "filesystem"}, preserving existing routes', () => {
  const { vercelJsonPath, configJsonPath } = makeFixture([
    { handle: 'filesystem' },
    {
      src: '^/_astro/(.*)$',
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
      continue: true,
    },
    { src: '^/.*$', dest: '/404.html', status: 404 },
  ]);

  const config = applyHeaders({ vercelJsonPath, configJsonPath }) as { routes: any[] };

  const filesystemIndex = config.routes.findIndex((r) => r.handle === 'filesystem');
  const headerIndex = config.routes.findIndex((r) => r.src === '^/(.*)$');

  assert.notEqual(headerIndex, -1, 'expected a header route for "/(.*)" to be inserted');
  assert.ok(
    headerIndex < filesystemIndex,
    `header route (index ${headerIndex}) must come before {handle: filesystem} (index ${filesystemIndex})`,
  );
  assert.equal(config.routes[headerIndex].continue, true);
  assert.deepEqual(config.routes[headerIndex].headers, {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  // Pre-existing routes (the adapter's own asset cache-control route, and
  // the 404 catch-all) must survive the merge untouched.
  assert.ok(config.routes.some((r) => r.src === '^/_astro/(.*)$'));
  assert.ok(config.routes.some((r) => r.dest === '/404.html'));
});

test('re-running the merge is idempotent -- no duplicate header route', () => {
  const { vercelJsonPath, configJsonPath } = makeFixture([
    { handle: 'filesystem' },
    { src: '^/.*$', dest: '/404.html', status: 404 },
  ]);

  applyHeaders({ vercelJsonPath, configJsonPath });
  const config = applyHeaders({ vercelJsonPath, configJsonPath }) as { routes: any[] };

  const matches = config.routes.filter((r) => r.src === '^/(.*)$');
  assert.equal(matches.length, 1, `expected exactly one header route after two runs, got ${matches.length}`);
});

test('a second run with a changed header value replaces the first, rather than stacking', () => {
  const { vercelJsonPath, configJsonPath } = makeFixture([{ handle: 'filesystem' }]);

  applyHeaders({ vercelJsonPath, configJsonPath });

  writeFileSync(
    vercelJsonPath,
    JSON.stringify({
      headers: [
        { source: '/(.*)', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
      ],
    }),
  );
  const config = applyHeaders({ vercelJsonPath, configJsonPath }) as { routes: any[] };

  const matches = config.routes.filter((r) => r.src === '^/(.*)$');
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].headers, { 'x-frame-options': 'SAMEORIGIN' });
});

test('throws instead of silently mistranslating a path-to-regexp named parameter', () => {
  const { vercelJsonPath, configJsonPath } = makeFixture(
    [{ handle: 'filesystem' }],
    [{ source: '/blog/:slug', headers: [{ key: 'X-Test', value: '1' }] }],
  );

  assert.throws(() => applyHeaders({ vercelJsonPath, configJsonPath }), /:slug/);
});

test('throws when config.json has no {handle: "filesystem"} entry to anchor on', () => {
  const { vercelJsonPath, configJsonPath } = makeFixture([
    { src: '^/.*$', dest: '/404.html', status: 404 },
  ]);

  assert.throws(() => applyHeaders({ vercelJsonPath, configJsonPath }), /filesystem/);
});
