// Derive the mqdefault thumbnail URL from whatever is stored in the DB.
// YouTube stores maxresdefault/hqdefault/sddefault; cards need the lighter mqdefault.
// cdn.deathgrind.club artwork URLs pass through unchanged.
export function thumb(url: string | null | undefined): string {
  if (!url) return '';
  return url
    .replace('maxresdefault', 'mqdefault')
    .replace('hqdefault', 'mqdefault')
    .replace('sddefault', 'mqdefault');
}
