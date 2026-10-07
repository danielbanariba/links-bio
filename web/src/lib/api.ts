// Shared forms-API config.
//
// API_BASE used to be hand-copied as
// `import.meta.env.PUBLIC_API_BASE ?? 'https://app.danielbanariba.com'` in 4
// separate inline <script> blocks (the contact form on index.astro, submit,
// promo and newsletter) — the same drift risk already realized with the
// social icon rows (see the T14 fix): a future default-URL change could
// silently apply to only some of the forms.
export const API_BASE: string = import.meta.env.PUBLIC_API_BASE ?? 'https://app.danielbanariba.com';

// Shared fetch timeout for the 4 form submissions. Without one, a hung API
// left the submit button spinning forever with no feedback.
export const FORM_FETCH_TIMEOUT_MS = 15000;

// Distinct message so a timeout reads differently from a generic network
// failure or a server-side validation error.
export const FORM_TIMEOUT_MESSAGE = 'The request took too long. Please check your connection and try again.';
