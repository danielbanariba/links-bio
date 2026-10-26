// Daniel's OWN live sets (e.g. "Megametal (Live in Honduras...)") are not studio
// albums: the feeds leave them out and show them in their own sections. The SQL
// side of this rule is LIVE_MATCH / NOT_LIVE in db.ts, which matches the same two
// phrases; this is the same test for a title already in hand, browser-safe so
// the Search island applies it too. db.ts re-exports it.
export function isLiveRecording(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return t.includes('live in') || t.includes('(live');
}
