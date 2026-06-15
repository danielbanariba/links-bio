// Search island — all browse interactivity lives here.
//
// The full browse-index (~1298 entries) is fetched once on mount, then ALL
// filtering/sorting/pagination is done in memory. 1298 objects is trivial for
// the browser; no debounce needed for filters, only for the text input.
//
// URL query-string is synced on every state change so links are bookmarkable.
// On mount, URL params are read back to restore state (e.g. from Reflex links
// like /browse?genre=Death+Metal).

import { useState, useEffect, useMemo, useRef } from 'preact/hooks';

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
  // First 24 entries from the server-rendered pass — used to render
  // immediately before the full index download completes.
  initial: BrowseEntry[];
}

const PAGE_SIZE = 24;

// Sort keys mapped to UI labels. Logic keys off o.value (never the label),
// so translating the labels is safe and does not affect sorting behavior.
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'az',     label: 'A — Z' },
  { value: 'za',     label: 'Z — A' },
  { value: 'views',  label: 'Más vistos' },
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
// loop when called 1298x per keystroke because we avoid allocating new strings.
function contains(haystack: string | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle);
}

export default function Search({ genres, countries, years, totalCount, initial }: SearchProps) {
  // ─── Index state ──────────────────────────────────────────────────────────
  const [index, setIndex] = useState<BrowseEntry[]>(initial);
  const [indexLoaded, setIndexLoaded] = useState(false);

  // ─── Filter / sort state (initialised from URL on mount) ─────────────────
  const [query, setQuery]       = useState('');
  const [genre, setGenre]       = useState('');
  const [country, setCountry]   = useState('');
  const [year, setYear]         = useState('');
  const [releaseType, setRelType] = useState('');
  const [sort, setSort]         = useState('newest');

  // Pagination — page is reset on any filter/sort change.
  const [page, setPage] = useState(1);

  // Whether the user has ever interacted — we suppress the "no results" msg
  // while the index is still downloading and initial-data is showing.
  const [active, setActive] = useState(false);

  // Debounce ref for the text input.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Mount: read URL params + fetch full index ────────────────────────────
  useEffect(() => {
    // Restore URL state.
    const q  = qp('q');
    const g  = qp('genre');
    const c  = qp('country');
    const y  = qp('year');
    const rt = qp('release_type');
    const s  = qp('sort');
    if (q)  { setQuery(q);    setActive(true); }
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
        // If fetch fails, keep using the initial 24 entries.
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
  function onQueryInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(val);
      setActive(true);
    }, 300);
  }

  function handleGenre(e: Event)   { setGenre((e.target as HTMLSelectElement).value);   setActive(true); }
  function handleCountry(e: Event) { setCountry((e.target as HTMLSelectElement).value); setActive(true); }
  function handleYear(e: Event)    { setYear((e.target as HTMLSelectElement).value);    setActive(true); }
  function handleRelType(e: Event) { setRelType((e.target as HTMLSelectElement).value); setActive(true); }
  function handleSort(e: Event)    { setSort((e.target as HTMLSelectElement).value);    setActive(true); }

  // ─── Render ───────────────────────────────────────────────────────────────
  const showEmpty = active && indexLoaded && filtered.length === 0;
  // While the full index is downloading, hide the result count so it doesn't
  // flash "24 resultados" (initial data) then jump to the real number.
  const resultLabel = indexLoaded
    ? `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}`
    : '';

  return (
    <div class="search-island">
      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div class="search-controls">
        <div class="search-input-wrap">
          <input
            type="search"
            class="search-input"
            placeholder="Busca bandas, álbumes, géneros..."
            defaultValue={query}
            onInput={onQueryInput}
            aria-label="Buscar álbumes"
          />
        </div>

        <div class="search-filters">
          <select class="search-select" value={genre} onChange={handleGenre} aria-label="Filtrar por género">
            <option value="">Todos los géneros</option>
            {genres.map((g) => <option value={g}>{g}</option>)}
          </select>

          <select class="search-select" value={country} onChange={handleCountry} aria-label="Filtrar por país">
            <option value="">Todos los países</option>
            {countries.map((c) => <option value={c}>{c}</option>)}
          </select>

          <select class="search-select" value={year} onChange={handleYear} aria-label="Filtrar por año">
            <option value="">Todos los años</option>
            {years.map((y) => <option value={y}>{y}</option>)}
          </select>

          <select class="search-select" value={releaseType} onChange={handleRelType} aria-label="Filtrar por tipo de lanzamiento">
            <option value="">Todos los tipos</option>
            {releaseTypes.map((rt) => <option value={rt}>{rt}</option>)}
          </select>

          <select class="search-select" value={sort} onChange={handleSort} aria-label="Ordenar">
            {SORT_OPTIONS.map((o) => <option value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Result count ──────────────────────────────────────────────── */}
      {resultLabel && (
        <p class="search-result-count" aria-live="polite">{resultLabel}</p>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {showEmpty && (
        <p class="search-empty">No se encontraron álbumes con estos filtros.</p>
      )}

      {/* ── Album grid ────────────────────────────────────────────────── */}
      {!showEmpty && (
        <div class="album-grid search-grid">
          {visible.map((a) => (
            <a key={a.id} class="album-card" href={`/metal-archive/album/${a.id}`}>
              <div class="album-card__art">
                {a.thumb
                  ? (
                    <img
                      class="album-card__cover"
                      src={a.thumb}
                      alt={`${a.band_name} — ${a.album_title}`}
                      loading="lazy"
                      decoding="async"
                      width="400"
                      height="400"
                    />
                  )
                  : <div class="album-card__cover album-card__cover--empty" aria-hidden="true" />
                }
                <span class="album-card__open" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 17 17 7" />
                    <path d="M8 7h9v9" />
                  </svg>
                </span>
              </div>
              <div class="album-card__body">
                <div class="album-card__band">{a.band_name}</div>
                <div class="album-card__album">{a.album_title}</div>
                {(a.year || a.country) && (
                  <div class="album-card__meta">
                    {a.year && <span>{a.year}</span>}
                    {a.year && a.country && <span aria-hidden="true"> · </span>}
                    {a.country && <span>{a.country}</span>}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* ── Load more ─────────────────────────────────────────────────── */}
      {hasMore && (
        <div class="search-load-more">
          <button
            class="btn-load-more"
            onClick={() => setPage((p) => p + 1)}
          >
            Cargar más ({filtered.length - visible.length} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
