// Shared SEO / structured-data helpers.

/**
 * Serializes a JSON-LD payload for an inline
 * `<script type="application/ld+json" set:html={...} />`.
 *
 * Astro's `set:html` does NOT HTML-escape its content, and the payload here
 * is built from database strings (band names, album titles, descriptions) —
 * untrusted input to a script tag. The only sequence that could break out of
 * it is "<" (e.g. a stray "</script>" inside a description), so it is
 * neutralized the same way the album page's #metal-np-data island already
 * does: JSON parses "<" back to "<", so the data is unaffected.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
