// The sidebar's "Recent" list: the albums this browser played, newest first,
// kept in localStorage. Storage can be missing, blocked (private mode, a
// SecurityError on access), full (QuotaExceededError) or hold anything a
// visitor or an older build wrote there, so every read is validated and every
// access is guarded.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addRecent,
  parseRecent,
  loadRecent,
  saveRecent,
  rememberRecent,
  RECENT_KEY,
  RECENT_MAX,
  type RecentEntry,
} from '../src/lib/recent.ts';

const entry = (id: string): RecentEntry => ({
  id,
  title: `Album ${id}`,
  band: `Band ${id}`,
  href: `/metal-archive/album/${id}`,
  cover: `/covers/v${id}.webp`,
});

// A Storage stand-in backed by a Map.
function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    map,
  };
}

test('addRecent puts the album just played first', () => {
  const list = addRecent([entry('1'), entry('2')], entry('3'));
  assert.deepEqual(list.map((e) => e.id), ['3', '1', '2']);
});

test('addRecent moves an album played again to the top instead of listing it twice', () => {
  const list = addRecent([entry('1'), entry('2'), entry('3')], entry('2'));
  assert.deepEqual(list.map((e) => e.id), ['2', '1', '3']);
});

test('addRecent keeps the newest RECENT_MAX albums and drops the oldest', () => {
  let list: RecentEntry[] = [];
  for (let i = 1; i <= RECENT_MAX + 2; i++) list = addRecent(list, entry(String(i)));
  assert.equal(list.length, RECENT_MAX);
  assert.equal(list[0].id, String(RECENT_MAX + 2));
  assert.ok(!list.some((e) => e.id === '1' || e.id === '2'), 'the two oldest are gone');
});

test('addRecent ignores an entry with no id or no title', () => {
  const start = [entry('1')];
  assert.deepEqual(addRecent(start, { ...entry('2'), id: '' }), start);
  assert.deepEqual(addRecent(start, { ...entry('2'), title: '  ' }), start);
});

test('parseRecent returns an empty list for anything that is not a JSON array', () => {
  assert.deepEqual(parseRecent(null), []);
  assert.deepEqual(parseRecent(''), []);
  assert.deepEqual(parseRecent('{not json'), []);
  assert.deepEqual(parseRecent('{"id":"1"}'), []);
});

test('parseRecent drops malformed entries and keeps the good ones in order', () => {
  const raw = JSON.stringify([
    entry('1'),
    { id: 2, title: 'number id' },
    null,
    { ...entry('3'), title: 42 },
    entry('4'),
  ]);
  assert.deepEqual(parseRecent(raw).map((e) => e.id), ['1', '4']);
});

test('parseRecent never returns a link that leaves the archive', () => {
  // The sidebar renders href as a link: a javascript: or off-site URL written
  // into storage must not turn into one.
  const raw = JSON.stringify([
    { ...entry('1'), href: 'javascript:alert(1)' },
    { ...entry('2'), href: 'https://evil.example/' },
    { ...entry('3'), href: '//evil.example/metal-archive/' },
    entry('4'),
  ]);
  assert.deepEqual(parseRecent(raw).map((e) => e.id), ['4']);
});

test('parseRecent caps a long stored list at RECENT_MAX', () => {
  const raw = JSON.stringify(Array.from({ length: 50 }, (_, i) => entry(String(i))));
  assert.equal(parseRecent(raw).length, RECENT_MAX);
});

test('loadRecent returns an empty list when storage is missing or throws', () => {
  assert.deepEqual(loadRecent(null), []);
  const blocked = { getItem: () => { throw new Error('SecurityError'); } };
  assert.deepEqual(loadRecent(blocked), []);
});

test('saveRecent swallows a full or blocked storage', () => {
  const full = { setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.doesNotThrow(() => saveRecent(full, [entry('1')]));
  assert.doesNotThrow(() => saveRecent(null, [entry('1')]));
});

test('rememberRecent stores the new list under RECENT_KEY and returns it', () => {
  const storage = memoryStorage({ [RECENT_KEY]: JSON.stringify([entry('1')]) });
  const list = rememberRecent(storage, entry('2'));
  assert.deepEqual(list.map((e) => e.id), ['2', '1']);
  assert.deepEqual(parseRecent(storage.map.get(RECENT_KEY)).map((e) => e.id), ['2', '1']);
});

test('rememberRecent still returns the list when storage cannot be written', () => {
  const readOnly = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.deepEqual(rememberRecent(readOnly, entry('7')).map((e) => e.id), ['7']);
});
