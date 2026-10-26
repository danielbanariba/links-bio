// Search island: the Browse page's search field and what it shows, as in the
// prototype's search screen. Three modes, from the URL and the field:
//   - empty: nothing typed and no filter. The island draws only the field; the
//     genre and country tiles under it are server-rendered by browse.astro (and
//     hidden by CSS once the island leaves this mode).
//   - results (?q=): a Top result, the matching albums as rows with a ▶, the
//     bands that have a page, and the matching genre and country pages
//     (lib/search.ts ranks them). Live recordings are searchable.
//   - list (?genre= ?country= ?year= ?release_type= ?sort=, no q): the albums
//     those filters keep, live recordings left out like every feed, as a grid
//     with a sort and "Load more". These are the old Browse links ("Most played:
//     See all" is ?sort=views); each filter is a chip that removes it.
//
// The index (/browse-index.json, ~2,700 entries) is fetched once, when the URL
// asks for results or the field is first used, then everything runs in memory.
// The URL follows the field and the filters (replaceState, keeping the history
// entry's state: ClientRouter keeps its scroll position there), and so does the
// number of results revealed, so Back reopens the list as far as it was.

import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { countryFlag, countryLabel, genreLabel } from '../lib/labels.js';
import { formatCardMeta, NO_GENRE } from '../lib/cardMeta.js';
import { displayTitle } from '../lib/title.js';
import { coverMode } from '../lib/coverDisplay.js';
import { GLYPH_PLAY, ICONS } from '../lib/icons.js';
import { slugify } from '../lib/slug.js';
import { isLiveRecording } from '../lib/live.js';
import { searchAlbums, searchBands, searchFacets, topResult, SEARCH_URL_EVENT } from '../lib/search.js';
import type { BrowseEntry } from '../lib/types.js';

// The cover as components/CoverArt.astro draws it: a square crop fills the box, a
// YouTube frame sits whole over a blurred copy of itself, never centre-cropped.
function Art({ src }: { src: string }) {
  const mode = coverMode(src);
  if (mode === 'none') return <span class="ma-art ma-art--none" aria-hidden="true" />;
  if (mode === 'square') {
    return (
      <span class="ma-art">
        <img class="ma-art__img" src={src} alt="" loading="lazy" decoding="async" width={400} height={400} />
      </span>
    );
  }
  return (
    <span class="ma-art ma-art--frame">
      <img class="ma-art__bg" src={src} alt="" loading="lazy" decoding="async" width={320} height={180} />
      <span class="ma-art__frame">
        <img class="ma-art__img" src={src} alt="" loading="lazy" decoding="async" width={320} height={180} />
      </span>
    </span>
  );
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  return <svg class="ma-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

const Glyph = () => (
  <svg data-glyph viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={GLYPH_PLAY} /></svg>
);

const FILTERS = ['genre', 'country', 'year', 'release_type'] as const;
type FilterKey = (typeof FILTERS)[number];
type Filters = Record<FilterKey, string>;
const NO_FILTERS: Filters = { genre: '', country: '', year: '', release_type: '' };

// Sort keys mapped to UI labels. Logic keys off o.value (never the label).
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az', label: 'A — Z' },
  { value: 'za', label: 'Z — A' },
  { value: 'views', label: 'Most viewed' },
];

const RESULTS_STEP = 20;
const GRID_STEP = 24;
const SHOWN_KEY = 'browseShown';

const plural = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

function sorted(list: BrowseEntry[], sort: string): BrowseEntry[] {
  const out = list.slice();
  if (sort === 'az') return out.sort((a, b) => a.band_name.localeCompare(b.band_name));
  if (sort === 'za') return out.sort((a, b) => b.band_name.localeCompare(a.band_name));
  if (sort === 'oldest') return out.sort((a, b) => a.id - b.id);
  // Views: an uncounted album last, a tie to the newer upload.
  if (sort === 'views') return out.sort((a, b) => (b.views ?? -1) - (a.views ?? -1) || b.id - a.id);
  return out.sort((a, b) => b.id - a.id); // newest: a higher id was added later
}

function filterLabel(key: FilterKey, value: string): string {
  if (key === 'genre') return genreLabel(value);
  if (key === 'country') return `${countryFlag(value) ? countryFlag(value) + ' ' : ''}${countryLabel(value)}`;
  return value;
}

/** Replace the URL's query, keeping the history entry's state (ClientRouter's scroll). */
function writeUrl(params: Record<string, string>, extra: Record<string, unknown> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : '');
  history.replaceState({ ...(history.state ?? {}), ...extra }, '', url);
  // replaceState fires no event: tell the sidebar, which marks Genres/Countries from the URL.
  document.dispatchEvent(new Event(SEARCH_URL_EVENT));
}

interface SearchProps {
  total: number;
}

export default function Search({ total }: SearchProps) {
  const [index, setIndex] = useState<BrowseEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState('');
  const [shown, setShown] = useState(0);
  // Set once the mount effect has read the URL: until then a deep link keeps the
  // page's tiles hidden (browse.astro marks it, archive.css hides them).
  const [ready, setReady] = useState(false);
  const loading = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = query.trim();
  const hasFilter = FILTERS.some((k) => filters[k]) || !!sort;
  const mode: 'empty' | 'results' | 'list' = q ? 'results' : hasFilter ? 'list' : 'empty';

  const loadIndex = () => {
    if (loading.current) return;
    loading.current = true;
    fetch('/browse-index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: BrowseEntry[]) => setIndex(data))
      .catch(() => setFailed(true));
  };

  // ─── Mount: the URL's state, and the index when it is needed now ──────────
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const f = { ...NO_FILTERS };
    for (const k of FILTERS) f[k] = sp.get(k) ?? '';
    const q0 = sp.get('q') ?? '';
    setQuery(q0);
    setFilters(f);
    setSort(sp.get('sort') ?? '');
    const saved = history.state?.[SHOWN_KEY];
    if (Number.isInteger(saved)) setShown(saved);
    setReady(true);
    if (q0.trim() || FILTERS.some((k) => f[k]) || sp.get('sort')) loadIndex();
  }, []);

  // ─── URL follows the field (debounced) and the filters ────────────────────
  const syncUrl = (next: { q?: string; filters?: Filters; sort?: string; shown?: number }) => {
    const params: Record<string, string> = {
      q: (next.q ?? query).trim(),
      ...(next.filters ?? filters),
      sort: next.sort ?? sort,
    };
    writeUrl(params, { [SHOWN_KEY]: next.shown ?? 0 });
  };

  function onInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    setQuery(value);
    setShown(0);
    loadIndex();
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => syncUrl({ q: value, shown: 0 }), 250);
  }
  function clearQuery() {
    setQuery('');
    setShown(0);
    syncUrl({ q: '', shown: 0 });
    inputRef.current?.focus();
  }
  function removeFilter(key: FilterKey) {
    const next = { ...filters, [key]: '' };
    setFilters(next);
    setShown(0);
    syncUrl({ filters: next, shown: 0 });
  }
  function onSort(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    setSort(value);
    setShown(0);
    syncUrl({ sort: value, shown: 0 });
  }
  function showMore(step: number) {
    const n = (shown || step) + step;
    setShown(n);
    syncUrl({ shown: n });
  }

  // ─── Derived ──────────────────────────────────────────────────────────────
  // Bands with a page (2+ albums under the exact name), for each ▶'s band link.
  const bandPages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of index ?? []) counts.set(a.band_name, (counts.get(a.band_name) ?? 0) + 1);
    return counts;
  }, [index]);
  const bandHref = (band: string) =>
    (bandPages.get(band) ?? 0) >= 2
      ? `/metal-archive/band/${slugify(band)}`
      : `/metal-archive/browse?q=${encodeURIComponent(band)}`;

  const results = useMemo(() => {
    if (mode !== 'results' || !index) return null;
    const pool = index.filter((a) => FILTERS.every((k) => !filters[k] || String(a[k] ?? '') === filters[k]));
    const albums = searchAlbums(pool, q);
    const bands = searchBands(index, q);
    return { albums, bands, facets: searchFacets(index, q), top: topResult(q, bands, albums) };
  }, [mode, index, q, filters]);

  const list = useMemo(() => {
    if (mode !== 'list' || !index) return null;
    const kept = index.filter(
      (a) => !isLiveRecording(a.album_title) && FILTERS.every((k) => !filters[k] || String(a[k] ?? '') === filters[k]),
    );
    return sorted(kept, sort || 'newest');
  }, [mode, index, filters, sort]);

  // ─── Pieces ───────────────────────────────────────────────────────────────
  const playAttrs = (a: BrowseEntry) => {
    const videoId = (a.youtube_video_id || '').trim();
    if (!videoId) return null;
    return {
      'data-play-card': '',
      'data-video-id': videoId,
      'data-album-id': String(a.id),
      'data-band': a.band_name,
      'data-title': displayTitle(a.album_title),
      'data-thumb': a.thumb || '',
      'data-cover': a.cover || a.thumb || '',
      'data-href': `/metal-archive/album/${a.id}`,
      'data-meta': formatCardMeta(a),
      'data-band-href': bandHref(a.band_name),
      ...(a.accent ? { 'data-accent': a.accent } : {}),
    };
  };

  const albumRow = (a: BrowseEntry) => {
    const title = displayTitle(a.album_title);
    const attrs = playAttrs(a);
    const src = a.cover || a.thumb;
    const sub = [a.band_name, a.year ? String(a.year) : '', a.genre === NO_GENRE ? '' : genreLabel(a.genre)].filter(Boolean).join(' · ');
    return (
      <li key={a.id} class="ma-arow">
        {attrs ? (
          <button type="button" class="ma-arow__art" aria-label={`Play ${title} by ${a.band_name}`} {...attrs}>
            <Art src={src} />
            <span class="ma-arow__icon" aria-hidden="true"><Glyph /></span>
          </button>
        ) : (
          <span class="ma-arow__art"><Art src={src} /></span>
        )}
        <a class="ma-arow__text" href={`/metal-archive/album/${a.id}`}>
          <b>{title}</b>
          <small>{sub}</small>
        </a>
        {a.views != null && <span class="ma-arow__views">{plural(a.views, 'view')}</span>}
      </li>
    );
  };

  const card = (a: BrowseEntry) => {
    const meta = formatCardMeta(a);
    const attrs = playAttrs(a);
    const href = `/metal-archive/album/${a.id}`;
    const title = displayTitle(a.album_title);
    const src = a.cover || a.thumb;
    return (
      <div key={a.id} class="ma-card">
        {attrs ? (
          <button type="button" class="ma-card__cover" aria-label={`Play ${title} by ${a.band_name}`} {...attrs}>
            <Art src={src} />
            <span class="ma-card__play" aria-hidden="true"><Glyph /></span>
          </button>
        ) : (
          <a class="ma-card__cover" href={href} tabIndex={-1} aria-hidden="true"><Art src={src} /></a>
        )}
        <a class="ma-card__meta" href={href}>
          <span class="ma-card__title">{title}</span>
          <span class="ma-card__band">{a.band_name}</span>
          {meta && <span class="ma-card__line" title={meta}>{meta}</span>}
        </a>
      </div>
    );
  };

  const topCard = () => {
    const top = results?.top;
    if (!top) return null;
    if (top.kind === 'band') {
      const b = top.band;
      return (
        <a class="ma-topres" href={b.href}>
          <span class="ma-topres__art"><Art src={b.cover} /></span>
          <span class="ma-topres__name">{b.name}</span>
          <span class="ma-topres__kind">Band<span class="ma-dot" aria-hidden="true">·</span>{plural(b.albums, 'album')}</span>
        </a>
      );
    }
    const a = top.album;
    const attrs = playAttrs(a);
    const title = displayTitle(a.album_title);
    return (
      <div class="ma-topres">
        {attrs ? (
          <button type="button" class="ma-topres__art ma-topres__play" aria-label={`Play ${title} by ${a.band_name}`} {...attrs}>
            <Art src={a.cover || a.thumb} />
            <span class="ma-arow__icon" aria-hidden="true"><Glyph /></span>
          </button>
        ) : (
          <span class="ma-topres__art"><Art src={a.cover || a.thumb} /></span>
        )}
        <a class="ma-topres__name ma-topres__link" href={`/metal-archive/album/${a.id}`}>{title}</a>
        <span class="ma-topres__kind">Album<span class="ma-dot" aria-hidden="true">·</span>{a.band_name}</span>
      </div>
    );
  };

  const chips = FILTERS.filter((k) => filters[k]).map((k) => (
    <li key={k}>
      <button type="button" class="ma-chip" onClick={() => removeFilter(k)} aria-label={`Remove the filter ${filterLabel(k, filters[k])}`}>
        {filterLabel(k, filters[k])}
        <Icon name="close" />
      </button>
    </li>
  ));

  // ─── Render ───────────────────────────────────────────────────────────────
  const waiting = mode !== 'empty' && !index;
  const listTitle = (() => {
    const set = FILTERS.filter((k) => filters[k]);
    if (set.length === 1 && set[0] !== 'release_type') return filterLabel(set[0], filters[set[0]]);
    return set.length ? 'Filtered albums' : 'All albums';
  })();

  return (
    <div class="ma-search-island" data-mode={mode} data-ready={ready ? '' : undefined}>
      <h1 class="ma-page-title">{mode === 'list' ? 'Browse' : 'Search'}</h1>
      <form class="ma-bigsearch" role="search" action="/metal-archive/browse" method="get" onSubmit={(e) => { e.preventDefault(); inputRef.current?.blur(); }}>
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={query}
          onInput={onInput}
          onFocus={loadIndex}
          placeholder="Bands, albums, genres, countries"
          aria-label="Search the archive"
          autocomplete="off"
          enterkeyhint="search"
        />
        {query && (
          <button type="button" class="ma-bigsearch__clear" onClick={clearQuery} aria-label="Clear the search">
            <Icon name="close" />
          </button>
        )}
      </form>

      <div class="ma-results" aria-live="polite">
        {waiting && !failed && <p class="ma-results__note">Loading the archive…</p>}
        {waiting && failed && <p class="ma-results__note">The archive could not be loaded. Check the connection and reload the page.</p>}

        {results && (() => {
          const { albums, bands, facets } = results;
          const n = shown || RESULTS_STEP;
          if (albums.length === 0 && bands.length === 0 && facets.length === 0) {
            return (
              <div class="ma-noresults">
                <p><b>No match for “{q}”.</b> Try a band, a genre or a country.</p>
              </div>
            );
          }
          return (
            <>
              {chips.length > 0 && <ul class="ma-chips">{chips}</ul>}
              {/* data-queue: a ▶ here plays these results in this order. */}
              <div class="ma-sres" data-queue data-from={`Search: ${q}`} data-from-href={`/metal-archive/browse?q=${encodeURIComponent(q)}`}>
                {results.top && (
                  <section class="ma-sres__top" aria-labelledby="top-h">
                    <h2 class="ma-sect__title" id="top-h">Top result</h2>
                    {topCard()}
                  </section>
                )}
                {albums.length > 0 && (
                  <section class="ma-sres__albums" aria-labelledby="alb-h">
                    <h2 class="ma-sect__title" id="alb-h">Albums <small>{albums.length.toLocaleString('en-US')}</small></h2>
                    <ol class="ma-arows ma-arows--results">{albums.slice(0, n).map(albumRow)}</ol>
                    {albums.length > n && (
                      <div class="search-load-more">
                        <button type="button" class="btn-load-more" onClick={() => showMore(RESULTS_STEP)}>
                          Show more ({(albums.length - n).toLocaleString('en-US')} remaining)
                        </button>
                      </div>
                    )}
                  </section>
                )}
              </div>
              {bands.length > 0 && (
                <section class="ma-sect ma-sres__bands" aria-labelledby="bands-h">
                  <h2 class="ma-sect__title" id="bands-h">Bands</h2>
                  <div class="ma-bgrid">
                    {bands.slice(0, 8).map((b) => (
                      <a key={b.name} class="ma-bcard" href={b.href}>
                        <span class="ma-bcard__art"><Art src={b.cover} /></span>
                        <span class="ma-bcard__name">{b.name}</span>
                        <span class="ma-bcard__sub">{plural(b.albums, 'album')}</span>
                      </a>
                    ))}
                  </div>
                </section>
              )}
              {facets.length > 0 && (
                <section class="ma-sect" aria-labelledby="fac-h">
                  <h2 class="ma-sect__title" id="fac-h">Genres and countries</h2>
                  <ul class="ma-pills">
                    {facets.slice(0, 16).map((f) => (
                      <li key={f.href}>
                        <a class="ma-pill" href={f.href}>
                          {f.flag && <span aria-hidden="true">{f.flag}</span>}
                          {f.label}
                          <small>{f.count.toLocaleString('en-US')}</small>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          );
        })()}

        {list && (() => {
          const n = shown || GRID_STEP;
          const from = `${listTitle}${sort ? ` · ${SORT_OPTIONS.find((o) => o.value === sort)?.label ?? ''}` : ''}`;
          return (
            <section class="ma-blist" aria-labelledby="list-h">
              <div class="ma-blist__head">
                <div>
                  <h2 class="ma-blist__title" id="list-h">{listTitle}</h2>
                  <p class="ma-blist__count">{plural(list.length, 'album')}{FILTERS.some((k) => filters[k]) ? '' : ` of ${total.toLocaleString('en-US')}`}</p>
                </div>
                <label class="ma-sort">
                  <span>Sort</span>
                  <select value={sort || 'newest'} onChange={onSort}>
                    {SORT_OPTIONS.map((o) => <option value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>
              {chips.length > 0 && <ul class="ma-chips">{chips}</ul>}
              {list.length === 0 ? (
                <p class="ma-noresults">No albums match these filters.</p>
              ) : (
                <div class="album-grid" data-queue data-from={from} data-from-href={typeof window === 'undefined' ? '/metal-archive/browse' : location.pathname + location.search}>
                  {list.slice(0, n).map(card)}
                </div>
              )}
              {list.length > n && (
                <div class="search-load-more">
                  <button type="button" class="btn-load-more" onClick={() => showMore(GRID_STEP)}>
                    Load more ({(list.length - n).toLocaleString('en-US')} remaining)
                  </button>
                </div>
              )}
            </section>
          );
        })()}
      </div>
    </div>
  );
}
