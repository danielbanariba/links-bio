// Search island — all browse interactivity lives here: the search field, the filters, the count
// and the result.
//
// The result takes one of two shapes. With no text typed it is the cover wall (the same cards
// as every other archive page). Once somebody types, it becomes rows: a 48px cover, the album,
// the band and year under it, the genre and country beside it. Searching is looking for one
// record, so rows are what can be scanned; browsing is looking at covers.
//
// The full browse-index (~2,750 entries) is fetched once on mount, then ALL
// filtering/sorting/pagination is done in memory. That is trivial for the browser;
// only the text input is debounced.
//
// URL query-string is synced on every state change so links are bookmarkable.
// On mount, URL params are read back to restore state (e.g. from the facet pages'
// "Refine in Browse" links, /browse?genre=Death+Metal).

import type { ComponentChildren } from 'preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { countryFlag, countryLabel, genreLabel } from '../lib/labels.js';
import { getCardMeta } from '../lib/cardMeta.js';

// Mirrors BrowseEntry from types.ts — must stay in sync.
interface BrowseEntry {
  id: number;
  band_name: string;
  album_title: string;
  genre: string | null;
  country: string | null;
  year: number | null;
  release_type: string | null;
  views: number | null;
  thumb: string;
}

interface SearchProps {
  genres: string[];
  countries: string[];
  years: string[];
  totalCount: number;
  // The newest entries from the server-rendered pass — used to render
  // immediately before the full index download completes.
  initial: BrowseEntry[];
}

// A multiple of 2, 3, 4 and 5: the wall is 2 columns on a phone up to 5 on a desktop, and a
// page of this size always ends on a full row.
export const PAGE_SIZE = 60;
// How many cards rise in on the first paint.
const RISING = 10;
// Rows that load their cover straight away; the rest wait until they are near the screen.
const EAGER_ROWS = 12;

const nf = new Intl.NumberFormat('en-US');

// Sort keys mapped to UI labels. Logic keys off o.value (never the label),
// so translating the labels is safe and does not affect sorting behavior.
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az',     label: 'A — Z' },
  { value: 'za',     label: 'Z — A' },
  { value: 'views',  label: 'Most viewed' },
];

// Read a string param from the current URL search string.
function qp(name: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

// Sync active filters into the browser URL without a page reload.
function syncUrl(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  const url = window.location.pathname + (qs ? '?' + qs : '');
  window.history.replaceState(null, '', url);
}

// Case-insensitive substring — faster than .toLowerCase() + .includes() in a
// loop when called 2,750x per keystroke because we avoid allocating new strings.
function contains(haystack: string | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle);
}

// One filter: a pill that holds the filter's name until a value is chosen, then turns bone.
function Pick(props: { label: string; value: string; set: boolean; onChange: (e: Event) => void; children: ComponentChildren }) {
  return (
    <div class="finder__pick" data-set={props.set ? '' : undefined}>
      <select class="finder__select" value={props.value} onChange={props.onChange} aria-label={props.label}>
        {props.children}
      </select>
      <svg class="finder__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export default function Search({ genres, countries, years, totalCount, initial }: SearchProps) {
  // ─── Index state ──────────────────────────────────────────────────────────
  const [index, setIndex] = useState<BrowseEntry[]>(initial);
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // ─── Filter / sort state (initialised from URL on mount) ─────────────────
  const [query, setQuery]       = useState('');
  const [genre, setGenre]       = useState('');
  const [country, setCountry]   = useState('');
  const [year, setYear]         = useState('');
  const [releaseType, setRelType] = useState('');
  const [sort, setSort]         = useState('newest');

  // Pagination — page is reset on any filter/sort change.
  const [page, setPage] = useState(1);

  // Whether the user (or the URL) has set anything — until then the server-rendered list is
  // already the right one.
  const [active, setActive] = useState(false);
  // Whether the user has touched a control. Until then the result arrives with an entrance
  // (the first cards, or rows, rise in, also when the URL carried the filters); after that
  // it changes in place, without one.
  const [touched, setTouched] = useState(false);

  // Debounce ref for the text input, and the elements the keyboard moves between.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ─── Mount: read URL params + fetch full index ────────────────────────────
  useEffect(() => {
    // Restore URL state.
    const q  = qp('q');
    const g  = qp('genre');
    const c  = qp('country');
    const y  = qp('year');
    const rt = qp('release_type');
    const s  = qp('sort');
    if (q)  { setQuery(q);    setActive(true); if (inputRef.current) inputRef.current.value = q; }
    if (g)  { setGenre(g);    setActive(true); }
    if (c)  { setCountry(c);  setActive(true); }
    if (y)  { setYear(y);     setActive(true); }
    if (rt) { setRelType(rt); setActive(true); }
    if (s)  { setSort(s);     setActive(true); }

    // Fetch full index (served from public/ root — no Astro base).
    fetch('/browse-index.json')
      .then((r) => r.json())
      .then((data: BrowseEntry[]) => {
        setIndex(data);
        setIndexLoaded(true);
      })
      .catch(() => {
        // If fetch fails, keep using the initial entries.
        setLoadFailed(true);
        setIndexLoaded(true);
      });
  }, []);

  // ─── URL sync on every filter change ─────────────────────────────────────
  useEffect(() => {
    syncUrl({ q: query, genre, country, year, release_type: releaseType, sort: sort === 'newest' ? '' : sort });
  }, [query, genre, country, year, releaseType, sort]);

  // ─── Derived: filtered + sorted result list ───────────────────────────────
  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();

    let result = index.filter((e) => {
      // Text search over band + album + genre + country, so typing a country
      // (e.g. "Honduras") returns results instead of silently emptying.
      if (
        needle &&
        !contains(e.band_name, needle) &&
        !contains(e.album_title, needle) &&
        !contains(e.genre, needle) &&
        !contains(e.country, needle)
      ) {
        return false;
      }
      if (genre       && e.genre        !== genre)       return false;
      if (country     && e.country      !== country)     return false;
      if (year        && String(e.year) !== year)        return false;
      if (releaseType && e.release_type !== releaseType) return false;
      return true;
    });

    // Sort.
    if (sort === 'az') {
      result = result.slice().sort((a, b) => a.band_name.localeCompare(b.band_name));
    } else if (sort === 'za') {
      result = result.slice().sort((a, b) => b.band_name.localeCompare(a.band_name));
    } else if (sort === 'newest') {
      // Index is ordered band_name ASC from DB; for newest we reverse by id
      // (higher id = more recently added). A full sort is done here because the
      // server sends index alphabetically.
      result = result.slice().sort((a, b) => b.id - a.id);
    } else if (sort === 'oldest') {
      result = result.slice().sort((a, b) => a.id - b.id);
    } else if (sort === 'views') {
      // Real "Mas vistos" — views now travels in the index. NULL views sort to
      // the bottom (treated as -1); ties break by id desc (newer first) so the
      // order is stable and deterministic.
      result = result.slice().sort((a, b) => {
        const av = a.views ?? -1;
        const bv = b.views ?? -1;
        return bv - av || b.id - a.id;
      });
    }

    return result;
  }, [index, query, genre, country, year, releaseType, sort]);

  // ─── Pagination ───────────────────────────────────────────────────────────
  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  // Reset to page 1 when filters/sort change.
  // useMemo runs synchronously before render so we can't setPage inside it;
  // use an effect that tracks the dependencies.
  const prevFilters = useRef('');
  useEffect(() => {
    const sig = query + genre + country + year + releaseType + sort;
    if (sig !== prevFilters.current) {
      prevFilters.current = sig;
      setPage(1);
    }
  }, [query, genre, country, year, releaseType, sort]);

  // ─── Release-type options derived from the loaded index ──────────────────
  const releaseTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const e of index) {
      if (e.release_type) seen.add(e.release_type);
    }
    return [...seen].sort();
  }, [index]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  function applyQuery(val: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    setQuery(val);
    setActive(true);
    setTouched(true);
  }
  function onQueryInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyQuery(val), 120);
  }

  function handleGenre(e: Event)   { setGenre((e.target as HTMLSelectElement).value);   setActive(true); setTouched(true); }
  function handleCountry(e: Event) { setCountry((e.target as HTMLSelectElement).value); setActive(true); setTouched(true); }
  function handleYear(e: Event)    { setYear((e.target as HTMLSelectElement).value);    setActive(true); setTouched(true); }
  function handleRelType(e: Event) { setRelType((e.target as HTMLSelectElement).value); setActive(true); setTouched(true); }
  function handleSort(e: Event)    { setSort((e.target as HTMLSelectElement).value);    setActive(true); setTouched(true); }

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
    setQuery(''); setGenre(''); setCountry(''); setYear(''); setRelType(''); setSort('newest');
    setTouched(true);
    inputRef.current?.focus();
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  // While the full index is still downloading and the URL (or the user) has already set
  // something, the list on screen is the unfiltered first page: it stays, dimmed, and the
  // count says so, rather than showing a wrong list as if it were the answer.
  const loading = active && !indexLoaded;
  const text = query.trim();
  const rowsMode = !loading && text !== '';
  const filtersSet = !!(genre || country || year || releaseType || sort !== 'newest');
  const shown = loading ? initial : visible;
  // the first cards / rows (and the no-results message) rise in, one after the other
  const rise = (i: number) => (!touched && i < RISING ? { class: 'rise', style: `--i:${3 + (i % 5)}` } : {});
  const showEmpty = !loading && indexLoaded && filtered.length === 0;

  let countLabel: string;
  if (loading) countLabel = 'Loading the archive…';
  else if (!indexLoaded) countLabel = `${nf.format(totalCount)} albums`;
  else {
    const n = filtered.length;
    countLabel = `${nf.format(n)} ${n === 1 ? 'album' : 'albums'}${text ? ` for “${text}”` : ''}`;
  }

  // Keyboard: the field hands over to the first row with the down arrow; the arrows then walk
  // the rows, and the up arrow on the first row returns to the field. Escape empties the field.
  const rowLinks = () => [...(resultsRef.current?.querySelectorAll<HTMLAnchorElement>('.srow') ?? [])];
  function onFieldKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' && rowsMode) {
      const first = rowLinks()[0];
      if (first) { e.preventDefault(); first.focus(); }
    } else if (e.key === 'Escape' && inputRef.current?.value) {
      e.preventDefault();
      inputRef.current.value = '';
      applyQuery('');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      applyQuery((e.target as HTMLInputElement).value);
    }
  }
  function onRowsKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = rowLinks();
    const at = rows.indexOf(document.activeElement as HTMLAnchorElement);
    if (at < 0) return;
    e.preventDefault();
    if (e.key === 'ArrowDown') rows[Math.min(at + 1, rows.length - 1)].focus();
    else if (at === 0) inputRef.current?.focus();
    else rows[at - 1].focus();
  }

  return (
    <div class="finder">
      {/* ── Controls: one row on the ground ──────────────────────────── */}
      <div class="finder__bar rise" style="--i:2" role="search">
        <div class="finder__field">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            class="finder__input"
            placeholder="Search bands, albums, genres..."
            autocomplete="off"
            onInput={onQueryInput}
            onKeyDown={onFieldKey}
            aria-label="Search albums"
          />
        </div>

        <Pick label="Filter by genre" value={genre} set={!!genre} onChange={handleGenre}>
          <option value="">All genres</option>
          {genres.map((g) => <option value={g}>{genreLabel(g)}</option>)}
        </Pick>

        {/* The option VALUE stays the raw (Spanish) database string so
            filtering and ?country= links keep working; only the visible text
            is translated. */}
        <Pick label="Filter by country" value={country} set={!!country} onChange={handleCountry}>
          <option value="">All countries</option>
          {countries.map((c) => <option value={c}>{countryLabel(c)}</option>)}
        </Pick>

        <Pick label="Filter by year" value={year} set={!!year} onChange={handleYear}>
          <option value="">All years</option>
          {years.map((y) => <option value={y}>{y}</option>)}
        </Pick>

        <Pick label="Filter by release type" value={releaseType} set={!!releaseType} onChange={handleRelType}>
          <option value="">All types</option>
          {releaseTypes.map((rt) => <option value={rt}>{rt}</option>)}
        </Pick>

        <Pick label="Sort" value={sort} set={sort !== 'newest'} onChange={handleSort}>
          {SORT_OPTIONS.map((o) => <option value={o.value}>{o.label}</option>)}
        </Pick>
      </div>

      {/* ── Count (the line keeps its height: nothing below it moves) ─── */}
      <div class="finder__status">
        <p class="finder__count" role="status">{countLabel}</p>
        {(text || filtersSet) && !loading && (
          <button type="button" class="finder__clear" onClick={clearAll}>Clear all</button>
        )}
      </div>

      {loadFailed && (
        <p class="finder__note">The full list could not be loaded, so only the newest {nf.format(initial.length)} albums can be searched. Reload the page to try again.</p>
      )}

      {/* ── Result: rows for a search, the wall for browsing ─────────── */}
      <div class="finder__results" ref={resultsRef} aria-busy={loading ? 'true' : undefined}>
        {showEmpty && (
          <div class="finder__empty">
            <h2 {...(touched ? {} : { class: 'rise', style: '--i:3' })}>No albums match</h2>
            <p {...(touched ? {} : { class: 'rise', style: '--i:4' })}>{text ? `Nothing in the archive matches “${text}”` : 'Nothing in the archive matches these filters'}. Try fewer letters or fewer filters.</p>
            <button type="button" class={touched ? 'btn btn--secondary' : 'btn btn--secondary rise'} style={touched ? undefined : '--i:5'} onClick={clearAll}>Clear search and filters</button>
          </div>
        )}

        {!showEmpty && rowsMode && (
          <ul class="srows" role="list" aria-label="Search results" onKeyDown={onRowsKey}>
            {visible.map((a, i) => {
              const meta = getCardMeta(a.year, a.country);
              const flag = countryFlag(a.country);
              return (
                <li key={a.id} {...rise(i)}>
                  <a class="srow" href={`/metal-archive/album/${a.id}`}>
                    <span class="srow__art">
                      {a.thumb
                        ? <img src={a.thumb} alt="" width="48" height="48" loading={i < EAGER_ROWS ? 'eager' : 'lazy'} decoding="async" />
                        : null}
                    </span>
                    <span class="srow__text">
                      <span class="srow__album">{a.album_title}</span>
                      <span class="srow__sub">
                        {a.band_name}
                        {meta.showYear && <> · <span class="srow__year">{a.year}</span></>}
                        {meta.showCountry && <span class="srow__sub-country"> · {countryLabel(a.country)}</span>}
                      </span>
                    </span>
                    <span class="srow__facet">{genreLabel(a.genre)}</span>
                    <span class="srow__facet">
                      {meta.showCountry && <>{flag && <span class="srow__flag" aria-hidden="true">{flag}</span>}{countryLabel(a.country)}</>}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        {!showEmpty && !rowsMode && (
          <ul class="wall" aria-label="Albums">
            {shown.map((a, i) => {
              return (
                <li key={a.id} {...rise(i)}>
                  <a class="album-card" href={`/metal-archive/album/${a.id}`}>
                    <div class="album-card__art">
                      {a.thumb
                        ? <img class="album-card__cover" src={a.thumb} alt="" width="320" height="180" loading={i < 5 ? 'eager' : 'lazy'} decoding="async" />
                        : <div class="album-card__cover album-card__cover--empty" aria-hidden="true" />}
                      <span class="album-card__open" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
                      </span>
                    </div>
                    <div class="album-card__body">
                      <div class="album-card__band">{a.band_name}</div>
                      <div class="album-card__album">{a.album_title}</div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Show more ───────────────────────────────────────────────── */}
      {hasMore && !loading && (
        <div class="finder__more">
          <button type="button" class="btn btn--secondary" onClick={() => setPage((p) => p + 1)}>
            Show more ({nf.format(filtered.length - visible.length)} left)
          </button>
        </div>
      )}
    </div>
  );
}
