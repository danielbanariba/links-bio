// Shared forms-API config.
//
// API_BASE used to be hand-copied as
// `import.meta.env.PUBLIC_API_BASE ?? 'https://app.danielbanariba.com'` in 4
// separate inline <script> blocks (the contact form on index.astro, submit,
// promo and newsletter) — the same drift risk already realized with the
// social icon rows (see the T14 fix): a future default-URL change could
// silently apply to only some of the forms.
//
// `import.meta.env` itself (not just the PUBLIC_API_BASE key) is undefined
// outside Vite/Astro — e.g. when this module is imported directly by the
// plain `node --test` runner for timeout-signal.test.ts below. Fall back to
// `{}` so importing this file never throws there; under Astro, `import.meta`
// always has an `env` object, so behavior is unchanged in production.
const env: Record<string, string | undefined> = (import.meta as any).env ?? {};
export const API_BASE: string = env.PUBLIC_API_BASE ?? 'https://app.danielbanariba.com';

// Shared fetch timeout for the 4 form submissions. Without one, a hung API
// left the submit button spinning forever with no feedback.
export const FORM_FETCH_TIMEOUT_MS = 15000;

// Distinct message so a timeout reads differently from a generic network
// failure or a server-side validation error.
export const FORM_TIMEOUT_MESSAGE = 'The request took too long. Please check your connection and try again.';

// All 4 forms used to call `AbortSignal.timeout(ms)` directly inline in the
// fetch() options literal. `AbortSignal.timeout` is missing on Safari < 16,
// Chrome < 103 and Firefox < 100: on those browsers, building the options
// object threw a TypeError before fetch() ever ran, so the catch block
// reported a generic network error on EVERY submit, not just a slow one.
//
// This falls back to a plain AbortController + setTimeout, aborting with a
// DOMException named 'TimeoutError'. Browsers that predate abort(reason)
// ignore that reason and reject with an AbortError, so the pages check
// isTimeoutError() below rather than the error name directly. If neither
// mechanism exists, it returns undefined and fetch() just runs without a
// timeout instead of throwing.
export function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  if (typeof AbortController === 'undefined') return undefined;
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort(new DOMException('The operation timed out.', 'TimeoutError'));
  }, ms);
  return controller.signal;
}

// True when a form fetch() rejected because timeoutSignal() fired. Native
// AbortSignal.timeout and abort(reason)-aware browsers reject with a
// TimeoutError; older browsers on the fallback path reject with an
// AbortError. Nothing else aborts these requests, so both mean a timeout.
export function isTimeoutError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
}
