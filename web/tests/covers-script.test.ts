// The pre-build covers step as `npm run build` runs it (a real child process).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve('scripts/covers/covers.mjs');

// Defect caught: `npm run build` (covers && astro build) stopped by the covers
// step itself when it cannot find reflex.db. The step promises never to fail the
// build; the page build reports a missing database on its own.
test('the covers step skips itself, with exit code 0, when reflex.db is not found', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'covers-script-'));
  try {
    const r = spawnSync(process.execPath, [SCRIPT], {
      cwd: dir,
      env: { ...process.env, REFLEX_DB: path.join(dir, 'missing.db') },
      encoding: 'utf-8',
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /reflex\.db not found/);
    assert.ok(!existsSync(path.join(dir, '.cover-cache.json')), 'nothing is written');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
