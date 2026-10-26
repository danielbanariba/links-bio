// The disk side of the covers: how the tracked, hand-edited override file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { readCoverOverrides } from '../src/lib/coverStore.ts';

// Defect caught: a typo in cover-overrides.json (a trailing comma) read as an
// empty file, so the covers step silently re-crops every album a human marked
// "full" or boxed by hand, and the build ships the crops the review rejected.
test('an override file that is not valid JSON is reported as unreadable, not as empty', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cover-store-'));
  try {
    const file = path.join(dir, 'cover-overrides.json');
    writeFileSync(file, '{ "abcdefghijk": "full", }');
    const r = readCoverOverrides(file);
    assert.equal(r.unreadable, true);
    assert.equal(r.problems.length, 1);
    // A file that is simply not there is no error: there are no overrides.
    const missing = readCoverOverrides(path.join(dir, 'none.json'));
    assert.deepEqual([missing.unreadable, missing.problems, missing.overrides], [false, [], {}]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
