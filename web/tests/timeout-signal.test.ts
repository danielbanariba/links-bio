// Regression test for R3-001 (lineage review-fad8cf8c80894277): all 4 forms
// called `AbortSignal.timeout(ms)` directly inline in their fetch() options.
// `AbortSignal.timeout` does not exist on Safari < 16, Chrome < 103 or
// Firefox < 100 — on those browsers, building the options object threw a
// TypeError before fetch() ever ran, so the catch block showed a generic
// network error on EVERY submit attempt, not just a slow one.
//
// timeoutSignal() (api.ts) fixes this with feature detection plus an
// AbortController + setTimeout fallback that still aborts with a
// DOMException named 'TimeoutError' (see isTimeoutError below for older
// browsers that reject with an AbortError instead).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isTimeoutError, timeoutSignal } from '../src/lib/api.ts';

test('timeoutSignal falls back to an AbortController when AbortSignal.timeout is unavailable', async () => {
  const original = AbortSignal.timeout;
  // Simulate Safari < 16 / Chrome < 103 / Firefox < 100, where this static
  // method does not exist.
  // @ts-expect-error - deleting a static method to simulate an older browser
  delete AbortSignal.timeout;

  try {
    // The exact defect: calling `AbortSignal.timeout(ms)` directly here would
    // throw "AbortSignal.timeout is not a function" instead of returning a
    // usable signal.
    const signal = timeoutSignal(5);
    assert.ok(signal instanceof AbortSignal);
    assert.equal(signal!.aborted, false);

    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(signal!.aborted, true);
    assert.equal((signal!.reason as DOMException).name, 'TimeoutError');
  } finally {
    AbortSignal.timeout = original;
  }
});

test('timeoutSignal uses the native AbortSignal.timeout when it is available', () => {
  // Guards the other branch: if the fallback path were used unconditionally
  // (ignoring the feature check), this would still pass, but a reversed
  // condition (falling back only when the native method IS available) would
  // make this return undefined instead of a fresh, not-yet-aborted signal.
  const signal = timeoutSignal(5000);
  assert.ok(signal instanceof AbortSignal);
  assert.equal(signal!.aborted, false);
});

// Regression test for R3-001 (lineage review-6b2db25e71aeb72d): browsers old
// enough to need the fallback above may also predate abort(reason)
// (Chrome < 98, Firefox < 97, Safari < 15.4). They ignore the TimeoutError
// reason, so the timed-out fetch rejects with an AbortError instead, and a
// strict `err.name === 'TimeoutError'` check showed the generic network
// error. Nothing else aborts these fetches, so AbortError means timeout.
test('isTimeoutError treats both TimeoutError and AbortError as a timeout, nothing else', () => {
  assert.equal(isTimeoutError(new DOMException('timed out', 'TimeoutError')), true);
  assert.equal(isTimeoutError(new DOMException('aborted', 'AbortError')), true);
  assert.equal(isTimeoutError(new TypeError('Failed to fetch')), false);
  assert.equal(isTimeoutError(undefined), false);
});
